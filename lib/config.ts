export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Legal Sakshya';
export const APP_TAGLINE = 'Section 63 BSA certificate drafter';
export const SITE_DOMAIN = 'legalsakshya.com';
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const HASH_WASM_VERSION = process.env.NEXT_PUBLIC_HASH_WASM_VERSION || 'unknown';

export const BARE_ACT_URL = 'https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf';

/** The privacy promise. Shown on every page and wherever something is added. */
export const PRIVACY_BADGE = 'Your evidence stays on your device';
export const PRIVACY_DETAIL = 'Files and details you add are never uploaded · Safe and private';
export const PRIVACY_LINE = 'Your evidence and the details you enter never leave your device.';

/**
 * Usage statistics: OpenTelemetry logs sent to the Legal Sakshya telemetry worker (telemetry/worker/), which adds
 * the visitor's IP address and location and forwards them to Elastic. NEXT_PUBLIC_TELEMETRY_URL (the GitHub
 * repository variable TELEMETRY_URL) points them at another worker, or turns them off when set to "off".
 */
const DEFAULT_TELEMETRY_URL = 'https://legalsakshya-telemetry.novadibyne.workers.dev';
const telemetrySetting = process.env.NEXT_PUBLIC_TELEMETRY_URL?.trim();
export const TELEMETRY_URL = telemetrySetting === 'off' ? '' : (telemetrySetting || DEFAULT_TELEMETRY_URL).replace(/\/+$/, '');
export const TELEMETRY_SERVICE_NAME = 'legal-sakshya';
/** How long Elastic keeps usage statistics; shown on the Privacy page and set by telemetry/setup-retention.mjs. */
export const STATS_RETENTION_DAYS = 365;

/** Academic context shown in the footer and Settings › About. */
export const AFFILIATION = 'Government Law College, Thiruvananthapuram';
export const AFFILIATION_NOTE = 'Developed as part of a research paper at';

/** Warn before keeping a copy of a file larger than this in browser storage. */
export const LARGE_FILE_WARN_BYTES = 500 * 1024 * 1024;

/** Path of a file the app serves itself from public/, including the GitHub Pages sub-path when there is one. */
export function assetPath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${path.replace(/^\//, '')}`;
}
