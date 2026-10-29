import { gunzipSync } from 'node:zlib';
import type { Page } from '@playwright/test';

/** The usage-statistics address the e2e build is made with (see README). Nothing real listens there. */
export const STATS_ORIGIN = 'https://apm.invalid';

/** Answers the app's usage-statistics requests like Elastic APM would, and keeps what was sent. */
export async function stubStats(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route(`${STATS_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const body = req.postDataBuffer();
    if (body?.length) sent.push((req.headers()['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString('utf8'));
    await route.fulfill({
      status: 202,
      headers: {
        'access-control-allow-origin': req.headers()['origin'] ?? '*',
        'access-control-allow-headers': 'content-type, content-encoding',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
      body: '',
    });
  });
  return sent;
}

/** True when the site under test was built with usage statistics on. */
export async function statsBuilt(page: Page): Promise<boolean> {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  return !!csp?.includes(STATS_ORIGIN);
}
