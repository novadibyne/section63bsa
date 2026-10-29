import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ServiceWorker } from '@/components/offline';
import { APP_NAME, APP_TAGLINE, SITE_URL, assetPath } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} · ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description:
    'Hash electronic evidence and draft the Section 63(4)(c) BSA certificate (Part A, Part B and Hash Report) entirely in your browser. Files are never uploaded.',
  icons: { icon: assetPath('favicon.svg') },
};

export const viewport: Viewport = { themeColor: '#0d1b3e' };

// connect-src 'self' means the browser itself refuses to send file contents anywhere else.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
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
      <head>{process.env.NODE_ENV === 'production' && <meta httpEquiv="Content-Security-Policy" content={CSP} />}</head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ServiceWorker />
        <Toaster position="bottom-right" toastOptions={{ className: 'font-sans' }} richColors closeButton />
      </body>
    </html>
  );
}
