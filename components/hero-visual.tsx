import { Check, Lock, MessageSquareText } from 'lucide-react';

function Box({ on, label }: { on?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-700">
      {label}
      <span className={`flex size-3.5 items-center justify-center rounded-[3px] border ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-300 bg-white'}`}>
        {on && <Check className="size-2.5" strokeWidth={4} />}
      </span>
    </span>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto mt-8 w-full max-w-[460px] select-none lg:mt-0" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-brand-100/70 via-white to-ink-100/80 blur-2xl" />

      {/* Certificate sheet */}
      <div className="relative rotate-[1.2deg] rounded-2xl bg-sheet p-6 shadow-sheet ring-1 ring-line sm:p-7">
        <div className="flex items-start justify-between">
          <div className="font-serif">
            <p className="text-[10.5px] font-semibold tracking-[0.22em] text-ink-500">THE SCHEDULE · s.63(4)(c)</p>
            <p className="mt-1 text-[17px] font-bold tracking-[0.18em] text-ink-950">CERTIFICATE</p>
            <p className="text-[12px] text-ink-600 italic">Part A — to be filled by the Party</p>
          </div>
          <div className="relative flex size-14 items-center justify-center rounded-full border-2 border-dashed border-brand-500 text-brand-600">
            <div className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-md">
              <Check className="size-5" strokeWidth={3} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <div className="h-2 w-full rounded-full bg-ink-100" />
          <div className="h-2 w-[88%] rounded-full bg-ink-100" />
          <div className="h-2 w-[64%] rounded-full bg-ink-100" />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-serif">
          <Box label="Mobile" on />
          <Box label="Cloud" on />
          <Box label="Computer" />
          <Box label="DVR" />
        </div>

        <div className="mt-4 rounded-lg border-l-[3px] border-brand-500 bg-white px-3.5 py-2.5 shadow-card ring-1 ring-line">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-brand-700">SHA256 ☑</p>
          <p className="mt-1 font-mono text-[11.5px] leading-relaxed break-all text-ink-800">
            41d70d0d155149de3db35ba8d44001370849d13c8a8872843938ec4d2b8bbe3a
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div className="flex flex-col gap-1 text-[10.5px] text-ink-500">
            <span>Date (DD/MM/YYYY): 13/10/2026</span>
            <span>Time (IST): 14:32 hours</span>
          </div>
          <div className="w-28 text-center">
            <div className="border-b border-ink-700" />
            <p className="mt-1 text-[10px] text-ink-500">(Name and signature)</p>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -top-12 -left-2 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-lift ring-1 ring-line sm:-left-10">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <MessageSquareText className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[12.5px] font-semibold text-ink-900">WhatsApp export</p>
          <p className="text-[11px] text-ink-500">1,284 messages · 37 media</p>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-2 flex items-center gap-2 rounded-full bg-ink-950 px-3.5 py-2 text-[12px] font-medium text-white shadow-lift sm:-left-8">
        <Lock className="size-3.5 text-brand-400" />
        Hashed on this device
      </div>
    </div>
  );
}
