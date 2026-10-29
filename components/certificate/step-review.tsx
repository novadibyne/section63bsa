'use client';

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, CheckCircle2, Download, FileCheck2, FileText, Lock, RefreshCcw, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import type { Certificate, Device, Evidence, EvidenceFile } from '@/lib/types';
import { buildPartValues, findIssues } from '@/lib/legal/certificate-values';
import { PART_A, PART_B } from '@/lib/legal/schedule-63';
import { downloadCertificatePdf, finaliseCertificate, generateDraftPdf } from '@/lib/actions';
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

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'A', label: 'Part A', show: true },
    { id: 'B', label: 'Part B', show: true },
    { id: 'H', label: 'Hash report', show: true },
    { id: 'PDF', label: stored?.final ? 'Final PDF' : 'PDF', show: !!stored },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {element}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-ink-100/70 p-1">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
                  tab === t.id ? 'bg-white text-ink-950 shadow-card' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {t.label}
              </button>
            ))}
        </div>
        <div className="dot-grid rounded-2xl border border-line bg-ink-50/50 p-3 sm:p-6">
          {tab === 'A' && <SchedulePreview part={PART_A} values={a} showHeading />}
          {tab === 'B' && <SchedulePreview part={PART_B} values={b} />}
          {tab === 'H' && <HashReportPreview evidence={evidence} files={files} cert={cert} />}
          {tab === 'PDF' && pdfUrl && (
            <div className="flex flex-col gap-3">
              <iframe src={pdfUrl} title="Certificate PDF" className="h-[78vh] w-full rounded-lg bg-white shadow-sheet ring-1 ring-line" />
              <p className="text-center text-[12.5px] text-ink-500">If the PDF does not display on your device, use Download.</p>
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
              <li>The party signs Part A; the expert signs Part B.</li>
              <li>File it with the printouts or copies, and keep the original device and files safe.</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
