import { defineConfig, devices } from '@playwright/test';

// Runs against a static build served under the GitHub Pages sub-path:
//   NEXT_PUBLIC_BASE_PATH=/section63bsa npm run build
//   mkdir -p .site && cp -r out .site/section63bsa && npx serve .site -l 4173
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173/section63bsa/',
    acceptDownloads: true,
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  reporter: [['list']],
});
