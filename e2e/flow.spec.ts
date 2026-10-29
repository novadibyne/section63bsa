import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { STATS_ORIGIN, stubStats } from './stats';

const fixture = join(__dirname, '../tests/fixtures/whatsapp-android.txt');
const imeiPhoto = join(__dirname, '../tests/fixtures/imei-screen.png');
const expectedSha256 = createHash('sha256').update(readFileSync(fixture)).digest('hex');
const shots = process.env.E2E_SCREENSHOTS;

// The usage-statistics endpoint is the one place the app may talk to; answer it like Elastic would.
test.beforeEach(async ({ page }) => {
  await stubStats(page);
});

/** Opens "Start a new certificate", picks the parts and lands on step 1. */
async function startCertificate(page: Page, parts: 'both' | 'A' | 'B') {
  await page.goto('./evidence/new/');
  await page.getByTestId(`parts-${parts}`).click();
  await page.getByTestId('begin').click();
  await page.waitForURL(/certificate\/\?evidenceId=.+step=1/);
}

test('evidence → certificate → finalised PDF, with nothing uploaded', async ({ page }, info) => {
  const errors: string[] = [];
  const offsite: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = new URL(r.url());
    // Only network requests count; chrome:// and chrome-extension:// are the browser's own PDF viewer.
    if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname) && u.origin !== STATS_ORIGIN) offsite.push(r.url());
  });
  const snap = async (name: string) => shots && page.screenshot({ path: `${shots}/${info.project.name}-${name}.png`, fullPage: true });

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Section 63 certificate');
  // The contact email: a box at the end of Home, and the footer of every page.
  await expect(page.locator('#contact').getByTestId('contact-email')).toHaveAttribute('href', /^mailto:legalsakshya\.bsa@gmail\.com\?/);
  await expect(page.getByTestId('footer-contact')).toContainText('legalsakshya.bsa@gmail.com');
  await snap('01-dashboard');

  await page.getByTestId('start').click();
  await expect(page.getByTestId('parts-both')).toHaveAttribute('aria-checked', 'true');
  await snap('01a-start');
  await page.getByTestId('begin').click();
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
  // Read both IMEIs and the serial number from a photo of the *#06# screen, on this device.
  await page.getByTestId('scan-ids').click();
  await page.getByTestId('scan-file-input').setInputFiles(imeiPhoto);
  const results = page.getByTestId('scan-results');
  await expect(results).toContainText('IMEI 1: 490154203237518', { timeout: 90_000 });
  await expect(results).toContainText('IMEI 2: 356938035643809');
  await expect(results).toContainText('R5CW12345AB');
  await snap('03a-scan');
  await page.getByTestId('scan-use').click();
  await expect(page.getByLabel('IMEI value').nth(0)).toHaveValue('490154203237518');
  await expect(page.getByLabel('IMEI value').nth(1)).toHaveValue('356938035643809');
  await expect(page.getByRole('textbox', { name: 'Serial Number' })).toHaveValue('R5CW12345AB');
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
  await expect(page.getByText('IMEI 1 490154203237518; IMEI 2 356938035643809').first()).toBeVisible();
  await snap('06-review');
  await page.getByRole('button', { name: /Generate draft PDF/ }).click();
  await expect(page.getByRole('button', { name: /Download draft/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /Finalise version 1/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  await expect(page.getByRole('button', { name: /Download final PDF/ })).toBeVisible({ timeout: 60_000 });
  await snap('07-finalised');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download final PDF/ }).click()]);
  if (shots) await download.saveAs(`${shots}/${info.project.name}-final.pdf`);
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
  await expect(page.getByText('Device IDs read from a photo')).toBeVisible();
  await snap('09-audit');

  // History: the finalised certificate can be downloaded again later.
  await page.goto('./history/');
  const row = page.getByTestId('history-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Version 1');
  await expect(row).toContainText('Final');
  await snap('10-history');
  const [again] = await Promise.all([page.waitForEvent('download'), row.getByTestId('history-download').click()]);
  expect(readFileSync(await again.path()).equals(pdf), 'the same final PDF is downloaded again').toBe(true);

  // Offline: once the app has loaded, it works with no network at all.
  await page.goto('./privacy/');
  await expect(page.getByText('Questions about your data?')).toBeVisible();
  await expect(page.getByTestId('offline-status')).toContainText('Ready to work offline', { timeout: 30_000 });
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your evidence and the details you enter never leave your device');
  await page.goto('./history/');
  await expect(page.getByTestId('history-row')).toHaveCount(1);
  await page.context().setOffline(false);

  // A page's raw data file is never shown: the service worker sends the browser to the page itself.
  await page.goto('./evidence/new/index.txt');
  await expect(page).toHaveURL(/\/evidence\/new\/$/);
  await expect(page.getByTestId('begin')).toBeVisible();

  expect(offsite, 'no requests may leave the site, except usage statistics').toEqual([]);
  expect(errors.filter((e) => !/favicon/.test(e)), 'no console errors (incl. CSP violations)').toEqual([]);
});

test('reads make & model, IMEIs and the serial number from a box label', async ({ page }) => {
  const offsite: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    // Only network requests count; chrome:// and chrome-extension:// are the browser's own PDF viewer.
    if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname) && u.origin !== STATS_ORIGIN) offsite.push(r.url());
  });
  await startCertificate(page, 'both');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('file-card')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('continue').click();

  await page.getByLabel('Make & Model').fill('');
  await page.getByTestId('scan-ids').click();
  await page.getByTestId('scan-file-input').setInputFiles(join(__dirname, '../tests/fixtures/box-label.png'));
  const results = page.getByTestId('scan-results');
  await expect(results).toContainText('IMEI 1: 490154203237518', { timeout: 90_000 });
  await expect(results).toContainText('IMEI 2: 356938035643809');
  await expect(results).toContainText('R5CW12345AB');
  await expect(results).toContainText('read from a barcode');
  await expect(results).toContainText('Make & model: Samsung Galaxy S23 (SM-S911B/DS)');
  if (shots) await page.screenshot({ path: `${shots}/11-box-label-scan.png` });
  await page.getByTestId('scan-use').click();
  await expect(page.getByLabel('IMEI value').nth(1)).toHaveValue('356938035643809');
  await expect(page.getByLabel('Make & Model')).toHaveValue('Samsung Galaxy S23 (SM-S911B/DS)');
  await expect(page.getByRole('textbox', { name: 'Serial Number' })).toHaveValue('R5CW12345AB');
  expect(offsite, 'no requests may leave the site, except usage statistics').toEqual([]);
});

test('makes only Part B: Part A is skipped and left out of the PDF', async ({ page }, info) => {
  await startCertificate(page, 'B');
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('file-card')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/How was this record produced/).fill('Exported via WhatsApp › Export chat');
  await expect(page.getByTestId('change-parts')).toContainText('Part B only');
  await expect(page.getByRole('button', { name: /^Step \d: / })).toHaveCount(4);

  await page.getByTestId('continue').click();
  await page.getByLabel('Make & Model').fill('Samsung Galaxy S23 (SM-S911B)');
  await expect(page.getByTestId('continue')).toContainText('Next: Expert');
  await page.getByTestId('continue').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The expert’s declaration');
  await page.locator('#pb-name').fill('Dr. Neha Mehta');
  await page.locator('#pb-rel').fill('Anil Mehta');
  await page.locator('#pb-addr').fill('Cyber Forensics Lab, Baner, Pune');
  await page.locator('#pb-desig').fill('Digital Forensic Examiner');
  await page.locator('#pb-place').fill('Pune');

  await page.getByTestId('continue').click();
  await expect(page.getByText('Everything required is filled in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Part A', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Finalise version 1/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download final PDF/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/_s63_certificate_PartB_v1\.pdf$/);
  const doc = await PDFDocument.load(readFileSync(await download.path()));
  expect(doc.getPageCount(), 'Part B and the Hash Report').toBe(2);
  expect(doc.getTitle()).toContain('Part B only');

  await page.goto('./history/');
  await expect(page.getByTestId('history-row')).toContainText('Part B only');
  if (shots) await page.screenshot({ path: `${shots}/${info.project.name}-12-part-b-history.png`, fullPage: true });
});
