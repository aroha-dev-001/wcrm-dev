'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import {
  RAIL_GROUPS,
  SECTION_META,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from './settings-sections';

// Width at/above which the rail is a vertical column (already in view, so
// no auto-scroll needed). Mirrors the Tailwind `lg:` breakpoint that
// drives the row→column switch in the markup below — keep the two in sync.
const RAIL_DESKTOP_MIN_PX = 1024;

/**
 * The settings left rail — grouped, vertical on desktop and a
 * horizontal scroller on narrow screens (mirrors the mockup's ≤920px
 * behaviour). The active item auto-scrolls into view when the rail is
 * horizontal so a deep-linked section is never off-screen.
 */
export function SettingsRail({
  active,
  onSelect,
  hints,
}: {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  hints?: Partial<Record<SettingsSection, ReactNode>>;
}) {
  const t = useTranslations('Settings');
  const activeRef = useRef<HTMLButtonElement>(null);

  // When horizontal (mobile), keep the active chip in view. On desktop
  // the rail is a static column, so skip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia(`(min-width: ${RAIL_DESKTOP_MIN_PX}px)`).matches) return;
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label={t('sectionsNav')}
      className={cn(
        'scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 pb-2 sm:-mx-6 sm:px-6',
        'lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b-0 lg:px-0 lg:pb-0',
      )}
    >
      {RAIL_GROUPS.map(({ label, group }) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) => SECTION_META[s].group === group,
        );
        return (
          <div
            key={group}
            className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5"
          >
            {label ? (
              <div className="hidden px-2 pt-4 pb-1 text-[11px] font-medium text-subtle-foreground lg:block">
                {t(`groups.${group}`)}
              </div>
            ) : null}
            {items.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const isActive = s === active;
              return (
                <button
                  key={s}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    'lg:w-full',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-4 shrink-0', isActive ? 'text-foreground' : 'text-subtle-foreground')} />
                  <span className="flex-1">{t(`sections.${s}`)}</span>
                  {hints?.[s] != null ? (
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-xs text-subtle-foreground lg:inline-flex',
                      )}
                    >
                      {hints[s]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
