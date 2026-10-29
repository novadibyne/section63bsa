'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { createEvidence } from '@/lib/actions';
import type { CertificateParts } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/misc';
import { PartsChoice } from '@/components/certificate/parts-choice';

function needs(parts: CertificateParts): string[] {
  return [
    'The evidence files: photos, screenshots, recordings, chat export or documents',
    'The phone or computer they came from, or a photo of its IMEI screen or box label',
    ...(parts !== 'B' ? ['Your name, your father’s, mother’s or spouse’s name, and your address'] : []),
    ...(parts !== 'A' ? ['The expert’s name, address, designation and qualification'] : []),
  ];
}

export default function NewEvidencePage() {
  const router = useRouter();
  const [parts, setParts] = React.useState<CertificateParts>('both');
  const [busy, setBusy] = React.useState(false);

  const start = async () => {
    setBusy(true);
    const id = await createEvidence(parts);
    router.replace(`/certificate/?evidenceId=${id}&step=1`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="New certificate" title="What do you need to make?" description="Pick the parts of the Section 63 certificate. You can change this later." />

      <PartsChoice value={parts} onChange={setParts} className="mt-6" />

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
        <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink-950">
          <ClipboardList className="size-[18px] text-brand-600" /> Keep these handy
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {needs(parts).map((n) => (
            <li key={n} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-ink-700">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
              {n}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="brand" size="lg" className="mt-6 w-full sm:w-auto" onClick={start} loading={busy} data-testid="begin">
        Start <ArrowRight />
      </Button>
    </div>
  );
}
