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
  setCertificateParts,
  updateCertificate,
} from '@/lib/actions';
import { useAutosave } from '@/lib/hooks';
import { findIssues } from '@/lib/legal/certificate-values';
import { PARTS_LABEL, hasPart, partsOf } from '@/lib/legal/parts';
import type { Certificate, CertificateParts } from '@/lib/types';
import { Stepper, type StepDef } from '@/components/stepper';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, EmptyState } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/dialog';
import { PartsChoice } from '@/components/certificate/parts-choice';
import { StatusBadge } from '@/components/evidence/kind';
import { StepEvidence } from '@/components/certificate/step-evidence';
import { StepDevice } from '@/components/certificate/step-device';
import { StepPartA, StepPartB } from '@/components/certificate/step-parties';
import { StepReview } from '@/components/certificate/step-review';
import { PageSkeleton } from '@/components/page-skeleton';

interface WizardStep extends StepDef {
  /** Only shown when the certificate includes this part. */
  part?: 'A' | 'B';
  title: string;
  text: string;
}

const STEPS: WizardStep[] = [
  {
    id: 1,
    label: 'Files',
    hint: 'Your evidence',
    title: 'Add the evidence files',
    text: 'Add the photos, screenshots, recordings, chat export or documents you want to show the court. Each file gets its unique fingerprint (hash) on this device as soon as you add it.',
  },
  {
    id: 2,
    label: 'Device',
    hint: 'Phone or computer',
    title: 'Which phone or computer is it from?',
    text: 'Describe the device the evidence came from. Scan a photo to fill in its IMEI numbers, serial number and model automatically.',
  },
  {
    id: 3,
    part: 'A',
    label: 'Your part',
    hint: 'Part A',
    title: 'Your declaration',
    text: 'Filled in by the person who owns or looks after the device. You sign it on paper after downloading.',
  },
  {
    id: 4,
    part: 'B',
    label: 'Expert',
    hint: 'Part B',
    title: 'The expert’s declaration',
    text: 'Filled in by a computer or cyber-forensics expert, who checks the record and its hash values and signs this part.',
  },
  {
    id: 5,
    label: 'Download',
    hint: 'Check & get PDF',
    title: 'Check and download',
    text: 'Look over the certificate. Download a draft to check it, then finalise it to get the copy for signing. You can download it again any time from My certificates.',
  },
];

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const evidenceId = params.get('evidenceId') ?? '';
  const requested = Math.min(5, Math.max(1, Number(params.get('step')) || 1));

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

  // Only the steps for the parts being made; a link to a skipped step lands on the next one.
  const steps = STEPS.filter((x) => !x.part || hasPart(cert ?? undefined, x.part));
  const current = steps.find((x) => x.id >= requested) ?? steps[steps.length - 1];
  const step = current.id;
  const index = steps.indexOf(current);
  const [partsOpen, setPartsOpen] = React.useState(false);

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
  const next = steps[index + 1];
  const prev = steps[index - 1];

  const newVersion = async () => {
    const c = await createCertificateVersion(evidenceId);
    toast.success(`Version ${c.version} started`, { description: 'Details were copied from the previous version.' });
    void goTo(steps.find((x) => x.part)?.id ?? 5);
  };

  const changeParts = async (parts: CertificateParts) => {
    if (!cert) return;
    setCert((c) => ({ ...c, parts }));
    await setCertificateParts(cert.id, parts);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-36 sm:px-6 sm:pt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/evidence/?id=${evidence.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-4" /> {evidence.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {cert && (
            <button
              type="button"
              onClick={() => setPartsOpen(true)}
              disabled={finalised}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[12.5px] font-medium text-ink-700 shadow-card enabled:hover:border-ink-300"
              data-testid="change-parts"
            >
              {PARTS_LABEL[partsOf(cert)]}
              {!finalised && <span className="text-brand-700">· Change</span>}
            </button>
          )}
          {cert && <span className="text-[12.5px] text-ink-500">v{cert.version}</span>}
          <StatusBadge status={evidence.status} />
        </div>
      </div>

      {cert && (
        <Dialog
          open={partsOpen}
          onClose={() => setPartsOpen(false)}
          title="Which parts are you making?"
          footer={
            <Button onClick={() => setPartsOpen(false)} data-testid="parts-done">
              Done
            </Button>
          }
        >
          <PartsChoice value={partsOf(cert)} onChange={changeParts} />
        </Dialog>
      )}

      <Stepper steps={steps} current={step} complete={complete} onSelect={goTo} />

      <div className="mt-8 mb-6 max-w-3xl">
        <p className="eyebrow mb-2">
          Step {index + 1} of {steps.length}
          {current.part && ` · Part ${current.part}`}
        </p>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-ink-950 sm:text-[34px]">{current.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{current.text}</p>
      </div>

      {finalised && current.part && (
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" onClick={() => prev && goTo(prev.id)} disabled={!prev}>
            <ArrowLeft /> Back
          </Button>
          <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-500 sm:inline-flex">
            <CloudCheck className="size-4 text-brand-600" /> Saved in this browser
          </span>
          {next ? (
            <Button onClick={() => goTo(next.id)} disabled={step === 1 && files.length === 0} data-testid="continue">
              Next: {next.label} <ArrowRight />
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
