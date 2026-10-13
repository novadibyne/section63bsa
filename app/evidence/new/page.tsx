'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createEvidence } from '@/lib/actions';
import { PageSkeleton } from '@/components/page-skeleton';

let pending: Promise<string> | null = null;

export default function NewEvidencePage() {
  const router = useRouter();
  React.useEffect(() => {
    // Module-level guard so React strict mode's double effect creates only one record.
    pending ??= createEvidence();
    pending.then((id) => {
      pending = null;
      router.replace(`/certificate/?evidenceId=${id}&step=1`);
    });
  }, [router]);
  return <PageSkeleton />;
}
