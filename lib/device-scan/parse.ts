// Finds IMEIs and serial numbers in text read from a photo (the *#06# screen, Settings › About phone,
// or the label on the phone's box) and in the barcodes found in it. Pure functions, so they are unit-tested.
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

  return { imeis: imeis.slice(0, 4), serials: serials.slice(0, 4) };
}
