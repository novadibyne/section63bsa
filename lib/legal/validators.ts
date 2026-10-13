import type { IdentifierType } from '@/lib/types';

export function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

/** IMEI: 15 digits whose last digit is a Luhn check digit. */
export function isValidImei(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = +d[14 - i];
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function isValidMac(value: string): boolean {
  return /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(value.trim()) || /^[0-9a-f]{12}$/i.test(value.trim());
}

export function identifierError(type: IdentifierType, value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (type === 'imei' && !isValidImei(v)) return 'IMEI must be 15 digits with a valid check digit (dial *#06# to see it)';
  if (type === 'mac' && !isValidMac(v)) return 'MAC must look like AA:BB:CC:DD:EE:FF';
  return undefined;
}

export const IDENTIFIER_LABEL: Record<IdentifierType, string> = {
  imei: 'IMEI',
  uin: 'UIN',
  uid: 'UID',
  mac: 'MAC',
  cloud_id: 'Cloud ID',
  other: 'Other ID',
};
