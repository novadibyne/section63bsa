'use client';

import * as React from 'react';
import { Share, Smartphone, SquarePlus } from 'lucide-react';
import { APP_NAME } from '@/lib/config';
import { track } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/**
 * "Install as an app": Android (and desktop Chrome/Edge) get the browser's own install prompt; iPhone and iPad,
 * which have none, get the Add to Home Screen steps. Hidden once the app is installed.
 */
export function InstallApp({ className }: { className?: string }) {
  const [prompt, setPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = React.useState(false);
  const [installed, setInstalled] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      track('app_installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        data-testid="install-app"
        onClick={async () => {
          if (!prompt) return setOpen(true);
          await prompt.prompt();
          setPrompt(null);
        }}
      >
        <Smartphone /> Install as an app
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add to your Home Screen"
        description={`${APP_NAME} then opens like an app, works without internet, and Safari keeps your certificates safe.`}
        footer={<Button onClick={() => setOpen(false)}>Got it</Button>}
      >
        <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14px] leading-relaxed text-ink-800">
          <li>
            Tap the <strong className="font-semibold">Share</strong> button <Share className="inline size-4 align-[-3px] text-brand-700" /> in
            Safari’s toolbar.
          </li>
          <li>
            Scroll down and tap <strong className="font-semibold">Add to Home Screen</strong>{' '}
            <SquarePlus className="inline size-4 align-[-3px] text-brand-700" />.
          </li>
          <li>
            Tap <strong className="font-semibold">Add</strong>. The {APP_NAME} icon appears on your Home Screen.
          </li>
        </ol>
      </Dialog>
    </>
  );
}
