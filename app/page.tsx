'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Cpu,
  FileCheck2,
  FileStack,
  Fingerprint,
  FolderOpen,
  Lock,
  Plus,
  ScrollText,
  ShieldCheck,
  Stamp,
  UserRoundCheck,
} from 'lucide-react';
import { db } from '@/lib/db';
import type { Evidence, EvidenceStatus } from '@/lib/types';
import { relativeTime } from '@/lib/time';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { KindIcon, StatusBadge } from '@/components/evidence/kind';
import { HeroVisual } from '@/components/hero-visual';

const NEXT: Record<EvidenceStatus, { label: string; step?: number }> = {
  draft: { label: 'Add files', step: 1 },
  hashed: { label: 'Complete the certificate', step: 2 },
  certificate_drafted: { label: 'Review & finalise', step: 5 },
  finalised: { label: 'View record' },
  archived: { label: 'View record' },
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
      <ButtonLink href={href} variant={ev.status === 'finalised' ? 'secondary' : 'primary'} size="sm" className="shrink-0">
        <span className="hidden md:inline">{next.label}</span>
        <ArrowRight />
      </ButtonLink>
    </div>
  );
}

const HOW = [
  { icon: FileStack, title: 'Add the evidence', text: 'Photos, recordings, a WhatsApp export or documents. Each file gets its SHA-256 hash instantly.' },
  { icon: Cpu, title: 'Describe the device', text: 'Phone, computer, DVR or cloud: make, model, serial, IMEI. Photo EXIF pre-fills what it can.' },
  { icon: UserRoundCheck, title: 'Part A and Part B', text: 'The party’s declaration and the expert’s details, with the statutory text exactly as in the Schedule.' },
  { icon: Stamp, title: 'Review and download', text: 'See every field in place, then download the PDF with the Hash Report annexed, ready to sign.' },
];

export default function Dashboard() {
  const evidence = useLiveQuery(() => db.evidence.orderBy('updatedAt').reverse().toArray(), []);
  const fileCounts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.files.each((f) => m.set(f.evidenceId, (m.get(f.evidenceId) ?? 0) + 1));
    return m;
  }, []);
  const stats = useLiveQuery(async () => ({
    files: await db.files.count(),
    finalised: await db.certificates.where('status').equals('finalised').count(),
    events: await db.auditEvents.count(),
  }), []);
  const hasEvidence = !!evidence?.length;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 shadow-card">
              <span className="size-1.5 rounded-full bg-brand-500" />
              Bharatiya Sakshya Adhiniyam, 2023 · Section 63
            </p>
            <h1 className="mt-5 font-display text-[36px] leading-[1.05] font-extrabold tracking-[-0.025em] text-ink-950 sm:text-[52px]">
              Draft the <span className="text-brand-600">Section 63 certificate</span> for your digital evidence.
            </h1>
            <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-600">
              Add photos, recordings, WhatsApp chats or documents. We hash them, read their technical details and draft Part A, Part B
              and the Hash Report word for word as Section 63(4)(c) prescribes. Everything happens in your browser.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/evidence/new/" variant="brand" size="lg" data-testid="start">
                <Plus /> Start new evidence
              </ButtonLink>
              <ButtonLink href={hasEvidence ? '#records' : '#how'} variant="secondary" size="lg">
                {hasEvidence ? <FolderOpen /> : <ScrollText />}
                {hasEvidence ? 'Your records' : 'How it works'}
              </ButtonLink>
            </div>
            <ul className="mt-9 grid gap-3 text-[13.5px] text-ink-700 sm:grid-cols-3">
              {[
                [Lock, 'Files never leave your device'],
                [Fingerprint, 'SHA-256 hash of every file'],
                [ShieldCheck, 'Hash-chained audit log'],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={text as string} className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <I className="size-3.5" />
                    </span>
                    {text as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="px-6 pb-6 lg:px-0">
            <HeroVisual />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Records */}
        <section id="records" className="scroll-mt-24 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">In this browser</p>
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950">Your evidence</h2>
            </div>
            {hasEvidence && stats && (
              <dl className="flex gap-6 text-right">
                {[
                  ['Records', evidence!.length],
                  ['Files hashed', stats.files],
                  ['Finalised', stats.finalised],
                  ['Audit entries', stats.events],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dd className="font-display text-xl font-bold text-ink-950 tabular-nums">{v}</dd>
                    <dt className="text-[11.5px] text-ink-500">{k}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="mt-5">
            {evidence === undefined ? (
              <div className="h-24 animate-pulse rounded-2xl bg-ink-100/70" />
            ) : hasEvidence ? (
              <div className="flex flex-col gap-2.5">
                {evidence.map((ev) => (
                  <EvidenceRow key={ev.id} ev={ev} fileCount={fileCounts?.get(ev.id) ?? 0} />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={<FileCheck2 />}
                  title="No evidence yet"
                  description="Start with the files you want to produce. You can come back any time — everything is saved in this browser."
                  action={
                    <ButtonLink href="/evidence/new/" variant="brand">
                      <Plus /> Start new evidence
                    </ButtonLink>
                  }
                />
              </Card>
            )}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 pt-16">
          <p className="eyebrow mb-2">How it works</p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950">Four steps to a signed certificate</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map((h, i) => (
              <li key={h.title} className="relative rounded-2xl border border-line bg-white p-5 shadow-card">
                <span className="absolute top-5 right-5 font-display text-[28px] leading-none font-extrabold text-ink-100">{i + 1}</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-ink-950 text-white">
                  <h.icon className="size-[18px]" />
                </span>
                <h3 className="mt-4 font-display text-[15.5px] font-semibold text-ink-950">{h.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">{h.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Privacy band */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-ink-950 text-white">
          <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-400 uppercase">Private by design</p>
              <h2 className="mt-3 font-display text-[26px] leading-tight font-bold tracking-tight">Evidence is sensitive. It never leaves your device.</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink-300">
                There is no account and no server. Files are hashed and the PDF is built inside your browser, and the page is locked so it
                cannot send data anywhere. Export a case bundle to back up or move your work.
              </p>
            </div>
            <ul className="grid gap-3 text-[13.5px]">
              {[
                'Exact statutory wording from the Schedule',
                'DD/MM/YYYY dates and 24-hour IST times',
                'A new certificate version for each submission',
                'Re-verify any file to prove it has not changed',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                  <ShieldCheck className="size-4 shrink-0 text-brand-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
