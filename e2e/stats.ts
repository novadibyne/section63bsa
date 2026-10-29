import type { Page } from '@playwright/test';

/** The usage-statistics address the e2e build is made with (see README). Nothing real listens there. */
export const STATS_ORIGIN = 'https://telemetry.invalid';

/** Answers the app's usage-statistics requests like the telemetry worker would, and keeps what was sent. */
export async function stubStats(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route(`${STATS_ORIGIN}/**`, async (route) => {
    const req = route.request();
    const body = req.postData();
    if (body) sent.push(body);
    await route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': req.headers()['origin'] ?? '*',
        'access-control-allow-headers': 'Content-Type',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
    });
  });
  return sent;
}

/** True when the site under test sends usage statistics to the test address. */
export async function statsBuilt(page: Page): Promise<boolean> {
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  return !!csp?.includes(STATS_ORIGIN);
}
