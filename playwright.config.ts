import { defineConfig, devices } from '@playwright/test';

// Runs against a static build served under the GitHub Pages sub-path:
//   NEXT_PUBLIC_BASE_PATH=/section63bsa npm run build
//   mkdir -p .site && cp -r out .site/section63bsa && npx serve .site -l 4173
//
// The whole flow also runs at Android and iPhone screen sizes with touch input. Both use Chromium:
// it checks layout, touch and the phone-only UI, not Safari's engine.
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173/section63bsa/',
    acceptDownloads: true,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] }, testMatch: /flow\.spec/ },
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' }, testMatch: /flow\.spec/ },
  ],
  reporter: [['list']],
});
