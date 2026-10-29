'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { startTelemetry, track } from '@/lib/telemetry';

/** Starts usage statistics once the page has loaded, and counts each page opened. Inert when statistics are off. */
export function Telemetry() {
  const pathname = usePathname();
  React.useEffect(() => {
    const start = () => void startTelemetry();
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }, []);
  React.useEffect(() => {
    track('page_view', { path: pathname });
  }, [pathname]);
  return null;
}
