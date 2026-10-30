import Link from 'next/link';
import { APP_NAME, SITE_DOMAIN } from '@/lib/config';
import { pageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/ui/misc';
import { ContactEmail } from '@/components/contact';

export const metadata = pageMetadata({
  title: 'Terms of use',
  description: `The terms for using ${APP_NAME}: a free tool that prepares a draft Section 63 BSA certificate and reads facts from files, provided as is and not legal advice.`,
  path: '/terms/',
});

/** Shown at the top of the page; change it whenever the terms change. */
const UPDATED = '30 October 2026';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: `What ${APP_NAME} is`,
    body: `${APP_NAME} (${SITE_DOMAIN}) is a free tool that helps you prepare a draft certificate in the format of the Schedule to Section 63 of the Bharatiya Sakshya Adhiniyam, 2023, and reads facts from the files you add. In these terms, “we” means the people who run ${APP_NAME}, and “you” means anyone who uses it.`,
  },
  {
    title: 'Not legal advice',
    body: `${APP_NAME} does not give legal advice, and using it does not create a lawyer–client relationship with anyone. Its explanations of the law are short summaries. Check the certificate against the official Act and take advice from a lawyer before relying on it.`,
  },
  {
    title: 'The certificate is yours',
    body: 'The app fills in the certificate from what you enter. It does not certify anything, check who you are, or check that what you or the expert declare is true. You and the expert are responsible for every detail, for signing Part A and Part B, and for filing the certificate correctly. Whether a court accepts a certificate is for the court to decide.',
  },
  {
    title: 'File observations',
    body: 'File observations are generated automatically by software from the file’s own data. They are informational only: not part of the certificate, not an expert opinion under Section 39 of the Bharatiya Sakshya Adhiniyam, and not a finding that any file is genuine, altered or AI-generated. They may be incomplete or wrong, and the absence of an observation does not show that a file is unaltered. They are attached to the PDF only if you choose, and their meaning is for a qualified examiner to assess.',
  },
  {
    title: 'Your data',
    body: (
      <>
        Your files and the details you enter stay in your browser on your device; we never receive them, so we cannot recover them.
        Keep your own copies: save each final PDF, or export a case bundle. The usage statistics we collect, and how long we keep
        them, are described on the{' '}
        <Link href="/privacy/" className="font-medium text-brand-700 hover:underline">
          Privacy page
        </Link>
        .
      </>
    ),
  },
  {
    title: 'Use it lawfully',
    body: 'Only add files you are entitled to handle, and do not use the app to mislead a court or anyone else.',
  },
  {
    title: 'Provided as is',
    body: `${APP_NAME} is provided free of charge, “as is” and “as available”. We make no promise that it is accurate, complete, error-free, always available, or suitable for any particular case, court or purpose.`,
  },
  {
    title: 'Limitation of liability',
    body: `To the extent the law allows, we are not liable for any loss or damage arising from using ${APP_NAME} or relying on anything it produces, including a certificate, a hash report or a file observation: for example a certificate or piece of evidence that is not accepted, a mistake in a document, or lost data. Nothing in these terms limits liability that cannot be limited by law.`,
  },
  {
    title: 'Open-source software',
    body: `${APP_NAME} is built with open-source software, each part under its own licence, listed in the project’s THIRD_PARTY_LICENSES file.`,
  },
  {
    title: 'Changes and law',
    body: 'We may update these terms; the date at the top shows the latest version, and using the app after a change means you accept it. These terms are governed by the laws of India.',
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Terms" title="Terms of use" description={`Plain words, in short. Last updated ${UPDATED}.`} />
      <ol className="mt-8 flex flex-col gap-6">
        {SECTIONS.map((s, i) => (
          <li key={s.title}>
            <h2 className="font-display text-[16px] font-semibold text-ink-950">
              {i + 1}. {s.title}
            </h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-700">{s.body}</p>
          </li>
        ))}
        <li>
          <h2 className="font-display text-[16px] font-semibold text-ink-950">{SECTIONS.length + 1}. Contact</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-700">
            Questions about these terms: <ContactEmail icon={false} />
          </p>
        </li>
      </ol>
    </div>
  );
}
