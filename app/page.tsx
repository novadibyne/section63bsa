'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, FileClock, Fingerprint, Lock, Plus, ScanLine } from 'lucide-react';
import { db } from '@/lib/db';
import type { Evidence, EvidenceStatus } from '@/lib/types';
import { relativeTime } from '@/lib/time';
import { APP_NAME, PRIVACY_BADGE } from '@/lib/config';
import { ButtonLink } from '@/components/ui/button';
import { KindIcon, StatusBadge } from '@/components/evidence/kind';
import { HeroVisual } from '@/components/hero-visual';
import { InstallApp } from '@/components/install-app';
import { ContactCard } from '@/components/contact';

const NEXT: Record<EvidenceStatus, { label: string; step?: number }> = {
  draft: { label: 'Add files', step: 1 },
  hashed: { label: 'Continue', step: 2 },
  certificate_drafted: { label: 'Check & finalise', step: 5 },
  finalised: { label: 'View' },
  archived: { label: 'View' },
};

function EvidenceRow({ ev, fileCount }: { ev: Evidence; fileCount: number }) {
  const next = NEXT[ev.status];
  const href = next.step ? `/certificate/?evidenceId=${ev.id}&step=${next.step}` : `/evidence/?id=${ev.id}`;
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card transition-all hover:border-line-strong hover:shadow-lift sm:px-5">
      <KindIcon kind={ev.evidenceType} />
      <Link href={`/evidence/?id=${ev.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink-950 group-hover:text-ink-800">{ev.title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          {fileCount} file{fileCount === 1 ? '' : 's'} · updated {relativeTime(ev.updatedAt)}
        </p>
      </Link>
      <div className="hidden sm:block">
        <StatusBadge status={ev.status} />
      </div>
      <ButtonLink href={href} variant={ev.status === 'finalised' ? 'secondary' : 'primary'} size="sm" className="shrink-0" aria-label={next.label}>
        <span className="hidden md:inline">{next.label}</span>
        <ArrowRight />
      </ButtonLink>
    </div>
  );
}

const HOW = [
  { title: 'Add your files', text: 'Photos, screenshots, recordings, a WhatsApp chat or documents.' },
  { title: 'Scan the phone', text: 'Make, model, IMEI and serial number are read from a photo.' },
  { title: 'Fill in Part A and/or Part B', text: 'The legal wording is filled in exactly as the law sets it out.' },
  { title: 'Download and sign', text: 'Get the PDF, sign it, and find it again any time.' },
];

export default function Home() {
  const evidence = useLiveQuery(() => db.evidence.orderBy('updatedAt').reverse().toArray(), []);
  const fileCounts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.files.each((f) => m.set(f.evidenceId, (m.get(f.evidenceId) ?? 0) + 1));
    return m;
  }, []);
  const hasEvidence = !!evidence?.length;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 shadow-card">
              <span className="size-1.5 rounded-full bg-brand-500" />
              Bharatiya Sakshya Adhiniyam, 2023 · Section 63
            </p>
            <h1 className="mt-5 font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.025em] text-ink-950 sm:text-[52px]">
              Make the <span className="text-brand-600">Section 63 certificate</span> for your digital evidence.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-600 sm:text-[16.5px]">
              Add your evidence, and {APP_NAME} prepares the certificate in the exact format the law asks for, ready to sign.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="/evidence/new/" variant="brand" size="lg" className="w-full sm:w-auto" data-testid="start">
                <Plus /> Start a new certificate
              </ButtonLink>
              {hasEvidence && (
                <ButtonLink href="/history/" variant="secondary" size="lg" className="w-full sm:w-auto">
                  <FileClock /> My certificates
                </ButtonLink>
              )}
              <InstallApp />
            </div>
            <ul className="mt-8 grid gap-3 text-[13.5px] text-ink-700 sm:grid-cols-3">
              {[
                [Lock, PRIVACY_BADGE],
                [Fingerprint, 'A unique fingerprint (SHA-256) for every file'],
                [ScanLine, 'Phone details read from a photo'],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={text as string} className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <I className="size-3.5" />
                    </span>
                    {text as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="hidden px-6 pb-6 lg:block lg:px-0">
            <HeroVisual />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {hasEvidence && (
          <section id="records" className="pt-10">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">Continue where you left off</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {evidence!.slice(0, 5).map((ev) => (
                <EvidenceRow key={ev.id} ev={ev} fileCount={fileCounts?.get(ev.id) ?? 0} />
              ))}
            </div>
            {evidence!.length > 5 && (
              <Link href="/history/" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:underline">
                See all in My certificates <ArrowRight className="size-4" />
              </Link>
            )}
          </section>
        )}

        <section id="how" className="pt-10">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink-950">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map((h, i) => (
              <li key={h.title} className="flex gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-[13px] font-bold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold text-ink-950">{h.title}</h3>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-600">{h.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="contact" className="pt-10">
          <ContactCard />
        </section>
      </div>
    </div>
  );
}
