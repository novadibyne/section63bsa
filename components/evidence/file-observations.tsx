'use client';

import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Info, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { observeStoredFile } from '@/lib/actions';
import { crossObservations } from '@/lib/evidence/observations/cross';
import { OBSERVATIONS_NOTICE, STATUS_LABEL, type Observation } from '@/lib/evidence/observations/types';
import type { EvidenceFile } from '@/lib/types';
import { formatIst } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Disclosure } from './disclosure';

/** One observation: the fact found, what it can mean, and how to repeat the check. */
export function ObservationItem({ o }: { o: Observation }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid="observation" data-status={o.status}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-inset',
            o.status === 'noted' ? 'bg-ink-900 text-white ring-ink-900' : 'bg-ink-50 text-ink-600 ring-line',
          )}
        >
          {STATUS_LABEL[o.status]}
        </span>
        <span className="text-[13px] font-semibold text-ink-900">{o.check}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-800">{o.finding}</p>
      {o.note && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{o.note}</p>}
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">How it was checked: {o.method}</p>
    </li>
  );
}

/** The file's own observations plus those that compare it with the rest of its record. */
export function useAllObservations(file: EvidenceFile): Observation[] | undefined {
  const others = useLiveQuery(() => db.files.where('evidenceId').equals(file.evidenceId).toArray(), [file.evidenceId]);
  const device = useLiveQuery(() => db.devices.where('evidenceId').equals(file.evidenceId).first(), [file.evidenceId]);
  if (!file.observations) return undefined;
  return [...file.observations.items, ...crossObservations(file, others ?? [], device)];
}

export function FileObservationsPanel({ file }: { file: EvidenceFile }) {
  const items = useAllObservations(file);
  const [running, setRunning] = React.useState(false);
  const noted = items?.filter((o) => o.status === 'noted').length ?? 0;
  const title = (
    <span>
      File observations
      {items && items.length > 0 && (
        <span className="ml-1.5 font-normal text-ink-500">
          · {noted} noted, {items.length - noted} other{items.length - noted === 1 ? '' : 's'}
        </span>
      )}
    </span>
  );

  return (
    <Disclosure title={title} icon={<ScanSearch />} testId="file-observations">
      <p className="flex gap-2 rounded-lg bg-ink-50/70 px-3 py-2.5 text-[12px] leading-relaxed text-ink-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
        {OBSERVATIONS_NOTICE}
      </p>
      {!file.observations ? (
        <div className="mt-3 flex flex-col items-start gap-2 text-[13px] text-ink-700">
          <p>
            {file.blobStored
              ? 'This file was added before file observations existed. Its stored copy can be checked now, on this device.'
              : 'This file was added before file observations existed, and no copy of it was kept. Add the file again to check it.'}
          </p>
          {file.blobStored && (
            <Button
              variant="secondary"
              size="sm"
              loading={running}
              onClick={async () => {
                setRunning(true);
                try {
                  await observeStoredFile(file.id);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'The checks could not run');
                } finally {
                  setRunning(false);
                }
              }}
            >
              <ScanSearch /> Check this file
            </Button>
          )}
        </div>
      ) : items && items.length ? (
        <>
          <ul className="mt-3 divide-y divide-line">
            {items.map((o) => (
              <ObservationItem key={o.id} o={o} />
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-ink-400">
            Rules version {file.observations.rules} · checked {formatIst(file.observations.checkedAt)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-600">No checks apply to this kind of file yet.</p>
      )}
    </Disclosure>
  );
}
