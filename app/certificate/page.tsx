'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Check, CloudCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import {
  createCertificateVersion,
  ensureDraftCertificate,
  latestCertificate,
  logDevicesSaved,
  logEvidenceUpdate,
  updateCertificate,
} from '@/lib/actions';
import { useAutosave } from '@/lib/hooks';
import { findIssues } from '@/lib/legal/certificate-values';
import type { Certificate } from '@/lib/types';
import { Stepper, type StepDef } from '@/components/stepper';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/misc';
import { StatusBadge } from '@/components/evidence/kind';
import { StepEvidence } from '@/components/certificate/step-evidence';
import { StepDevice } from '@/components/certificate/step-device';
import { StepPartA, StepPartB } from '@/components/certificate/step-parties';
import { StepReview } from '@/components/certificate/step-review';
import { PageSkeleton } from '@/components/page-skeleton';

const STEPS: StepDef[] = [
  { label: 'Evidence', hint: 'Files & hashes' },
  { label: 'Device', hint: 'Source details' },
  { label: 'Part A', hint: 'The party' },
  { label: 'Part B', hint: 'The expert' },
  { label: 'Review', hint: 'Preview & PDF' },
];

const STEP_INTRO = [
  { eyebrow: 'Step one', title: 'Add the evidence', text: 'Drop in the files you will produce. Each one is hashed on this device as soon as you add it.' },
  { eyebrow: 'Step two', title: 'Describe the device', text: 'Which phone, computer, DVR or cloud account the record came from — s.63(4)(b).' },
  { eyebrow: 'Step three', title: 'Part A — the party’s declaration', text: 'The person in charge of the device affirms the s.63(2) conditions.' },
  { eyebrow: 'Step four', title: 'Part B — the expert’s declaration', text: 'The expert confirms the source and hash values.' },
  { eyebrow: 'Step five', title: 'Review and generate', text: 'Check every field in the exact Schedule format, then generate the PDF.' },
];

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const evidenceId = params.get('evidenceId') ?? '';
  const step = Math.min(5, Math.max(1, Number(params.get('step')) || 1));

  const evidence = useLiveQuery(async () => (evidenceId ? ((await db.evidence.get(evidenceId)) ?? null) : null), [evidenceId]);
  const files = useLiveQuery(() => db.files.where('evidenceId').equals(evidenceId).sortBy('addedAt'), [evidenceId]);
  const devices = useLiveQuery(() => db.devices.where('evidenceId').equals(evidenceId).sortBy('createdAt'), [evidenceId]);
  const storedCert = useLiveQuery(async () => (evidenceId ? ((await latestCertificate(evidenceId)) ?? null) : null), [evidenceId]);

  React.useEffect(() => {
    if (evidence && storedCert === null) void ensureDraftCertificate(evidence.id);
  }, [evidence, storedCert]);

  const [cert, setCertRaw, flushCert] = useAutosave<Certificate>(storedCert?.id, storedCert ?? undefined, async (c) => {
    if (c.status === 'finalised') return;
    await updateCertificate(c.id, {
      partA: c.partA,
      partB: c.partB,
      declarationAcknowledgedAt: c.declarationAcknowledgedAt,
    });
  });
  const setCert = React.useCallback((fn: (c: Certificate) => Certificate) => setCertRaw((c) => fn(c)), [setCertRaw]);

  // Pick up status changes (e.g. finalised) made outside the form.
  React.useEffect(() => {
    if (storedCert && cert && storedCert.id === cert.id && storedCert.status !== cert.status) setCertRaw(storedCert);
  }, [storedCert, cert, setCertRaw]);

  const goTo = React.useCallback(
    async (n: number) => {
      await flushCert();
      if (step === 1 && n !== 1) void logEvidenceUpdate(evidenceId, ['details']);
      if (step === 2 && n !== 2) void logDevicesSaved(evidenceId);
      router.replace(`/certificate/?evidenceId=${evidenceId}&step=${n}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [evidenceId, flushCert, router, step],
  );

  if (evidence === undefined || files === undefined) return <PageSkeleton />;
  if (evidence === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Lock />}
          title="Evidence not found in this browser"
          description="Records are stored only in the browser where they were created. Import a case bundle in Settings to move one here."
          action={<ButtonLink href="/">Back to dashboard</ButtonLink>}
        />
      </div>
    );
  }

  const issues = findIssues({ evidence, files, devices: devices ?? [], cert: cert ?? undefined });
  const finalised = cert?.status === 'finalised';
  const complete = (n: number) => (n === 5 ? !!finalised : !issues.some((i) => i.step === n) && (n !== 2 || (devices?.length ?? 0) > 0));
  const intro = STEP_INTRO[step - 1];

  const newVersion = async () => {
    const c = await createCertificateVersion(evidenceId);
    toast.success(`Version ${c.version} started`, { description: 'Details were copied from the previous version.' });
    void goTo(3);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/evidence/?id=${evidence.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-4" /> {evidence.title}
        </Link>
        <div className="flex items-center gap-2">
          {cert && <span className="text-[12.5px] text-ink-500">Certificate v{cert.version}</span>}
          <StatusBadge status={evidence.status} />
        </div>
      </div>

      <Stepper steps={STEPS} current={step} complete={complete} onSelect={goTo} />

      <div className="mt-8 mb-6 max-w-3xl">
        <p className="eyebrow mb-2">{intro.eyebrow}</p>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-ink-950 sm:text-[34px]">{intro.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{intro.text}</p>
      </div>

      {finalised && step >= 3 && step < 5 && (
        <Callout
          tone="brand"
          icon={<Lock />}
          title={`Version ${cert.version} is finalised and read-only`}
          className="mb-6"
        >
          <button type="button" className="font-semibold underline underline-offset-2" onClick={newVersion}>
            Start version {cert.version + 1}
          </button>{' '}
          to make changes.
        </Callout>
      )}

      {step === 1 && <StepEvidence evidence={evidence} files={files} />}
      {step === 2 && <StepDevice evidenceId={evidence.id} files={files} devices={devices} />}
      {step === 3 && cert && <StepPartA cert={cert} setCert={setCert} files={files} readOnly={finalised} />}
      {step === 4 && cert && <StepPartB cert={cert} setCert={setCert} readOnly={finalised} />}
      {step === 5 && cert && devices && (
        <StepReview
          evidence={evidence}
          files={files}
          devices={devices}
          cert={cert}
          flush={flushCert}
          goTo={goTo}
          onNewVersion={newVersion}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur-md no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 1}>
            <ArrowLeft /> Back
          </Button>
          <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-500 sm:inline-flex">
            <CloudCheck className="size-4 text-brand-600" /> Saved in this browser
          </span>
          {step < 5 ? (
            <Button onClick={() => goTo(step + 1)} disabled={step === 1 && files.length === 0} data-testid="continue">
              Continue to {STEPS[step].label} <ArrowRight />
            </Button>
          ) : (
            <ButtonLink href={`/evidence/?id=${evidence.id}`} variant="secondary">
              <Check /> Done
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <Wizard />
    </React.Suspense>
  );
}
