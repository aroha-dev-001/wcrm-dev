"use client"

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { Tags } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { CustomerInterest as CustomerInterestData } from '@/lib/dashboard/types'
import { contactHandle } from '@/lib/whatsapp/wa-identity'
import { initialOf } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel, PanelHeader } from '@/components/ui/panel'

/**
 * Who reached out and what they're interested in — built from the tags
 * flows and automations add ("Interested: Bio Astra", "Wants quote").
 * Left: the most common tags this month. Right: the latest contacts,
 * each linking straight to their conversation.
 */
export function CustomerInterest({
  data,
  error,
}: {
  data: CustomerInterestData | null
  error?: boolean
}) {
  const t = useTranslations('Dashboard.interest')

  if (data === null) {
    return (
      <Panel>
        <PanelHeader title={t('title')} description={t('description')} />
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </div>
      </Panel>
    )
  }

  if (data.topTags.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t('title')} description={t('description')} />
        <EmptyState
          size="sm"
          icon={Tags}
          title={error ? t('loadError') : t('empty')}
          description={error ? undefined : t('emptyHint')}
        />
      </Panel>
    )
  }

  const max = data.topTags[0]?.count ?? 1

  return (
    <Panel>
      <PanelHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link
            href="/contacts"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('viewContacts')}
          </Link>
        }
      />
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">{t('topInterests')}</p>
          <ul className="space-y-2.5">
            {data.topTags.map((tag) => (
              <li key={tag.id} className="text-[13px]">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{tag.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t('contactCount', { count: tag.count })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(6, (tag.count / max) * 100)}%`,
                      backgroundColor: tag.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground">
            {t('latestLeads')}
          </p>
          <ul className="divide-y divide-border">
            {data.leads.map((lead) => {
              const name =
                lead.contact?.name ||
                (lead.contact ? contactHandle(lead.contact) : '') ||
                t('unknown')
              return (
                <li key={lead.contactId}>
                  <Link
                    href={lead.conversationId ? `/inbox?c=${lead.conversationId}` : '/contacts'}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <Avatar className="mt-0.5 size-7">
                      {lead.contact?.avatar_url ? (
                        <AvatarImage src={lead.contact.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback>{initialOf(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {name}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {formatDistanceToNowStrict(new Date(lead.lastAt))}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lead.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card-2 px-1.5 py-px text-[11px] text-foreground"
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Panel>
  )
}
