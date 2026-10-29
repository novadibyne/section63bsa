'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookOpenText, FileClock, House, Lock, Plus, Settings2, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { APP_NAME, APP_TAGLINE, PRIVACY_BADGE, PRIVACY_DETAIL } from '@/lib/config';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home', icon: House },
  { href: '/history/', label: 'My certificates', icon: FileClock },
  { href: '/why/', label: 'Why it matters', icon: BookOpenText },
  { href: '/privacy/', label: 'Privacy', icon: ShieldCheck },
  { href: '/settings/', label: 'Settings', icon: Settings2 },
];

/** The privacy promise, on every page. */
function PrivacyBar() {
  return (
    <Link
      href="/privacy/"
      className="group block bg-brand-700 text-white hover:bg-brand-800"
      data-testid="privacy-bar"
      title="Your files, photos and certificates are processed in this browser and never uploaded"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-[12.5px] sm:px-6">
        <Lock className="size-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">{PRIVACY_BADGE}</strong>
          <span className="hidden sm:inline"> · {PRIVACY_DETAIL}</span>
          <span className="sm:hidden"> · Safe and private</span>
        </span>
        <ArrowRight className="hidden size-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5 sm:block" />
      </div>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, '')));

  return (
    // Sticky only on large screens: on a phone a fixed header would take up a third of the screen.
    <header className="z-40 lg:sticky lg:top-0">
      <PrivacyBar />
      <div className="border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[17px] font-extrabold tracking-tight text-ink-950">{APP_NAME}</span>
              <span className="hidden text-[11.5px] text-ink-500 sm:block">{APP_TAGLINE}</span>
            </div>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex">
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

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ButtonLink href="/evidence/new/" variant="brand" size="sm" className="h-9">
              <Plus />
              <span className="hidden sm:inline">New certificate</span>
            </ButtonLink>
          </div>
        </div>

        {/* Phone and tablet nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden">
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
      </div>
    </header>
  );
}
