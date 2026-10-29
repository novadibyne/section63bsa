'use client';

import * as React from 'react';
import { Toaster } from 'sonner';

/** Notifications at the top on phones, where the bottom holds the Back / Next bar; bottom-right elsewhere. */
export function AppToaster() {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return <Toaster position={phone ? 'top-center' : 'bottom-right'} toastOptions={{ className: 'font-sans' }} richColors closeButton />;
}
