'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, FileCheck2, FolderOpen, HardDrive, Plus, Search, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { downloadLatestPdf } from '@/lib/actions';
import type { Certificate, Evidence } from '@/lib/types';
import { formatIst, relativeTime } from '@/lib/time';
import { cn, shortHash } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form';
import { Callout, CopyButton, EmptyState, PageHeader } from '@/components/ui/misc';

interface Row {
  cert: Certificate;
  evidence: Evidence;
}

const when = (c: Certificate) => c.finalisedAt ?? c.generatedAt ?? c.updatedAt;

function CertificateRow({ cert, evidence }: Row) {
  const [busy, setBusy] = React.useState(false);
  const final = cert.status === 'finalised';
  const filed = [evidence.courtName, evidence.caseNumber].filter(Boolean).join(' · ');

  const download = async () => {
    setBusy(true);
    try {
      await downloadLatestPdf(cert.id);
    } catch (e) {
      toast.error('Could not make the PDF', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-white px-4 py-4 shadow-card sm:flex-row sm:items-center sm:px-5" data-testid="history-row">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:size-[18px]',
          final ? 'bg-brand-50 text-brand-700 ring-brand-100' : 'bg-amber-50 text-amber-700 ring-amber-100',
        )}
      >
        {final ? <FileCheck2 /> : <Stamp />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/evidence/?id=${evidence.id}`} className="min-w-0 truncate text-[15px] font-semibold text-ink-950 hover:underline">
            {evidence.title}
          </Link>
          <span className="text-[13px] text-ink-500">Version {cert.version}</span>
          <Badge tone={final ? 'brand' : 'amber'} dot>
            {final ? 'Final' : 'Draft'}
          </Badge>
        </div>
        {filed && <p className="mt-0.5 truncate text-[13px] text-ink-600">{filed}</p>}
        <p className="mt-0.5 text-[12.5px] text-ink-500">
          {final ? `Finalised ${formatIst(cert.finalisedAt)}` : `Last changed ${relativeTime(cert.updatedAt)}`}
        </p>
        {final && cert.pdfSha256 && (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-500">
            PDF fingerprint (SHA-256) <span className="hash text-[11.5px] text-ink-600">{shortHash(cert.pdfSha256, 8)}</span>
            <CopyButton value={cert.pdfSha256} label="Copy PDF SHA-256" className="size-6" />
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant={final ? 'brand' : 'secondary'} onClick={download} loading={busy} data-testid="history-download">
          {!busy && <Download />} {final ? 'Download PDF' : 'Download draft PDF'}
        </Button>
        <ButtonLink href={`/evidence/?id=${evidence.id}`} variant="ghost">
          <FolderOpen /> Open
        </ButtonLink>
      </div>
    </li>
  );
}

export default function HistoryPage() {
  const rows = useLiveQuery(async () => {
    const [certs, evidence] = await Promise.all([db.certificates.toArray(), db.evidence.toArray()]);
    const byId = new Map(evidence.map((e) => [e.id, e]));
    return certs
      .filter((c) => byId.has(c.evidenceId))
      .map((c) => ({ cert: c, evidence: byId.get(c.evidenceId)! }))
      .sort((a, b) => when(b.cert).localeCompare(when(a.cert)));
  }, []);
  const [query, setQuery] = React.useState('');

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    ({ evidence: e }) => !q || [e.title, e.courtName, e.caseNumber].some((v) => v?.toLowerCase().includes(q)),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="History"
        title="My certificates"
        description="Every certificate made in this browser. Download any of them again, whenever you need it."
        actions={
          <ButtonLink href="/evidence/new/" variant="brand">
            <Plus /> New certificate
          </ButtonLink>
        }
      />

      <Callout tone="neutral" icon={<HardDrive />} className="mt-6">
        These are kept only in this browser, on this device. Clearing the browser’s data deletes them, so save the PDFs you need, or
        export a case bundle from the record’s page as a backup.
      </Callout>

      {rows && rows.length > 3 && (
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, court or case number" className="pl-10" aria-label="Search certificates" />
        </div>
      )}

      <div className="mt-6">
        {rows === undefined ? (
          <div className="h-24 animate-pulse rounded-2xl bg-ink-100/70" />
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Stamp />}
              title="No certificates yet"
              description="Once you start a certificate it appears here, and you can download it again at any time."
              action={
                <ButtonLink href="/evidence/new/" variant="brand">
                  <Plus /> Make a certificate
                </ButtonLink>
              }
            />
          </Card>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-ink-500">No certificate matches “{query}”.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shown.map((r) => (
              <CertificateRow key={r.cert.id} {...r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
