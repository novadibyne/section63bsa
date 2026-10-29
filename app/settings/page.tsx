'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { DatabaseBackup, HardDrive, Info, Trash2, Upload, UserRound, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { clearAllData, getProfileDefaults, saveProfileDefaults, storageEstimate } from '@/lib/actions';
import { importBundle } from '@/lib/bundle/bundle';
import { AFFILIATION, APP_NAME, HASH_WASM_VERSION, SITE_DOMAIN } from '@/lib/config';
import { SCHEDULE_VERSION } from '@/lib/legal/schedule-63';
import type { ProfileDefaults } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { PageHeader, Progress } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/dialog';
import { InstallApp } from '@/components/install-app';

export default function SettingsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = React.useState<ProfileDefaults | null>(null);
  const [usage, setUsage] = React.useState<{ usage: number; quota: number }>();
  const [importing, setImporting] = React.useState(false);
  const { confirm, element } = useConfirm();
  const counts = useLiveQuery(async () => ({ evidence: await db.evidence.count(), stored: await db.blobs.count() }), []);
  const fileInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    void getProfileDefaults().then(setProfiles);
    void storageEstimate().then(setUsage);
  }, []);

  if (!profiles) return null;
  const party = profiles.party;
  const expert = profiles.expert;
  const setParty = (k: string, v: string) => setProfiles((p) => p && { ...p, party: { ...p.party, [k]: v } });
  const setExpert = (k: string, v: string) => setProfiles((p) => p && { ...p, expert: { ...p.expert, [k]: v } });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {element}
      <PageHeader eyebrow="Preferences" title="Settings" description="Saved details pre-fill new certificates. Everything stays in this browser." />

      <div className="mt-8 flex flex-col gap-6">
        <Card>
          <CardHeader icon={<UserRound />} title="My details (Part A)" description="Used when you choose “Use saved” in Part A." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="s-pn">
              <Input id="s-pn" value={party.fullName ?? ''} onChange={(e) => setParty('fullName', e.target.value)} />
            </Field>
            <Field label="Son / daughter / spouse of" htmlFor="s-pr">
              <Input id="s-pr" value={party.relationName ?? ''} onChange={(e) => setParty('relationName', e.target.value)} />
            </Field>
            <Field label="Residing / employed at" htmlFor="s-pa" className="sm:col-span-2">
              <Textarea id="s-pa" rows={2} value={party.addressOrEmployer ?? ''} onChange={(e) => setParty('addressOrEmployer', e.target.value)} />
            </Field>
            <Field label="Usual place of signing" htmlFor="s-pp">
              <Input id="s-pp" value={party.place ?? ''} onChange={(e) => setParty('place', e.target.value)} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<UserRoundCog />} title="Default expert (Part B)" description="For firms that work with the same examiner." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="s-en">
              <Input id="s-en" value={expert.fullName ?? ''} onChange={(e) => setExpert('fullName', e.target.value)} />
            </Field>
            <Field label="Son / daughter / spouse of" htmlFor="s-er">
              <Input id="s-er" value={expert.relationName ?? ''} onChange={(e) => setExpert('relationName', e.target.value)} />
            </Field>
            <Field label="Residing / employed at" htmlFor="s-ea" className="sm:col-span-2">
              <Textarea id="s-ea" rows={2} value={expert.addressOrEmployer ?? ''} onChange={(e) => setExpert('addressOrEmployer', e.target.value)} />
            </Field>
            <Field label="Designation" htmlFor="s-ed">
              <Input id="s-ed" value={expert.designation ?? ''} onChange={(e) => setExpert('designation', e.target.value)} />
            </Field>
            <Field label="Qualification" htmlFor="s-eq">
              <Input id="s-eq" value={expert.qualification ?? ''} onChange={(e) => setExpert('qualification', e.target.value)} />
            </Field>
            <Field label="Usual place of signing" htmlFor="s-ep">
              <Input id="s-ep" value={expert.place ?? ''} onChange={(e) => setExpert('place', e.target.value)} />
            </Field>
          </CardBody>
        </Card>
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              await saveProfileDefaults(profiles);
              toast.success('Details saved');
            }}
          >
            Save details
          </Button>
        </div>

        <Card>
          <CardHeader icon={<DatabaseBackup />} title="Backup and transfer" description="Case bundles are .zip files with every record, file, PDF and a SHA256SUMS.txt." />
          <CardBody className="flex flex-col gap-4">
            <p className="text-[13.5px] leading-relaxed text-ink-600">
              Export a bundle from any evidence record’s page. Importing checks every file in the bundle against its recorded SHA-256 before
              anything is saved.
            </p>
            <div>
              <Button variant="secondary" loading={importing} onClick={() => fileInput.current?.click()}>
                <Upload /> Import case bundle
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setImporting(true);
                  const r = await importBundle(f);
                  setImporting(false);
                  if (r.ok) {
                    toast.success(`Imported “${r.title}”`, { description: `${r.verified} entries verified against SHA256SUMS.txt` });
                    router.push(`/evidence/?id=${r.evidenceId}`);
                  } else toast.error('Import failed', { description: r.message });
                }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<HardDrive />} title="Storage in this browser" />
          <CardBody className="flex flex-col gap-4">
            {usage && usage.quota > 0 && (
              <div>
                <div className="mb-1.5 flex justify-between text-[13px] text-ink-600">
                  <span>{formatBytes(usage.usage)} used</span>
                  <span>{formatBytes(usage.quota)} available to this site</span>
                </div>
                <Progress value={usage.usage / usage.quota} />
              </div>
            )}
            <p className="text-[13.5px] text-ink-600">
              {counts?.evidence ?? 0} evidence record(s), {counts?.stored ?? 0} stored file copies.
            </p>
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="text-[13.5px] font-semibold text-red-800">Clear all data</p>
              <p className="mt-0.5 text-[13px] text-red-700/90">Deletes every record, file copy, certificate and the audit log from this browser.</p>
              <Button
                variant="danger"
                className="mt-3"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete everything in this browser?',
                    description: 'This cannot be undone. Export case bundles first if you need them.',
                    confirmLabel: 'Delete everything',
                    danger: true,
                  });
                  if (!ok) return;
                  await clearAllData();
                  toast('All data cleared');
                  void storageEstimate().then(setUsage);
                }}
              >
                <Trash2 /> Clear all data
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Info />} title="About" />
          <CardBody>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              {[
                ['App', APP_NAME],
                ['Website', SITE_DOMAIN],
                ['Research', AFFILIATION],
                ['Schedule text', SCHEDULE_VERSION],
                ['Hash library', `hash-wasm ${HASH_WASM_VERSION}`],
              ].map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-3">
                  <dt className="w-28 shrink-0 text-ink-500">{k}</dt>
                  <dd className="min-w-0 font-medium break-words text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-[13px] font-medium">
              <Link href="/audit/" className="text-brand-700 hover:underline">
                Activity log (audit trail)
              </Link>
              <Link href="/privacy/" className="text-brand-700 hover:underline">
                Privacy
              </Link>
            </div>
            <InstallApp className="mt-3 -ml-3" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
