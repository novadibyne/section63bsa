import { describe, expect, it } from 'vitest';
import { cleanLabels, dropResourceSpans, scrubPayload, stripQuery, track } from '@/lib/telemetry';

describe('usage statistics never carry evidence details', () => {
  it('keeps only the allowed labels, of the right type', () => {
    expect(
      cleanLabels({
        parts: 'A',
        kind: 'final',
        imei_count: 2,
        serial_found: true,
        // Anything else is dropped, whatever it is called.
        name: 'Ravi Sharma',
        imei: '490154203237518',
        sha256: '78a59b5110151199e10b188bad351928ca0dcb1c0fb1e5fea4322ba7db0adf69',
        title: 'WhatsApp chat — Ravi Sharma',
        // Right key, wrong type.
        model_found: 'Samsung Galaxy S23',
      }),
    ).toEqual({ parts: 'A', kind: 'final', imei_count: 2, serial_found: true });
  });

  it('cuts allowed strings short', () => {
    expect(cleanLabels({ path: `/${'x'.repeat(100)}` }).path).toHaveLength(40);
  });

  it('removes record IDs from page addresses', () => {
    expect(stripQuery('https://legalsakshya.com/certificate/?evidenceId=ab12&step=3')).toBe('https://legalsakshya.com/certificate/');
    expect(stripQuery('https://legalsakshya.com/evidence/#files')).toBe('https://legalsakshya.com/evidence/');
  });

  it('scrubs every URL and referrer in an outgoing payload', () => {
    const payload = {
      transactions: [{ name: 'page-load', context: { page: { url: 'https://legalsakshya.com/evidence/?id=1', referer: 'https://x.test/?q=secret' } } }],
      errors: [{ context: { page: { url: 'https://legalsakshya.com/certificate/?evidenceId=2' } } }],
    };
    expect(scrubPayload(payload)).toEqual({
      transactions: [{ name: 'page-load', context: { page: { url: 'https://legalsakshya.com/evidence/', referer: 'https://x.test/' } } }],
      errors: [{ context: { page: { url: 'https://legalsakshya.com/certificate/' } } }],
    });
  });

  it('drops per-file timings but keeps the page timings', () => {
    const payload = { transactions: [{ spans: [{ type: 'hard-navigation.browser-timing' }, { type: 'resource.script' }, { type: 'resource.link' }] }] };
    expect(dropResourceSpans(payload).transactions[0].spans).toEqual([{ type: 'hard-navigation.browser-timing' }]);
  });

  it('does nothing when statistics are off', () => {
    expect(() => track('pdf_generated', { kind: 'final' })).not.toThrow();
  });
});
