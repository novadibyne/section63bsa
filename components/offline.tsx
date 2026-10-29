'use client';

import * as React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { assetPath } from '@/lib/config';

/** Registers the service worker (out/sw.js, built by scripts/build-sw.mjs) so the app keeps working offline. */
export function ServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    // When a new version takes over an open page, reload once so the whole page runs the new version.
    const hadController = !!sw.controller;
    let reloaded = false;
    const onChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    sw.addEventListener('controllerchange', onChange);
    sw.register(assetPath('sw.js'), { scope: assetPath('') })
      .then((reg) => reg.update())
      .catch(() => {
        /* offline support is a bonus; the app works without it */
      });
    return () => sw.removeEventListener('controllerchange', onChange);
  }, []);
  return null;
}

export function useOfflineReady(): boolean | undefined {
  const [ready, setReady] = React.useState<boolean>();
  React.useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return setReady(false);
    let alive = true;
    void navigator.serviceWorker.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export function OfflineStatus() {
  const ready = useOfflineReady();
  if (ready === false) return null;
  return (
    <p className="inline-flex items-center gap-2 text-[13px] font-medium text-brand-800" data-testid="offline-status">
      {ready ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
      {ready ? 'Ready to work offline in this browser' : 'Getting ready to work offline…'}
    </p>
  );
}
