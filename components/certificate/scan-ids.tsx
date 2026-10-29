'use client';

import * as React from 'react';
import { Camera, ImageUp, Lock, ScanLine, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import type { DeviceIdScan, FoundId } from '@/lib/device-scan/parse';
import type { ScanProgress } from '@/lib/device-scan/scan';
import { logDeviceScan } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/form';
import { Callout, Progress } from '@/components/ui/misc';

const STAGE: Record<ScanProgress['stage'], { label: string; at: (p: number) => number }> = {
  preparing: { label: 'Getting the photo ready', at: () => 0.04 },
  barcodes: { label: 'Looking for barcodes', at: () => 0.1 },
  loading: { label: 'Loading the text reader (first time takes longer)', at: (p) => 0.12 + 0.28 * p },
  reading: { label: 'Reading the text in the photo', at: (p) => 0.4 + 0.6 * p },
};

type Phase = { name: 'pick' } | { name: 'working'; p: ScanProgress } | { name: 'results'; scan: DeviceIdScan } | { name: 'error'; message: string };

function sourceText(x: FoundId) {
  return x.sources.length > 1 ? 'read from a barcode and the text' : x.sources[0] === 'barcode' ? 'read from a barcode' : 'read from the text';
}

export function ScanIdsButton({
  evidenceId,
  onUse,
  disabled,
}: {
  evidenceId: string;
  onUse: (found: { imeis: string[]; serial?: string; makeModel?: string }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ name: 'pick' });
  const [preview, setPreview] = React.useState<string>();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const camera = React.useRef<HTMLInputElement>(null);
  const gallery = React.useRef<HTMLInputElement>(null);

  // The photo only ever lives in this object URL; closing the dialog drops it.
  const forgetPhoto = React.useCallback(() => {
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return undefined;
    });
  }, []);
  React.useEffect(() => forgetPhoto, [forgetPhoto]);

  const close = () => {
    setOpen(false);
    setPhase({ name: 'pick' });
    forgetPhoto();
  };

  const run = async (photo: File) => {
    forgetPhoto();
    setPreview(URL.createObjectURL(photo));
    setPhase({ name: 'working', p: { stage: 'preparing' } });
    try {
      const { scanDeviceIds } = await import('@/lib/device-scan/scan');
      const scan = await scanDeviceIds(photo, (p) => setPhase({ name: 'working', p }));
      const serial = scan.serials.find((s) => s.label === 'Serial number') ?? scan.serials[0];
      setPicked(new Set([...scan.imeis.map((x) => x.value), ...[serial, scan.models[0]].filter(Boolean).map((x) => x!.value)]));
      setPhase({ name: 'results', scan });
    } catch (err) {
      setPhase({ name: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const toggle = (value: string, on: boolean, scan: DeviceIdScan) =>
    setPicked((s) => {
      const next = new Set(s);
      // Only one serial number and one make & model can go on the certificate.
      for (const group of [scan.serials, scan.models])
        if (on && group.some((x) => x.value === value)) group.forEach((x) => next.delete(x.value));
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });

  const use = async (scan: DeviceIdScan) => {
    const imeis = scan.imeis.filter((x) => picked.has(x.value)).map((x) => x.value);
    const serial = scan.serials.find((x) => picked.has(x.value))?.value;
    const makeModel = scan.models.find((x) => picked.has(x.value))?.value;
    onUse({ imeis, serial, makeModel });
    close();
    toast.success('Filled in from the photo', { description: 'Check the details below. The photo was not kept.' });
    await logDeviceScan(evidenceId, imeis.length, !!serial, !!makeModel);
  };

  const found = phase.name === 'results' && [phase.scan.imeis, phase.scan.serials, phase.scan.models].some((g) => g.length > 0);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={disabled} data-testid="scan-ids">
        <ScanLine /> Scan from a photo
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Read the phone’s details from a photo"
        description="Its IMEI numbers, serial number and make & model are read from a photo of the IMEI screen, the About phone page or the label on its box."
        footer={
          phase.name === 'results' && found ? (
            <>
              <Button variant="secondary" onClick={() => setPhase({ name: 'pick' })}>
                Try another photo
              </Button>
              <Button onClick={() => use(phase.scan)} disabled={picked.size === 0} data-testid="scan-use">
                Use these
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {phase.name === 'pick' && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="lg" onClick={() => camera.current?.click()}>
                  <Camera /> Take a photo
                </Button>
                <Button size="lg" variant="secondary" onClick={() => gallery.current?.click()}>
                  <ImageUp /> Choose a photo
                </Button>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-600">
                <li>
                  Dial <strong className="font-semibold text-ink-900">*#06#</strong> on the phone, or open Settings › About phone.
                </li>
                <li>
                  Photograph that screen <strong className="font-semibold text-ink-900">with another phone or camera</strong>. Don’t take a
                  screenshot on the evidence phone: that adds a new file to it.
                </li>
                <li>A photo of the box label works too. Its barcodes are read as well.</li>
              </ul>
            </>
          )}

          {preview && phase.name !== 'pick' && (
            <img src={preview} alt="The photo being read" className="max-h-44 w-full rounded-xl bg-ink-50 object-contain ring-1 ring-line" />
          )}

          {phase.name === 'working' && (
            <div aria-live="polite">
              <p className="text-[13.5px] font-medium text-ink-800">{STAGE[phase.p.stage].label}…</p>
              <Progress className="mt-2" value={STAGE[phase.p.stage].at(phase.p.progress ?? 0)} />
            </div>
          )}

          {phase.name === 'results' &&
            (found ? (
              <div className="flex flex-col gap-3" data-testid="scan-results">
                <p className="text-[13.5px] text-ink-700">Found in the photo. Untick anything that doesn’t match the phone, then press “Use these”.</p>
                {[...phase.scan.models, ...phase.scan.imeis, ...phase.scan.serials].map((x) => (
                  <Checkbox
                    key={x.value}
                    id={`scan-${x.value}`}
                    checked={picked.has(x.value)}
                    onChange={(on) => toggle(x.value, on, phase.scan)}
                    label={
                      <>
                        {x.label}: <span className="font-mono font-semibold tracking-tight">{x.value}</span>
                      </>
                    }
                    description={x.label.startsWith('IMEI') ? `Check digit is valid · ${sourceText(x)}` : sourceText(x)}
                  />
                ))}
              </div>
            ) : (
              <Callout tone="amber" icon={<SearchX />} title="Nothing readable found in this photo">
                Try again closer up, with the numbers sharp and filling most of the photo, and without glare.
                <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => setPhase({ name: 'pick' })}>
                  Try another photo
                </Button>
              </Callout>
            ))}

          {phase.name === 'error' && (
            <Callout tone="red" title="The photo could not be read">
              {phase.message}
            </Callout>
          )}

          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-brand-800">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            The photo is read on this device and then thrown away. It is never uploaded or saved. Only the numbers you tick go on the
            certificate.
          </p>
        </div>

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void run(f);
          }}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="scan-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void run(f);
          }}
        />
      </Dialog>
    </>
  );
}
