import { beforeAll, describe, expect, it } from 'vitest';

type Setup = (o: { url: string; apiKey: string; dryRun?: boolean; log?: (s: string) => void; fetchImpl: typeof fetch }) => Promise<unknown>;
let setup: Setup;
let matches: (p: string, n: string) => boolean;

beforeAll(async () => {
  const path = '../telemetry/setup-retention.mjs';
  ({ setup, matches } = await import(/* @vite-ignore */ path));
});

const TEMPLATES = [
  { name: 'logs', index_template: { index_patterns: ['logs-*-*'], priority: 100, composed_of: ['logs@settings'], data_stream: {} } },
  {
    name: 'logs-otel@template',
    index_template: {
      index_patterns: ['logs-*.otel-*'],
      priority: 150,
      composed_of: ['logs@settings', 'otel@mappings', 'logs-otel@custom'],
      ignore_missing_component_templates: ['logs-otel@custom'],
      data_stream: { allow_custom_routing: false },
      template: { settings: { index: { mode: 'logsdb', lifecycle: { name: 'logs' } } } },
    },
  },
  { name: 'metrics', index_template: { index_patterns: ['metrics-*-*'], priority: 100 } },
];

/** A pretend Elasticsearch that records what it is asked. */
function fakeElastic({ serverless = false, dataStream = false } = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    calls.push({ method, path, body: init.body ? JSON.parse(init.body as string) : undefined });
    expect((init.headers as Record<string, string>).Authorization).toBe('ApiKey a2V5');
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (path === '/') return json(200, { cluster_name: 'test', version: { number: '9.1.0', build_flavor: serverless ? 'serverless' : 'default' } });
    if (path === '/_index_template' && method === 'GET') return json(200, { index_templates: TEMPLATES });
    if (path.startsWith('/_data_stream/') && method === 'GET') return dataStream ? json(200, { data_streams: [{}] }) : json(404, { error: 'missing' });
    return json(200, { acknowledged: true });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('Elastic retention setup', () => {
  it('matches template patterns like Elasticsearch', () => {
    expect(matches('logs-*.otel-*', 'logs-legal_hashed.otel-default')).toBe(true);
    expect(matches('logs-*-*', 'logs-legal_hashed.otel-default')).toBe(true);
    expect(matches('metrics-*-*', 'logs-legal_hashed.otel-default')).toBe(false);
  });

  it('adds a 365-day policy and a Legal Sakshya copy of the OpenTelemetry logs template', async () => {
    const { calls, fetchImpl } = fakeElastic();
    await setup({ url: 'https://es.test/', apiKey: 'a2V5', log: () => {}, fetchImpl });

    const policy = calls.find((c) => c.path === '/_ilm/policy/legal-hashed-365-days');
    expect(policy?.body).toMatchObject({ policy: { phases: { delete: { min_age: '365d' } } } });

    const template = calls.find((c) => c.method === 'PUT' && c.path === '/_index_template/logs-legal_hashed.otel')?.body as Record<string, any>;
    expect(template.index_patterns).toEqual(['logs-legal_hashed.otel-*']);
    expect(template.priority).toBe(151);
    expect(template.composed_of).toEqual(['logs@settings', 'otel@mappings', 'logs-otel@custom']);
    expect(template.ignore_missing_component_templates).toEqual(['logs-otel@custom']);
    expect(template.data_stream).toEqual({ allow_custom_routing: false });
    expect(template.template.settings).toEqual({ 'index.mode': 'logsdb', 'index.lifecycle.name': 'legal-hashed-365-days' });
    expect(template.template.lifecycle).toEqual({ data_retention: '365d' });

    // No data yet: nothing else to change.
    expect(calls.some((c) => c.path.endsWith('/_rollover'))).toBe(false);
  });

  it('applies the retention to statistics already stored', async () => {
    const { calls, fetchImpl } = fakeElastic({ dataStream: true });
    await setup({ url: 'https://es.test', apiKey: 'a2V5', log: () => {}, fetchImpl });
    const paths = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(paths).toEqual([
      'PUT /_ilm/policy/legal-hashed-365-days',
      'PUT /_index_template/logs-legal_hashed.otel',
      'PUT /_data_stream/logs-legal_hashed.otel-default/_lifecycle',
      'PUT /logs-legal_hashed.otel-default/_settings',
      'POST /logs-legal_hashed.otel-default/_rollover',
    ]);
  });

  it('uses only a data stream lifecycle on serverless projects', async () => {
    const { calls, fetchImpl } = fakeElastic({ serverless: true });
    await setup({ url: 'https://es.test', apiKey: 'a2V5', log: () => {}, fetchImpl });
    expect(calls.some((c) => c.path.startsWith('/_ilm/'))).toBe(false);
    const template = calls.find((c) => c.method === 'PUT' && c.path === '/_index_template/logs-legal_hashed.otel')?.body as Record<string, any>;
    expect(template.template.settings['index.lifecycle.name']).toBe('logs');
    expect(template.template.lifecycle).toEqual({ data_retention: '365d' });
  });

  it('changes nothing in a dry run', async () => {
    const { calls, fetchImpl } = fakeElastic({ dataStream: true });
    await setup({ url: 'https://es.test', apiKey: 'a2V5', dryRun: true, log: () => {}, fetchImpl });
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
});
