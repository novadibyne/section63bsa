import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scheduleToPlainText, partToPlainText, PART_A, emptyValues } from '@/lib/legal/schedule-63';

function specScheduleBlock(): string {
  const spec = readFileSync(new URL('../docs/SPECIFICATION.md', import.meta.url), 'utf8');
  const from = spec.indexOf('### 2.3');
  const start = spec.indexOf('```text', from) + '```text'.length;
  const end = spec.indexOf('```', start);
  return spec.slice(start, end);
}

const normalise = (s: string) => s.replace(/[☐☑]/g, '[]').replace(/\s+/g, ' ').trim();

describe('Schedule text', () => {
  it('reproduces docs/SPECIFICATION.md §2.3 word for word', () => {
    expect(normalise(scheduleToPlainText())).toBe(normalise(specScheduleBlock()));
  });

  it('fills fields and ticks boxes without altering the statutory words', () => {
    const v = emptyValues();
    v.fields.name = 'Asha Rao';
    v.fields.date = '13/10/2026';
    v.boxes.device.add('mobile');
    v.boxes.algo.add('sha256');
    const text = partToPlainText(PART_A, v);
    expect(text).toContain('I, Asha Rao (Name), Son/daughter/spouse of ________');
    expect(text).toContain('Mobile ☑');
    expect(text).toContain('DVR ☐');
    expect(text).toContain('SHA256: ☑');
    expect(text).toContain('SHA1: ☐');
    expect(text).toContain('MD5: ☐');
    expect(text).toContain('Date (DD/MM/YYYY): 13/10/2026');
  });
});
