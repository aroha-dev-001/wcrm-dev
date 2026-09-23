"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  Plus,
  Radio,
  UserPlus,
  Zap,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadNeedsReply,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  NeedsReplyItem,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { Page, PageBody, PageHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Stat, StatStrip } from '@/components/ui/stat-strip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineBreakdown } from '@/components/dashboard/pipeline-breakdown'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { NeedsReply } from '@/components/dashboard/needs-reply'

type RangeDays = 7 | 30 | 90

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page')
  const tQuick = useTranslations('Dashboard.quickActions')
  const { defaultCurrency } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  // Keep a cache per range so switching tabs doesn't re-fetch what we
  // already have. Ranges the user hasn't opened yet stay null and
  // trigger a fetch on first view.
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const [needsReply, setNeedsReply] = useState<NeedsReplyItem[] | null>(null)
  const [needsReplyError, setNeedsReplyError] = useState(false)

  const loadAll = useCallback(() => {
    const db = createClient()

    // Kick everything off in parallel. Each block has its own
    // setState + finally so a slow query doesn't hold up faster
    // sections — each widget shows its own skeleton independently.
    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    // Fetch up to 50 so the biggest page-size option in the feed
    // (50 rows) is already in memory — switching sizes then becomes
    // a pure client-side slice with no extra round trip.
    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))

    void loadNeedsReply(db)
      .then((n) => setNeedsReply(n))
      .catch((err) => {
        console.error('[dashboard] needs-reply failed:', err)
        setNeedsReplyError(true)
        setNeedsReply([])
      })
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Range switch handler — kept in an event callback (not an effect)
  // so the setState calls stay out of the react-hooks/set-state-in-effect
  // rule's way. The cached bucket check means switching back to a
  // previously-viewed range is instant and doesn't re-fetch.
  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  const createActions = [
    { key: 'newContact', href: '/contacts?new=1', icon: UserPlus },
    { key: 'newDeal', href: '/pipelines?new=deal', icon: Briefcase },
    { key: 'newBroadcast', href: '/broadcasts/new', icon: Radio },
    { key: 'newAutomation', href: '/automations/new', icon: Zap },
  ] as const

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button />}
            >
              <Plus />
              {t('create')}
              <ChevronDown className="-mr-0.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {createActions.map((a) => (
                <DropdownMenuItem key={a.key} render={<Link href={a.href} />}>
                  <a.icon />
                  {tQuick(a.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <PageBody className="space-y-4">
        {/* Key numbers */}
        <StatStrip className="lg:grid-cols-4">
          {metricsLoading || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card px-4 py-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2.5 h-6 w-16" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            ))
          ) : (
            <>
              <Stat
                label={t('activeConversations')}
                value={metrics.activeConversations.current.toLocaleString()}
                hint={
                  <Delta
                    delta={metrics.activeConversations.previous}
                    label={deltaLabel(
                      metrics.activeConversations.previous,
                      t('newTodayVsYesterday'),
                      t('noChange', { suffix: t('newTodayVsYesterday') }),
                    )}
                  />
                }
              />
              <Stat
                label={t('newContactsToday')}
                value={metrics.newContactsToday.current.toLocaleString()}
                hint={
                  <Delta
                    delta={metrics.newContactsToday.current - metrics.newContactsToday.previous}
                    label={deltaLabel(
                      metrics.newContactsToday.current - metrics.newContactsToday.previous,
                      t('vsYesterday'),
                      t('noChange', { suffix: t('vsYesterday') }),
                    )}
                  />
                }
              />
              <Stat
                label={t('openDealsValue')}
                value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
                hint={t('openDeals', { count: metrics.openDealsCount })}
              />
              <Stat
                label={t('messagesSentToday')}
                value={metrics.messagesSentToday.current.toLocaleString()}
                hint={
                  <Delta
                    delta={metrics.messagesSentToday.current - metrics.messagesSentToday.previous}
                    label={deltaLabel(
                      metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                      t('vsYesterday'),
                      t('noChange', { suffix: t('vsYesterday') }),
                    )}
                  />
                }
              />
            </>
          )}
        </StatStrip>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <ConversationsChart
              series={series}
              loading={seriesLoading}
              range={range}
              onRangeChange={handleRangeChange}
            />
          </div>
          <NeedsReply items={needsReply} error={needsReplyError} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />
          </div>
          <PipelineBreakdown
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
          />
        </div>

        <ActivityFeed items={activity} loading={activityLoading} />
      </PageBody>
    </Page>
  )
}

// ------------------------------------------------------------

function Delta({ delta, label }: { delta: number; label: string }) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {label}
    </span>
  )
}

function deltaLabel(delta: number, suffix: string, noChangeLabel: string): string {
  if (delta === 0) return noChangeLabel
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}
