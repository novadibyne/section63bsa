'use client';

import * as React from 'react';
import { BadgeCheck, CalendarClock, Fingerprint, KeyRound, Save, ScrollText, UserRound, UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import type { Certificate, ControlType, Declarant, EvidenceFile, PartB } from '@/lib/types';
import { CONTROL_OPTIONS, LAWFUL_CONTROL_DECLARATION } from '@/lib/legal/schedule-63';
import { getProfileDefaults, saveProfileDefaults } from '@/lib/actions';
import { istDateInput, istTimeInput, nowIso, toDMY } from '@/lib/time';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckChip, Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/misc';
import { shortHash } from '@/lib/utils';

type SetCert = (fn: (c: Certificate) => Certificate) => void;

function DeclarantFields<T extends Declarant>({
  who,
  value,
  onChange,
  idPrefix,
}: {
  who: 'party' | 'expert';
  value: T;
  onChange: (patch: Partial<T>) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor={`${idPrefix}-name`} required>
        <Input id={`${idPrefix}-name`} value={value.fullName} onChange={(e) => onChange({ fullName: e.target.value } as Partial<T>)} autoComplete="name" />
      </Field>
      <Field label="Son / daughter / spouse of" htmlFor={`${idPrefix}-rel`} required hint="Name of father, mother or spouse">
        <Input id={`${idPrefix}-rel`} value={value.relationName} onChange={(e) => onChange({ relationName: e.target.value } as Partial<T>)} />
      </Field>
      <Field
        label="Residing / employed at"
        htmlFor={`${idPrefix}-addr`}
        required
        className="sm:col-span-2"
        hint={who === 'expert' ? 'Lab, firm or office address' : 'Full residential or work address'}
      >
        <Textarea id={`${idPrefix}-addr`} rows={2} value={value.addressOrEmployer} onChange={(e) => onChange({ addressOrEmployer: e.target.value } as Partial<T>)} />
      </Field>
    </div>
  );
}

function SignedAt<T extends Declarant>({ value, onChange, idPrefix }: { value: T; onChange: (patch: Partial<T>) => void; idPrefix: string }) {
  return (
    <Card>
      <CardHeader
        icon={<CalendarClock />}
        title="Date, time and place of signing"
        description="Printed as DD/MM/YYYY and 24-hour IST. Update these to when the certificate is actually signed."
        actions={
          <Button variant="ghost" size="sm" onClick={() => onChange({ date: istDateInput(), time: istTimeInput() } as Partial<T>)}>
            Set to now
          </Button>
        }
      />
      <CardBody className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor={`${idPrefix}-date`} hint={value.date ? `Prints as ${toDMY(value.date)}` : undefined}>
          <Input id={`${idPrefix}-date`} type="date" value={value.date} onChange={(e) => onChange({ date: e.target.value } as Partial<T>)} />
        </Field>
        <Field label="Time (IST, 24-hour)" htmlFor={`${idPrefix}-time`} hint={value.time ? `Prints as ${value.time} hours` : undefined}>
          <Input id={`${idPrefix}-time`} type="time" value={value.time} onChange={(e) => onChange({ time: e.target.value } as Partial<T>)} />
        </Field>
        <Field label="Place" htmlFor={`${idPrefix}-place`} required>
          <Input id={`${idPrefix}-place`} value={value.place} onChange={(e) => onChange({ place: e.target.value } as Partial<T>)} placeholder="e.g. Pune" />
        </Field>
      </CardBody>
    </Card>
  );
}

function DefaultsButtons({ onLoad, onSave }: { onLoad: () => void; onSave: () => void }) {
  return (
    <div className="flex gap-1.5">
      <Button variant="ghost" size="sm" onClick={onLoad}>
        <UserRound /> Use saved
      </Button>
      <Button variant="ghost" size="sm" onClick={onSave}>
        <Save /> Save as default
      </Button>
    </div>
  );
}

export function StepPartA({ cert, setCert, files, readOnly }: { cert: Certificate; setCert: SetCert; files: EvidenceFile[]; readOnly?: boolean }) {
  const a = cert.partA;
  const patch = (p: Partial<typeof a>) => setCert((c) => ({ ...c, partA: { ...c.partA, ...p } }));
  const toggle = (k: ControlType, on: boolean) => patch({ control: on ? [...a.control, k] : a.control.filter((x) => x !== k) });

  return (
    <fieldset disabled={readOnly} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader
            icon={<UserRound />}
            title="Part A — the party"
            description="The person in charge of the device or of the relevant activities."
            actions={
              !readOnly && (
                <DefaultsButtons
                  onLoad={async () => {
                    const d = await getProfileDefaults();
                    if (!d.party.fullName) return toast('No saved details yet', { description: 'Fill the form and choose “Save as default”.' });
                    patch({ fullName: d.party.fullName ?? '', relationName: d.party.relationName ?? '', addressOrEmployer: d.party.addressOrEmployer ?? '', place: d.party.place ?? a.place });
                  }}
                  onSave={async () => {
                    const d = await getProfileDefaults();
                    await saveProfileDefaults({ ...d, party: { fullName: a.fullName, relationName: a.relationName, addressOrEmployer: a.addressOrEmployer, place: a.place } });
                    toast.success('Saved as your default party details');
                  }}
                />
              )
            }
          />
          <CardBody>
            <DeclarantFields who="party" value={a} onChange={patch} idPrefix="pa" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<KeyRound />} title="The device or source is…" description="Select as applicable — printed as “… by me”." />
          <CardBody className="flex flex-wrap gap-2">
            {CONTROL_OPTIONS.map((o) => (
              <CheckChip key={o.key} checked={a.control.includes(o.key)} onChange={(v) => toggle(o.key, v)} disabled={readOnly}>
                {o.label}
              </CheckChip>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<ScrollText />} title="Declaration under Section 63(2)" description="Statutory text from the Schedule. It cannot be edited." />
          <CardBody className="flex flex-col gap-4">
            <blockquote className="rounded-xl border-l-4 border-ink-900 bg-sheet px-5 py-4 font-serif text-[14.5px] leading-relaxed text-ink-900">
              {LAWFUL_CONTROL_DECLARATION}
            </blockquote>
            <Checkbox
              id="ack"
              checked={!!cert.declarationAcknowledgedAt}
              onChange={(v) => setCert((c) => ({ ...c, declarationAcknowledgedAt: v ? nowIso() : undefined }))}
              label="I have read and understood this declaration and it is true to the best of my knowledge and belief."
              description="The party must be able to make this statement personally. The app cannot verify it."
            />
          </CardBody>
        </Card>

        <SignedAt value={a} onChange={patch} idPrefix="pa" />
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader icon={<Fingerprint />} title="Hash algorithm: SHA-256" description="SHA256 is ticked in both parts of the certificate." />
          <CardBody className="flex flex-col gap-3">
            {files.slice(0, 3).map((f) => (
              <div key={f.id} className="rounded-xl border border-brand-200 bg-brand-50/60 px-3.5 py-2.5">
                <p className="truncate text-[12.5px] font-medium text-ink-800">{f.originalFilename}</p>
                <p className="hash mt-0.5 text-[11.5px] text-ink-600">{shortHash(f.sha256, 16)}</p>
              </div>
            ))}
            {files.length > 3 && <p className="text-[12.5px] text-ink-500">+ {files.length - 3} more in the Hash Report</p>}
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              SHA-256 is the current standard (NIST FIPS 180-4). The Schedule&apos;s SHA1 and MD5 boxes are printed as part of the statutory
              form but left unticked.
            </p>
          </CardBody>
        </Card>
        <Callout tone="neutral" icon={<BadgeCheck />}>
          Part A is signed by the party by hand (or with a digital signature) after printing. The app leaves the signature box blank.
        </Callout>
      </div>
    </fieldset>
  );
}

export function StepPartB({ cert, setCert, readOnly }: { cert: Certificate; setCert: SetCert; readOnly?: boolean }) {
  const b = cert.partB;
  const patch = (p: Partial<PartB>) => setCert((c) => ({ ...c, partB: { ...c.partB, ...p } }));
  return (
    <fieldset disabled={readOnly} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader
            icon={<UserRoundCog />}
            title="Part B — the expert"
            description="The expert confirms the source device and the hash values."
            actions={
              !readOnly && (
                <DefaultsButtons
                  onLoad={async () => {
                    const d = await getProfileDefaults();
                    if (!d.expert.fullName) return toast('No saved expert yet', { description: 'Fill the form and choose “Save as default”.' });
                    patch({ ...d.expert, date: b.date, time: b.time } as Partial<PartB>);
                  }}
                  onSave={async () => {
                    const d = await getProfileDefaults();
                    const { date: _d, time: _t, ...rest } = b;
                    await saveProfileDefaults({ ...d, expert: rest });
                    toast.success('Saved as your default expert');
                  }}
                />
              )
            }
          />
          <CardBody className="flex flex-col gap-4">
            <DeclarantFields who="expert" value={b} onChange={patch} idPrefix="pb" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation" htmlFor="pb-desig" required hint="Printed beside the signature">
                <Input id="pb-desig" value={b.designation} onChange={(e) => patch({ designation: e.target.value })} placeholder="e.g. Digital Forensic Examiner" />
              </Field>
              <Field label="Qualification / accreditation" htmlFor="pb-qual" hint="For your records (not part of the Schedule)">
                <Input id="pb-qual" value={b.qualification} onChange={(e) => patch({ qualification: e.target.value })} placeholder="e.g. CHFI, M.Sc. Digital Forensics" />
              </Field>
            </div>
          </CardBody>
        </Card>
        <SignedAt value={b} onChange={patch} idPrefix="pb" />
      </div>
      <div className="flex flex-col gap-4">
        <Callout tone="amber" icon={<BadgeCheck />} title="Who can sign Part B?">
          Whether the expert must be a notified Examiner of Electronic Evidence (s.79A IT Act) is debated. Confirm with your advocate who
          should sign for your court.
        </Callout>
        <Callout tone="neutral">
          The expert should independently check the device and the hash values before signing. The device and hash fields in Part B are
          filled from the same details you entered.
        </Callout>
      </div>
    </fieldset>
  );
}
