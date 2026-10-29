import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const shots = process.env.E2E_SCREENSHOTS;

for (const [name, path] of [
  ['dashboard', './'],
  ['history', './history/'],
  ['why', './why/'],
  ['privacy', './privacy/'],
  ['audit', './audit/'],
  ['settings', './settings/'],
] as const) {
  test(`no horizontal scroll at phone width: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (shots) await page.screenshot({ path: `${shots}/m-${name}.png` });
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('affiliation')).toContainText('Government Law College, Thiruvananthapuram');
  });
}

test('no horizontal scroll at phone width: wizard', async ({ page }) => {
  await page.goto('./evidence/new/');
  await page.waitForURL(/certificate\/\?evidenceId=/);
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (shots) await page.screenshot({ path: `${shots}/m-wizard.png` });
  expect(overflow).toBeLessThanOrEqual(0);
});
