import { GraduationCap, Scale } from 'lucide-react';
import Link from 'next/link';
import { AFFILIATION, AFFILIATION_NOTE, APP_NAME, BARE_ACT_URL } from '@/lib/config';
import { ContactEmail } from '@/components/contact';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-[13px] text-ink-500 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="flex max-w-2xl gap-3">
          <Scale className="mt-0.5 size-4 shrink-0 text-ink-400" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-ink-700">{APP_NAME} prepares drafts only and does not certify anything.</strong>{' '}
            Part A must be affirmed by the party and Part B signed by an expert. Signatures are added outside the app. Check the
            text against the official Bharatiya Sakshya Adhiniyam, 2023 and take legal advice before relying on any certificate.
          </p>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <div className="flex flex-col gap-1 md:items-end" data-testid="footer-contact">
            <span className="text-[12px] font-semibold tracking-wide text-ink-700 uppercase">Contact us</span>
            <ContactEmail className="text-[14px]" />
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-2 md:justify-end">
            <Link href="/privacy/" className="hover:text-ink-900">
              Privacy
            </Link>
            <Link href="/terms/" className="hover:text-ink-900">
              Terms
            </Link>
            <Link href="/audit/" className="hover:text-ink-900">
              Activity log
            </Link>
            <a href={BARE_ACT_URL} target="_blank" rel="noreferrer" className="hover:text-ink-900">
              BSA 2023 bare Act
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-ink-50/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6" data-testid="affiliation">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white">
            <GraduationCap className="size-4" />
          </span>
          <p className="text-[13px] leading-snug text-ink-600">
            {AFFILIATION_NOTE} <strong className="font-semibold text-ink-900">{AFFILIATION}</strong>
          </p>
        </div>
      </div>
    </footer>
  );
}
