"use client"

import Link from 'next/link'
import { useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Inbox,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/dashboard/types'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel, PanelFooter, PanelHeader } from '@/components/ui/panel'
import { SegmentedControl } from '@/components/ui/segmented-control'

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading: boolean
}

const PAGE_SIZES = [5, 10, 20, 50] as const
type PageSize = (typeof PAGE_SIZES)[number]

// Neutral glyph per event kind — the icon carries the meaning, so the
// feed stays calm instead of a rainbow of tinted badges.
const KIND_ICON: Record<ActivityKind, ComponentType<{ className?: string }>> = {
  message: MessageSquare,
  contact: UserPlus,
  deal: Briefcase,
  broadcast: Radio,
  automation: Zap,
}

import { useTranslations } from 'next-intl'

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const t = useTranslations('Dashboard.activityFeed')
  // Start at 5 — a quick scan of the most recent events without
  // dominating vertical real estate. User expands explicitly via the
  // footer control when they want deeper history.
  const [pageSize, setPageSize] = useState<PageSize>(5)

  const totalLoaded = items?.length ?? 0
  const visible = items?.slice(0, pageSize) ?? []
  // A size option is "useful" if picking it would reveal rows the
  // smaller option doesn't already show. With PAGE_SIZES=[5,10,20,50]:
  // "10" is useful only once we've loaded ≥6 items, "20" once ≥11, etc.
  // The smallest option is always enabled.
  const isSizeUseful = (size: PageSize, i: number) =>
    i === 0 || totalLoaded > PAGE_SIZES[i - 1]

  return (
    <Panel>
      <PanelHeader
        title={t('title')}
        actions={
          <Link
            href="/inbox"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('viewAll')}
          </Link>
        }
      />

      {loading || !items ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Inbox}
          title={t('noActivity')}
          description={t('noActivityHint')}
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {visible.map((it) => {
              const Icon = KIND_ICON[it.kind]
              const row = (
                <div className="flex items-center gap-3 px-4 py-2">
                  <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-md border border-border bg-card-2 text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {it.text}
                  </span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                    {relativeTime(it.at, t)}
                  </span>
                </div>
              )
              return (
                <li key={it.id} className="transition-colors hover:bg-muted/40">
                  {it.href ? (
                    <Link href={it.href} className="block focus-visible:bg-muted/40 focus-visible:outline-none">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
          <PanelFooter>
            <span className="tabular-nums">
              {t('showingOf', { visible: visible.length, totalLoaded, plus: totalLoaded === 50 ? '+' : '' })}
            </span>
            <div className="flex items-center gap-2">
              <span>{t('show')}</span>
              <SegmentedControl
                size="sm"
                aria-label={t('show')}
                value={pageSize}
                onValueChange={(v) => setPageSize(v)}
                options={PAGE_SIZES.filter((size, i) => isSizeUseful(size, i)).map((size) => ({
                  value: size,
                  label: String(size),
                }))}
              />
            </div>
          </PanelFooter>
        </>
      )}
    </Panel>
  )
}

function relativeTime(iso: string, t: ReturnType<typeof useTranslations>): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return t('timeS', { sec: Math.max(1, diffSec) })
  if (diffSec < 3600) return t('timeM', { min: Math.floor(diffSec / 60) })
  if (diffSec < 86400) return t('timeH', { hr: Math.floor(diffSec / 3600) })
  if (diffSec < 2_592_000) return t('timeD', { day: Math.floor(diffSec / 86400) })
  return new Date(iso).toLocaleDateString()
}
