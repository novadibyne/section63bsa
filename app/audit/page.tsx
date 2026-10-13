'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, ScrollText, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { db } from '@/lib/db';
import { ACTION_LABEL } from '@/lib/audit/append';
import { verifyChain, type ChainCheck } from '@/lib/audit/chain';
import type { AuditAction, AuditEvent } from '@/lib/types';
import { formatIstSeconds, nowIso } from '@/lib/time';
import { downloadBlob, shortHash } from '@/lib/utils';
import { Card, CardBody } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Callout, EmptyState, PageHeader } from '@/components/ui/misc';

function tone(a: AuditAction): BadgeTone {
  if (a.startsWith('certificate.finalise')) return 'brand';
  if (a.startsWith('certificate')) return 'amber';
  if (a.startsWith('file.hash') || a.startsWith('file.reverify')) return 'blue';
  if (a.endsWith('delete') || a.endsWith('remove') || a === 'data.clear') return 'red';
  return 'neutral';
}

function detailText(e: AuditEvent): string {
  const d = e.details as Record<string, unknown>;
  const bits: string[] = [];
  if (typeof d.name === 'string') bits.push(d.name);
  if (typeof d.title === 'string') bits.push(d.title);
  if (typeof d.version === 'number') bits.push(`v${d.version}`);
  if (typeof d.match === 'boolean') bits.push(d.match ? 'match' : 'MISMATCH');
  if (typeof d.sha256 === 'string') bits.push(`SHA-256 ${shortHash(d.sha256, 8)}`);
  if (typeof d.pdfSha256 === 'string') bits.push(`PDF ${shortHash(d.pdfSha256, 8)}`);
  if (typeof d.deviceCount === 'number') bits.push(`${d.deviceCount} device(s)`);
  if (typeof d.message === 'string') bits.push(d.message);
  if (Array.isArray(d.fields)) bits.push(`fields: ${d.fields.join(', ')}`);
  return bits.join(' · ');
}

export default function AuditPage() {
  const events = useLiveQuery(() => db.auditEvents.orderBy('seq').toArray(), []);
  const titles = useLiveQuery(async () => new Map((await db.evidence.toArray()).map((e) => [e.id, e.title])), []);
  const [filter, setFilter] = React.useState<string>('all');
  const [check, setCheck] = React.useState<ChainCheck | null>(null);
  const [checking, setChecking] = React.useState(false);

  const runCheck = React.useCallback(async () => {
    setChecking(true);
    setCheck(await verifyChain(await db.auditEvents.orderBy('seq').toArray()));
    setChecking(false);
  }, []);
  React.useEffect(() => {
    void runCheck();
  }, [runCheck, events?.length]);

  const shown = (events ?? []).filter((e) => filter === 'all' || e.action.startsWith(filter)).slice().reverse();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Record of every action"
        title="Audit log"
        description="Each entry includes the SHA-256 of the previous one, so any edit, insertion or reordering breaks the chain and is detected."
        actions={
          <>
            <Button variant="secondary" onClick={runCheck} loading={checking}>
              <ShieldCheck /> Verify chain
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const rows = await db.auditEvents.orderBy('seq').toArray();
                downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `audit-log-${nowIso().slice(0, 10)}.json`);
              }}
            >
              <Download /> Export JSON
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        {check ? (
          check.ok ? (
            <Callout tone="brand" icon={<ShieldCheck />} title={`Chain intact — ${check.count} entries verified`}>
              Every entry links correctly to the one before it.
            </Callout>
          ) : (
            <Callout tone="red" icon={<ShieldAlert />} title={`Chain broken at entry #${check.brokenAtSeq}`}>
              {check.reason}. The log has been altered outside the app.
            </Callout>
          )
        ) : (
          <Callout icon={<ShieldQuestion />} title="Checking…" />
        )}
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="md:w-56" aria-label="Filter">
          <option value="all">All actions</option>
          <option value="evidence">Evidence</option>
          <option value="file">Files & hashes</option>
          <option value="device">Devices</option>
          <option value="certificate">Certificates</option>
          <option value="bundle">Bundles</option>
        </Select>
      </div>

      <Card className="mt-6 overflow-hidden">
        {events && events.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="Nothing logged yet" description="Actions appear here as soon as you add evidence." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-line bg-ink-50/70 text-[11.5px] tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Time (IST)</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                  <th className="px-3 py-3 font-semibold">Evidence</th>
                  <th className="px-3 py-3 font-semibold">Details</th>
                  <th className="px-5 py-3 font-semibold">Entry hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((e) => (
                  <tr key={e.seq} className="align-top hover:bg-ink-50/40">
                    <td className="px-5 py-3 font-mono text-[12px] text-ink-400">{e.seq}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-700">{formatIstSeconds(e.createdAt).replace(' IST', '')}</td>
                    <td className="px-3 py-3">
                      <Badge tone={tone(e.action)}>{ACTION_LABEL[e.action] ?? e.action}</Badge>
                    </td>
                    <td className="max-w-48 truncate px-3 py-3">
                      {e.evidenceId ? (
                        titles?.get(e.evidenceId) ? (
                          <Link href={`/evidence/?id=${e.evidenceId}`} className="font-medium text-ink-900 hover:underline">
                            {titles.get(e.evidenceId)}
                          </Link>
                        ) : (
                          <span className="text-ink-400">deleted</span>
                        )
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="max-w-80 px-3 py-3 break-words text-ink-600">{detailText(e)}</td>
                    <td className="px-5 py-3 font-mono text-[11.5px] text-ink-400" title={e.rowHash}>
                      {e.rowHash.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-500">
        This log is stored in this browser. It detects edits, but clearing the browser’s site data deletes it. Export it regularly; a
        server-side log comes with accounts in a later phase.
      </p>
    </div>
  );
}
