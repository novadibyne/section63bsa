import { describe, expect, it } from 'vitest';
import { browserName, buildLogsRequest, cleanLabels, osName, otlpAttributes, track } from '@/lib/telemetry';

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

  it('does nothing when statistics are off', () => {
    expect(() => track('pdf_generated', { kind: 'final' })).not.toThrow();
  });
});

describe('OpenTelemetry logs request', () => {
  it('turns values into OTLP attributes', () => {
    expect(otlpAttributes({ a: 'x', b: true, c: 2, d: 1.5 })).toEqual([
      { key: 'a', value: { stringValue: 'x' } },
      { key: 'b', value: { boolValue: true } },
      { key: 'c', value: { intValue: '2' } },
      { key: 'd', value: { doubleValue: 1.5 } },
    ]);
  });

  it('puts each event in a log record with its labels', () => {
    const req = buildLogsRequest(
      [
        { name: 'page_view', labels: { path: '/history/' }, timeMs: 1_761_730_000_000 },
        { name: 'pdf_generated', labels: { kind: 'final', parts: 'B' }, timeMs: 1_761_730_001_000 },
      ],
      { 'service.name': 'legal-sakshya' },
    );
    const rl = req.resourceLogs[0];
    expect(rl.resource.attributes).toEqual([{ key: 'service.name', value: { stringValue: 'legal-sakshya' } }]);
    const [view, pdf] = rl.scopeLogs[0].logRecords;
    expect(view.timeUnixNano).toBe('1761730000000000000');
    expect(view.body).toEqual({ stringValue: 'page_view' });
    expect(view.attributes).toEqual([
      { key: 'event.name', value: { stringValue: 'page_view' } },
      { key: 'url.path', value: { stringValue: '/history/' } },
    ]);
    expect(pdf.attributes).toContainEqual({ key: 'legal_sakshya.kind', value: { stringValue: 'final' } });
    expect(pdf.attributes).toContainEqual({ key: 'legal_sakshya.parts', value: { stringValue: 'B' } });
    expect(pdf.severityText).toBe('INFO');
  });
});

describe('browser and system names', () => {
  it('recognises common browsers and systems', () => {
    const android = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
    expect([browserName(android), osName(android)]).toEqual(['Chrome', 'Android']);
    expect([browserName(iphone), osName(iphone)]).toEqual(['Safari', 'iOS']);
    expect([browserName(edge), osName(edge)]).toEqual(['Edge', 'Windows']);
  });
});
