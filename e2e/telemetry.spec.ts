import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { statsBuilt, stubStats } from './stats';

const fixture = join(__dirname, '../tests/fixtures/whatsapp-android.txt');
const fixtureSha256 = createHash('sha256').update(readFileSync(fixture)).digest('hex');

test('usage statistics report what happened, never the evidence', async ({ page }) => {
  const sent = await stubStats(page);
  await page.goto('./');
  test.skip(!(await statsBuilt(page)), 'built without NEXT_PUBLIC_TELEMETRY_URL=https://telemetry.invalid');

  await page.goto('./evidence/new/');
  await page.getByTestId('parts-B').click();
  await page.getByTestId('begin').click();
  await page.waitForURL(/certificate\/\?evidenceId=.+step=1/);
  await page.getByTestId('file-input').setInputFiles(fixture);
  await expect(page.getByTestId('file-card')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/How was this record produced/).fill('Exported via WhatsApp › Export chat by Ravi Sharma');
  await page.getByTestId('continue').click();
  await page.getByLabel('Make & Model').fill('Samsung Galaxy S23 (SM-S911B)');
  await page.getByLabel('IMEI value').fill('490154203237518');
  await page.getByTestId('continue').click();
  await page.locator('#pb-name').fill('Dr. Neha Mehta');
  await page.locator('#pb-rel').fill('Anil Mehta');
  await page.locator('#pb-addr').fill('Cyber Forensics Lab, Baner, Pune');
  await page.locator('#pb-desig').fill('Digital Forensic Examiner');
  await page.locator('#pb-place').fill('Pune');
  await page.getByTestId('continue').click();
  await page.getByRole('button', { name: /Finalise version 1/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download final PDF/ }).click()]);

  // Events go out in batches; hiding the page sends what is waiting.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => sent.join('\n'), { timeout: 15_000 }).toContain('pdf_downloaded');
  const all = sent.join('\n');
  if (process.env.STATS_DUMP) writeFileSync(process.env.STATS_DUMP, all);

  // Every request is OpenTelemetry logs JSON, as the worker expects.
  const records = sent.flatMap((b) => JSON.parse(b).resourceLogs.flatMap((r: { scopeLogs: { logRecords: unknown[] }[] }) => r.scopeLogs[0].logRecords));
  const names = records.map((r) => (r as { body: { stringValue: string } }).body.stringValue);
  for (const event of ['page_view', 'certificate_started', 'evidence_added', 'pdf_generated', 'pdf_downloaded']) {
    expect(names, `reports ${event}`).toContain(event);
  }
  expect(all).toContain('{"key":"legal_sakshya.parts","value":{"stringValue":"B"}}');
  expect(all).toContain('{"key":"legal_sakshya.kind","value":{"stringValue":"final"}}');
  expect(all).toContain('{"key":"service.name","value":{"stringValue":"legal-sakshya"}}');

  // None of what the user typed or added may be in it.
  for (const secret of ['Ravi', 'Meera', 'Neha', 'Mehta', 'Baner', 'Samsung', '490154203237518', fixtureSha256, 'evidenceId=', 'WhatsApp chat', 'whatsapp-android']) {
    expect(all, `must not contain ${secret}`).not.toContain(secret);
  }
});
