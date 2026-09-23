"use client"

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { NeedsReplyItem } from '@/lib/dashboard/types'
import { contactHandle } from '@/lib/whatsapp/wa-identity'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel, PanelFooter, PanelHeader } from '@/components/ui/panel'

import { initialOf } from '@/lib/utils'
/**
 * Open conversations with unread customer messages — the shortest path
 * from the dashboard to work that's waiting.
 */
export function NeedsReply({
  items,
  error,
}: {
  items: NeedsReplyItem[] | null
  error?: boolean
}) {
  const t = useTranslations('Dashboard.attention')

  return (
    <Panel className="h-full">
      <PanelHeader title={t('title')} description={t('description')} />
      <div className="flex-1">
        {items === null ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            size="sm"
            icon={CheckCheck}
            title={error ? t('loadError') : t('empty')}
            description={error ? undefined : t('emptyHint')}
            className="min-h-48"
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => {
              const name =
                c.contact?.name || (c.contact ? contactHandle(c.contact) : '') || t('unknown')
              return (
                <li key={c.id}>
                  <Link
                    href={`/inbox?c=${c.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <Avatar className="size-7">
                      {c.contact?.avatar_url ? (
                        <AvatarImage src={c.contact.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback>{initialOf(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {name}
                        </span>
                        {c.lastMessageAt ? (
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {formatDistanceToNowStrict(new Date(c.lastMessageAt))}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {c.lastMessageText || '—'}
                        </p>
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                          {c.unreadCount}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <PanelFooter className="justify-end">
        <Link href="/inbox" className="font-medium text-foreground hover:underline">
          {t('openInbox')}
        </Link>
      </PanelFooter>
    </Panel>
  )
}
