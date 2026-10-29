export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Legal Sakshya';
export const APP_TAGLINE = 'Section 63 BSA certificate drafter';
export const SITE_DOMAIN = 'legalsakshya.com';
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const HASH_WASM_VERSION = process.env.NEXT_PUBLIC_HASH_WASM_VERSION || 'unknown';

export const BARE_ACT_URL = 'https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf';

/** The privacy promise. Shown on every page and wherever something is added. */
export const PRIVACY_BADGE = '100% on-device · 100% safe';
export const PRIVACY_LINE = 'Nothing you add ever leaves this device.';

/** Academic context shown in the footer and Settings › About. */
export const AFFILIATION = 'Government Law College, Thiruvananthapuram';
export const AFFILIATION_NOTE = 'Developed as part of a research paper at';

/** Warn before keeping a copy of a file larger than this in browser storage. */
export const LARGE_FILE_WARN_BYTES = 500 * 1024 * 1024;

/** Path of a file the app serves itself from public/, including the GitHub Pages sub-path when there is one. */
export function assetPath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${path.replace(/^\//, '')}`;
}
