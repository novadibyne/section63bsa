import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type Worker = { fetch: (req: Request, env: Record<string, unknown>) => Promise<Response> };
let worker: Worker;
let addVisitorDetails: (text: string, req: Request) => string | null;
let logsJsonToProtobuf: (text: string) => Uint8Array | null;

beforeAll(async () => {
  const path = '../telemetry/worker/worker.js';
  const mod = await import(/* @vite-ignore */ path);
  ({ addVisitorDetails, logsJsonToProtobuf } = mod);
  worker = mod.default as Worker;
});

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const ENV = { ELASTIC_OTLP_ENDPOINT: 'https://otlp.example.elastic.cloud', ELASTIC_API_KEY: 'ApiKey c2VjcmV0' };
const CF = { country: 'IN', region: 'Kerala', regionCode: 'KL', city: 'Thiruvananthapuram', latitude: '8.5241', longitude: '76.9366', asn: 24560, asOrganization: 'Bharti Airtel' };

function otlp(extraResourceAttrs: object[] = []) {
  return JSON.stringify({
    resourceLogs: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'legal-hashed' } }, ...extraResourceAttrs] },
        scopeLogs: [{ logRecords: [{ body: { stringValue: 'pdf_generated' } }] }],
      },
    ],
  });
}

function request(path: string, init: RequestInit & { origin?: string | null } = {}) {
  const headers = new Headers(init.headers);
  if (init.origin !== null) headers.set('Origin', init.origin ?? 'https://legalhashed.com');
  headers.set('CF-Connecting-IP', '203.0.113.7');
  const req = new Request(`https://legalhashed-telemetry.novadibyne.workers.dev${path}`, { ...init, headers });
  Object.defineProperty(req, 'cf', { value: CF });
  return req;
}

const post = (body: string, type = 'application/json') => request('/v1/logs', { method: 'POST', body, headers: { 'Content-Type': type } });

afterEach(() => vi.unstubAllGlobals());

describe('telemetry worker', () => {
  it('refuses other websites and requests without an origin', async () => {
    expect((await worker.fetch(request('/v1/logs', { method: 'POST', origin: 'https://evil.test' }), ENV)).status).toBe(403);
    expect((await worker.fetch(request('/v1/logs', { method: 'POST', origin: null }), ENV)).status).toBe(403);
  });

  it('answers the browser’s CORS check for its own site only', async () => {
    const res = await worker.fetch(request('/v1/logs', { method: 'OPTIONS' }), ENV);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://legalhashed.com');
    // The app's first address still works while visitors move over.
    const old = await worker.fetch(request('/v1/logs', { method: 'OPTIONS', origin: 'https://legalsakshya.com' }), ENV);
    expect(old.headers.get('Access-Control-Allow-Origin')).toBe('https://legalsakshya.com');
  });

  it('rejects unknown paths, query strings, other methods, types and oversized bodies', async () => {
    expect((await worker.fetch(request('/v1/other', { method: 'POST' }), ENV)).status).toBe(404);
    expect((await worker.fetch(request('/v1/logs?x=1', { method: 'POST' }), ENV)).status).toBe(404);
    expect((await worker.fetch(request('/v1/logs', { method: 'GET' }), ENV)).status).toBe(405);
    expect((await worker.fetch(post('{}', 'text/plain'), ENV)).status).toBe(415);
    expect((await worker.fetch(post('x'.repeat(70_000)), ENV)).status).toBe(413);
  });

  it('adds the visitor’s IP and location, replacing faked ones', () => {
    const faked = [{ key: 'client.address', value: { stringValue: '1.1.1.1' } }];
    const sent = JSON.parse(addVisitorDetails(otlp(faked), request('/v1/logs'))!);
    const attrs = Object.fromEntries(
      sent.resourceLogs[0].resource.attributes.map((a: { key: string; value: Record<string, unknown> }) => [a.key, Object.values(a.value)[0]]),
    );
    expect(attrs).toMatchObject({
      'service.name': 'legal-hashed',
      'client.address': '203.0.113.7',
      'client.geo.country_iso_code': 'IN',
      'client.geo.region_name': 'Kerala',
      'client.geo.region_iso_code': 'IN-KL',
      'client.geo.city_name': 'Thiruvananthapuram',
      'client.geo.location.lat': 8.5241,
      'client.geo.location.lon': 76.9366,
      'client.as.number': '24560',
      'client.as.organization.name': 'Bharti Airtel',
    });
    expect(attrs).not.toHaveProperty('client.address', '1.1.1.1');
    expect(sent.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toBe('pdf_generated');
  });

  it('encodes OTLP logs as protobuf exactly like the OpenTelemetry encoder', () => {
    // Expected bytes from @opentelemetry/otlp-transformer 0.203.0 (ExportLogsServiceRequest.encode) for the same request.
    const kv = (key: string, value: object) => ({ key, value });
    const sample = {
      resourceLogs: [
        {
          resource: { attributes: [kv('service.name', { stringValue: 'legal-hashed' }), kv('app.installed', { boolValue: true })] },
          scopeLogs: [
            {
              scope: { name: 'legal-hashed-web', version: '1' },
              logRecords: [
                {
                  timeUnixNano: '1793278488496000000',
                  observedTimeUnixNano: '1793278488496000000',
                  severityNumber: 17,
                  severityText: 'ERROR',
                  body: { stringValue: 'app_error' },
                  traceId: '5b8efff798038103d269b633813fc60c',
                  spanId: 'eee19b7ec3c1b174',
                  flags: 1,
                  eventName: 'app_error',
                  attributes: [
                    kv('i', { intValue: '-5' }),
                    kv('d', { doubleValue: 9.96667 }),
                    kv('a', { arrayValue: { values: [{ stringValue: 'x' }, { intValue: '3' }] } }),
                    kv('k', { kvlistValue: { values: [kv('y', { boolValue: false })] } }),
                    kv('b', { bytesValue: 'AQID' }),
                    kv('u', { stringValue: 'ünï✓' }),
                  ],
                },
              ],
              schemaUrl: 'https://opentelemetry.io/schemas/1.26.0',
            },
          ],
        },
      ],
    };
    expect(hex(logsJsonToProtobuf(JSON.stringify(sample))!)).toBe(
      '0ab4020a350a1e0a0c736572766963652e6e616d65120e0a0c6c6567616c2d6861736865640a130a0d6170702e696e7374616c6c65641202100112fa010a150a106c6567616c2d6861736865642d77656212013112b70109004c27ba4801e31810111a054552524f522a0b0a096170705f6572726f7232100a0169120b18fbffffffffffffffff01320e0a0164120921740cc85eefee234032100a0161120b2a090a030a01780a02180332100a016b120b32090a070a017912021000320a0a016212053a03010203320f0a0175120a0a08c3bc6ec3afe29c9345010000004a105b8efff798038103d269b633813fc60c5208eee19b7ec3c1b17459004c27ba4801e31862096170705f6572726f721a2768747470733a2f2f6f70656e74656c656d657472792e696f2f736368656d61732f312e32362e30',
    );
    expect(hex(logsJsonToProtobuf('{}')!)).toBe('');
    expect(logsJsonToProtobuf('not json')).toBeNull();
  });

  it('forwards the logs to Elastic as protobuf, with the visitor’s details and the API key', async () => {
    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const res = await worker.fetch(post(otlp()), ENV);
    expect(res.status).toBe(204);

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://otlp.example.elastic.cloud/v1/logs');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('ApiKey c2VjcmV0');
    expect(headers['Content-Type']).toBe('application/x-protobuf');
    const expected = logsJsonToProtobuf(addVisitorDetails(otlp(), request('/v1/logs'))!)!;
    expect(hex(init.body as Uint8Array)).toBe(hex(expected));
    expect(Buffer.from(init.body as Uint8Array).toString('utf8')).toContain('203.0.113.7');
  });

  it('rejects JSON that isn’t JSON, and keeps Elastic’s errors private', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('index error with details', { status: 400 })));
    expect((await worker.fetch(post('{not json'), ENV)).status).toBe(400);
    expect((await worker.fetch(post('5'), ENV)).status).toBe(400);
    const res = await worker.fetch(post(otlp()), ENV);
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('Telemetry rejected');
  });

  it('says which Elastic setting is missing, in the response and the worker log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await worker.fetch(post(otlp()), { ELASTIC_API_KEY: 'ApiKey c2VjcmV0' });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Proxy not configured: ELASTIC_OTLP_ENDPOINT is not set');
    expect(log.mock.calls[0][0]).toContain('ELASTIC_OTLP_ENDPOINT is not set');
    expect(log.mock.calls[0][0]).not.toContain('c2VjcmV0');
    log.mockRestore();
  });

  it('accepts the usual ways of pasting the endpoint and the key', async () => {
    const pasted: Record<string, string>[] = [
      { ELASTIC_OTLP_ENDPOINT: ' https://otlp.example.elastic.cloud/ ', ELASTIC_API_KEY: 'c2VjcmV0' },
      { ELASTIC_OTLP_ENDPOINT: 'https://otlp.example.elastic.cloud:443/v1/logs', ELASTIC_API_KEY: '"ApiKey c2VjcmV0"' },
      { ELASTIC_OTLP_ENDPOINT: 'otlp.example.elastic.cloud', ELASTIC_API_KEY: 'Authorization: ApiKey c2Vj\ncmV0' },
      { ELASTIC_OTLP_ENDPOINT: 'OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp.example.elastic.cloud"', ELASTIC_API_KEY: 'OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey%20c2VjcmV0"' },
    ];
    for (const env of pasted) {
      const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', upstream);
      expect((await worker.fetch(post(otlp()), env)).status).toBe(204);
      const [url, init] = upstream.mock.calls[0];
      expect(url).toBe('https://otlp.example.elastic.cloud/v1/logs');
      expect((init.headers as Record<string, string>).Authorization).toBe('ApiKey c2VjcmV0');
    }
    // "id:api_key" is encoded for Elastic.
    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    await worker.fetch(post(otlp()), { ...ENV, ELASTIC_API_KEY: 'abc:def' });
    expect((upstream.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(`ApiKey ${btoa('abc:def')}`);

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await worker.fetch(post(otlp()), { ...ENV, ELASTIC_OTLP_ENDPOINT: 'http://otlp.example.elastic.cloud' });
    expect(await res.text()).toBe('Proxy not configured: ELASTIC_OTLP_ENDPOINT is not a valid https:// address');
    log.mockRestore();
  });

  it('logs why Elastic refused the data, without telling the browser', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unable to authenticate', { status: 401 })));
    const res = await worker.fetch(post(otlp()), ENV);
    expect(await res.text()).toBe('Telemetry rejected');
    expect(log.mock.calls[0][0]).toContain('Elastic refused the API key (401)');
    expect(log.mock.calls[0][0]).toContain('unable to authenticate');
    log.mockRestore();
  });

  it('shows a status page for checking the setup, without the values', async () => {
    const page = (env: Record<string, unknown>) => worker.fetch(request('/status', { method: 'GET', origin: null }), env);

    let res = await page({ ELASTIC_ENDPOINT: 'https://x.test' });
    expect(res.status).toBe(503);
    let report = await res.json();
    expect(report).toMatchObject({
      ok: false,
      settings_found: ['ELASTIC_ENDPOINT'],
      ELASTIC_OTLP_ENDPOINT: 'ELASTIC_OTLP_ENDPOINT is not set',
      ELASTIC_API_KEY: 'ELASTIC_API_KEY is not set',
    });

    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    res = await page(ENV);
    expect(res.status).toBe(200);
    report = await res.json();
    expect(report).toMatchObject({ ok: true, ELASTIC_OTLP_ENDPOINT: 'ok: https://otlp.example.elastic.cloud', ELASTIC_API_KEY: 'ok: set' });
    expect(report.elastic).toContain('accepted');
    expect(JSON.stringify(report)).not.toContain('c2VjcmV0');
    expect(upstream.mock.calls[0][0]).toBe('https://otlp.example.elastic.cloud/v1/logs');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    report = await (await page(ENV)).json();
    expect(report.ok).toBe(false);
    expect(report.elastic).toContain('Managed OTLP endpoint');
  });
});
