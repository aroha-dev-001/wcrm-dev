// Shared result shapes the dashboard components consume. Centralised
// here so each component stays thin and the page-level loader wires
// them up without type gymnastics.

export interface MetricDelta {
  current: number
  previous: number
}

export interface MetricsBundle {
  activeConversations: MetricDelta
  newContactsToday: MetricDelta
  openDealsValue: number
  openDealsCount: number
  messagesSentToday: MetricDelta
}

export interface ConversationsSeriesPoint {
  day: string // YYYY-MM-DD local
  incoming: number
  outgoing: number
}

export interface PipelineStageSlice {
  id: string
  name: string
  color: string
  dealCount: number
  totalValue: number
}

export interface PipelineDonutData {
  stages: PipelineStageSlice[]
  totalValue: number
}

export interface ResponseTimeBucket {
  /** 0 = Mon … 6 = Sun (Monday-first). */
  dow: number
  /** Average first-response time in minutes. Null means no samples. */
  avgMinutes: number | null
  samples: number
}

export interface ResponseTimeSummary {
  buckets: ResponseTimeBucket[]
  thisWeekAvg: number | null
  lastWeekAvg: number | null
}

export type ActivityKind =
  | 'message'
  | 'deal'
  | 'broadcast'
  | 'automation'
  | 'contact'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** Primary line of text rendered in the feed. Pre-formatted. */
  text: string
  /** ISO timestamp the item happened at, drives relative-time + sort. */
  at: string
  /** Optional deep-link for the whole row (not all items have a target). */
  href?: string
}

/** A conversation waiting on the team: open with unread customer
 *  messages, or handed off by a flow / the AI bot (`pending`). */
export interface NeedsReplyItem {
  id: string
  status: 'open' | 'pending'
  unreadCount: number
  lastMessageText: string | null
  lastMessageAt: string | null
  contact: {
    name: string | null
    phone: string | null
    wa_username?: string | null
    wa_user_id?: string | null
    avatar_url?: string | null
    company?: string | null
  } | null
}

/** A tag and how many contacts received it in the window. */
export interface InterestTagCount {
  id: string
  name: string
  color: string
  count: number
}

/** A contact who picked up tags recently, with those tags newest-first. */
export interface InterestLead {
  contactId: string
  /** Thread to open from the dashboard; null if the contact has none. */
  conversationId: string | null
  lastAt: string
  contact: {
    name: string | null
    phone: string | null
    wa_username?: string | null
    wa_user_id?: string | null
    avatar_url?: string | null
  } | null
  tags: { id: string; name: string; color: string }[]
}

export interface CustomerInterest {
  topTags: InterestTagCount[]
  leads: InterestLead[]
}
