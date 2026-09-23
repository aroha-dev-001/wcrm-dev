"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pipeline, PipelineStage, Deal } from "@/types";
import { PipelineBoard } from "@/components/pipelines/pipeline-board";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { DealForm } from "@/components/pipelines/deal-form";
import { PipelineAnalytics } from "@/components/pipelines/pipeline-analytics";
import { DealsTable } from "@/components/pipelines/deals-table";
import { Page, PageBody, PageHeader } from "@/components/layout/page";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Plus, ChevronDown, Settings, Check, Columns3, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/hooks/use-auth";
import { GatedButton } from "@/components/ui/gated-button";
import { useTranslations } from "next-intl";

// Pipeline creation is admin-class (settings-tier write under
// the new RLS); deal creation is operational and only requires
// agent+. The two CTAs gate on different `useCan` capabilities,
// not on different copy.

// Spec-defined seed — name and color per the product spec.
const SPEC_DEFAULT_STAGES = [
  { name: "New Lead", color: "#3b82f6", position: 0 }, // blue
  { name: "Qualified", color: "#eab308", position: 1 }, // yellow
  { name: "Proposal Sent", color: "#f97316", position: 2 }, // orange
  { name: "Negotiation", color: "#8b5cf6", position: 3 }, // purple
  { name: "Won", color: "#22c55e", position: 4 }, // green
];

type View = "board" | "table";
const VIEW_STORAGE_KEY = "wacrm:pipelines:view";

// `useSearchParams` (the `?new=deal` deep link) needs a Suspense boundary.
export default function PipelinesPage() {
  return (
    <Suspense fallback={null}>
      <PipelinesPageInner />
    </Suspense>
  );
}

function PipelinesPageInner() {
  const t = useTranslations("Pipelines.page");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const canEditSettings = useCan("edit-settings");
  const canCreateDeals = useCan("send-messages");
  const { accountId } = useAuth();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog / sheet state
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Deal form state is lifted here so both the top-bar "Add Deal" and
  // the per-column "+" trigger the same Sheet.
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>("");

  // Guard against double-seeding (React StrictMode double-effect in dev).
  const seedAttempted = useRef(false);

  // Board / table view, remembered per device. Read lazily: the
  // dashboard subtree only renders client-side (the shell waits on auth),
  // so there is no server render to mismatch.
  const [view, setView] = useState<View>(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "board" || stored === "table") return stored;
    } catch {
      // localStorage can throw in private-browsing / sandboxed contexts.
    }
    return "board";
  });
  const changeView = useCallback((next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort.
    }
  }, []);

  const loadPipelines = useCallback(async () => {
    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at");
    if (error) {
      console.error("Failed to load pipelines:", error.message);
      return [];
    }
    return data ?? [];
  }, [supabase]);

  const loadStages = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position");
      return data ?? [];
    },
    [supabase],
  );

  const loadDeals = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("deals")
        .select("*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(*)")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Deal[];
    },
    [supabase],
  );

  const seedDefaultPipeline = useCallback(async (): Promise<Pipeline | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) return null;

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name: "Sales Pipeline" })
      .select()
      .single();

    if (error || !pipeline) {
      console.error("Failed to seed pipeline:", error?.message);
      return null;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    return pipeline as Pipeline;
  }, [supabase, accountId]);

  // Initial load + seed-if-empty
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let list = await loadPipelines();

      if (list.length === 0 && !seedAttempted.current) {
        seedAttempted.current = true;
        const seeded = await seedDefaultPipeline();
        if (seeded) list = await loadPipelines();
      }

      if (cancelled) return;
      setPipelines(list);
      if (list.length > 0) {
        setSelectedPipelineId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id,
        );
      } else {
        setSelectedPipelineId("");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPipelines, seedDefaultPipeline]);

  // Load stages + deals whenever selected pipeline changes.
  // Clearing on no-selection is a legitimate sync with URL/prop
  // state; the load completion uses async setters inside promise
  // callbacks (not synchronous in the effect body).
  useEffect(() => {
    if (!selectedPipelineId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStages([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [s, d] = await Promise.all([
        loadStages(selectedPipelineId),
        loadDeals(selectedPipelineId),
      ]);
      if (cancelled) return;
      setStages(s);
      setDeals(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPipelineId, loadStages, loadDeals]);

  const refreshPipelines = useCallback(async () => {
    const list = await loadPipelines();
    setPipelines(list);
    if (list.length === 0) setSelectedPipelineId("");
    else if (!list.some((p) => p.id === selectedPipelineId))
      setSelectedPipelineId(list[0].id);
  }, [loadPipelines, selectedPipelineId]);

  const refreshStages = useCallback(async () => {
    if (!selectedPipelineId) return;
    setStages(await loadStages(selectedPipelineId));
  }, [loadStages, selectedPipelineId]);

  const refreshDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    setDeals(await loadDeals(selectedPipelineId));
  }, [loadDeals, selectedPipelineId]);

  const handleDealMoved = useCallback(
    async (dealId: string, newStageId: string) => {
      // Optimistic update — board already animated; just persist.
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)),
      );
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId);
      if (error) {
        toast.error(t("toastFailedMoveDeal"));
        refreshDeals();
      }
    },
    [supabase, refreshDeals, t],
  );

  const handleAddDeal = useCallback(
    (stageId?: string) => {
      setEditingDeal(null);
      setDefaultStageId(stageId ?? stages[0]?.id ?? "");
      setDealFormOpen(true);
    },
    [stages],
  );

  // `?new=deal` (command menu / dashboard "Create") opens the deal form
  // once stages are loaded, then drops the param.
  const wantsNewDeal = searchParams.get("new") === "deal";
  useEffect(() => {
    if (!wantsNewDeal || loading || stages.length === 0) return;
    // One-shot URL intent → open the form; the param is consumed below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canCreateDeals) handleAddDeal();
    router.replace("/pipelines", { scroll: false });
  }, [wantsNewDeal, loading, stages.length, canCreateDeals, handleAddDeal, router]);

  const handleEditDeal = useCallback((deal: Deal) => {
    setEditingDeal(deal);
    setDefaultStageId(deal.stage_id);
    setDealFormOpen(true);
  }, []);

  async function handleCreatePipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setCreating(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCreating(false);
      return;
    }
    // pipelines.account_id is NOT NULL post-017 with no DB default.
    if (!accountId) {
      toast.error(t("toastNotLinkedToAccount"));
      setCreating(false);
      return;
    }

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, account_id: accountId, name })
      .select()
      .single();

    if (error || !pipeline) {
      toast.error(t("toastFailedCreatePipeline"));
      setCreating(false);
      return;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    setNewPipelineName("");
    setNewPipelineOpen(false);
    setSelectedPipelineId(pipeline.id);
    await refreshPipelines();
    setCreating(false);
    toast.success(t("toastPipelineCreated"));
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  if (loading) {
    return (
      <Page>
        <PageHeader title={<Skeleton className="h-4 w-40" />} />
        <PageBody className="space-y-4">
          <Skeleton className="h-[74px] w-full rounded-lg" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-96 w-[280px] shrink-0 rounded-lg" />
            ))}
          </div>
        </PageBody>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("switchPipeline")}
              className="-mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-accent"
            >
              <span className="max-w-[45vw] truncate sm:max-w-sm">
                {selectedPipeline?.name ?? t("selectPipeline")}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {pipelines.length === 0 && (
                <DropdownMenuItem disabled>
                  {t("noPipelinesYet")}
                </DropdownMenuItem>
              )}
              {pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                >
                  <GitBranch />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.id === selectedPipelineId && <Check className="size-3.5 text-foreground!" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {selectedPipeline && (
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings />
                  {t("managePipelines")}
                </DropdownMenuItem>
              )}
              {canEditSettings && (
                <DropdownMenuItem onClick={() => setNewPipelineOpen(true)}>
                  <Plus />
                  {t("addPipeline")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        description={
          pipelines.length > 0 ? t("dealsCount", { count: deals.length }) : undefined
        }
        actions={
          pipelines.length > 0 ? (
            <>
              <SegmentedControl
                aria-label={t("viewLabel")}
                value={view}
                onValueChange={changeView}
                options={[
                  { value: "board", label: t("viewBoard"), icon: <Columns3 /> },
                  { value: "table", label: t("viewTable"), icon: <Rows3 /> },
                ]}
              />
              {selectedPipeline && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t("pipelineSettings")}
                  title={t("pipelineSettings")}
                >
                  <Settings />
                </Button>
              )}
              <GatedButton
                canAct={canCreateDeals}
                gateReason="create deals"
                disabled={!selectedPipelineId || stages.length === 0}
                onClick={() => handleAddDeal()}
              >
                <Plus />
                {t("addDeal")}
              </GatedButton>
            </>
          ) : null
        }
      />

      <PageBody className="flex min-h-0 flex-col gap-4">
        {pipelines.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={GitBranch}
              title={t("noPipelinesYet")}
              description={t("createToStartTracking")}
              action={
                <GatedButton
                  canAct={canEditSettings}
                  gateReason="create pipelines"
                  onClick={() => setNewPipelineOpen(true)}
                >
                  <Plus />
                  {t("createPipeline")}
                </GatedButton>
              }
            />
          </div>
        ) : (
          <>
            <PipelineAnalytics stages={stages} deals={deals} />
            {view === "board" ? (
              <PipelineBoard
                stages={stages}
                deals={deals}
                onDealMoved={handleDealMoved}
                onAddDeal={handleAddDeal}
                onEditDeal={handleEditDeal}
              />
            ) : (
              <DealsTable stages={stages} deals={deals} onEditDeal={handleEditDeal} />
            )}
          </>
        )}
      </PageBody>

      {/* New Pipeline Dialog */}
      <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("newPipeline")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-pipeline-name">{t("pipelineName")}</Label>
            <Input
              id="new-pipeline-name"
              autoFocus
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder={t("pipelineNamePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePipeline();
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t("defaultStagesDesc")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewPipelineOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreatePipeline}
              disabled={creating || !newPipelineName.trim()}
            >
              {creating ? t("creating") : t("createPipelineBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Settings */}
      {selectedPipeline && (
        <PipelineSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          pipeline={selectedPipeline}
          stages={stages}
          onPipelinesChanged={refreshPipelines}
          onStagesChanged={refreshStages}
          onCreateNewPipeline={() => {
            setSettingsOpen(false);
            setNewPipelineOpen(true);
          }}
        />
      )}

      {/* Deal Form (Sheet) */}
      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        deal={editingDeal}
        pipelineId={selectedPipelineId}
        stages={stages}
        defaultStageId={defaultStageId}
        onSaved={refreshDeals}
      />
    </Page>
  );
}
