// What kind of certificate a PDF is, for the usage statistics: parts, kinds of evidence and devices, and counts.
// Only values from fixed lists, numbers and yes/no go in. Never names, addresses, file names, hashes, IMEI or
// serial numbers, case numbers, court names or any other text typed into the app.
import { makerOf } from '@/lib/device-scan/parse';
import type { Labels } from '@/lib/telemetry';
import { findIssues, type CertificateContext } from './certificate-values';
import { hasPart, partsOf } from './parts';

/** Kinds of court, matched in the court name typed in step 1; only the kind is sent. Checked in order. */
const COURT_TYPES: [RegExp, string][] = [
  [/supreme\s*court/i, 'supreme_court'],
  [/high\s*court/i, 'high_court'],
  [/family/i, 'family_court'],
  [/consumer|commission/i, 'consumer_commission'],
  [/tribunal|\b(?:NCLT|NCLAT|DRT|MACT|CAT|ITAT)\b/i, 'tribunal'],
  [/arbitra/i, 'arbitration'],
  [/sessions/i, 'sessions_court'],
  [/magistrate|\b(?:CJM|JMFC|ACJM|MM)\b/i, 'magistrate'],
  [/civil|munsif|\bsub[\s-]*judge|small\s*causes/i, 'civil_court'],
  [/district/i, 'district_court'],
  [/commercial/i, 'commercial_court'],
  [/special|\b(?:POCSO|NDPS|CBI|PMLA)\b/i, 'special_court'],
];

export function courtType(courtName: string | undefined): string {
  if (!courtName?.trim()) return 'not_given';
  return COURT_TYPES.find(([re]) => re.test(courtName))?.[1] ?? 'other';
}

/** Values from a fixed list, sorted and joined, e.g. "image+whatsapp_export". */
function list(values: string[]): string {
  const joined = [...new Set(values)].sort().join('+');
  return !joined ? 'none' : joined.length > 64 ? 'several' : joined;
}

export function certificateLabels(ctx: CertificateContext): Labels {
  const { evidence, files, devices, cert } = ctx;
  const acquisition = files.filter((f) => f.acquisitionHash);
  return {
    // The random ID the browser gave the certificate, so its drafts and final PDF count as one certificate.
    certificate_id: cert.id,
    parts: partsOf(cert),
    version: cert.version,
    evidence_type: evidence.evidenceType,
    file_count: files.length,
    file_kinds: list(files.map((f) => f.kind)),
    archive_files: files.reduce((n, f) => n + (f.members?.length ?? 0), 0),
    total_kb: Math.round(files.reduce((n, f) => n + f.sizeBytes, 0) / 1024),
    device_count: devices.length,
    device_types: list(devices.flatMap((d) => d.categories)),
    device_makers: list(devices.map((d) => (d.makeModel?.trim() ? (makerOf(d.makeModel) ?? 'other') : 'not_given'))),
    id_types: list(devices.flatMap((d) => d.identifiers.filter((i) => i.value.trim()).map((i) => i.idType))),
    control: hasPart(cert, 'A') ? list(cert.partA.control) : undefined,
    court_type: courtType(evidence.courtName),
    case_number_given: !!evidence.caseNumber?.trim(),
    manner_given: !!evidence.mannerOfProduction?.trim(),
    acquisition_hash: !acquisition.length ? 'none' : acquisition.every((f) => f.acquisitionHashMatch) ? 'match' : 'differs',
    observations_annexure: !!cert.includeObservations,
    observations_noted: files.reduce((n, f) => n + (f.observations?.items.filter((i) => i.status === 'noted').length ?? 0), 0),
    complete: findIssues(ctx).length === 0,
  };
}
