/**
 * Shared display config for message_templates.status.
 *
 * The DB stores Meta's raw enum (DRAFT / APPROVED / PENDING / REJECTED /
 * PAUSED / DISABLED / IN_APPEAL / PENDING_DELETION) — the UI maps it to
 * a human label + semantic badge classes here so the template manager,
 * inbox picker, and broadcast picker stay aligned.
 */

import type { MessageTemplateStatus } from '@/types';

export interface TemplateStatusDisplay {
  label: string;
  classes: string;
}

export const templateStatusConfig: Record<
  MessageTemplateStatus,
  TemplateStatusDisplay
> = {
  DRAFT: {
    label: 'Draft',
    classes: 'border-border bg-muted text-muted-foreground',
  },
  PENDING: {
    label: 'Pending',
    classes: 'border-warning/30 bg-warning/10 text-warning',
  },
  APPROVED: {
    label: 'Approved',
    classes: 'border-success/25 bg-success/10 text-success',
  },
  REJECTED: {
    label: 'Rejected',
    classes: 'border-destructive/25 bg-destructive/10 text-destructive',
  },
  PAUSED: {
    label: 'Paused',
    classes: 'border-warning/30 bg-warning/10 text-warning',
  },
  DISABLED: {
    label: 'Disabled',
    classes: 'border-destructive/25 bg-destructive/10 text-destructive',
  },
  IN_APPEAL: {
    label: 'In Appeal',
    classes: 'border-info/25 bg-info/10 text-info',
  },
  PENDING_DELETION: {
    label: 'Pending Deletion',
    classes: 'border-border bg-muted text-muted-foreground',
  },
};
