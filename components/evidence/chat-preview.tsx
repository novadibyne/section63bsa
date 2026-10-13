'use client';

import * as React from 'react';
import { Paperclip } from 'lucide-react';
import type { ChatSummary } from '@/lib/evidence/metadata/whatsapp';
import { cn } from '@/lib/utils';

export function ChatPreview({ chat, initial = 12 }: { chat: ChatSummary; initial?: number }) {
  const [limit, setLimit] = React.useState(initial);
  const first = chat.participants[0];
  const shown = chat.preview.slice(0, limit);
  return (
    <div className="rounded-xl border border-line bg-[#efeae2] bg-[radial-gradient(rgb(0_0_0/0.035)_1px,transparent_1px)] [background-size:14px_14px] p-3 sm:p-4">
      <div className="flex flex-col gap-1.5">
        {shown.map((m) =>
          m.system ? (
            <div key={m.n} className="mx-auto my-1 max-w-[85%] rounded-lg bg-[#fff5c4] px-3 py-1 text-center text-[11.5px] text-ink-700 shadow-sm">
              {m.text}
            </div>
          ) : (
            <div key={m.n} className={cn('flex', m.sender === first ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'relative max-w-[82%] rounded-xl px-3 pt-1.5 pb-1 text-[13.5px] leading-snug shadow-sm',
                  m.sender === first ? 'rounded-tl-sm bg-white' : 'rounded-tr-sm bg-[#d9fdd3]',
                )}
              >
                <div className="mb-0.5 flex items-center gap-2 text-[11px] font-semibold text-brand-800">
                  <span className="font-mono text-[10px] font-medium text-ink-400">#{m.n}</span>
                  {m.sender}
                </div>
                <p className="whitespace-pre-wrap break-words text-ink-900">
                  {m.media && <Paperclip className="mr-1 inline size-3 text-ink-500" />}
                  {m.text}
                </p>
                <p className="mt-0.5 text-right text-[10.5px] text-ink-500">
                  {m.date} · {m.time}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
      {chat.preview.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 40)}
          className="mx-auto mt-3 block rounded-full bg-white/90 px-4 py-1.5 text-[12.5px] font-medium text-ink-700 shadow-sm hover:bg-white"
        >
          Show more messages ({chat.preview.length - limit} more in preview)
        </button>
      )}
      {chat.messageCount + chat.systemMessageCount > chat.preview.length && limit >= chat.preview.length && (
        <p className="mt-3 text-center text-[11.5px] text-ink-600">
          Preview shows the first {chat.preview.length} entries of {chat.messageCount + chat.systemMessageCount}.
        </p>
      )}
    </div>
  );
}
