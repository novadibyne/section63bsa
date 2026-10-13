import { describe, expect, it } from 'vitest';
import { identifierError, isValidImei, isValidMac } from '@/lib/legal/validators';

describe('validators', () => {
  it('checks IMEI Luhn digits', () => {
    expect(isValidImei('490154203237518')).toBe(true);
    expect(isValidImei('49-015420-323751-8')).toBe(true);
    expect(isValidImei('490154203237519')).toBe(false);
    expect(isValidImei('12345')).toBe(false);
  });
  it('checks MAC addresses', () => {
    expect(isValidMac('AA:BB:CC:DD:EE:FF')).toBe(true);
    expect(isValidMac('aa-bb-cc-dd-ee-ff')).toBe(true);
    expect(isValidMac('AA:BB:CC')).toBe(false);
  });
  it('only reports errors for typed values', () => {
    expect(identifierError('imei', '')).toBeUndefined();
    expect(identifierError('cloud_id', 'anything')).toBeUndefined();
    expect(identifierError('imei', '123')).toMatch(/15 digits/);
  });
});
