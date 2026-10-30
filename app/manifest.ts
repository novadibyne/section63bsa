import type { MetadataRoute } from 'next';
import { APP_NAME, APP_TAGLINE } from '@/lib/config';

export const dynamic = 'force-static';

/** Lets phones install the app from the browser ("Add to Home Screen"). Paths are relative so a sub-path works too. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} · ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: 'Make the Section 63 BSA certificate for electronic evidence: Part A, Part B and the SHA-256 hash report. Your evidence stays on your phone: files are never uploaded.',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7fb',
    theme_color: '#0d1b3e',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
