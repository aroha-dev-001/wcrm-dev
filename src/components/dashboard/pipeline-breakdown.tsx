"use client"

import Link from 'next/link'
import { GitBranch } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { PipelineDonutData } from '@/lib/dashboard/types'
import { formatCurrencyShort } from '@/lib/currency'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel, PanelFooter, PanelHeader } from '@/components/ui/panel'

interface PipelineBreakdownProps {
  data: PipelineDonutData | null
  loading: boolean
  /** Account default currency for the totals. */
  currency: string
}

/**
 * Open pipeline value by stage as a ranked bar list — easier to read
 * and compare than a donut, and it keeps the exact numbers visible.
 */
export function PipelineBreakdown({ data, loading, currency }: PipelineBreakdownProps) {
  const t = useTranslations('Dashboard.pipelineDonut')
  const max = data ? Math.max(1, ...data.stages.map((s) => s.totalValue)) : 1

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('title')}
        description={t('description')}
        actions={
          data && data.stages.length > 0 ? (
            <span className="text-[13px] font-semibold text-foreground tabular-nums">
              {formatCurrencyShort(data.totalValue, currency)}
            </span>
          ) : null
        }
      />
      <div className="flex-1 px-4 py-3">
        {loading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : data.stages.length === 0 ? (
          <EmptyState
            size="sm"
            icon={GitBranch}
            title={t('noOpenDeals')}
            description={t('noOpenDealsHint')}
            className="min-h-48"
          />
        ) : (
          <ul className="space-y-3" aria-label={t('ariaLabel')}>
            {data.stages.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t('dealCount', { count: s.dealCount })}
                  </span>
                  <span className="w-16 text-right font-medium text-foreground tabular-nums">
                    {formatCurrencyShort(s.totalValue, currency)}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (s.totalValue / max) * 100)}%`,
                      background: s.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.stages.length > 0 ? (
        <PanelFooter>
          <span>{t('stages', { count: data.stages.length })}</span>
          <Link href="/pipelines" className="font-medium text-foreground hover:underline">
            {t('openPipelines')}
          </Link>
        </PanelFooter>
      ) : null}
    </Panel>
  )
}
