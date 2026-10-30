// Finds IMEIs, the serial number and the make & model in text read from a photo (the *#06# screen,
// Settings › About phone, or the label on the phone's box) and in the barcodes found in it.
// Pure functions, so they are unit-tested.
import { digitsOnly, isValidImei } from '@/lib/legal/validators';

export type FoundSource = 'barcode' | 'text';

export interface FoundId {
  value: string;
  /** "IMEI 1", "IMEI 2", "Serial number"… */
  label: string;
  sources: FoundSource[];
}

export interface DeviceIdScan {
  imeis: FoundId[];
  serials: FoundId[];
  /** "Samsung Galaxy S23 (SM-S911B)", ready for the Make & Model field. */
  models: FoundId[];
}

export interface BarcodeHit {
  text: string;
  format: string;
}

/** Characters OCR often reads in place of digits. Only applied inside runs that are already mostly digits. */
const DIGIT_LOOKALIKE: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', S: '5', s: '5', B: '8', Z: '2' };
const LOOKALIKE = 'OoDQIl|SsBZ';

function asDigits(run: string): string | undefined {
  const realDigits = digitsOnly(run).length;
  const mapped = [...run].map((c) => DIGIT_LOOKALIKE[c] ?? c).join('');
  return /^\d+$/.test(mapped) && realDigits >= mapped.length - 2 ? mapped : undefined;
}

/** 15-digit numbers with a valid check digit, as printed on one line (allowing "35 209900 176148 1" grouping). */
export function imeisInLine(line: string): string[] {
  // Drop "IMEI", "IMEI1", "IMEI 2:" labels so their digit doesn't run into the number.
  const cleaned = line.replace(/\bIMEI\s*(?:\(?\s*slot\s*)?(?:[12](?!\d))?\s*\)?\s*[:#.\-]?/gi, '  ');
  const found: string[] = [];
  const consider = (run: string) => {
    const d = asDigits(run);
    if (!d) return;
    if (d.length === 15 && isValidImei(d)) found.push(d);
    // Two IMEIs printed side by side and joined by the grouping rule below.
    else if (d.length === 30 && isValidImei(d.slice(0, 15)) && isValidImei(d.slice(15))) found.push(d.slice(0, 15), d.slice(15));
  };
  const token = new RegExp(`[\\d${LOOKALIKE}]+`, 'g');
  // 1. Whole tokens, e.g. "352099001761481" or "352099001761481/01" (a Samsung IMEI with its software version).
  for (const m of cleaned.matchAll(token)) consider(m[0]);
  // 2. Groups split by single spaces or hyphens, e.g. "35 209900 176148 1" on an iPhone.
  const grouped = new RegExp(`[\\d${LOOKALIKE}]+(?:[ \\-][\\d${LOOKALIKE}]+)+`, 'g');
  for (const m of cleaned.matchAll(grouped)) consider(m[0].replace(/[ \-]/g, ''));
  return [...new Set(found)];
}

/** The IMEI slot a line is labelled with ("IMEI 2", "IMEI2", "IMEI (slot 2)"), if any. */
function slotOf(line: string): 1 | 2 | undefined {
  const m = /\bIMEI\s*(?:\(?\s*slot\s*)?([12])\b/i.exec(line);
  return m ? (Number(m[1]) as 1 | 2) : undefined;
}

const SERIAL_LABEL = /\b(?:serial\s*(?:number|num|no\.?|#)?|s\s*\/\s*n|sn)(?![a-z])\s*[:#.\-]?\s*/i;
const SERIAL_VALUE = /^[A-Z0-9][A-Z0-9\-]{4,24}$/i;

function looksLikeSerial(v: string): boolean {
  const s = v.replace(/-/g, '');
  if (!SERIAL_VALUE.test(v) || s.length < 6 || s.length > 22) return false;
  if (!/\d/.test(s)) return false;
  if (/^\d+$/.test(s) && (s.length === 15 || s.length === 8 || s.length === 12 || s.length === 13)) return false; // IMEI / EAN / UPC
  return true;
}

/** Serial numbers written next to a "Serial number", "S/N" or "SN" label, or on the line below it. */
export function serialsInText(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const found: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = SERIAL_LABEL.exec(lines[i]);
    if (!m) continue;
    const after = lines[i].slice(m.index + m[0].length).trim();
    const sameLine = after.split(/\s+/)[0] ?? '';
    if (looksLikeSerial(sameLine)) {
      found.push(sameLine.toUpperCase());
      continue;
    }
    if (after) continue;
    // Android's About phone shows the label on one line and the value on the next.
    const next = lines.slice(i + 1).find(Boolean)?.split(/\s+/)[0] ?? '';
    if (looksLikeSerial(next)) found.push(next.toUpperCase());
  }
  return found;
}

/* ───────────────────────── Make & model ───────────────────────── */

/** Product lines and the maker they belong to. The name must be followed by a model, e.g. "Galaxy S23". */
const SERIES_MAKE: Record<string, string> = {
  galaxy: 'Samsung',
  iphone: 'Apple',
  ipad: 'Apple',
  redmi: 'Xiaomi',
  poco: 'Xiaomi',
  xiaomi: 'Xiaomi',
  pixel: 'Google',
  oneplus: 'OnePlus',
  nord: 'OnePlus',
  vivo: 'vivo',
  iqoo: 'vivo',
  oppo: 'OPPO',
  reno: 'OPPO',
  realme: 'realme',
  narzo: 'realme',
  moto: 'Motorola',
  motorola: 'Motorola',
  nokia: 'Nokia',
  xperia: 'Sony',
  zenfone: 'Asus',
};
const SERIES = new RegExp(
  `\\b(?:${Object.keys(SERIES_MAKE).join('|')})\\b(?:[ \\t]+(?:[A-Z]?\\d{1,3}[A-Z]{0,2}\\+?|Pro\\+?|Max|Plus|Ultra|Lite|mini|FE|5G|4G|Note|Prime|Neo|Fold\\d?|Flip\\d?|Edge|Power|Play|SE|XR|XS|Turbo|GT|Fusion|Stylus))+`,
  'i',
);

/** Model numbers whose shape gives away the maker. */
const CODE_MAKE: [RegExp, string][] = [
  [/\bSM-[A-Z]\d{3,4}[A-Z0-9]{0,4}(?:\/DS[A-Z]?)?(?![\w/])/, 'Samsung'],
  [/\bM[A-Z0-9]{4}[A-Z]{1,2}\/A\b/, 'Apple'],
  [/\bRMX\d{4}\b/, 'realme'],
  [/\bXT\d{4}(?:-\d{1,2})?\b/, 'Motorola'],
  [/\bTA-\d{4}\b/, 'Nokia'],
  [/\bV2\d{3}[A-Z]?\b/, 'vivo'],
];

/** Maker names trusted anywhere in the text (others, like "Google", also appear in unrelated settings). */
const MAKER_WORD = /\b(Samsung|Apple|Xiaomi|OnePlus|vivo|OPPO|realme|Motorola|Nokia|Huawei|Tecno|Infinix|Sony|Asus|Lenovo)\b/i;

const MODEL_NAME_LABEL = /\bmodel\s*name\b\s*[:\-]?\s*(.*)$/i;
const MODEL_NUMBER_LABEL = /\bmodel\s*(?:number|no\.?|#)\s*[:\-]?\s*(.*)$/i;
const MODEL_LABEL = /^model\b(?!\s*(?:name|number|no\b|#))\s*[:\-]?\s*(.*)$/i;
const BRAND_LABEL = /^(?:brand|manufacturer|make)\b\s*[:\-]?\s*(.*)$/i;
const ANOTHER_LABEL = /^(?:model|serial|imei|android|build|baseband|kernel|status|software|hardware|device|phone|brand|manufacturer|ram|storage|processor)\b/i;

/** The value after a label: on the same line, or (as on About phone screens) on the next line. */
function labelled(lines: string[], label: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = label.exec(lines[i]);
    if (!m) continue;
    const same = (m[1] ?? '').trim();
    const v = same || (lines[i + 1] && !ANOTHER_LABEL.test(lines[i + 1]) ? lines[i + 1] : '');
    if (v) return v.replace(/\s{2,}.*$/, '').slice(0, 40).trim();
  }
  return undefined;
}

const isModelCode = (v: string) => /^[A-Z0-9][A-Z0-9\-/]{2,19}$/i.test(v) && /\d/.test(v) && !/^\d+$/.test(v);
const seriesIn = (v: string) => SERIES.exec(v)?.[0].replace(/\s+/g, ' ').trim();

/** Make & model as one line for the certificate, e.g. "Samsung Galaxy S23 (SM-S911B/DS)". */
export function makeModelInText(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let name = labelled(lines, MODEL_NAME_LABEL);
  let code = labelled(lines, MODEL_NUMBER_LABEL)?.split(/\s+/)[0];
  const plain = labelled(lines, MODEL_LABEL);
  if (plain) {
    if (seriesIn(plain)) name ??= plain;
    else if (isModelCode(plain.split(/\s+/)[0])) code ??= plain.split(/\s+/)[0];
  }
  name = name ? (seriesIn(name) ?? (/[a-z]/i.test(name) && !isModelCode(name) ? name : undefined)) : seriesIn(text);
  if (code && !isModelCode(code)) code = undefined;
  const coded = CODE_MAKE.map(([re, make]) => ({ m: re.exec(text), make })).find((x) => x.m);
  code ??= coded?.m?.[0];
  if (!name && !code) return undefined;

  const make =
    labelled(lines, BRAND_LABEL)?.split(/\s+/)[0] ??
    coded?.make ??
    (name ? SERIES_MAKE[name.split(/\s+/)[0].toLowerCase()] : undefined) ??
    MAKER_WORD.exec(text)?.[1];
  const prefix = make && !(name ?? '').toLowerCase().startsWith(make.toLowerCase()) ? `${make} ` : '';
  return name ? `${prefix}${name}${code ? ` (${code})` : ''}` : `${prefix}${code}`;
}

/** Other makers, for makerOf: computers, CCTV recorders and storage. An empty make means the name matched. */
const OTHER_MAKER: [RegExp, string][] = [
  [/\b(?:MacBook|iMac|Mac\s?mini)\b/i, 'Apple'],
  [/\bSurface\b/i, 'Microsoft'],
  [/\b(Google|Honor|Nothing|LG|HP|Dell|Acer|Microsoft|Hikvision|CP Plus|Dahua|SanDisk|Kingston|Seagate|WD)\b/i, ''],
];
const SERIES_WORD = new RegExp(`\\b(${Object.keys(SERIES_MAKE).join('|')})\\b`, 'i');

/** The maker named in a device's make & model, in lower case: "samsung" for "Galaxy S23 (SM-S911B)". */
export function makerOf(makeModel: string): string | undefined {
  const series = SERIES_WORD.exec(makeModel)?.[1];
  let make =
    MAKER_WORD.exec(makeModel)?.[1] ??
    (series ? SERIES_MAKE[series.toLowerCase()] : undefined) ??
    CODE_MAKE.find(([re]) => re.test(makeModel))?.[1];
  for (const [re, name] of OTHER_MAKER) {
    const m = make ? null : re.exec(makeModel);
    if (m) make = name || m[1];
  }
  return make?.toLowerCase().replace(/\s+/g, '_');
}

const LINEAR_FORMATS = /code\s*-?\s*(128|39|93)|codabar|itf|datamatrix|data\s*matrix|qr/i;

function add(list: FoundId[], value: string, source: FoundSource, label: string) {
  const hit = list.find((x) => x.value === value);
  if (hit) {
    if (!hit.sources.includes(source)) hit.sources.push(source);
    return;
  }
  list.push({ value, label, sources: [source] });
}

export function findDeviceIds({ text = '', barcodes = [] }: { text?: string; barcodes?: BarcodeHit[] }): DeviceIdScan {
  const bySlot: { value: string; slot?: 1 | 2; source: FoundSource }[] = [];

  for (const b of barcodes) {
    const d = b.text.trim().replace(/^IMEI\s*(?:[12](?!\d))?\s*[:#]?\s*/i, '').replace(/\s+/g, '');
    if (/^\d{15}$/.test(d) && isValidImei(d)) bySlot.push({ value: d, source: 'barcode' });
  }
  for (const line of text.split(/\r?\n/)) {
    const slot = slotOf(line);
    for (const v of imeisInLine(line)) bySlot.push({ value: v, slot, source: 'text' });
  }

  // Labelled slots first, then the rest in the order they were found.
  const ordered = [...bySlot.filter((x) => x.slot === 1), ...bySlot.filter((x) => x.slot === 2), ...bySlot.filter((x) => !x.slot)];
  const imeis: FoundId[] = [];
  for (const x of ordered) add(imeis, x.value, x.source, '');
  imeis.forEach((x, i) => (x.label = imeis.length > 1 ? `IMEI ${i + 1}` : 'IMEI'));

  const serials: FoundId[] = [];
  for (const s of serialsInText(text)) add(serials, s, 'text', 'Serial number');
  for (const b of barcodes) {
    const v = b.text.trim().replace(/^(?:s\/?n|serial)\s*[:#]?\s*/i, '');
    if (!LINEAR_FORMATS.test(b.format) || !/[A-Z]/i.test(v) || !looksLikeSerial(v)) continue;
    // A barcode that matches a serial read from the text confirms it; others are only possible serials.
    add(serials, v.toUpperCase(), 'barcode', serials.some((s) => s.value === v.toUpperCase()) ? 'Serial number' : 'Possible serial number');
  }

  const model = makeModelInText(text);
  const models: FoundId[] = model ? [{ value: model, label: 'Make & model', sources: ['text'] }] : [];

  return { imeis: imeis.slice(0, 4), serials: serials.slice(0, 4), models };
}
