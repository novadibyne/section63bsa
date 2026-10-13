import { AudioLines, File, FileText, Image as ImageIcon, Mail, MessageSquareText, Video } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EvidenceStatus, EvidenceType } from '@/lib/types';

const ICON = {
  image: ImageIcon,
  audio: AudioLines,
  video: Video,
  document: FileText,
  whatsapp_export: MessageSquareText,
  email: Mail,
  other: File,
} as const;

const TINT: Record<EvidenceType, string> = {
  image: 'bg-violet-50 text-violet-700 ring-violet-100',
  audio: 'bg-amber-50 text-amber-700 ring-amber-100',
  video: 'bg-rose-50 text-rose-700 ring-rose-100',
  document: 'bg-sky-50 text-sky-700 ring-sky-100',
  whatsapp_export: 'bg-brand-50 text-brand-700 ring-brand-100',
  email: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  other: 'bg-ink-50 text-ink-600 ring-line',
};

export function KindIcon({ kind, className, size = 'md' }: { kind: EvidenceType; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICON[kind];
  const box = size === 'lg' ? 'size-12 rounded-2xl [&_svg]:size-5' : size === 'sm' ? 'size-8 rounded-lg [&_svg]:size-4' : 'size-10 rounded-xl [&_svg]:size-[18px]';
  return (
    <span className={cn('flex shrink-0 items-center justify-center ring-1', box, TINT[kind], className)}>
      <Icon />
    </span>
  );
}

const STATUS: Record<EvidenceStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  hashed: { label: 'Hashed', tone: 'blue' },
  certificate_drafted: { label: 'Certificate drafted', tone: 'amber' },
  finalised: { label: 'Finalised', tone: 'brand' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}
