// Usage statistics: small "this happened" events ("a final PDF was made, Part A only"), never what was in it:
// no evidence, file names, hashes, names, addresses, IMEIs, serial numbers, case numbers or PDF contents.
// They are sent as OpenTelemetry logs (OTLP/HTTP JSON) to the Legal Sakshya telemetry worker
// (telemetry/worker/), which adds the visitor's IP address and location and forwards them to Elastic.
import { TELEMETRY_SERVICE_NAME, TELEMETRY_URL } from './config';

export type AppEvent =
  | 'page_view'
  | 'certificate_started'
  | 'evidence_added'
  | 'pdf_generated'
  | 'pdf_downloaded'
  | 'device_scan'
  | 'app_installed'
  | 'app_error';

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
  error_type: 'string',
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

/* ───────────────────────── OTLP/JSON ───────────────────────── */

type OtlpValue = { stringValue: string } | { boolValue: boolean } | { intValue: string } | { doubleValue: number };
export interface OtlpAttribute {
  key: string;
  value: OtlpValue;
}

export function otlpAttributes(values: Record<string, LabelValue>): OtlpAttribute[] {
  return Object.entries(values).map(([key, v]) => ({
    key,
    value:
      typeof v === 'boolean'
        ? { boolValue: v }
        : typeof v === 'number'
          ? Number.isInteger(v)
            ? { intValue: String(v) }
            : { doubleValue: v }
          : { stringValue: v },
  }));
}

export interface QueuedEvent {
  name: AppEvent;
  labels: Record<string, LabelValue>;
  timeMs: number;
}

/** The page path uses its OpenTelemetry name; the other labels are kept under legal_sakshya.* */
const attributeName = (label: string) => (label === 'path' ? 'url.path' : `legal_sakshya.${label}`);

/** One OTLP logs request for a batch of events from this browser. */
export function buildLogsRequest(events: QueuedEvent[], resource: Record<string, LabelValue>) {
  return {
    resourceLogs: [
      {
        resource: { attributes: otlpAttributes(resource) },
        scopeLogs: [
          {
            scope: { name: 'legal-sakshya-web' },
            logRecords: events.map((e) => {
              const nanos = `${Math.round(e.timeMs)}000000`;
              const error = e.name === 'app_error';
              return {
                timeUnixNano: nanos,
                observedTimeUnixNano: nanos,
                severityNumber: error ? 17 : 9,
                severityText: error ? 'ERROR' : 'INFO',
                body: { stringValue: e.name },
                attributes: otlpAttributes({
                  'event.name': e.name,
                  ...Object.fromEntries(Object.entries(e.labels).map(([k, v]) => [attributeName(k), v])),
                }),
              };
            }),
          },
        ],
      },
    ],
  };
}

/* ───────────────────────── About this browser ───────────────────────── */

export function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

export function osName(ua: string, touchMac = false): string {
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) return 'iOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
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

function resourceAttributes(): Record<string, LabelValue> {
  const ua = navigator.userAgent;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return {
    'service.name': TELEMETRY_SERVICE_NAME,
    'service.version': process.env.NEXT_PUBLIC_BUILD_ID || 'local',
    'deployment.environment.name': 'production',
    // Elastic stores these in their own data stream, logs-legal_sakshya.otel-default.
    'data_stream.dataset': 'legal_sakshya',
    'user.id': visitorId(),
    'user_agent.original': ua.slice(0, 300),
    'browser.name': browserName(ua),
    'os.name': osName(ua, navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    'device.type': !touch ? 'desktop' : shortSide < 600 ? 'phone' : 'tablet',
    'browser.language': navigator.language,
    'app.installed': window.matchMedia('(display-mode: standalone)').matches,
  };
}

/* ───────────────────────── Sending ───────────────────────── */

export const telemetryEnabled = () => !!TELEMETRY_URL && typeof window !== 'undefined' && process.env.NODE_ENV === 'production';

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Sends what is waiting in one request. Events are kept for later if the device is offline. */
function flush() {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  const body = JSON.stringify(buildLogsRequest(batch, resourceAttributes()));
  fetch(`${TELEMETRY_URL}/v1/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    // keepalive lets the last events go out as the page closes (browsers allow up to 64 KB).
    keepalive: body.length < 60_000,
    credentials: 'omit',
  }).catch(() => {
    if (queue.length < 100) queue.unshift(...batch);
  });
  if (queue.length) schedule();
}

function schedule() {
  timer ??= setTimeout(flush, 3000);
}

let started = false;

/** Sends waiting events when the page is hidden or the device is back online, and counts app errors. */
export function startTelemetry() {
  if (!telemetryEnabled() || started) return;
  started = true;
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
  window.addEventListener('online', flush);
  // Only the kind of error is sent: messages can contain file names.
  window.addEventListener('error', (e) => track('app_error', { error_type: (e.error as Error | undefined)?.name ?? 'Error' }));
  window.addEventListener('unhandledrejection', (e) =>
    track('app_error', { error_type: (e.reason as Error | undefined)?.name ?? 'UnhandledRejection' }),
  );
}

/** Records that something happened. Safe to call anywhere: a no-op when statistics are off. */
export function track(event: AppEvent, labels: Labels = {}) {
  if (!telemetryEnabled()) return;
  queue.push({ name: event, labels: cleanLabels(labels), timeMs: Date.now() });
  if (queue.length >= 20) flush();
  else schedule();
}
