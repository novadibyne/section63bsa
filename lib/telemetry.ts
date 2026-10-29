// Usage statistics, sent to Elastic APM (Real User Monitoring) when NEXT_PUBLIC_APM_SERVER_URL is set.
// They say what kind of thing happened ("a final PDF was made, Part A only"), never what was in it:
// no evidence, file names, hashes, names, addresses, IMEIs, serial numbers, case numbers or PDF contents.
// Elastic adds the visitor's IP address, location and browser on its side.
import type { ApmBase, Transaction } from '@elastic/apm-rum';
import { APM_SERVER_URL, APM_SERVICE_NAME } from './config';

export type AppEvent =
  | 'page_view'
  | 'certificate_started'
  | 'evidence_added'
  | 'pdf_generated'
  | 'pdf_downloaded'
  | 'device_scan'
  | 'app_installed';

type LabelValue = string | number | boolean;
export type Labels = Record<string, LabelValue | undefined>;

/** The only labels an event may carry. Anything else is dropped before it is sent. */
const ALLOWED_LABELS: Record<string, 'string' | 'number' | 'boolean'> = {
  path: 'string',
  parts: 'string',
  kind: 'string',
  via: 'string',
  file_kind: 'string',
  imei_count: 'number',
  serial_found: 'boolean',
  model_found: 'boolean',
};

/** Keeps only allowed labels of the right type; strings are cut short so nothing long can slip through. */
export function cleanLabels(labels: Labels): Record<string, LabelValue> {
  const out: Record<string, LabelValue> = {};
  for (const [k, v] of Object.entries(labels)) {
    if (v === undefined || ALLOWED_LABELS[k] !== typeof v) continue;
    out[k] = typeof v === 'string' ? v.slice(0, 40) : v;
  }
  return out;
}

/** Drops the query string and fragment: they hold record IDs such as ?evidenceId=… */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** Applies stripQuery to every page URL and referrer in an outgoing payload. */
export function scrubPayload<T>(payload: T): T {
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === 'string' && (k === 'url' || k === 'referer' || k === 'full')) (node as Record<string, unknown>)[k] = stripQuery(v);
      else walk(v);
    }
  };
  walk(payload);
  return payload;
}

/** Drops per-file download timings from page loads: dozens per page, and not needed for usage statistics. */
export function dropResourceSpans<T>(payload: T): T {
  const txs = (payload as { transactions?: { spans?: { type?: string }[] }[] }).transactions ?? [];
  for (const tx of txs) if (tx.spans) tx.spans = tx.spans.filter((sp) => !sp.type?.startsWith('resource'));
  return payload;
}

/** A random ID kept in this browser, so visitors can be counted once. It says nothing about who they are. */
function visitorId(): string {
  try {
    const existing = localStorage.getItem('ls-visitor');
    if (existing) return existing;
    const id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ls-visitor', id);
    return id;
  } catch {
    return 'unknown';
  }
}

let apm: ApmBase | null = null;
let starting = false;
const queue: [AppEvent, Labels][] = [];

export const telemetryEnabled = () => !!APM_SERVER_URL && typeof window !== 'undefined' && process.env.NODE_ENV === 'production';

/** Loads the Elastic agent after the page has loaded. Does nothing unless an APM server is configured. */
export async function startTelemetry() {
  if (!telemetryEnabled() || apm || starting) return;
  starting = true;
  try {
    const { init } = await import('@elastic/apm-rum');
    const agent = init({
      serviceName: APM_SERVICE_NAME,
      serverUrl: APM_SERVER_URL,
      serviceVersion: process.env.NEXT_PUBLIC_BUILD_ID || undefined,
      environment: 'production',
      // Page loads and app errors only: no tracing of the app's own file requests, no click tracking.
      disableInstrumentations: ['history', 'eventtarget', 'click', 'fetch', 'xmlhttprequest'],
      distributedTracing: false,
      centralConfig: false,
      breakdownMetrics: false,
      pageLoadTransactionName: window.location.pathname,
    });
    agent.setUserContext({ id: visitorId() });
    agent.addLabels({
      installed: window.matchMedia('(display-mode: standalone)').matches,
    });
    agent.addFilter((payload) => dropResourceSpans(scrubPayload(payload)));
    apm = agent;
    for (const [e, l] of queue.splice(0)) send(e, l);
  } catch {
    // Statistics must never get in the way of the app.
  } finally {
    starting = false;
  }
}

function send(event: AppEvent, labels: Labels) {
  // A custom event lasts 1 ms: the agent drops events that take no time at all.
  const now = performance.now();
  const t: Transaction | undefined = apm?.startTransaction(event, 'app-event', { managed: false, startTime: now - 1 });
  if (!t) return;
  t.addLabels(cleanLabels(labels));
  t.end(now);
}

/** Records that something happened. Safe to call anywhere: a no-op when statistics are off. */
export function track(event: AppEvent, labels: Labels = {}) {
  if (!telemetryEnabled()) return;
  if (apm) send(event, labels);
  else if (queue.length < 20) queue.push([event, labels]);
}
