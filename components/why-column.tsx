import Link from 'next/link';
import { ArrowRight, Gavel, Landmark, Lightbulb } from 'lucide-react';
import { CERTIFICATE_HISTORY, WHAT_IT_MEANS } from '@/lib/legal/case-law';
import { cn } from '@/lib/utils';

/** The certificate's history as a timeline. `full` shows the longer summaries (the /why/ page). */
export function CertificateTimeline({ full = false }: { full?: boolean }) {
  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-5" data-testid="timeline">
      {CERTIFICATE_HISTORY.map((m) => (
        <li key={m.title} className="relative">
          <span
            className={cn(
              'absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-white [&_svg]:size-3',
              m.key ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-700',
            )}
          >
            {m.kind === 'law' ? <Landmark /> : <Gavel />}
          </span>
          <p className={cn('text-[12px] font-bold tracking-wide', m.key ? 'text-brand-700' : 'text-ink-500')}>{m.date ?? m.year}</p>
          <p className={cn('mt-0.5 leading-snug font-semibold text-ink-950', full ? 'text-[16px]' : 'text-[14px]')}>
            {m.kind === 'judgment' ? <em className="not-italic">{m.title}</em> : m.title}
          </p>
          {m.citation && <p className="text-[12px] text-ink-500">{m.citation}</p>}
          <p className={cn('mt-1 leading-relaxed text-ink-700', full ? 'text-[14.5px]' : 'text-[13px]')}>{full ? m.summary : m.short}</p>
        </li>
      ))}
    </ol>
  );
}

export function WhatItMeans({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-brand-200 bg-brand-50/70 p-4', className)}>
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-brand-900">
        <Lightbulb className="size-4" /> What this means for you
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-brand-900/90">
        {WHAT_IT_MEANS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** The home page's side column: why the certificate matters, from Arjun Panditrao (2020) to Section 63 BSA. */
export function WhyColumn() {
  return (
    <aside className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6" aria-labelledby="why-title" data-testid="why-column">
      <p className="eyebrow mb-2">Why this certificate matters</p>
      <h2 id="why-title" className="font-display text-[19px] leading-snug font-bold tracking-tight text-ink-950">
        Without it, a copy of digital evidence can be refused.
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
        Since <em>Arjun Panditrao Khotkar</em> (2020) the certificate is mandatory, and Section 63 of the BSA now fixes its exact format.
      </p>
      <div className="mt-5 pl-2.5">
        <CertificateTimeline />
      </div>
      <WhatItMeans className="mt-5" />
      <Link href="/why/" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline">
        Read the full story <ArrowRight className="size-4" />
      </Link>
    </aside>
  );
}
