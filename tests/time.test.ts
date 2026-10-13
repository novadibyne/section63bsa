import { describe, expect, it } from 'vitest';
import { formatIst, istDateInput, istTimeInput, toDMY } from '@/lib/time';

describe('IST formatting', () => {
  it('prints dates as DD/MM/YYYY', () => {
    expect(toDMY('2026-10-13')).toBe('13/10/2026');
  });
  it('converts UTC to IST (UTC+5:30) in 24-hour format', () => {
    const d = new Date('2026-10-13T18:45:00Z');
    expect(istDateInput(d)).toBe('2026-10-14');
    expect(istTimeInput(d)).toBe('00:15');
    expect(formatIst(d)).toBe('14/10/2026 00:15 IST');
  });
});
