'use client';

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, CheckCircle2, Download, ExternalLink, FileCheck2, FileText, Lock, RefreshCcw, Share2, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { Certificate, Device, Evidence, EvidenceFile } from '@/lib/types';
import { buildPartValues, findIssues } from '@/lib/legal/certificate-values';
import { PART_A, PART_B } from '@/lib/legal/schedule-63';
import { downloadCertificatePdf, finaliseCertificate, generateDraftPdf, shareStoredPdf } from '@/lib/actions';
import { hasPart, partsOf } from '@/lib/legal/parts';
import { useCanShareFiles } from '@/lib/hooks';
import { formatIst } from '@/lib/time';
import { cn, formatBytes } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HashLine } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/dialog';
import { SchedulePreview } from './schedule-preview';

type Tab = 'A' | 'B' | 'H' | 'PDF';

function HashReportPreview({ evidence, files, cert }: { evidence: Evidence; files: EvidenceFile[]; cert: Certificate }) {
  return (
    <div className="mx-auto max-w-[720px] rounded-md bg-sheet px-6 py-8 text-ink-950 shadow-sheet ring-1 ring-line sm:px-10 sm:py-10">
      <p className="font-display text-[15px] font-bold tracking-wide">ANNEXURE — HASH REPORT</p>
      <p className="mt-1 text-[12.5px] text-ink-500">Enclosed with the certificate · version {cert.version}</p>
      <dl className="mt-5 divide-y divide-line border-y border-line text-[13px]">
        {[
          ['Title', evidence.title],
          ['Manner of production', evidence.mannerOfProduction || '—'],
          ['Court / case', [evidence.courtName, evidence.caseNumber].filter(Boolean).join(' · ') || '—'],
          ['Hash algorithm', 'SHA-256'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-4 py-2">
            <dt className="w-44 shrink-0 text-ink-500">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-3">
        {files.map((f, i) => (
          <div key={f.id} className="rounded-lg border border-line bg-white p-3.5">
            <p className="text-[13.5px] font-semibold">
              {i + 1}. {f.originalFilename} <span className="font-normal text-ink-500">· {formatBytes(f.sizeBytes)}</span>
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <HashLine algo="SHA-256" value={f.sha256} emphasise />
            </div>
            {f.members?.length ? <p className="mt-2 text-[12px] text-ink-500">+ SHA-256 of {f.members.length} files inside the archive</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepReview({
  evidence,
  files,
  devices,
  cert,
  flush,
  goTo,
  onNewVersion,
}: {
  evidence: Evidence;
  files: EvidenceFile[];
  devices: Device[];
  cert: Certificate;
  flush: () => Promise<void>;
  goTo: (step: number) => void;
  onNewVersion: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>('A');
  const [busy, setBusy] = React.useState<'gen' | 'final' | null>(null);
  const { confirm, element } = useConfirm();
  const stored = useLiveQuery(() => db.pdfs.get(cert.id), [cert.id]);
  const pdfUrl = React.useMemo(() => (stored ? URL.createObjectURL(stored.blob) : undefined), [stored]);
  React.useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const ctx = { evidence, files, devices, cert };
  const issues = findIssues(ctx);
  const a = buildPartValues('A', ctx);
  const b = buildPartValues('B', ctx);
  const finalised = cert.status === 'finalised';

  const generate = async () => {
    setBusy('gen');
    try {
      await flush();
      await generateDraftPdf(cert.id);
      setTab('PDF');
      toast.success('Draft PDF generated', { description: 'Check it, then download or finalise.' });
    } catch (err) {
      toast.error('Could not generate the PDF', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const finalise = async () => {
    const ok = await confirm({
      title: `Finalise version ${cert.version}?`,
      description:
        'The certificate is locked and a final PDF (without the DRAFT watermark) is produced. Its SHA-256 is recorded in the audit log. To change anything later you start a new version.',
      confirmLabel: 'Finalise',
    });
    if (!ok) return;
    setBusy('final');
    try {
      await flush();
      await finaliseCertificate(cert.id);
      setTab('PDF');
      toast.success(`Version ${cert.version} finalised`);
    } catch (err) {
      toast.error('Could not finalise', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const parts = partsOf(cert);
  const canShare = useCanShareFiles();
  const share = async () => {
    if (!stored || !(await shareStoredPdf(evidence, cert, stored))) await downloadCertificatePdf(cert.id);
  };

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'A', label: 'Part A', show: hasPart(cert, 'A') },
    { id: 'B', label: 'Part B', show: hasPart(cert, 'B') },
    { id: 'H', label: 'Hash report', show: true },
    { id: 'PDF', label: stored?.final ? 'Final PDF' : 'PDF', show: !!stored },
  ];

  const visibleTabs = tabs.filter((t) => t.show);
  const shownTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0].id;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {element}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-ink-100/70 p-1">
          {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
                  shownTab === t.id ? 'bg-white text-ink-950 shadow-card' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {t.label}
              </button>
            ))}
        </div>
        <div className="dot-grid rounded-2xl border border-line bg-ink-50/50 p-3 sm:p-6">
          {shownTab === 'A' && <SchedulePreview part={PART_A} values={a} showHeading />}
          {shownTab === 'B' && <SchedulePreview part={PART_B} values={b} showHeading={parts === 'B'} />}
          {shownTab === 'H' && <HashReportPreview evidence={evidence} files={files} cert={cert} />}
          {shownTab === 'PDF' && pdfUrl && (
            <div className="flex flex-col gap-3">
              {/* Phones can't show a PDF inside a page (iPhone shows only page 1), so they open it instead. */}
              <iframe src={pdfUrl} title="Certificate PDF" className="hidden h-[78vh] w-full rounded-lg bg-white shadow-sheet ring-1 ring-line sm:block" />
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-6 text-[14px] font-semibold text-ink-900 shadow-card ring-1 ring-line sm:hidden"
              >
                <ExternalLink className="size-4" /> Open the PDF
              </a>
              <p className="hidden text-center text-[12.5px] text-ink-500 sm:block">If the PDF does not display on your device, use Download.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
        <Card>
          <CardHeader
            icon={finalised ? <Lock /> : <Stamp />}
            title={`Version ${cert.version}`}
            description={finalised ? `Finalised ${formatIst(cert.finalisedAt)}` : 'Draft — saved automatically'}
            actions={<Badge tone={finalised ? 'brand' : 'amber'} dot>{finalised ? 'Finalised' : 'Draft'}</Badge>}
          />
          <CardBody className="flex flex-col gap-3">
            {!finalised && (
              <>
                {issues.length === 0 ? (
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-brand-700">
                    <CheckCircle2 className="size-4" /> Everything required is filled in
                  </p>
                ) : (
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-[13.5px] font-medium text-amber-800">
                      <AlertCircle className="size-4" /> {issues.length} item{issues.length > 1 ? 's' : ''} to complete
                    </p>
                    <ul className="flex flex-col gap-1">
                      {issues.map((i) => (
                        <li key={i.message}>
                          <button
                            type="button"
                            onClick={() => goTo(i.step)}
                            className="w-full rounded-lg px-2 py-1 text-left text-[12.5px] text-ink-700 hover:bg-amber-50 hover:text-amber-900"
                          >
                            <span className="mr-1.5 font-mono text-[11px] text-ink-400">Step {i.step}</span>
                            {i.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button variant="secondary" onClick={generate} loading={busy === 'gen'} disabled={!files.length || !!busy}>
                  <FileText /> {stored ? 'Regenerate draft PDF' : 'Generate draft PDF'}
                </Button>
                {stored && (
                  <Button variant="secondary" onClick={() => downloadCertificatePdf(cert.id)}>
                    <Download /> Download draft
                  </Button>
                )}
                {stored && canShare && (
                  <Button variant="secondary" onClick={share}>
                    <Share2 /> Share or save draft
                  </Button>
                )}
                <Button variant="brand" onClick={finalise} loading={busy === 'final'} disabled={issues.length > 0 || !!busy}>
                  <FileCheck2 /> Finalise version {cert.version}
                </Button>
                <p className="text-[12px] leading-relaxed text-ink-500">
                  Drafts carry a DRAFT watermark. Finalising locks this version and records the PDF’s SHA-256.
                </p>
              </>
            )}
            {finalised && (
              <>
                <Button variant="brand" onClick={() => downloadCertificatePdf(cert.id)}>
                  <Download /> Download final PDF
                </Button>
                {stored && canShare && (
                  <Button variant="secondary" onClick={share}>
                    <Share2 /> Share or save to Files
                  </Button>
                )}
                {cert.pdfSha256 && (
                  <div>
                    <p className="mb-1 text-[12px] font-medium text-ink-600">SHA-256 of the final PDF</p>
                    <HashLine algo="PDF" value={cert.pdfSha256} />
                  </div>
                )}
                <Button variant="secondary" onClick={onNewVersion}>
                  <RefreshCcw /> Start version {cert.version + 1}
                </Button>
                <p className="text-[12px] leading-relaxed text-ink-500">
                  Need it for another hearing or a correction? Start a new version; this one stays unchanged.
                </p>
              </>
            )}
          </CardBody>
        </Card>
        <Card className="bg-ink-950 text-white ring-0">
          <CardBody className="text-[13px] leading-relaxed text-ink-200">
            <p className="font-display text-[14px] font-semibold text-white">Next steps</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Print the final PDF.</li>
              {parts === 'both' && <li>The party signs Part A; the expert signs Part B.</li>}
              {parts === 'A' && <li>The party signs Part A. Attach Part B signed by the expert.</li>}
              {parts === 'B' && <li>The expert signs Part B. Attach Part A signed by the party.</li>}
              <li>File it with the printouts or copies, and keep the original device and files safe.</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
