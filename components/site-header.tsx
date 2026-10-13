'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, ScrollText, Settings2, Plus } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { APP_NAME, APP_TAGLINE } from '@/lib/config';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/audit/', label: 'Audit log', icon: ScrollText },
  { href: '/settings/', label: 'Settings', icon: Settings2 },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, '')));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <LogoMark />
          <div className="leading-tight">
            <span className="block font-display text-[17px] font-extrabold tracking-tight text-ink-950">{APP_NAME}</span>
            <span className="hidden text-[11.5px] text-ink-500 sm:block">{APP_TAGLINE}</span>
          </div>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13.5px] font-medium transition-colors',
                isActive(href) ? 'bg-ink-50 text-ink-950' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-800 lg:inline-flex"
            title="Files are processed in this browser and never uploaded"
          >
            <ShieldCheck className="size-3.5" />
            On-device · nothing uploaded
          </span>
          <ButtonLink href="/evidence/new/" variant="brand" size="sm" className="h-9">
            <Plus />
            <span className="hidden sm:inline">New evidence</span>
          </ButtonLink>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium',
              isActive(href) ? 'bg-ink-50 text-ink-950' : 'text-ink-600',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
