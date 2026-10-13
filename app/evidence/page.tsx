'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Archive, Cpu, Download, FileStack, History, Lock, PenLine, Plus, Stamp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { createCertificateVersion, deleteEvidence, downloadCertificatePdf } from '@/lib/actions';
import { exportBundle } from '@/lib/bundle/bundle';
import { ACTION_LABEL } from '@/lib/audit/append';
import { DEVICE_SOURCE_OPTIONS } from '@/lib/legal/schedule-63';
import { IDENTIFIER_LABEL } from '@/lib/legal/validators';
import { KIND_LABEL } from '@/lib/evidence/detect';
import { formatIst, relativeTime } from '@/lib/time';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/dialog';
import { KindIcon, StatusBadge } from '@/components/evidence/kind';
import { FileCard } from '@/components/evidence/file-card';
import { PageSkeleton } from '@/components/page-skeleton';

function Detail() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  const evidence = useLiveQuery(async () => (id ? ((await db.evidence.get(id)) ?? null) : null), [id]);
  const files = useLiveQuery(() => db.files.where('evidenceId').equals(id).sortBy('addedAt'), [id]);
  const devices = useLiveQuery(() => db.devices.where('evidenceId').equals(id).sortBy('createdAt'), [id]);
  const certs = useLiveQuery(() => db.certificates.where('evidenceId').equals(id).reverse().sortBy('version'), [id]);
  const events = useLiveQuery(() => db.auditEvents.where('evidenceId').equals(id).reverse().sortBy('seq'), [id]);
  const { confirm, element } = useConfirm();
  const [exporting, setExporting] = React.useState(false);

  if (evidence === undefined || !files) return <PageSkeleton />;
  if (evidence === null)
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Lock />}
          title="Evidence not found in this browser"
          description="Records live only in the browser where they were created. Import a case bundle in Settings to bring one here."
          action={<ButtonLink href="/">Back to dashboard</ButtonLink>}
        />
      </div>
    );

  const latest = certs?.[0];
  const wizardHref = `/certificate/?evidenceId=${evidence.id}&step=${latest ? 5 : 1}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {element}
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <KindIcon kind={evidence.evidenceType} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[28px]">{evidence.title}</h1>
              <StatusBadge status={evidence.status} />
            </div>
            <p className="mt-1 text-[13.5px] text-ink-500">
              {KIND_LABEL[evidence.evidenceType]} · {files.length} file{files.length === 1 ? '' : 's'} · created {formatIst(evidence.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportBundle(evidence.id);
                toast.success('Case bundle downloaded', { description: 'Keep it as a backup or import it in another browser.' });
              } catch (e) {
                toast.error('Export failed', { description: e instanceof Error ? e.message : String(e) });
              } finally {
                setExporting(false);
              }
            }}
          >
            <Archive /> Export bundle
          </Button>
          <ButtonLink href={wizardHref}>
            <PenLine /> {latest ? 'Open certificate' : 'Start certificate'}
          </ButtonLink>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              icon={<FileStack />}
              title="Files and hashes"
              description="Re-verify any time to prove a file has not changed since it was hashed."
              actions={
                evidence.status !== 'finalised' && (
                  <ButtonLink href={`/certificate/?evidenceId=${evidence.id}&step=1`} variant="ghost" size="sm">
                    <Plus /> Add files
                  </ButtonLink>
                )
              }
            />
            <CardBody className="flex flex-col gap-3">
              {files.length ? (
                files.map((f) => <FileCard key={f.id} file={f} full editable={evidence.status !== 'finalised'} />)
              ) : (
                <EmptyState icon={<FileStack />} title="No files yet" className="py-8" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Cpu />} title="Device / source" />
            <CardBody className="flex flex-col gap-4">
              {devices?.length ? (
                devices.map((d, i) => (
                  <div key={d.id} className="rounded-xl border border-line p-4">
                    <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">{i === 0 ? 'Primary device' : `Device ${i + 1}`}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.categories.map((c) => (
                        <Badge key={c} tone="ink">
                          {c === 'other' && d.categoryOther ? d.categoryOther : DEVICE_SOURCE_OPTIONS.find((o) => o.key === c)?.label}
                        </Badge>
                      ))}
                    </div>
                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                      {[
                        ['Make & model', d.makeModel],
                        ['Colour', d.color],
                        ['Serial', d.serialNumber],
                        ...d.identifiers.filter((x) => x.value).map((x) => [IDENTIFIER_LABEL[x.idType], x.value]),
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={`${k}-${v}`} className="flex gap-2">
                            <dt className="w-24 shrink-0 text-ink-500">{k}</dt>
                            <dd className="min-w-0 font-medium break-words text-ink-900">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ))
              ) : (
                <p className="text-[13.5px] text-ink-500">Not described yet. It is filled in step 2 of the certificate.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader icon={<Stamp />} title="Certificate versions" description="One per submission to a court." />
            <CardBody className="flex flex-col gap-3">
              {certs?.length ? (
                certs.map((c) => (
                  <div key={c.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-[14.5px] font-semibold text-ink-950">Version {c.version}</p>
                      <Badge tone={c.status === 'finalised' ? 'brand' : 'amber'} dot>
                        {c.status === 'finalised' ? 'Finalised' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {c.status === 'finalised' ? `Finalised ${formatIst(c.finalisedAt)}` : `Updated ${relativeTime(c.updatedAt)}`}
                    </p>
                    {c.pdfSha256 && <p className="hash mt-1.5 text-[11px] text-ink-500">PDF SHA-256 {c.pdfSha256}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(c.status === 'finalised' || c.generatedAt) && (
                        <Button size="sm" variant="secondary" onClick={() => downloadCertificatePdf(c.id)}>
                          <Download /> PDF
                        </Button>
                      )}
                      {c.id === latest?.id && c.status === 'draft' && (
                        <ButtonLink size="sm" href={`/certificate/?evidenceId=${evidence.id}&step=3`}>
                          Continue <ArrowRight />
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[13.5px] text-ink-500">No certificate yet.</p>
              )}
              {latest?.status === 'finalised' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const c = await createCertificateVersion(evidence.id);
                    router.push(`/certificate/?evidenceId=${evidence.id}&step=3`);
                    toast.success(`Version ${c.version} started`);
                  }}
                >
                  <Plus /> New version
                </Button>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<PenLine />} title="Record details" />
            <CardBody>
              <dl className="flex flex-col gap-3 text-[13px]">
                {[
                  ['Manner of production', evidence.mannerOfProduction],
                  ['Court / proceeding', evidence.courtName],
                  ['Case number', evidence.caseNumber],
                  ['Description', evidence.description],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] text-ink-500">{k}</dt>
                    <dd className="mt-0.5 break-words text-ink-900">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<History />}
              title="Activity"
              actions={
                <Link href="/audit/" className="text-[12.5px] font-medium text-brand-700 hover:underline">
                  Full log
                </Link>
              }
            />
            <CardBody>
              <ol className="relative flex flex-col gap-4 border-l border-line pl-5">
                {(events ?? []).slice(0, 12).map((e) => (
                  <li key={e.seq} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-ink-300 ring-1 ring-line" />
                    <p className="text-[13px] font-medium text-ink-900">{ACTION_LABEL[e.action]}</p>
                    <p className="text-[12px] text-ink-500">
                      {formatIst(e.createdAt)}
                      {typeof e.details.name === 'string' && ` · ${e.details.name}`}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this evidence record?',
                description:
                  'Its files, hashes, devices and certificates are removed from this browser. The audit log keeps a record of the deletion. Export a case bundle first if you may need it.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (!ok) return;
              await deleteEvidence(evidence.id);
              toast('Evidence deleted');
              router.push('/');
            }}
          >
            <Trash2 /> Delete evidence
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <Detail />
    </React.Suspense>
  );
}
