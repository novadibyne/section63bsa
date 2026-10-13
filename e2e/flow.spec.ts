import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const fixture = join(__dirname, '../tests/fixtures/whatsapp-android.txt');
const expectedSha256 = createHash('sha256').update(readFileSync(fixture)).digest('hex');
const shots = process.env.E2E_SCREENSHOTS;

test('evidence → certificate → finalised PDF, with nothing uploaded', async ({ page }) => {
  const errors: string[] = [];
  const offsite: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) offsite.push(r.url());
  });
  const snap = async (name: string) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Section 63 certificate');
  await snap('01-dashboard');

  await page.getByTestId('start').click();
  await page.waitForURL(/certificate\/\?evidenceId=.+step=1/);

  // Step 1: add a WhatsApp export; it is hashed in the browser.
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('file-card')).toContainText(expectedSha256, { timeout: 30_000 });
  await expect(page.getByTestId('file-card')).toContainText('WhatsApp export');
  await page.getByLabel(/How was this record produced/).fill('Exported via WhatsApp › Export chat on the phone described in step 2');
  await expect(page.getByLabel('Title')).toHaveValue(/WhatsApp chat — Ravi Sharma, Meera Iyer/);
  await snap('02-evidence');

  // Step 2: device (Mobile + Cloud are suggested for a WhatsApp export).
  await page.getByTestId('continue').click();
  await expect(page.getByRole('checkbox', { name: 'Mobile' })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Make & Model').fill('Samsung Galaxy S23 (SM-S911B)');
  await page.getByLabel('Color').fill('Phantom Black');
  await page.getByLabel('IMEI value').fill('490154203237518');
  await snap('03-device');

  // Step 3: Part A.
  await page.getByTestId('continue').click();
  await page.locator('#pa-name').fill('Ravi Sharma');
  await page.locator('#pa-rel').fill('Suresh Sharma');
  await page.locator('#pa-addr').fill('14 MG Road, Pune 411001');
  await page.getByRole('checkbox', { name: 'Owned' }).click();
  await page.getByRole('checkbox', { name: 'Operated' }).click();
  await page.getByLabel(/I have read and understood/).check();
  await page.locator('#pa-place').fill('Pune');
  await snap('04-part-a');

  // Step 4: Part B.
  await page.getByTestId('continue').click();
  await page.locator('#pb-name').fill('Dr. Neha Mehta');
  await page.locator('#pb-rel').fill('Anil Mehta');
  await page.locator('#pb-addr').fill('Cyber Forensics Lab, Baner, Pune');
  await page.locator('#pb-desig').fill('Digital Forensic Examiner');
  await page.locator('#pb-place').fill('Pune');
  await snap('05-part-b');

  // Step 5: review, generate, finalise.
  await page.getByTestId('continue').click();
  await expect(page.getByText('Everything required is filled in')).toBeVisible();
  await expect(page.getByText('Ravi Sharma').first()).toBeVisible();
  await snap('06-review');
  await page.getByRole('button', { name: /Generate draft PDF/ }).click();
  await expect(page.getByRole('button', { name: /Download draft/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /Finalise version 1/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  await expect(page.getByRole('button', { name: /Download final PDF/ })).toBeVisible({ timeout: 60_000 });
  await snap('07-finalised');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download final PDF/ }).click()]);
  if (shots) await download.saveAs(`${shots}/final.pdf`);
  const pdf = readFileSync(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(4000);
  expect(download.suggestedFilename()).toMatch(/_s63_certificate_v1\.pdf$/);

  // Evidence overview + audit log.
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByText('Version 1').first()).toBeVisible();
  await snap('08-evidence');
  await page.goto('./audit/');
  await expect(page.getByText(/Chain intact — \d+ entries verified/)).toBeVisible();
  await expect(page.getByText('Certificate finalised')).toBeVisible();
  await snap('09-audit');

  expect(offsite, 'no requests may leave the site').toEqual([]);
  expect(errors.filter((e) => !/favicon/.test(e)), 'no console errors (incl. CSP violations)').toEqual([]);
});
