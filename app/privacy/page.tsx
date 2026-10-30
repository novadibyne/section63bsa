import { Ban, BarChart3, Camera, Cpu, FileLock2, HardDrive, Plane, ScanSearch, ServerOff, ShieldCheck } from 'lucide-react';
import { APP_NAME, PRIVACY_BADGE, PRIVACY_LINE, STATS_RETENTION_DAYS, TELEMETRY_URL } from '@/lib/config';
import { pageMetadata } from '@/lib/seo';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { OfflineStatus } from '@/components/offline';
import { ContactCard } from '@/components/contact';

export const metadata = pageMetadata({
  title: 'Privacy: your evidence never leaves your device',
  description:
    'Evidence files, photos and the details you enter are processed and kept in your browser and never uploaded. What usage statistics are collected, and for how long.',
  path: '/privacy/',
});

/** Usage statistics are on unless the site is built with NEXT_PUBLIC_TELEMETRY_URL=off (see lib/telemetry.ts). */
const STATS_ON = !!TELEMETRY_URL;

const PROMISES = [
  { icon: Cpu, title: 'Everything happens on this device', text: 'Files are fingerprinted (hashed), read and turned into the certificate PDF inside this browser.' },
  { icon: ServerOff, title: 'No account, no upload', text: 'There is no login, and your files have nowhere to go: the app has no server for them.' },
  STATS_ON
    ? {
        icon: BarChart3,
        title: 'Usage statistics',
        text: `To see how the app is used, we record visits and what kind of certificate is made (for example “final PDF, Part A only, 3 photos and a WhatsApp chat, a Samsung phone, a magistrate’s court”), with your IP address, approximate location, browser and device. Kept for ${STATS_RETENTION_DAYS} days. Never your evidence, file names, hashes, names, addresses, IMEI or serial numbers, case numbers, court names or anything else you type.`,
      }
    : { icon: Ban, title: 'No tracking', text: 'No analytics, no ads and no error-reporting services. Fonts and tools are served by this site itself.' },
  {
    icon: FileLock2,
    title: 'Locked by the browser',
    text: STATS_ON
      ? 'A security policy tells the browser to refuse to send data to any other website, except the usage-statistics service, which only receives the counts above.'
      : 'A security policy tells the browser to refuse any attempt to send data to another website.',
  },
  { icon: Camera, title: 'Photos for IMEI scans are thrown away', text: 'They are read on this device to find the numbers, then dropped. They are never saved or uploaded.' },
  { icon: ScanSearch, title: 'File checks run here too', text: 'File observations are read from each file on this device. Nothing is sent anywhere to check a file.' },
];

const CHECK = [
  'Open this site once while you are online.',
  'Turn on airplane mode, or switch off Wi-Fi and mobile data.',
  'Reload the page. The app still opens.',
  'Add a file, fill in the certificate and download the PDF. It all works, because nothing needs the internet.',
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-ink-950 px-6 py-8 text-white sm:px-10 sm:py-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 text-[12px] font-semibold text-brand-400 ring-1 ring-brand-400/30">
          <ShieldCheck className="size-3.5" /> {PRIVACY_BADGE}
        </p>
        <h1 className="mt-4 font-display text-[30px] leading-tight font-extrabold tracking-tight sm:text-[38px]">{PRIVACY_LINE}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">
          Evidence is sensitive. {APP_NAME} never uploads it: your files, photos, names and certificates stay in this browser on this
          device.
        </p>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PROMISES.map((p) => (
          <div key={p.title} className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <p.icon className="size-[18px]" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink-950">{p.title}</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-600">{p.text}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader icon={<Plane />} title="Check it yourself in one minute" description="You don’t have to take our word for it." />
        <CardBody className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-ink-800">
            {CHECK.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <OfflineStatus />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader icon={<HardDrive />} title="Where your data is kept" />
        <CardBody>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[14px] leading-relaxed text-ink-700">
            <li>In this browser’s own storage, on this device only. Another browser or device can’t see it.</li>
            <li>
              To move it or back it up, export a <strong className="font-semibold">case bundle</strong> from a record’s page and import it
              in Settings.
            </li>
            <li>Keep this device locked with a PIN or password: anyone who can open this browser on it can open your records.</li>
            <li>
              To delete everything, use <strong className="font-semibold">Settings › Clear all data</strong>, or clear this site’s data in
              the browser.
            </li>
          </ul>
        </CardBody>
      </Card>

      <ContactCard
        className="mt-6"
        title="Questions about your data?"
        text={STATS_ON ? 'Email us about privacy or the usage statistics.' : 'Email us about privacy.'}
      />
    </div>
  );
}
