'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast, BroadcastRecipient, RecipientStatus } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2,
  Download,
  ChevronDown,
  Trash2,
  PlayCircle,
  RotateCcw,
  Check,
  Users,
} from 'lucide-react';
import { Page, PageBody, PageHeader } from '@/components/layout/page';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Stat, StatStrip } from '@/components/ui/stat-strip';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingState } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  getBroadcastStatus,
  getRecipientStatus,
} from '@/lib/broadcast-status';
import { useTranslations } from 'next-intl';

interface FunnelStep {
  label: string;
  value: number;
}

/**
 * Delivery funnel as a ranked bar list. Widths are relative to Sent so
 * each stage reads as a share of what actually went out.
 */
function Funnel({ steps, title, hint }: { steps: FunnelStep[]; title: string; hint: string }) {
  const base = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <Panel>
      <PanelHeader title={title} description={hint} />
      <div className="space-y-3 px-4 py-4">
        {steps.map((step) => {
          const pct = Math.round((step.value / base) * 100);
          return (
            <div key={step.label} className="grid grid-cols-[88px_1fr_88px] items-center gap-3 text-[13px]">
              <span className="text-muted-foreground">{step.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-chart-1 transition-[width] duration-500"
                  style={{ width: `${Math.max(step.value > 0 ? 2 : 0, pct)}%` }}
                />
              </div>
              <span className="text-right text-foreground tabular-nums">
                {step.value.toLocaleString()}
                <span className="ml-1.5 text-xs text-muted-foreground">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const RECIPIENT_STATUSES: readonly RecipientStatus[] = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
  'failed',
];

/**
 * CSV export helper — RFC 4180 quoting. Quote every field so
 * commas/newlines/quotes round-trip cleanly.
 */
function toCsv(rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('Broadcasts.detail');
  const tStatus = useTranslations('Broadcasts.status');
  const broadcastId = params.id as string;

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'all'>(
    'all',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resumingScope, setResumingScope] = useState<
    'pending' | 'failed' | null
  >(null);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      const { data: bc, error: bcError } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('id', broadcastId)
        .single();

      if (bcError) throw bcError;
      setBroadcast(bc);

      const { data: recs, error: recsError } = await supabase
        .from('broadcast_recipients')
        .select('*, contact:contacts(*)')
        .eq('broadcast_id', broadcastId)
        .order('created_at', { ascending: false });

      if (recsError) throw recsError;
      setRecipients(recs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notFound'));
    } finally {
      setLoading(false);
    }
  }, [broadcastId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecipients = useMemo(
    () =>
      statusFilter === 'all'
        ? recipients
        : recipients.filter((r) => r.status === statusFilter),
    [recipients, statusFilter],
  );

  function handleExport() {
    if (!broadcast) return;
    const header = [
      t('table.contact'),
      t('table.phone'),
      t('table.status'),
      t('table.sent'),
      t('table.delivered'),
      t('table.read'),
      t('table.error'),
    ];
    const rows = recipients.map((r) => [
      r.contact?.name ?? '',
      r.contact?.phone ?? '',
      r.status,
      r.sent_at ?? '',
      r.delivered_at ?? '',
      r.read_at ?? '',
      r.error_message ?? '',
    ]);
    const csv = toCsv([header, ...rows]);
    const safeName = broadcast.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    downloadBlob(`broadcast-${safeName}-${broadcastId.slice(0, 8)}.csv`, csv);
  }

  /**
   * Hand the leftovers to the server (issue #472).
   *
   * The wizard's send loop lives in the tab that started the campaign,
   * so navigating away strands the rest as 'pending' with the broadcast
   * stuck 'sending'. This is the recovery, and the same call retries
   * failed recipients.
   */
  async function handleResume(scope: 'pending' | 'failed') {
    setResumingScope(scope);
    try {
      const res = await fetch(`/api/whatsapp/broadcast/${broadcastId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(
          t('toastResumeFailed', {
            error: payload?.error || `HTTP ${res.status}`,
          }),
        );
        return;
      }

      toast.success(
        payload.remaining > 0
          ? t('toastResumeStartedCapped', {
              count: payload.resuming,
              remaining: payload.remaining,
            })
          : t('toastResumeStarted', { count: payload.resuming }),
      );
      // Delivery runs server-side after the 202, so the counts here are
      // a snapshot — reload to pick up the first of it.
      await fetchData();
    } catch (err) {
      toast.error(
        t('toastResumeFailed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        }),
      );
    } finally {
      setResumingScope(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // broadcast_recipients cascades on broadcasts.id (migration 001), so a
    // single delete is sufficient — the aggregate trigger in migration 003
    // is defined on broadcast_recipients but fires only on its own row
    // changes, not on a cascaded drop of the parent row.
    const { error: delErr } = await supabase
      .from('broadcasts')
      .delete()
      .eq('id', broadcastId);
    setDeleting(false);
    if (delErr) {
      toast.error(t('toastFailedDelete', { error: delErr.message }));
      return;
    }
    toast.success(t('toastDeleted'));
    router.push('/broadcasts');
  }

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingState />
        </PageBody>
      </Page>
    );
  }

  if (error || !broadcast) {
    return (
      <Page>
        <PageHeader title={t('notFound')} back="/broadcasts" backLabel={t('backToBroadcasts')} />
        <PageBody>
          <div className="rounded-lg border border-border bg-card">
            <ErrorState
              title={t('notFound')}
              description={error ?? undefined}
              action={
                <Button variant="outline" size="sm" onClick={() => router.push('/broadcasts')}>
                  {t('backToBroadcasts')}
                </Button>
              }
            />
          </div>
        </PageBody>
      </Page>
    );
  }

  const status = getBroadcastStatus(broadcast.status);

  const pendingCount = recipients.filter((r) => r.status === 'pending').length;
  const retryableCount = recipients.filter((r) => r.status === 'failed').length;
  // A campaign whose tab went away sits in 'sending' with recipients
  // still pending and nothing left to move them. Name that state rather
  // than leaving a permanently pulsing "sending" badge.
  const isStalled = broadcast.status === 'sending' && pendingCount > 0;

  const funnelSteps: FunnelStep[] = [
    { label: t('stats.sent'), value: broadcast.sent_count },
    { label: t('stats.delivered'), value: broadcast.delivered_count },
    { label: t('stats.read'), value: broadcast.read_count },
    { label: t('stats.replied'), value: broadcast.replied_count },
  ];

  const total = broadcast.total_recipients;
  const pctOf = (n: number) =>
    t('ofRecipients', { pct: total > 0 ? Math.round((n / total) * 100) : 0 });

  return (
    <Page>
      <PageHeader
        back="/broadcasts"
        backLabel={t('backToBroadcasts')}
        title={broadcast.name}
        badge={
          <Badge className={status.classes}>
            {status.pulse && !isStalled && <StatusDot className="animate-pulse" />}
            {tStatus(status.label)}
          </Badge>
        }
        description={
          <>
            {t('template', { name: broadcast.template_name })}
            <span className="mx-1.5 text-border-strong">·</span>
            {t('createdAt', { date: new Date(broadcast.created_at).toLocaleDateString() })}
          </>
        }
        actions={
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-foreground">{t('deletePrompt')}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t('deleting') : t('confirm')}
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={recipients.length === 0}
              >
                <Download />
                {t('exportCsv')}
              </Button>
              {/* Delete — inline confirm. Mid-send broadcasts can't be
                  deleted: orphaning in-flight Meta messages would leave
                  the funnel inconsistent. */}
              <Button
                variant="destructive-outline"
                disabled={broadcast.status === 'sending'}
                onClick={() => setConfirmDelete(true)}
                title={
                  broadcast.status === 'sending'
                    ? t('cannotDeleteSending')
                    : t('deleteHover')
                }
              >
                <Trash2 />
                {t('delete')}
              </Button>
            </>
          )
        }
      />

      <PageBody className="space-y-4">
        {/* Resume / retry (issue #472). Only rendered when there is
            actually something outstanding. */}
        {(pendingCount > 0 || retryableCount > 0) && (
          <Alert variant={isStalled ? 'warning' : 'default'} className="flex flex-wrap items-center justify-between gap-3 pr-3">
            <div className="min-w-0">
              <AlertTitle>
                {isStalled ? t('resumeStalledTitle') : t('resumeTitle')}
              </AlertTitle>
              <AlertDescription>
                {isStalled
                  ? t('resumeStalledHint', { count: pendingCount })
                  : t('resumeHint', { count: retryableCount })}
              </AlertDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleResume('pending')}
                  disabled={resumingScope !== null}
                >
                  {resumingScope === 'pending' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <PlayCircle />
                  )}
                  {t('resumePending', { count: pendingCount })}
                </Button>
              )}
              {retryableCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResume('failed')}
                  disabled={resumingScope !== null}
                >
                  {resumingScope === 'failed' ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RotateCcw />
                  )}
                  {t('retryFailed', { count: retryableCount })}
                </Button>
              )}
            </div>
          </Alert>
        )}

        <StatStrip className="sm:grid-cols-3 xl:grid-cols-6">
          <Stat label={t('stats.totalRecipients')} value={total.toLocaleString()} />
          <Stat label={t('stats.sent')} value={broadcast.sent_count.toLocaleString()} hint={pctOf(broadcast.sent_count)} />
          <Stat label={t('stats.delivered')} value={broadcast.delivered_count.toLocaleString()} hint={pctOf(broadcast.delivered_count)} />
          <Stat label={t('stats.read')} value={broadcast.read_count.toLocaleString()} hint={pctOf(broadcast.read_count)} />
          <Stat label={t('stats.replied')} value={broadcast.replied_count.toLocaleString()} hint={pctOf(broadcast.replied_count)} />
          <Stat
            label={t('stats.failed')}
            value={
              <span className={broadcast.failed_count > 0 ? 'text-destructive' : undefined}>
                {broadcast.failed_count.toLocaleString()}
              </span>
            }
            hint={pctOf(broadcast.failed_count)}
          />
        </StatStrip>

        <Funnel steps={funnelSteps} title={t('funnel')} hint={t('funnelHint')} />

        {/* Recipients */}
        <Panel>
          <PanelHeader
            title={
              statusFilter !== 'all'
                ? t('recipientsHeader', { filtered: filteredRecipients.length, total: recipients.length })
                : t('recipientsHeaderAll', { total: recipients.length })
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  {statusFilter === 'all'
                    ? t('allStatuses')
                    : tStatus(getRecipientStatus(statusFilter).label)}
                  <ChevronDown className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                    <span className="flex-1">{t('allStatuses')}</span>
                    {statusFilter === 'all' && <Check className="size-3.5 text-foreground!" />}
                  </DropdownMenuItem>
                  {RECIPIENT_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                      <span className="flex-1">{tStatus(getRecipientStatus(s).label)}</span>
                      {statusFilter === s && <Check className="size-3.5 text-foreground!" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          {filteredRecipients.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Users}
              title={recipients.length === 0 ? t('noRecipients') : t('noRecipientsFilter')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.contact')}</TableHead>
                  <TableHead>{t('table.phone')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('table.sent')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('table.delivered')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('table.read')}</TableHead>
                  <TableHead>{t('table.error')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipients.map((recipient) => {
                  const rStatus = getRecipientStatus(recipient.status);
                  const fmt = (v?: string | null) =>
                    v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
                  return (
                    <TableRow key={recipient.id}>
                      <TableCell className="max-w-52 truncate font-medium text-foreground">
                        {recipient.contact?.name ?? t('unknownContact')}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {recipient.contact?.phone ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={rStatus.classes}>{tStatus(rStatus.label)}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground tabular-nums md:table-cell">
                        {fmt(recipient.sent_at)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground tabular-nums lg:table-cell">
                        {fmt(recipient.delivered_at)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground tabular-nums lg:table-cell">
                        {fmt(recipient.read_at)}
                      </TableCell>
                      <TableCell
                        className="max-w-xs truncate text-xs text-destructive"
                        title={recipient.error_message ?? undefined}
                      >
                        {recipient.error_message ?? <span className="text-subtle-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </PageBody>
    </Page>
  );
}
