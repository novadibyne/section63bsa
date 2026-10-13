/**
 * THE SCHEDULE [See section 63(4)(c)] — CERTIFICATE, Bharatiya Sakshya Adhiniyam, 2023.
 *
 * This is the single source of the statutory wording. It is reproduced word for word and must
 * never be paraphrased or generated. The PDF, the on-screen preview and the unit test that
 * compares it with docs/SPECIFICATION.md §2.3 all read from here.
 *
 * Verify punctuation and layout against the official India Code text before production use:
 * https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf
 */
import type { ControlType, DeviceCategory } from '@/lib/types';

export const SCHEDULE_VERSION = 'BSA-2023-original' as const;

export const SCHEDULE_HEADING = ['THE SCHEDULE', '[See section 63(4)(c)]', 'CERTIFICATE'] as const;

export const BLANK = '________';

export type FieldKey =
  | 'name'
  | 'relation'
  | 'address'
  | 'deviceOther'
  | 'makeModel'
  | 'color'
  | 'serial'
  | 'identifiers'
  | 'otherInfo'
  | 'hashValues'
  | 'algoOther'
  | 'date'
  | 'time'
  | 'place';

export type BoxGroup = 'device' | 'control' | 'algo';

export type Seg =
  | string
  | { field: FieldKey; blank?: string; lead?: string }
  | { box: BoxGroup; key: string; label: string }
  | { signature: string };

export type Line = Seg[];
export type Paragraph = Line[];

export interface SchedulePart {
  id: 'A' | 'B';
  title: string;
  subtitle: string;
  paragraphs: Paragraph[];
}

export const DEVICE_SOURCE_OPTIONS: { key: DeviceCategory; label: string }[] = [
  { key: 'computer_storage_media', label: 'Computer / Storage Media' },
  { key: 'dvr', label: 'DVR' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'flash_drive', label: 'Flash Drive' },
  { key: 'cd_dvd', label: 'CD/DVD' },
  { key: 'server', label: 'Server' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'other', label: 'Other' },
];

export const CONTROL_OPTIONS: { key: ControlType; label: string }[] = [
  { key: 'owned', label: 'Owned' },
  { key: 'maintained', label: 'Maintained' },
  { key: 'managed', label: 'Managed' },
  { key: 'operated', label: 'Operated' },
];

const f = (field: FieldKey, extra?: { blank?: string; lead?: string }): Seg => ({ field, ...extra });
const box = (group: BoxGroup, key: string, label: string): Seg => ({ box: group, key, label });
const GAP = '   ';

const deviceLabel = (k: DeviceCategory) => DEVICE_SOURCE_OPTIONS.find((o) => o.key === k)!.label;

const INTRO: Paragraph = [
  [
    'I, ',
    f('name'),
    ' (Name), Son/daughter/spouse of ',
    f('relation'),
    ' residing/employed at ',
    f('address'),
    ' do hereby solemnly affirm and sincerely state and submit as follows:—',
  ],
];

const DEVICE_TICKS: Paragraph = [
  [
    box('device', 'computer_storage_media', deviceLabel('computer_storage_media')),
    GAP,
    box('device', 'dvr', deviceLabel('dvr')),
    GAP,
    box('device', 'mobile', deviceLabel('mobile')),
    GAP,
    box('device', 'flash_drive', deviceLabel('flash_drive')),
  ],
  [
    box('device', 'cd_dvd', deviceLabel('cd_dvd')),
    GAP,
    box('device', 'server', deviceLabel('server')),
    GAP,
    box('device', 'cloud', deviceLabel('cloud')),
    GAP,
    box('device', 'other', deviceLabel('other')),
  ],
  ['Other: ', f('deviceOther')],
];

const DEVICE_DETAILS: Paragraph = [
  ['Make & Model: ', f('makeModel'), `${GAP}Color: `, f('color')],
  ['Serial Number: ', f('serial')],
  ['IMEI/UIN/UID/MAC/Cloud ID ', f('identifiers'), ' (as applicable)'],
  ['and any other relevant information, if any, about the device/digital record ', f('otherInfo'), ' (specify).'],
];

export const LAWFUL_CONTROL_DECLARATION =
  'The digital device or the digital record source was under the lawful control for regularly creating, storing or processing information for the purposes of carrying out regular activities and during this period, the computer or the communication device was working properly and the relevant information was regularly fed into the computer during the ordinary course of business. If the computer/digital device at any point of time was not working properly or out of operation, then it has not affected the electronic/digital record or its accuracy. The digital device or the source of the digital record is:—';

const CONTROL: Paragraph = [
  [
    box('control', 'owned', 'Owned'),
    GAP,
    box('control', 'maintained', 'Maintained'),
    GAP,
    box('control', 'managed', 'Managed'),
    GAP,
    box('control', 'operated', 'Operated'),
  ],
  ['by me (select as applicable).'],
];

const HASH: Paragraph = [
  ['I state that the HASH value/s of the electronic/digital record/s is ', f('hashValues'), ', obtained through the following algorithm:—'],
  [box('algo', 'sha1', 'SHA1:')],
  [box('algo', 'sha256', 'SHA256:')],
  [box('algo', 'md5', 'MD5:')],
  ['Other ', f('algoOther'), ' (Legally acceptable standard)'],
];

const HASH_REPORT_NOTE: Paragraph = [['(Hash report to be enclosed with the certificate)']];

const signOff = (signatureLabel: string): Paragraph => [
  [{ signature: signatureLabel }],
  ['Date (DD/MM/YYYY):', f('date', { blank: '', lead: ' ' })],
  ['Time (IST): ', f('time'), ' hours (In 24 hours format)'],
  ['Place:', f('place', { blank: '', lead: ' ' })],
];

export const PART_A: SchedulePart = {
  id: 'A',
  title: 'PART A',
  subtitle: '(To be filled by the Party)',
  paragraphs: [
    INTRO,
    [['I have produced electronic record/output of the digital record taken from the following device/digital record source (tick mark):—']],
    DEVICE_TICKS,
    DEVICE_DETAILS,
    [[LAWFUL_CONTROL_DECLARATION]],
    CONTROL,
    HASH,
    HASH_REPORT_NOTE,
    signOff('(Name and signature)'),
  ],
};

export const PART_B: SchedulePart = {
  id: 'B',
  title: 'PART B',
  subtitle: '(To be filled by the Expert)',
  paragraphs: [
    INTRO,
    [['The produced electronic record/output of the digital record are obtained from the following device/digital record source (tick mark):—']],
    DEVICE_TICKS,
    DEVICE_DETAILS,
    HASH,
    HASH_REPORT_NOTE,
    signOff('(Name, designation and signature)'),
  ],
};

export interface PartValues {
  fields: Partial<Record<FieldKey, string>>;
  boxes: Record<BoxGroup, Set<string>>;
  /** Printed under the signature line, e.g. name (and designation for Part B). */
  signatureLines?: string[];
}

export function emptyValues(): PartValues {
  return { fields: {}, boxes: { device: new Set(), control: new Set(), algo: new Set() } };
}

export function renderSegPlain(seg: Seg, values?: PartValues): string {
  if (typeof seg === 'string') return seg;
  if ('field' in seg) {
    const v = values?.fields[seg.field]?.trim();
    return v ? `${seg.lead ?? ''}${v}` : (seg.blank ?? BLANK);
  }
  if ('box' in seg) return `${seg.label} ${values?.boxes[seg.box].has(seg.key) ? '☑' : '☐'}`;
  return seg.signature;
}

export function partToPlainText(part: SchedulePart, values?: PartValues): string {
  const body = part.paragraphs
    .map((p) => p.map((line) => line.map((s) => renderSegPlain(s, values)).join('')).join('\n'))
    .join('\n\n');
  return `${part.title}\n${part.subtitle}\n\n${body}`;
}

export function scheduleToPlainText(a?: PartValues, b?: PartValues): string {
  return `${SCHEDULE_HEADING.join('\n')}\n\n${partToPlainText(PART_A, a)}\n\n${partToPlainText(PART_B, b)}`;
}
