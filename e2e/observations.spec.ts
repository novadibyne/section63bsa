import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { STATS_ORIGIN, stubStats } from './stats';

const fx = (f: string) => join(__dirname, '../tests/fixtures', f);

test.beforeEach(async ({ page }) => {
  await stubStats(page);
});

const card = (page: Page, name: string) => page.getByTestId('file-card').filter({ has: page.getByRole('heading', { name, exact: true }) });

/** Opens a file's observations (if folded) and returns the panel. */
async function observations(page: Page, name: string): Promise<Locator> {
  const panel = card(page, name).getByTestId('file-observations');
  if (!(await panel.getByTestId('observation').count())) await panel.locator('button').first().click();
  return panel;
}
const item = (panel: Locator, check: string) => panel.getByTestId('observation').filter({ hasText: check });

async function pdfPages(page: Page, button: RegExp): Promise<number> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).click()]);
  return (await PDFDocument.load(readFileSync(await download.path()))).getPageCount();
}

test('file observations are read on this device, stated as facts, and attached to the PDF only when chosen', async ({ page }) => {
  const offsite: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname) && u.origin !== STATS_ORIGIN) offsite.push(r.url());
  });

  await page.goto('./evidence/new/');
  await page.getByTestId('parts-both').click();
  await page.getByTestId('begin').click();
  await page.waitForURL(/certificate\/\?evidenceId=.+step=1/);
  await page.getByTestId('file-input').setInputFiles([fx('edited-photo.jpg'), fx('edited-photo-copy.jpg'), fx('c2pa/C.jpg'), fx('c2pa/XCA.jpg')]);
  await expect(page.getByTestId('file-card')).toHaveCount(4, { timeout: 120_000 });

  // A photo that names an editor, with different "taken" and "changed" dates, and a recompressed copy of it.
  let panel = await observations(page, 'edited-photo.jpg');
  await expect(panel).toContainText('Generated automatically by software from the file’s own data. Informational only.');
  await expect(item(panel, 'Software named in the picture')).toHaveAttribute('data-status', 'noted');
  await expect(item(panel, 'Software named in the picture')).toContainText('Adobe Photoshop 25.0 (Windows)');
  await expect(item(panel, 'When it was taken and when it was last changed')).toHaveAttribute('data-status', 'noted');
  await expect(item(panel, 'Pictures in this record that look the same')).toContainText('edited-photo-copy.jpg');
  await expect(item(panel, 'Camera named in the picture')).toHaveAttribute('data-status', 'unavailable');

  // Content Credentials (C2PA), read with the C2PA library served by this site.
  panel = await observations(page, 'C.jpg');
  await expect(item(panel, 'Content Credentials (C2PA)')).toContainText('The file’s content matches what was signed.', { timeout: 60_000 });
  await expect(item(panel, 'Labels written by AI or other generators')).toContainText('algorithmicMedia');
  panel = await observations(page, 'XCA.jpg');
  await expect(item(panel, 'Content Credentials (C2PA)')).toContainText('assertion.dataHash.mismatch');

  for (const text of await page.getByTestId('observation').allTextContents()) {
    expect(text).not.toMatch(/\b(fake|forged|tampered|genuine|authentic)\b/i);
  }

  // The camera named in the photo, against a different phone entered in step 2.
  await page.getByTestId('continue').click();
  await page.getByLabel('Make & Model').fill('Apple iPhone 14');
  await page.getByRole('button', { name: /Back/ }).click();
  panel = await observations(page, 'edited-photo.jpg');
  await expect(item(panel, 'Camera named in the picture')).toHaveAttribute('data-status', 'noted');
  await expect(item(panel, 'Camera named in the picture')).toContainText('‘samsung SM-S911B’');

  // Step 5: no annexure unless ticked.
  await page.goto(page.url().replace(/step=\d/, 'step=5'));
  const option = page.getByLabel('Attach file observations (optional)');
  await expect(option).not.toBeChecked();
  await page.getByRole('button', { name: /Generate draft PDF/ }).click();
  await expect(page.getByRole('button', { name: /Download draft/ })).toBeVisible({ timeout: 60_000 });
  const without = await pdfPages(page, /Download draft/);
  await option.check();
  await expect(option).toBeChecked();
  await page.getByRole('button', { name: /Regenerate draft PDF/ }).click();
  await page.waitForTimeout(1500);
  const withAnnexure = await pdfPages(page, /Download draft/);
  expect(withAnnexure).toBeGreaterThan(without);

  await page.goto('./audit/');
  await expect(page.getByText('File observations generated').first()).toBeVisible();
  expect(offsite, 'nothing may leave the device').toEqual([]);
});
