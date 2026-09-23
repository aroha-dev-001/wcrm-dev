"use client";

/**
 * Editor toolbar — flow name / description, status chip, dirty
 * indicator, and the action buttons (Save, Activate/Pause, Delete,
 * View runs, Back).
 *
 * Restyled to the Flow Builder design handoff: a single compact
 * toolbar row (back · icon · inline-editable name · status chip ·
 * edited dot on the left; Runs · Delete · Activate · Save on the
 * right) followed by a subtle, full-width description "note" line.
 * Replaces the old three-row stack so the editor reads as one app
 * chrome bar above the canvas/list stage.
 *
 * Lifted out of flow-builder.tsx so the same toolbar renders above
 * both views in FlowEditorShell. Without this, canvas users had no
 * way to save without toggling to list view.
 *
 * Reads everything from the editor context (`useFlowEditor`) so it
 * stays in sync with whichever view is mutating state, and routes
 * router navigation locally (back to /flows, View runs to
 * /flows/[id]/runs) — those don't belong in the hook.
 */

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CircleDot,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useFlowEditor,
  type BuilderState,
} from "./flow-editor-state";

export function EditorHeader() {
  const router = useRouter();
  const t = useTranslations("Flows.header");
  const {
    flow,
    state,
    setState,
    dirty,
    saving,
    activating,
    canActivate,
    save,
    setStatus,
    deleteFlow,
  } = useFlowEditor();

  return (
    <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* ---- left: back · name · status · edited ---- */}
        <button
          type="button"
          onClick={() => router.push("/flows")}
          title={t("backToFlows")}
          aria-label={t("backToFlows")}
          className="-ml-1.5 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              spellCheck={false}
              aria-label={t("namePlaceholder")}
              className="h-7 min-w-[120px] max-w-[340px] rounded-md border border-transparent bg-transparent px-1.5 text-[15px] font-semibold text-foreground outline-none transition-colors hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15"
            />
            <StatusChip status={state.status} />
            {dirty && (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-warning"
                title={t("unsavedHint")}
                aria-live="polite"
              >
                <span className="size-1.5 rounded-full bg-warning" />
                {t("edited")}
              </span>
            )}
          </div>
          {/* ---- description note (subtle, inline-editable) ---- */}
          <input
            value={state.description}
            onChange={(e) =>
              setState((s) => ({ ...s, description: e.target.value }))
            }
            placeholder={t("descriptionPlaceholder")}
            aria-label={t("descriptionLabel")}
            className="h-6 w-full max-w-[78ch] rounded-md border border-transparent bg-transparent px-1.5 text-[13px] text-muted-foreground outline-none transition-colors placeholder:text-subtle-foreground hover:border-input focus-visible:border-ring focus-visible:text-foreground"
          />
        </div>

        {/* ---- right: runs · delete · activate · save ---- */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/flows/${flow.id}/runs`)}
          >
            <History />
            {t("runs")}
            <span className="ml-0.5 text-xs text-muted-foreground tabular-nums">
              {flow.execution_count}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void deleteFlow()}
            className="text-destructive hover:bg-destructive/8 hover:text-destructive"
          >
            <Trash2 />
            {t("delete")}
          </Button>
          {state.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setStatus("draft")}
              disabled={activating}
            >
              {activating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PauseCircle />
              )}
              {t("pause")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void setStatus("active")}
              disabled={activating || !canActivate}
              title={
                !canActivate ? t("fixIssues") : undefined
              }
            >
              {activating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PlayCircle />
              )}
              {t("activate")}
            </Button>
          )}
          <Button onClick={() => void save()} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: BuilderState["status"] }) {
  // Status labels live with the flows list so the chip and the list
  // badge can never drift apart.
  const t = useTranslations("Flows.list");
  const cfg = {
    draft: {
      // Neutral, not amber — amber is reserved for the adjacent
      // "Edited" dirty signal, so the two don't read as the same alert.
      cls: "border-border bg-muted text-muted-foreground",
      label: t("statusDraft"),
    },
    active: {
      cls: "border-success/30 bg-success/10 text-success",
      label: t("statusActive"),
    },
    archived: {
      cls: "border-border bg-muted/50 text-muted-foreground",
      label: t("statusArchived"),
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] border px-1.5 text-[11px] font-medium",
        cfg.cls,
      )}
    >
      <CircleDot className="size-3" />
      {cfg.label}
    </span>
  );
}
