"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Briefcase } from "lucide-react";

import type { Deal, PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DealsTableProps {
  stages: PipelineStage[];
  deals: Deal[];
  onEditDeal: (deal: Deal) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Dense, scannable list of every deal in the pipeline — the table
 * counterpart to the board. Sorted by stage order, then newest first,
 * so it reads top-to-bottom the way the board reads left-to-right.
 */
export function DealsTable({ stages, deals, onEditDeal }: DealsTableProps) {
  const t = useTranslations("Pipelines.table");
  const tCard = useTranslations("Pipelines.card");

  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const rows = useMemo(() => {
    return [...deals].sort((a, b) => {
      const pa = stageById.get(a.stage_id)?.position ?? Number.MAX_SAFE_INTEGER;
      const pb = stageById.get(b.stage_id)?.position ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [deals, stageById]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState icon={Briefcase} title={t("empty")} description={t("emptyHint")} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("deal")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("contact")}</TableHead>
            <TableHead>{t("stage")}</TableHead>
            <TableHead className="text-right">{t("value")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("status")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("closeDate")}</TableHead>
            <TableHead className="hidden xl:table-cell">{t("owner")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((deal) => {
            const stage = stageById.get(deal.stage_id);
            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer"
                onClick={() => onEditDeal(deal)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEditDeal(deal);
                  }
                }}
                tabIndex={0}
              >
                <TableCell className="max-w-72">
                  <span className="block truncate font-medium text-foreground">
                    {deal.title}
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-52 truncate text-muted-foreground md:table-cell">
                  {deal.contact?.name || deal.contact?.phone || (
                    <span className="text-subtle-foreground">{tCard("noContact")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex max-w-44 items-center gap-1.5 text-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: stage?.color ?? "var(--border-strong)" }}
                      aria-hidden
                    />
                    <span className="truncate">{stage?.name ?? "—"}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium text-foreground tabular-nums">
                  {formatCurrency(deal.value, deal.currency)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {deal.status === "won" ? (
                    <Badge variant="success">{tCard("won")}</Badge>
                  ) : deal.status === "lost" ? (
                    <Badge variant="destructive">{tCard("lost")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("statusOpen")}</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                  {deal.expected_close_date ? formatDate(deal.expected_close_date) : (
                    <span className="text-subtle-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground xl:table-cell">
                  {deal.assignee?.full_name || (
                    <span className="text-subtle-foreground">{t("unassigned")}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
