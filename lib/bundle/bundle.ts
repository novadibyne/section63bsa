import { db } from '@/lib/db';
import { appendAudit } from '@/lib/audit/append';
import { sha256Bytes } from '@/lib/evidence/hash-core';
import { nowIso } from '@/lib/time';
import { downloadBlob, safeFilename } from '@/lib/utils';
import type { AuditEvent, Certificate, Device, Evidence, EvidenceFile, StoredPdf } from '@/lib/types';
import { crossObservations } from '@/lib/evidence/observations/cross';
import { OBSERVATIONS_NOTICE } from '@/lib/evidence/observations/types';

export const BUNDLE_FORMAT = 'section63bsa-case-bundle';

interface Manifest {
  format: typeof BUNDLE_FORMAT;
  formatVersion: 1;
  exportedAt: string;
  evidence: Evidence;
  files: EvidenceFile[];
  devices: Device[];
  certificates: Certificate[];
  pdfs: { certificateId: string; path: string; sha256: string; final: boolean }[];
}

export async function exportBundle(evidenceId: string) {
  const { default: JSZip } = await import('jszip');
  const evidence = await db.evidence.get(evidenceId);
  if (!evidence) throw new Error('Evidence not found');
  const files = await db.files.where('evidenceId').equals(evidenceId).toArray();
  const devices = await db.devices.where('evidenceId').equals(evidenceId).toArray();
  const certificates = await db.certificates.where('evidenceId').equals(evidenceId).toArray();
  const audit: AuditEvent[] = await db.auditEvents.where('evidenceId').equals(evidenceId).sortBy('seq');

  const zip = new JSZip();
  const sums: string[] = [];
  const add = async (path: string, data: Uint8Array) => {
    zip.file(path, data);
    sums.push(`${await sha256Bytes(data)}  ${path}`);
  };

  for (const f of files) {
    const blob = (await db.blobs.get(f.id))?.blob;
    if (blob) await add(`files/${f.id}/${safeFilename(f.originalFilename)}`, new Uint8Array(await blob.arrayBuffer()));
  }
  const pdfs: Manifest['pdfs'] = [];
  for (const c of certificates) {
    const p = await db.pdfs.get(c.id);
    if (!p) continue;
    const path = `certificates/${c.id}-v${c.version}${p.final ? '' : '-draft'}.pdf`;
    await add(path, new Uint8Array(await p.blob.arrayBuffer()));
    pdfs.push({ certificateId: c.id, path, sha256: p.sha256, final: p.final });
  }
  const manifest: Manifest = { format: BUNDLE_FORMAT, formatVersion: 1, exportedAt: nowIso(), evidence, files, devices, certificates, pdfs };
  const enc = new TextEncoder();
  await add('manifest.json', enc.encode(JSON.stringify(manifest, null, 2)));
  await add('audit.json', enc.encode(JSON.stringify(audit, null, 2)));
  // The file observations on their own, for an examiner (also inside manifest.json with each file).
  const observations = {
    notice: OBSERVATIONS_NOTICE,
    files: files.map((f) => ({
      fileId: f.id,
      name: f.originalFilename,
      sha256: f.sha256,
      rules: f.observations?.rules,
      checkedAt: f.observations?.checkedAt,
      observations: f.observations ? [...f.observations.items, ...crossObservations(f, files, devices[0])] : null,
    })),
  };
  await add('observations.json', enc.encode(JSON.stringify(observations, null, 2)));
  zip.file('SHA256SUMS.txt', `${sums.join('\n')}\n`);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const name = `${safeFilename(evidence.title)}_case_bundle.zip`;
  downloadBlob(blob, name);
  await appendAudit('bundle.export', {
    evidenceId,
    details: { name, fileCount: files.length, storedCopies: sums.filter((s) => s.includes('  files/')).length },
  });
}

export interface ImportResult {
  ok: boolean;
  evidenceId?: string;
  title?: string;
  message: string;
  verified: number;
}

export async function importBundle(file: File): Promise<ImportResult> {
  const { default: JSZip } = await import('jszip');
  const fail = async (message: string): Promise<ImportResult> => {
    await appendAudit('bundle.import', { details: { name: file.name, ok: false, message } });
    return { ok: false, message, verified: 0 };
  };

  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return fail('Not a valid .zip file');
  }
  const sumsText = await zip.file('SHA256SUMS.txt')?.async('string');
  const manifestText = await zip.file('manifest.json')?.async('string');
  if (!sumsText || !manifestText) return fail('This is not a case bundle (manifest or SHA256SUMS.txt missing)');

  // 1. Every file listed in SHA256SUMS.txt must match.
  let verified = 0;
  for (const line of sumsText.split('\n').filter(Boolean)) {
    const m = /^([0-9a-f]{64})\s+(.+)$/.exec(line.trim());
    if (!m) return fail(`Malformed line in SHA256SUMS.txt: ${line}`);
    const entry = zip.file(m[2]);
    if (!entry) return fail(`Missing from bundle: ${m[2]}`);
    const got = await sha256Bytes(await entry.async('uint8array'));
    if (got !== m[1]) return fail(`Hash mismatch for ${m[2]}. The bundle has been altered or is corrupt.`);
    verified++;
  }

  const manifest = JSON.parse(manifestText) as Manifest;
  if (manifest.format !== BUNDLE_FORMAT) return fail('Unknown bundle format');
  if (await db.evidence.get(manifest.evidence.id)) {
    return fail(`“${manifest.evidence.title}” already exists in this browser. Delete it first to re-import.`);
  }

  // 2. Every stored evidence file must match the hash recorded when it was added.
  const blobs: { fileId: string; blob: Blob }[] = [];
  for (const f of manifest.files) {
    const entry = zip.file(`files/${f.id}/${safeFilename(f.originalFilename)}`);
    if (!entry) continue;
    const bytes = await entry.async('uint8array');
    if ((await sha256Bytes(bytes)) !== f.sha256) return fail(`${f.originalFilename} does not match its recorded SHA-256`);
    blobs.push({ fileId: f.id, blob: new Blob([bytes as BlobPart], { type: f.detectedMime || f.declaredMime || '' }) });
  }
  const pdfRows: StoredPdf[] = [];
  for (const p of manifest.pdfs) {
    const entry = zip.file(p.path);
    if (!entry) continue;
    const bytes = await entry.async('uint8array');
    pdfRows.push({ certificateId: p.certificateId, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), sha256: p.sha256, final: p.final, createdAt: nowIso() });
  }

  await db.transaction('rw', [db.evidence, db.files, db.blobs, db.devices, db.certificates, db.pdfs], async () => {
    await db.evidence.add(manifest.evidence);
    await db.files.bulkAdd(manifest.files.map((f) => ({ ...f, blobStored: blobs.some((b) => b.fileId === f.id) })));
    await db.blobs.bulkPut(blobs);
    await db.devices.bulkAdd(manifest.devices);
    await db.certificates.bulkAdd(manifest.certificates);
    await db.pdfs.bulkPut(pdfRows);
  });
  await appendAudit('bundle.import', {
    evidenceId: manifest.evidence.id,
    details: { name: file.name, ok: true, verifiedEntries: verified, exportedAt: manifest.exportedAt },
  });
  return { ok: true, evidenceId: manifest.evidence.id, title: manifest.evidence.title, message: 'Imported and verified', verified };
}
