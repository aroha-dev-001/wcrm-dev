'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Stat, StatStrip } from '@/components/ui/stat-strip';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/components/tremor/bar-chart';
import { formatCompactNumber } from '@/lib/currency';
import { format, parseISO } from 'date-fns';

interface UsageResponse {
  window_days: number;
  truncated: boolean;
  totals: {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  by_mode: {
    auto_reply: { calls: number; tokens: number };
    draft: { calls: number; tokens: number };
  };
  by_model: {
    model: string;
    provider: string;
    calls: number;
    tokens: number;
  }[];
  daily: { date: string; tokens: number; calls: number }[];
}

const WINDOWS = [7, 30, 90] as const;

/**
 * Token-spend dashboard for the account's BYO key. Admin-only (spend is
 * billing-class), mirroring the `ai_usage_log` SELECT policy and the
 * `GET /api/ai/usage` route. Renders nothing for non-admins.
 */
export function AiUsageCard() {
  const t = useTranslations('Agents.usage');
  const { accountId, accountRole, profileLoading } = useAuth();
  const canView = accountRole ? canEditSettings(accountRole) : false;

  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);
  const loadedRef = useRef<string | null>(null);

  const fetchUsage = useCallback(async (windowDays: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/usage?days=${windowDays}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? t('loadFailed'));
        setData(null);
        return;
      }
      setData(json as UsageResponse);
    } catch {
      toast.error(t('loadFailed'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canView || !accountId) return;
    // Refetch on account switch or window change.
    const key = `${accountId}:${days}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;
    void fetchUsage(days);
  }, [canView, accountId, days, fetchUsage]);

  if (profileLoading || !canView) return null;

  // The category label doubles as the data key so the chart tooltip
  // shows the translated series name.
  const tokensLabel = t('tokens');
  const chartData =
    data?.daily.map((d) => ({
      day: format(parseISO(d.date), 'MMM d'),
      [tokensLabel]: d.tokens,
    })) ?? [];
  const hasSpend = (data?.totals.total_tokens ?? 0) > 0;

  return (
    <Panel>
      <PanelHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger size="sm" className="w-32 flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {t('window', { days: w })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <div className="space-y-5 p-4">
        {loading || !data ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasSpend ? (
          <EmptyState
            size="sm"
            icon={BarChart3}
            title={t('empty', { days: data.window_days })}
            description={t('emptyHint')}
          />
        ) : (
          <>
            <StatStrip className="sm:grid-cols-4">
              <Stat label={t('totalTokens')} value={formatCompactNumber(data.totals.total_tokens)} />
              <Stat label={t('llmCalls')} value={String(data.totals.calls)} />
              <Stat label={t('autoReply')} value={formatCompactNumber(data.by_mode.auto_reply.tokens)} />
              <Stat label={t('drafts')} value={formatCompactNumber(data.by_mode.draft.tokens)} />
            </StatStrip>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('tokensPerDay')}
              </p>
              <BarChart
                data={chartData}
                index="day"
                categories={[tokensLabel]}
                colors={['primary']}
                valueFormatter={(v) => formatCompactNumber(v)}
                showLegend={false}
                yAxisWidth={48}
                className="h-[200px]"
              />
            </div>

            {data.by_model.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('byModel')}
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.by_model.map((m) => (
                    <li
                      key={`${m.provider}:${m.model}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-xs text-foreground">{m.model}</span>{' '}
                        <span className="text-xs text-muted-foreground">
                          ({m.provider})
                        </span>
                      </span>
                      <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t('modelCalls', {
                          tokens: formatCompactNumber(m.tokens),
                          count: m.calls,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.truncated && (
              <p className="text-xs text-muted-foreground">
                {t('partialWindow')}
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
