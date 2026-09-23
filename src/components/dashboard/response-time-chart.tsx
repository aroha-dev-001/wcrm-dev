"use client"

import { Clock } from 'lucide-react'
import { DOW_SHORT_MON_FIRST } from '@/lib/dashboard/date-utils'
import type { ResponseTimeSummary } from '@/lib/dashboard/types'
import { BarChart } from '@/components/tremor/bar-chart'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel, PanelHeader } from '@/components/ui/panel'

interface ResponseTimeChartProps {
  data: ResponseTimeSummary | null
  loading: boolean
  /** Minutes. Surfaced as a "target" pill in the header. The
   *  hand-rolled SVG version drew this as a horizontal dashed
   *  line on the chart; Tremor BarChart doesn't expose Recharts
   *  primitives, so we promote it to the header for now. A
   *  follow-up can introduce an overlay or extend the vendored
   *  BarChart with a `referenceLines` prop. */
  thresholdMinutes?: number
}

import { useTranslations } from 'next-intl'

// Single category, single colour — the data is "average minutes
// per weekday". Tremor expects categories as the second tuple in
// the row object, so we shape the buckets into
// `{ day: 'Mon', 'Avg minutes': 4.2 }` rows below.
const CATEGORY = 'Avg minutes'

export function ResponseTimeChart({
  data,
  loading,
  thresholdMinutes = 5,
}: ResponseTimeChartProps) {
  const t = useTranslations('Dashboard.responseTimeChart')
  const hasData = data?.buckets.some((b) => b.avgMinutes != null) ?? false

  // Map buckets → Tremor rows. Null `avgMinutes` (no samples)
  // collapses to 0; the chart will render an empty slot for it.
  // We attach `samples` on the row so a future customTooltip can
  // surface "no samples" copy without losing the data shape.
  const chartData =
    data?.buckets.map((b, i) => ({
      day: DOW_SHORT_MON_FIRST[i],
      [CATEGORY]: b.avgMinutes ?? 0,
      samples: b.samples,
    })) ?? []

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-4 text-xs">
            {data && (data.thisWeekAvg != null || data.lastWeekAvg != null) && (
              <>
                <div className="text-right">
                  <div className="text-muted-foreground">{t('thisWeek')}</div>
                  <div className="font-semibold text-foreground tabular-nums">
                    {fmt(data.thisWeekAvg)}
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-muted-foreground">{t('lastWeek')}</div>
                  <div className="font-medium text-muted-foreground tabular-nums">
                    {fmt(data.lastWeekAvg)}
                  </div>
                </div>
              </>
            )}
            {thresholdMinutes > 0 && (
              <span className="hidden rounded-[5px] border border-border px-1.5 py-0.5 font-medium text-muted-foreground tabular-nums md:inline">
                {t('target', { minutes: thresholdMinutes })}
              </span>
            )}
          </div>
        }
      />

      <div className="flex flex-1 flex-col justify-center px-4 py-3">
        {loading || !data ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasData ? (
          <EmptyState
            size="sm"
            icon={Clock}
            title={t('noReplies')}
            description={t('noRepliesHint')}
            className="min-h-[220px]"
          />
        ) : (
          <BarChart
            data={chartData}
            index="day"
            categories={[CATEGORY]}
            // Theme accent via chart tokens (see tremor/chart-colors).
            colors={['primary']}
            valueFormatter={(value) => `${value.toFixed(1)}m`}
            showLegend={false}
            yAxisWidth={40}
            className="h-[220px]"
          />
        )}
      </div>
    </Panel>
  )
}

function fmt(mins: number | null): string {
  if (mins == null) return '—'
  if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`
  if (mins < 60) return `${mins.toFixed(1)}m`
  return `${(mins / 60).toFixed(1)}h`
}
