/**
 * Shared status badge config for broadcasts + recipients.
 *
 * Previously `statusConfig` was defined inline in both
 * /broadcasts/page.tsx and /broadcasts/[id]/page.tsx with slight
 * drift risk. One source of truth now.
 *
 * Badge shape: semantic tokens (success / warning / destructive /
 * info) at a 10% tint with a 25% border — tuned per mode in
 * globals.css so labels stay legible on light and dark surfaces.
 */

import type { BroadcastStatus, RecipientStatus } from "@/types";

export interface StatusDisplay {
  label: string;
  classes: string;
  /**
   * Set true for statuses that should pulse in the UI to convey
   * "live / in-flight" — currently only `sending`.
   */
  pulse?: boolean;
}

export const broadcastStatusConfig: Record<BroadcastStatus, StatusDisplay> = {
  draft: {
    label: "draft",
    classes: "border-border bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "scheduled",
    classes: "border-info/25 bg-info/10 text-info",
  },
  sending: {
    label: "sending",
    classes: "border-warning/30 bg-warning/10 text-warning",
    pulse: true,
  },
  sent: {
    label: "sent",
    classes: "border-success/25 bg-success/10 text-success",
  },
  failed: {
    label: "failed",
    classes: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

export const recipientStatusConfig: Record<RecipientStatus, StatusDisplay> = {
  pending: {
    label: "pending",
    classes: "border-border bg-muted text-muted-foreground",
  },
  sent: {
    label: "sent",
    classes: "border-info/25 bg-info/10 text-info",
  },
  delivered: {
    label: "delivered",
    classes: "border-success/25 bg-success/10 text-success",
  },
  read: {
    label: "read",
    classes: "border-success/25 bg-success/10 text-success",
  },
  replied: {
    label: "replied",
    classes: "border-primary/20 bg-primary-soft text-primary",
  },
  failed: {
    label: "failed",
    classes: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

/**
 * Tolerant lookup — callers often have a generic string status
 * coming from Supabase. Falls back to the "draft" / "pending"
 * entry so the UI never crashes on an unknown value.
 */
export function getBroadcastStatus(status: string): StatusDisplay {
  return (
    broadcastStatusConfig[status as BroadcastStatus] ??
    broadcastStatusConfig.draft
  );
}

export function getRecipientStatus(status: string): StatusDisplay {
  return (
    recipientStatusConfig[status as RecipientStatus] ??
    recipientStatusConfig.pending
  );
}
