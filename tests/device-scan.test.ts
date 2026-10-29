import { describe, expect, it } from 'vitest';
import { findDeviceIds, imeisInLine, serialsInText } from '@/lib/device-scan/parse';

const IMEI_1 = '490154203237518';
const IMEI_2 = '356938035643809';

describe('IMEIs read from text', () => {
  it('finds both IMEIs on a Samsung *#06# screen, ignoring the /01 software version', () => {
    const text = `IMEI 1: ${IMEI_1}/01\nIMEI 2: ${IMEI_2}/01\nS/N: R5CW12345AB`;
    const r = findDeviceIds({ text });
    expect(r.imeis.map((x) => [x.label, x.value])).toEqual([
      ['IMEI 1', IMEI_1],
      ['IMEI 2', IMEI_2],
    ]);
    expect(r.serials[0]).toMatchObject({ value: 'R5CW12345AB', label: 'Serial number' });
  });

  it('reads an iPhone-style grouped IMEI and keeps the labelled slot order', () => {
    const text = 'IMEI2\n35 693803 564380 9\nIMEI\n49 015420 323751 8';
    expect(findDeviceIds({ text }).imeis.map((x) => x.value)).toEqual([IMEI_2, IMEI_1]);
  });

  it('does not swallow the slot digit of "IMEI1"', () => {
    expect(imeisInLine(`IMEI1 ${IMEI_1}`)).toEqual([IMEI_1]);
    expect(imeisInLine(`IMEI2:${IMEI_2}`)).toEqual([IMEI_2]);
  });

  it('fixes letters OCR commonly reads in place of digits', () => {
    expect(imeisInLine('IMEI: 49O154203237S18')).toEqual([IMEI_1]);
  });

  it('splits two IMEIs printed side by side', () => {
    expect(imeisInLine(`${IMEI_1} ${IMEI_2}`).sort()).toEqual([IMEI_1, IMEI_2].sort());
  });

  it('rejects 15-digit numbers whose check digit is wrong, and other numbers', () => {
    expect(imeisInLine('IMEI 490154203237519')).toEqual([]);
    expect(imeisInLine('EID 89049032004008882600012345678901')).toEqual([]);
    expect(imeisInLine('Phone 9876543210, date 29/10/2026')).toEqual([]);
  });
});

describe('serial numbers read from text', () => {
  it('takes the value on the next line (Android About phone)', () => {
    expect(serialsInText('Model\nSM-S911B\nSerial number\nR5CW12345AB\nIMEI')).toEqual(['R5CW12345AB']);
  });

  it('reads "Serial No.:" and "SN" labels on the same line', () => {
    expect(serialsInText('Serial No.: f2lxk0abhg7f')).toEqual(['F2LXK0ABHG7F']);
    expect(serialsInText('SN 0123ABCD99')).toEqual(['0123ABCD99']);
  });

  it('ignores labels without a usable value', () => {
    expect(serialsInText('Serial number\nUnknown')).toEqual([]);
    expect(serialsInText('SNAPDRAGON 8 GEN 2')).toEqual([]);
  });
});

describe('barcodes', () => {
  it('reads IMEIs and a serial from box-label barcodes and merges them with the text', () => {
    const r = findDeviceIds({
      text: `IMEI 1 ${IMEI_1}`,
      barcodes: [
        { text: IMEI_1, format: 'Code128' },
        { text: IMEI_2, format: 'Code128' },
        { text: 'R5CW12345AB', format: 'Code128' },
        { text: '8806094936691', format: 'EAN13' },
      ],
    });
    expect(r.imeis.map((x) => x.value)).toEqual([IMEI_1, IMEI_2]);
    expect(r.imeis[0].sources.sort()).toEqual(['barcode', 'text']);
    expect(r.serials).toEqual([{ value: 'R5CW12345AB', label: 'Possible serial number', sources: ['barcode'] }]);
  });
});
