"use client";

import { useMemo } from "react";
import type { Deal, PipelineStage } from "@/types";
import { Stat, StatStrip } from "@/components/ui/stat-strip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[],
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const t = useTranslations("Pipelines.analytics");
  const { defaultCurrency } = useAuth();
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== "lost");
    const openDeals = active.filter((d) => d.status !== "won");

    const totalCount = active.length;
    const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const wonThisMonth = deals.filter(
      (d) => d.status === "won" && thisMonth(d),
    ).length;
    const lostThisMonth = deals.filter(
      (d) => d.status === "lost" && thisMonth(d),
    ).length;

    return {
      totalCount,
      totalValue,
      avgValue,
      weightedValue,
      wonThisMonth,
      lostThisMonth,
    };
  }, [deals, sortedStages]);

  return (
    <StatStrip className="sm:grid-cols-3 xl:grid-cols-6">
      <Stat
        label={t("totalDeals")}
        value={String(stats.totalCount)}
        info={t("totalDealsTooltip")}
      />
      <Stat
        label={t("pipelineValue")}
        value={formatCurrency(stats.totalValue, defaultCurrency)}
        info={t("pipelineValueTooltip")}
      />
      <Stat
        label={t("avgDealSize")}
        value={formatCurrency(stats.avgValue, defaultCurrency)}
        info={t("avgDealSizeTooltip")}
      />
      <Stat
        label={t("weightedValue")}
        value={formatCurrency(stats.weightedValue, defaultCurrency)}
        info={t("weightedValueTooltip")}
      />
      <Stat
        label={t("wonThisMonth")}
        value={<span className={stats.wonThisMonth > 0 ? "text-success" : undefined}>{stats.wonThisMonth}</span>}
        info={t("wonThisMonthTooltip")}
      />
      <Stat
        label={t("lostThisMonth")}
        value={<span className={stats.lostThisMonth > 0 ? "text-destructive" : undefined}>{stats.lostThisMonth}</span>}
        info={t("lostThisMonthTooltip")}
      />
    </StatStrip>
  );
}
