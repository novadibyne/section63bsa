// Keeps Legal Hashed usage statistics in Elastic for 365 days, then deletes them. Touches nothing else.
//
// Usage statistics arrive (through the telemetry worker) in the data stream logs-legal_hashed.otel-default.
// This script finds the index template Elastic would use for it, adds a Legal Sakshya copy of that template with
// a 365-day retention, and applies the retention to data already stored. Safe to run more than once.
//
// Run it from GitHub: Actions → "Set up Elastic retention" → Run workflow (uses the ELASTIC_URL and
// ELASTIC_SETUP_API_KEY repository secrets), or locally:
//   ELASTIC_URL=https://<elasticsearch endpoint> ELASTIC_API_KEY=<encoded key> node telemetry/setup-retention.mjs [--dry-run]

export const DATA_STREAM = 'logs-legal_hashed.otel-default';
export const PATTERN = 'logs-legal_hashed.otel-*';
export const TEMPLATE = 'logs-legal_hashed.otel';
export const POLICY = 'legal-hashed-365-days';
export const DAYS = 365;

/** Glob match for index template patterns ("*" only, as Elasticsearch uses). */
export function matches(pattern, name) {
  const re = new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(name);
}

/** Turns nested settings into flat dotted keys, so ours can be set without clashing. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** The Legal Sakshya template: the matching template's content, a higher priority and a 365-day retention. */
export function retentionTemplate(base, baseName, maxPriority, { ilm }) {
  const t = base.template ?? {};
  const settings = flatten(t.settings);
  if (ilm) settings['index.lifecycle.name'] = POLICY;
  return {
    index_patterns: [PATTERN],
    priority: maxPriority + 1,
    ...(base.composed_of ? { composed_of: base.composed_of } : {}),
    ...(base.ignore_missing_component_templates ? { ignore_missing_component_templates: base.ignore_missing_component_templates } : {}),
    ...(base.data_stream ? { data_stream: base.data_stream } : { data_stream: {} }),
    ...(base.allow_auto_create !== undefined ? { allow_auto_create: base.allow_auto_create } : {}),
    template: {
      ...t,
      settings,
      lifecycle: { ...(t.lifecycle ?? {}), data_retention: `${DAYS}d` },
    },
    _meta: { description: `Legal Sakshya usage statistics: kept ${DAYS} days`, based_on: baseName, managed_by: 'legal-hashed' },
  };
}

export async function setup({ url, apiKey, dryRun = false, log = console.log, fetchImpl = fetch }) {
  const es = async (method, path, body) => {
    if (dryRun && method !== 'GET') {
      log(`[dry run] ${method} ${path}${body ? `\n${JSON.stringify(body, null, 2)}` : ''}`);
      return { status: 200, json: {} };
    }
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}${path}`, {
      method,
      headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  };
  const must = (r, what) => {
    if (r.status >= 300) throw new Error(`${what} failed (HTTP ${r.status}): ${JSON.stringify(r.json).slice(0, 500)}`);
    return r.json;
  };

  const info = must(await es('GET', '/'), 'Connecting to Elasticsearch');
  const serverless = info.version?.build_flavor === 'serverless';
  log(`Connected: ${info.cluster_name ?? 'Elasticsearch'} ${info.version?.number ?? ''}${serverless ? ' (serverless)' : ''}`);

  // 1. The retention policy (Elastic Cloud Hosted). Serverless projects only use data stream lifecycles.
  if (!serverless) {
    must(
      await es('PUT', `/_ilm/policy/${POLICY}`, {
        policy: {
          _meta: { description: `Legal Sakshya usage statistics: delete after ${DAYS} days` },
          phases: {
            hot: { actions: { rollover: { max_age: '30d', max_primary_shard_size: '50gb' } } },
            delete: { min_age: `${DAYS}d`, actions: { delete: {} } },
          },
        },
      }),
      'Creating the retention policy',
    );
    log(`Retention policy ${POLICY}: delete after ${DAYS} days.`);
  }

  // 2. A Legal Sakshya copy of the template Elastic would otherwise use for this data stream.
  const all = must(await es('GET', '/_index_template'), 'Reading index templates').index_templates ?? [];
  const candidates = all.filter((t) => t.name !== TEMPLATE && (t.index_template.index_patterns ?? []).some((p) => matches(p, DATA_STREAM)));
  if (!candidates.length) throw new Error(`No index template matches ${DATA_STREAM}. Is the Managed OTLP Endpoint set up on this deployment?`);
  const priority = (t) => t.index_template.priority ?? 0;
  const base = candidates.reduce((a, b) => (priority(b) > priority(a) ? b : a));
  const overlapping = all.filter((t) => t.name !== TEMPLATE && (t.index_template.index_patterns ?? []).some((p) => matches(p, DATA_STREAM) || matches(PATTERN, p)));
  const maxPriority = Math.max(...overlapping.map(priority));
  must(
    await es('PUT', `/_index_template/${TEMPLATE}`, retentionTemplate(base.index_template, base.name, maxPriority, { ilm: !serverless })),
    'Creating the Legal Sakshya index template',
  );
  log(`Index template ${TEMPLATE}: based on ${base.name}, priority ${maxPriority + 1}.`);

  // 3. Data already stored: give it the same retention.
  const existing = await es('GET', `/_data_stream/${DATA_STREAM}`);
  if (existing.status === 404) {
    log(`No statistics stored yet: ${DATA_STREAM} will get the ${DAYS}-day retention when the first event arrives.`);
    return { serverless, base: base.name, existing: false };
  }
  must(existing, 'Reading the data stream');
  must(await es('PUT', `/_data_stream/${DATA_STREAM}/_lifecycle`, { data_retention: `${DAYS}d` }), 'Setting the data stream lifecycle');
  if (!serverless) {
    must(await es('PUT', `/${DATA_STREAM}/_settings`, { 'index.lifecycle.name': POLICY }), 'Applying the policy to stored data');
  }
  must(await es('POST', `/${DATA_STREAM}/_rollover`), 'Starting a new index with the new rules');
  log(`${DATA_STREAM}: existing data now kept ${DAYS} days.`);
  return { serverless, base: base.name, existing: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;
  if (!url || !apiKey) {
    console.error('Set ELASTIC_URL (the Elasticsearch endpoint) and ELASTIC_API_KEY (an encoded API key).');
    process.exit(2);
  }
  setup({ url, apiKey, dryRun: process.argv.includes('--dry-run') }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
