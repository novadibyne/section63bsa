import type { Certificate, Device, Evidence, EvidenceFile } from '@/lib/types';
import { toDMY } from '@/lib/time';
import { DEVICE_SOURCE_OPTIONS, emptyValues, type PartValues } from './schedule-63';
import { IDENTIFIER_LABEL } from './validators';

export interface CertificateContext {
  evidence: Evidence;
  files: EvidenceFile[];
  devices: Device[];
  cert: Certificate;
}

const MAX_INLINE_HASHES = 4;

function identifiersText(d: Device): string {
  return d.identifiers
    .filter((i) => i.value.trim())
    .map((i) => `${IDENTIFIER_LABEL[i.idType]} ${i.value.trim()}`)
    .join('; ');
}

function deviceSentence(d: Device, n: number): string {
  const cats = d.categories
    .map((c) => (c === 'other' && d.categoryOther ? d.categoryOther : DEVICE_SOURCE_OPTIONS.find((o) => o.key === c)?.label))
    .filter(Boolean)
    .join('/');
  const parts = [cats, d.makeModel, d.color && `colour ${d.color}`, d.serialNumber && `serial ${d.serialNumber}`, identifiersText(d)]
    .filter(Boolean)
    .join(', ');
  return `Device ${n}: ${parts}${d.otherInfo ? `; ${d.otherInfo}` : ''}`;
}

export function hashValuesText(files: EvidenceFile[], algo: Certificate['hashAlgo']): string {
  if (algo === 'other' || !files.length) return '';
  const list = files.map((f) => ({ name: f.originalFilename, hash: f[algo] }));
  if (list.length === 1) return list[0].hash;
  const shown = list.slice(0, MAX_INLINE_HASHES).map((x) => `${x.hash} (${x.name})`);
  const rest = list.length - shown.length;
  return `${shown.join('; ')}${rest > 0 ? `; and ${rest} more, as per the Hash Report annexed` : ''}`;
}

export function buildPartValues(part: 'A' | 'B', ctx: CertificateContext): PartValues {
  const v = emptyValues();
  const who = part === 'A' ? ctx.cert.partA : ctx.cert.partB;
  const [primary, ...others] = ctx.devices;

  v.fields.name = who.fullName;
  v.fields.relation = who.relationName;
  v.fields.address = who.addressOrEmployer;
  v.fields.date = toDMY(who.date);
  v.fields.time = who.time;
  v.fields.place = who.place;
  v.signatureLines = [who.fullName, part === 'B' ? ctx.cert.partB.designation : ''].map((x) => x?.trim()).filter(Boolean) as string[];

  for (const d of ctx.devices) d.categories.forEach((c) => v.boxes.device.add(c));
  v.fields.deviceOther = ctx.devices
    .filter((d) => d.categories.includes('other') && d.categoryOther)
    .map((d) => d.categoryOther)
    .join('; ');
  if (primary) {
    v.fields.makeModel = primary.makeModel;
    v.fields.color = primary.color;
    v.fields.serial = primary.serialNumber;
    v.fields.identifiers = identifiersText(primary);
  }
  const other = [primary?.otherInfo, ...others.map((d, i) => deviceSentence(d, i + 2))].filter(Boolean).join('. ');
  v.fields.otherInfo = other;

  if (part === 'A') ctx.cert.partA.control.forEach((c) => v.boxes.control.add(c));
  v.boxes.algo.add(ctx.cert.hashAlgo);
  v.fields.hashValues = hashValuesText(ctx.files, ctx.cert.hashAlgo);
  if (ctx.cert.hashAlgo === 'other') v.fields.algoOther = ctx.cert.hashAlgoOther;
  return v;
}

export interface Issue {
  step: number;
  message: string;
}

/** Things the user still needs to fill before the certificate is complete. */
export function findIssues(ctx: Omit<CertificateContext, 'cert'> & { cert?: Certificate }): Issue[] {
  const issues: Issue[] = [];
  const { evidence, files, devices, cert } = ctx;
  if (!files.length) issues.push({ step: 1, message: 'Add at least one evidence file' });
  if (!evidence.mannerOfProduction?.trim()) issues.push({ step: 1, message: 'Describe how the record was produced (s.63(4)(a))' });
  if (!devices.length || !devices[0].categories.length) issues.push({ step: 2, message: 'Tick at least one device / source type' });
  if (devices[0] && !devices[0].makeModel?.trim() && !devices[0].categories.includes('cloud'))
    issues.push({ step: 2, message: 'Enter the device make & model' });
  if (!cert) return issues;
  const a = cert.partA;
  if (!a.fullName.trim()) issues.push({ step: 3, message: 'Part A: party’s name' });
  if (!a.relationName.trim()) issues.push({ step: 3, message: 'Part A: son/daughter/spouse of' });
  if (!a.addressOrEmployer.trim()) issues.push({ step: 3, message: 'Part A: residing/employed at' });
  if (!a.control.length) issues.push({ step: 3, message: 'Part A: owned / maintained / managed / operated' });
  if (!cert.declarationAcknowledgedAt) issues.push({ step: 3, message: 'Part A: acknowledge the declaration' });
  if (!a.place.trim()) issues.push({ step: 3, message: 'Part A: place' });
  const b = cert.partB;
  if (!b.fullName.trim()) issues.push({ step: 4, message: 'Part B: expert’s name' });
  if (!b.relationName.trim()) issues.push({ step: 4, message: 'Part B: son/daughter/spouse of' });
  if (!b.addressOrEmployer.trim()) issues.push({ step: 4, message: 'Part B: residing/employed at' });
  if (!b.designation.trim()) issues.push({ step: 4, message: 'Part B: designation' });
  if (!b.place.trim()) issues.push({ step: 4, message: 'Part B: place' });
  return issues;
}
