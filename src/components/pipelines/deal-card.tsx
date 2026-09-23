"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

import { initialOf } from "@/lib/utils";
interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return initialOf(source);
}

export function DealCard({ deal, onEdit, isOverlay }: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const contactLabel = deal.contact?.name || deal.contact?.phone || t("noContact");
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-md border bg-card px-3 py-2.5 text-left transition-[border-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
        isOverlay
          ? "border-border-strong shadow-lg"
          : "border-border shadow-xs hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-[13px] leading-snug font-medium break-words text-foreground">
          {deal.title}
        </h4>
        {deal.status === "won" && (
          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] border border-success/25 bg-success/10 px-1.5 text-[10px] font-medium text-success">
            <Check className="size-3" />
            {t("won")}
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-[4px] border border-destructive/25 bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">
            <X className="size-3" />
            {t("lost")}
          </span>
        )}
      </div>

      {/* Contact row */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
          {initials(deal.contact?.name, deal.contact?.phone)}
        </span>
        <span className="truncate text-xs text-muted-foreground">{contactLabel}</span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-foreground tabular-nums">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Calendar className="size-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
        {assigneeLabel && (
          <span
            title={assigneeLabel}
            className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary"
          >
            {initials(assigneeLabel)}
          </span>
        )}
      </div>
    </button>
  );
}
