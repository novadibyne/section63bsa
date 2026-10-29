'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { startTelemetry, track } from '@/lib/telemetry';

/** Starts usage statistics and counts each page opened. Inert when statistics are off. */
export function Telemetry() {
  const pathname = usePathname();
  React.useEffect(() => startTelemetry(), []);
  React.useEffect(() => {
    track('page_view', { path: pathname });
  }, [pathname]);
  return null;
}
