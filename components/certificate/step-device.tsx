'use client';

import * as React from 'react';
import { Cpu, Info, Plus, Trash2, Wand2, X } from 'lucide-react';
import type { Device, DeviceCategory, EvidenceFile, IdentifierType } from '@/lib/types';
import { blankDevice, removeDevice, saveDevice } from '@/lib/actions';
import { useAutosave } from '@/lib/hooks';
import { DEVICE_SOURCE_OPTIONS } from '@/lib/legal/schedule-63';
import { IDENTIFIER_LABEL, identifierError } from '@/lib/legal/validators';
import { metadataSentence, type MetaRow } from '@/lib/evidence/metadata';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CheckChip, Field, Input, Select, Textarea } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/dialog';

function suggestCategories(files: EvidenceFile[]): DeviceCategory[] {
  const set = new Set<DeviceCategory>();
  for (const f of files) {
    if (['image', 'audio', 'video'].includes(f.kind)) set.add('mobile');
    if (f.kind === 'whatsapp_export') {
      set.add('mobile');
      set.add('cloud');
    }
    if (f.kind === 'document' || f.kind === 'email') set.add('computer_storage_media');
  }
  return [...set];
}

function exifMakeModel(files: EvidenceFile[]): string | undefined {
  for (const f of files) {
    const make = f.metadata.make as string | undefined;
    const model = f.metadata.model as string | undefined;
    if (model && make && model.toLowerCase().startsWith(make.toLowerCase())) return model;
    if (make || model) return [make, model].filter(Boolean).join(' ');
  }
  return undefined;
}

function DeviceEditor({
  device,
  index,
  files,
  canRemove,
  readOnly,
}: {
  device: Device;
  index: number;
  files: EvidenceFile[];
  canRemove: boolean;
  readOnly?: boolean;
}) {
  const [d, setD] = useAutosave<Device>(device.id, device, saveDevice);
  const { confirm, element } = useConfirm();
  const suggestion = exifMakeModel(files);
  if (!d) return null;
  const toggle = (k: DeviceCategory, on: boolean) =>
    setD((x) => ({ ...x, categories: on ? [...x.categories, k] : x.categories.filter((c) => c !== k) }));
  const setId = (i: number, patch: Partial<{ idType: IdentifierType; value: string }>) =>
    setD((x) => ({ ...x, identifiers: x.identifiers.map((id, j) => (j === i ? { ...id, ...patch } : id)) }));

  return (
    <Card>
      {element}
      <CardHeader
        icon={<Cpu />}
        title={index === 0 ? 'Device or source of the record' : `Additional device ${index + 1}`}
        description={index === 0 ? 'Printed in the device fields of Part A and Part B.' : 'Listed under “any other relevant information”.'}
        actions={
          canRemove && !readOnly ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: 'Remove this device?', confirmLabel: 'Remove', danger: true })) await removeDevice(device);
              }}
            >
              <Trash2 /> Remove
            </Button>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-5">
        <fieldset disabled={readOnly} className="contents">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-800">
              Device / digital record source <span className="text-brand-600">*</span>
              <span className="ml-1 font-normal text-ink-500">(tick all that apply)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DEVICE_SOURCE_OPTIONS.map((o) => (
                <CheckChip key={o.key} checked={d.categories.includes(o.key)} onChange={(v) => toggle(o.key, v)} disabled={readOnly}>
                  {o.label}
                </CheckChip>
              ))}
            </div>
            {d.categories.includes('other') && (
              <Input
                className="mt-3 max-w-md"
                placeholder="Describe the other source"
                value={d.categoryOther ?? ''}
                onChange={(e) => setD((x) => ({ ...x, categoryOther: e.target.value }))}
                aria-label="Other source"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Make & Model" htmlFor={`mm-${d.id}`} hint={!d.makeModel && suggestion ? undefined : 'e.g. Samsung Galaxy S23 (SM-S911B)'}>
              <Input id={`mm-${d.id}`} value={d.makeModel ?? ''} onChange={(e) => setD((x) => ({ ...x, makeModel: e.target.value }))} />
              {suggestion && d.makeModel !== suggestion && !readOnly && (
                <button
                  type="button"
                  onClick={() => setD((x) => ({ ...x, makeModel: suggestion }))}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100"
                >
                  <Wand2 className="size-3.5" /> Use “{suggestion}” from photo EXIF
                </button>
              )}
            </Field>
            <Field label="Color" htmlFor={`col-${d.id}`}>
              <Input id={`col-${d.id}`} value={d.color ?? ''} onChange={(e) => setD((x) => ({ ...x, color: e.target.value }))} placeholder="e.g. Phantom Black" />
            </Field>
            <Field label="Serial Number" htmlFor={`sn-${d.id}`} className="sm:col-span-2">
              <Input id={`sn-${d.id}`} value={d.serialNumber ?? ''} onChange={(e) => setD((x) => ({ ...x, serialNumber: e.target.value }))} placeholder="Settings › About phone › Serial number" />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-800">
              IMEI / UIN / UID / MAC / Cloud ID <span className="font-normal text-ink-500">(as applicable)</span>
            </p>
            <div className="flex flex-col gap-2">
              {d.identifiers.map((id, i) => {
                const err = identifierError(id.idType, id.value);
                return (
                  <div key={i}>
                    <div className="flex gap-2">
                      <Select
                        className="w-32 shrink-0"
                        value={id.idType}
                        onChange={(e) => setId(i, { idType: e.target.value as IdentifierType })}
                        aria-label="Identifier type"
                      >
                        {Object.entries(IDENTIFIER_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                      <Input
                        value={id.value}
                        onChange={(e) => setId(i, { value: e.target.value })}
                        placeholder={id.idType === 'imei' ? '15 digits — dial *#06#' : id.idType === 'mac' ? 'AA:BB:CC:DD:EE:FF' : id.idType === 'cloud_id' ? 'e.g. account email / Apple ID' : ''}
                        className={err ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'font-mono text-[13px]'}
                        aria-label={`${IDENTIFIER_LABEL[id.idType]} value`}
                        aria-invalid={!!err}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove identifier"
                        onClick={() => setD((x) => ({ ...x, identifiers: x.identifiers.filter((_, j) => j !== i) }))}
                      >
                        <X />
                      </Button>
                    </div>
                    {err && <p className="mt-1 ml-34 text-[12px] text-red-600">{err}</p>}
                  </div>
                );
              })}
              <Button
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() => setD((x) => ({ ...x, identifiers: [...x.identifiers, { idType: x.identifiers.length ? 'other' : 'imei', value: '' }] }))}
              >
                <Plus /> Add identifier
              </Button>
            </div>
          </div>

          <Field label="Any other relevant information about the device / digital record" htmlFor={`oi-${d.id}`}>
            <Textarea
              id={`oi-${d.id}`}
              rows={3}
              value={d.otherInfo ?? ''}
              onChange={(e) => setD((x) => ({ ...x, otherInfo: e.target.value }))}
              placeholder="e.g. Android 14, WhatsApp account +91 98xxxxxx10, chat backed up to Google Drive"
            />
            {index === 0 && files.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() =>
                  setD((x) => ({
                    ...x,
                    otherInfo: [x.otherInfo, ...files.map((f) => metadataSentence(f.originalFilename, (f.metadata.summary as MetaRow[]) ?? []))]
                      .filter(Boolean)
                      .join('\n'),
                  }))
                }
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 py-1 text-[12px] font-medium text-ink-700 ring-1 ring-line hover:bg-white"
              >
                <Wand2 className="size-3.5" /> Insert details read from the files
              </button>
            )}
          </Field>
        </fieldset>
      </CardBody>
    </Card>
  );
}

export function StepDevice({
  evidenceId,
  files,
  devices,
  readOnly,
}: {
  evidenceId: string;
  files: EvidenceFile[];
  devices: Device[] | undefined;
  readOnly?: boolean;
}) {
  const created = React.useRef(false);
  React.useEffect(() => {
    if (devices && devices.length === 0 && !created.current && !readOnly) {
      created.current = true;
      const d = blankDevice(evidenceId);
      d.categories = suggestCategories(files);
      d.makeModel = exifMakeModel(files);
      void saveDevice(d);
    }
  }, [devices, evidenceId, files, readOnly]);

  if (!devices) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        {devices.map((d, i) => (
          <DeviceEditor key={d.id} device={d} index={i} files={files} canRemove={devices.length > 1} readOnly={readOnly} />
        ))}
        {!readOnly && (
          <Button variant="secondary" className="w-fit" onClick={() => saveDevice(blankDevice(evidenceId))}>
            <Plus /> Add another device
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Callout tone="neutral" icon={<Info />} title="Several devices count as one">
          Under s.63(3), devices used together (for example a phone, its cloud backup and the WhatsApp service) are treated as a single
          device. Add each one that was involved.
        </Callout>
        <Callout tone="brand" icon={<Cpu />} title="Where to find the numbers">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>IMEI: dial *#06# on the phone</li>
            <li>Serial: Settings › About phone</li>
            <li>MAC: Settings › About › Wi-Fi MAC address</li>
            <li>DVR: label under the unit, or its system menu</li>
          </ul>
        </Callout>
      </div>
    </div>
  );
}
