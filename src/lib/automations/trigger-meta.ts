import type { AutomationTriggerType } from '@/types'

export interface TriggerMeta {
  /** Tailwind classes for the Badge pill on the list row. Neutral for
   *  every trigger — the label carries the meaning, so the list stays
   *  calm instead of a rainbow of pills. */
  pillClass: string
}

/**
 * The user-visible trigger name lives in the message catalogue
 * (`Automations.builder.triggers.<id>.label`); this module only carries
 * the styling so it stays free of React and of locale.
 */
export const TRIGGER_META: Record<AutomationTriggerType, TriggerMeta> = {
  new_message_received: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  first_inbound_message: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  keyword_match: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  new_contact_created: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  conversation_assigned: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  tag_added: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  time_based: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
  interactive_reply: {
    pillClass: 'border-border bg-card text-muted-foreground',
  },
}

export function isKnownTrigger(t: string): t is AutomationTriggerType {
  return Object.prototype.hasOwnProperty.call(TRIGGER_META, t)
}

export function triggerMeta(t: AutomationTriggerType | string): TriggerMeta {
  return (
    TRIGGER_META[t as AutomationTriggerType] ?? {
      pillClass: 'border-border bg-card text-muted-foreground',
    }
  )
}

export type RelativeTimeKey = 'never' | 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo'

/**
 * Translator for the `Automations.relative` namespace. Typed loosely so
 * next-intl's `useTranslations("Automations.relative")` result can be
 * passed straight in without this module importing React or next-intl.
 */
export type RelativeTimeTranslator = (key: RelativeTimeKey, values?: { n: number }) => string

export function formatRelative(
  iso: string | null | undefined,
  t: RelativeTimeTranslator,
): string {
  if (!iso) return t('never')
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return t('never')
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return t('justNow')
  if (diffSec < 3600) return t('minutesAgo', { n: Math.floor(diffSec / 60) })
  if (diffSec < 86400) return t('hoursAgo', { n: Math.floor(diffSec / 3600) })
  if (diffSec < 2_592_000) return t('daysAgo', { n: Math.floor(diffSec / 86400) })
  return new Date(iso).toLocaleDateString()
}
