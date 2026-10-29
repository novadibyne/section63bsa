import { db, getSetting, setSetting } from './db';
import { appendAudit } from './audit/append';
import { detectFile } from './evidence/detect';
import { hashFile, isSha256Hex, normaliseHash } from './evidence/hashing';
import { sha256Bytes } from './evidence/hash-core';
import { extractMetadata } from './evidence/metadata';
import { istDateInput, istTimeInput, nowIso } from './time';
import { downloadBlob, newId, safeFilename } from './utils';
import type { CertificateContext } from './legal/certificate-values';
import type { Certificate, Device, Evidence, EvidenceFile, PartA, PartB, ProfileDefaults } from './types';

export const UNTITLED = 'Untitled evidence';

/* ───────────────────────── Evidence ───────────────────────── */

export async function createEvidence(): Promise<string> {
  const now = nowIso();
  const ev: Evidence = { id: newId(), title: UNTITLED, evidenceType: 'other', status: 'draft', createdAt: now, updatedAt: now };
  await db.evidence.add(ev);
  await appendAudit('evidence.create', { evidenceId: ev.id, details: { title: ev.title } });
  return ev.id;
}

export async function updateEvidence(id: string, patch: Partial<Evidence>) {
  await db.evidence.update(id, { ...patch, updatedAt: nowIso() });
}

export async function logEvidenceUpdate(id: string, fields: string[]) {
  await appendAudit('evidence.update', { evidenceId: id, details: { fields } });
}

export async function deleteEvidence(id: string) {
  const ev = await db.evidence.get(id);
  const files = await db.files.where('evidenceId').equals(id).toArray();
  const certs = await db.certificates.where('evidenceId').equals(id).toArray();
  await db.transaction('rw', [db.evidence, db.files, db.blobs, db.devices, db.certificates, db.pdfs], async () => {
    await db.blobs.bulkDelete(files.map((f) => f.id));
    await db.files.where('evidenceId').equals(id).delete();
    await db.devices.where('evidenceId').equals(id).delete();
    await db.pdfs.bulkDelete(certs.map((c) => c.id));
    await db.certificates.where('evidenceId').equals(id).delete();
    await db.evidence.delete(id);
  });
  await appendAudit('evidence.delete', { evidenceId: id, details: { title: ev?.title, fileCount: files.length } });
}

/* ───────────────────────── Files ───────────────────────── */

export type AddStage = 'queued' | 'detecting' | 'hashing' | 'reading' | 'saving' | 'done' | 'error';
export interface AddProgress {
  stage: AddStage;
  progress?: number;
  error?: string;
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | undefined> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : undefined;
  } catch {
    return undefined;
  }
}

export async function addFile(
  evidenceId: string,
  file: File,
  keepCopy: boolean,
  onProgress: (p: AddProgress) => void,
): Promise<EvidenceFile> {
  const fileId = newId();
  onProgress({ stage: 'detecting' });
  const det = await detectFile(file);
  await appendAudit('file.add', {
    evidenceId,
    details: { fileId, name: file.name, sizeBytes: file.size, detectedMime: det.detectedMime, kind: det.kind },
  });

  onProgress({ stage: 'hashing', progress: 0 });
  const hashes = await hashFile(file, (p) => onProgress({ stage: 'hashing', progress: p }));
  const hashedAt = nowIso();
  await appendAudit('file.hash', { evidenceId, details: { fileId, name: file.name, ...hashes } });

  onProgress({ stage: 'reading' });
  const { metadata, members } = await extractMetadata(file, det);

  onProgress({ stage: 'saving' });
  const record: EvidenceFile = {
    id: fileId,
    evidenceId,
    originalFilename: file.name,
    declaredMime: file.type || undefined,
    detectedMime: det.detectedMime,
    detectedExt: det.detectedExt,
    kind: det.kind,
    sizeBytes: file.size,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
    ...hashes,
    hashedAt,
    metadata,
    members,
    blobStored: keepCopy,
    addedAt: nowIso(),
  };
  const ev = await db.evidence.get(evidenceId);
  const existing = await db.files.where('evidenceId').equals(evidenceId).count();
  await db.transaction('rw', [db.files, db.blobs, db.evidence], async () => {
    await db.files.add(record);
    if (keepCopy) await db.blobs.put({ fileId, blob: file });
    const patch: Partial<Evidence> = { updatedAt: nowIso() };
    if (ev?.status === 'draft') patch.status = 'hashed';
    if (!existing) patch.evidenceType = det.kind;
    if (ev?.title === UNTITLED) patch.title = suggestTitle(record);
    await db.evidence.update(evidenceId, patch);
  });
  if (keepCopy) void requestPersistentStorage();
  onProgress({ stage: 'done', progress: 1 });
  return record;
}

function suggestTitle(f: EvidenceFile): string {
  const chat = f.metadata.chat as { participants?: string[] } | undefined;
  if (f.kind === 'whatsapp_export' && chat?.participants?.length) {
    return `WhatsApp chat — ${chat.participants.slice(0, 3).join(', ')}`;
  }
  return f.originalFilename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || UNTITLED;
}

export async function removeFile(fileId: string) {
  const f = await db.files.get(fileId);
  if (!f) return;
  await db.transaction('rw', [db.files, db.blobs], async () => {
    await db.files.delete(fileId);
    await db.blobs.delete(fileId);
  });
  await appendAudit('file.remove', { evidenceId: f.evidenceId, details: { fileId, name: f.originalFilename, sha256: f.sha256 } });
}

export async function getFileBlob(fileId: string): Promise<Blob | undefined> {
  return (await db.blobs.get(fileId))?.blob;
}

export async function reverifyFile(fileId: string, source?: File, onProgress?: (p: number) => void) {
  const f = await db.files.get(fileId);
  if (!f) throw new Error('File not found');
  const blob = source ?? (await getFileBlob(fileId));
  if (!blob) throw new Error('No stored copy. Select the original file to re-verify.');
  const h = await hashFile(blob, onProgress);
  const match = h.sha256 === f.sha256;
  await db.files.update(fileId, { lastVerifiedAt: nowIso(), lastVerifiedMatch: match });
  await appendAudit('file.reverify', {
    evidenceId: f.evidenceId,
    details: { fileId, name: f.originalFilename, match, sha256: h.sha256, source: source ? 'selected file' : 'stored copy' },
  });
  return { match, ...h };
}

export async function setAcquisitionHash(fileId: string, value: string) {
  const f = await db.files.get(fileId);
  if (!f) return;
  const norm = normaliseHash(value);
  if (!norm) {
    await db.files.update(fileId, { acquisitionHash: undefined, acquisitionHashAlgo: undefined, acquisitionHashMatch: undefined });
    return;
  }
  if (!isSha256Hex(norm)) return { valid: false, match: false };
  const match = f.sha256 === norm;
  await db.files.update(fileId, { acquisitionHash: norm, acquisitionHashAlgo: 'sha256', acquisitionHashMatch: match });
  await appendAudit('file.acquisition_hash', { evidenceId: f.evidenceId, details: { fileId, match } });
  return { valid: true, match };
}

/* ───────────────────────── Devices ───────────────────────── */

export function blankDevice(evidenceId: string): Device {
  return { id: newId(), evidenceId, categories: [], identifiers: [{ idType: 'imei', value: '' }], createdAt: nowIso() };
}

export async function saveDevice(d: Device) {
  await db.devices.put(d);
}

export async function removeDevice(d: Device) {
  await db.devices.delete(d.id);
  await appendAudit('device.remove', { evidenceId: d.evidenceId, details: { deviceId: d.id } });
}

/** Records that IDs were read from a photo. The photo itself is never stored. */
export async function logDeviceScan(evidenceId: string, imeiCount: number, serialFound: boolean) {
  const what = [imeiCount && `${imeiCount} IMEI${imeiCount === 1 ? '' : 's'}`, serialFound && 'serial number'].filter(Boolean).join(' and ');
  await appendAudit('device.scan', {
    evidenceId,
    details: { imeiCount, serialFound, message: `${what || 'Nothing'} used; photo not kept` },
  });
}

export async function logDevicesSaved(evidenceId: string) {
  const n = await db.devices.where('evidenceId').equals(evidenceId).count();
  await appendAudit('device.save', { evidenceId, details: { deviceCount: n } });
}

/* ───────────────────────── Profiles ───────────────────────── */

export async function getProfileDefaults(): Promise<ProfileDefaults> {
  return getSetting<ProfileDefaults>('profiles', { party: {}, expert: {} });
}

export async function saveProfileDefaults(p: ProfileDefaults) {
  await setSetting('profiles', p);
}

/* ───────────────────────── Certificates ───────────────────────── */

function freshPartA(base?: Partial<PartA>): PartA {
  return {
    fullName: base?.fullName ?? '',
    relationName: base?.relationName ?? '',
    addressOrEmployer: base?.addressOrEmployer ?? '',
    place: base?.place ?? '',
    control: base?.control ?? [],
    date: istDateInput(),
    time: istTimeInput(),
  };
}

function freshPartB(base?: Partial<PartB>): PartB {
  return {
    fullName: base?.fullName ?? '',
    relationName: base?.relationName ?? '',
    addressOrEmployer: base?.addressOrEmployer ?? '',
    designation: base?.designation ?? '',
    qualification: base?.qualification ?? '',
    place: base?.place ?? '',
    date: istDateInput(),
    time: istTimeInput(),
  };
}

export async function latestCertificate(evidenceId: string): Promise<Certificate | undefined> {
  return db.certificates.where('[evidenceId+version]').between([evidenceId, 0], [evidenceId, Infinity]).last();
}

export async function createCertificateVersion(evidenceId: string): Promise<Certificate> {
  const prev = await latestCertificate(evidenceId);
  const defaults = await getProfileDefaults();
  const now = nowIso();
  const cert: Certificate = {
    id: newId(),
    evidenceId,
    version: (prev?.version ?? 0) + 1,
    scheduleVersion: 'BSA-2023-original',
    partA: freshPartA(prev?.partA ?? defaults.party),
    partB: freshPartB(prev?.partB ?? defaults.expert),
    hashAlgo: 'sha256',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await db.certificates.add(cert);
  await appendAudit('certificate.create', { evidenceId, certificateId: cert.id, details: { version: cert.version } });
  return cert;
}

const inflight = new Map<string, Promise<Certificate>>();

/** Returns the latest certificate version, creating version 1 if there is none yet. */
export function ensureDraftCertificate(evidenceId: string): Promise<Certificate> {
  const running = inflight.get(evidenceId);
  if (running) return running;
  const p = (async () => (await latestCertificate(evidenceId)) ?? createCertificateVersion(evidenceId))().finally(() =>
    inflight.delete(evidenceId),
  );
  inflight.set(evidenceId, p);
  return p;
}

export async function updateCertificate(id: string, patch: Partial<Certificate>) {
  const c = await db.certificates.get(id);
  if (!c) throw new Error('Certificate not found');
  if (c.status === 'finalised') throw new Error('This version is finalised and cannot be edited');
  await db.certificates.update(id, { ...patch, updatedAt: nowIso() });
}

export async function loadContext(certId: string): Promise<CertificateContext> {
  const cert = await db.certificates.get(certId);
  if (!cert) throw new Error('Certificate not found');
  const evidence = await db.evidence.get(cert.evidenceId);
  if (!evidence) throw new Error('Evidence not found');
  const files = await db.files.where('evidenceId').equals(evidence.id).sortBy('addedAt');
  const devices = await db.devices.where('evidenceId').equals(evidence.id).sortBy('createdAt');
  return { evidence, files, devices, cert };
}

async function render(ctx: CertificateContext, draft: boolean): Promise<{ blob: Blob; sha256: string }> {
  const { renderCertificatePdf } = await import('./pdf/render');
  const blob = await renderCertificatePdf(ctx, { draft });
  const sha256 = await sha256Bytes(new Uint8Array(await blob.arrayBuffer()));
  return { blob, sha256 };
}

export async function generateDraftPdf(certId: string): Promise<{ blob: Blob; sha256: string }> {
  const ctx = await loadContext(certId);
  const out = await render(ctx, ctx.cert.status !== 'finalised');
  await db.pdfs.put({ certificateId: certId, blob: out.blob, sha256: out.sha256, final: false, createdAt: nowIso() });
  await db.certificates.update(certId, { generatedAt: nowIso() });
  if (ctx.evidence.status !== 'finalised') await db.evidence.update(ctx.evidence.id, { status: 'certificate_drafted', updatedAt: nowIso() });
  await appendAudit('certificate.generate', {
    evidenceId: ctx.evidence.id,
    certificateId: certId,
    details: { version: ctx.cert.version, pdfSha256: out.sha256, draft: true },
  });
  return out;
}

export async function finaliseCertificate(certId: string): Promise<{ blob: Blob; sha256: string }> {
  const ctx = await loadContext(certId);
  if (ctx.cert.status === 'finalised') throw new Error('Already finalised');
  const finalisedAt = nowIso();
  const out = await render({ ...ctx, cert: { ...ctx.cert, status: 'finalised', finalisedAt } }, false);
  await db.transaction('rw', [db.pdfs, db.certificates, db.evidence], async () => {
    await db.pdfs.put({ certificateId: certId, blob: out.blob, sha256: out.sha256, final: true, createdAt: finalisedAt });
    await db.certificates.update(certId, { status: 'finalised', pdfSha256: out.sha256, finalisedAt, updatedAt: finalisedAt });
    await db.evidence.update(ctx.evidence.id, { status: 'finalised', updatedAt: finalisedAt });
  });
  await appendAudit('certificate.finalise', {
    evidenceId: ctx.evidence.id,
    certificateId: certId,
    details: { version: ctx.cert.version, pdfSha256: out.sha256 },
  });
  return out;
}

export function pdfFilename(evidence: Evidence, cert: Certificate, final: boolean) {
  return `${safeFilename(evidence.title)}_s63_certificate_v${cert.version}${final ? '' : '_DRAFT'}.pdf`;
}

export async function downloadCertificatePdf(certId: string) {
  let stored = await db.pdfs.get(certId);
  if (!stored) {
    await generateDraftPdf(certId);
    stored = await db.pdfs.get(certId);
  }
  const ctx = await loadContext(certId);
  downloadBlob(stored!.blob, pdfFilename(ctx.evidence, ctx.cert, stored!.final));
  await appendAudit('certificate.download', {
    evidenceId: ctx.evidence.id,
    certificateId: certId,
    details: { version: ctx.cert.version, final: stored!.final, pdfSha256: stored!.sha256 },
  });
}

/** Downloads the PDF as it stands now: the stored final PDF, or a draft rebuilt from the latest details. */
export async function downloadLatestPdf(certId: string) {
  const cert = await db.certificates.get(certId);
  if (cert && cert.status !== 'finalised') await generateDraftPdf(certId);
  await downloadCertificatePdf(certId);
}

/* ───────────────────────── Maintenance ───────────────────────── */

export async function clearAllData() {
  await db.transaction(
    'rw',
    [db.evidence, db.files, db.blobs, db.devices, db.certificates, db.pdfs, db.auditEvents],
    async () => {
      await Promise.all([
        db.evidence.clear(),
        db.files.clear(),
        db.blobs.clear(),
        db.devices.clear(),
        db.certificates.clear(),
        db.pdfs.clear(),
        db.auditEvents.clear(),
      ]);
    },
  );
  await appendAudit('data.clear', { details: { note: 'All evidence, certificates and the previous audit log were cleared' } });
}
