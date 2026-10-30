import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ServiceWorker } from '@/components/offline';
import { AppToaster } from '@/components/app-toaster';
import { Telemetry } from '@/components/telemetry';
import { JsonLd } from '@/components/json-ld';
import { APP_NAME, SITE_URL, TELEMETRY_URL, assetPath } from '@/lib/config';
import { OG_IMAGE, SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_JSON_LD } from '@/lib/seo';

// Search Console and Bing Webmaster Tools ownership checks: the repository variables GOOGLE_SITE_VERIFICATION and
// BING_SITE_VERIFICATION (the code from their "HTML tag" option), passed in by the deploy workflow.
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

// Defaults for every page; each public page sets its own title, description and canonical address (lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SEO_TITLE, template: `%s | ${APP_NAME}` },
  description: SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: APP_NAME,
  category: 'legal',
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: APP_NAME, locale: 'en_IN', title: SEO_TITLE, description: SEO_DESCRIPTION, images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: SEO_TITLE, description: SEO_DESCRIPTION, images: [OG_IMAGE.url] },
  icons: {
    icon: [
      { url: assetPath('favicon.ico'), sizes: '16x16 32x32 48x48' },
      { url: assetPath('favicon.svg'), type: 'image/svg+xml' },
    ],
    apple: assetPath('icons/apple-touch-icon.png'),
  },
  // iPhone: open full screen, with its own name, when added to the Home Screen.
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  verification: {
    ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
    ...(BING_VERIFICATION ? { other: { 'msvalidate.01': BING_VERIFICATION } } : {}),
  },
};

export const viewport: Viewport = { themeColor: '#0d1b3e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// connect-src means the browser itself refuses to send anything anywhere else. The only exception is the
// usage-statistics worker, when statistics are on (lib/telemetry.ts).
const STATS_ORIGIN = TELEMETRY_URL ? new URL(TELEMETRY_URL).origin : '';
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' blob: data:${STATS_ORIGIN ? ` ${STATS_ORIGIN}` : ''}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        {process.env.NODE_ENV === 'production' && <meta httpEquiv="Content-Security-Policy" content={CSP} />}
        {SITE_JSON_LD.map((data) => (
          <JsonLd key={data['@type']} data={data} />
        ))}
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ServiceWorker />
        <Telemetry />
        <AppToaster />
      </body>
    </html>
  );
}
