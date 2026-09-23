'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Radio, Plus } from 'lucide-react';
import { Page, PageBody, PageHeader } from '@/components/layout/page';
import { Badge, StatusDot } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { useTranslations } from 'next-intl';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-primary" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-1 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-xs text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export default function BroadcastsPage() {
  const router = useRouter();
  const t = useTranslations('Broadcasts.page');
  const tStatus = useTranslations('Broadcasts.status');
  const canCreate = useCan('send-messages');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchBroadcasts() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBroadcasts(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchBroadcasts, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchBroadcasts();
        startPolling();
      }
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  const header = (
    <PageHeader
      title={t('title')}
      description={
        broadcasts.length > 0 ? t('countLabel', { count: broadcasts.length }) : t('subtitle')
      }
      actions={
        <GatedButton
          canAct={canCreate}
          gateReason="create broadcasts"
          onClick={() => router.push('/broadcasts/new')}
        >
          <Plus />
          {t('newBroadcast')}
        </GatedButton>
      }
    />
  );

  if (loading) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <SkeletonRows rows={6} />
          </div>
        </PageBody>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="rounded-lg border border-border bg-card">
            <ErrorState
              title={t('errorLoad')}
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  {t('retry')}
                </Button>
              }
            />
          </div>
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anySending && (
        <div
          role="progressbar"
          aria-label={t('broadcastInProgress')}
          className="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-muted"
        >
          <div className="broadcast-indeterminate-bar h-0.5 bg-primary" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      {header}

      <PageBody>
        {broadcasts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={Radio}
              title={t('noBroadcastsYet')}
              description={t('createFirst')}
              action={
                <GatedButton
                  canAct={canCreate}
                  gateReason="create broadcasts"
                  onClick={() => router.push('/broadcasts/new')}
                  size="sm"
                >
                  <Plus />
                  {t('newBroadcast')}
                </GatedButton>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('table.template')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    {t('table.recipients')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">{t('table.delivery')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('table.read')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t('table.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((broadcast) => {
                  const status = getBroadcastStatus(broadcast.status);
                  return (
                    <TableRow
                      key={broadcast.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') router.push(`/broadcasts/${broadcast.id}`);
                      }}
                    >
                      <TableCell className="max-w-64 truncate font-medium text-foreground">
                        {broadcast.name}
                      </TableCell>
                      <TableCell className="hidden max-w-52 truncate font-mono text-xs text-muted-foreground md:table-cell">
                        {broadcast.template_name}
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                        {broadcast.total_recipients.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.delivered_count}
                          total={broadcast.total_recipients}
                          color="bg-success"
                        />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <RateCell
                          value={broadcast.read_count}
                          total={broadcast.total_recipients}
                          color="bg-info"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={status.classes}>
                          {status.pulse && <StatusDot className="animate-pulse" />}
                          {tStatus(status.label)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                        {new Date(broadcast.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageBody>
    </Page>
  );
}
