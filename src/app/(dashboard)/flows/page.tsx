"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Workflow,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  MessageSquare,
  HelpCircle,
  UserPlus,
  FileText,
  MoreHorizontal,
  History,
} from "lucide-react";

import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Page, PageBody, PageHeader } from "@/components/layout/page";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Flows list page.
 *
 * Open to every authenticated user. Flows is in soft-GA — the "Beta"
 * chip in the header is the only remaining signal that the surface
 * is new. The previous per-account beta gate was removed in PR #134.
 */

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: { keywords?: string[] } | Record<string, unknown>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS = (t: ReturnType<typeof useTranslations>): Record<FlowRow["status"], string> => ({
  draft: t("statusDraft"),
  active: t("statusActive"),
  archived: t("statusArchived"),
});

const STATUS_VARIANT: Record<FlowRow["status"], "success" | "secondary" | "outline"> = {
  draft: "secondary",
  active: "success",
  archived: "outline",
};

interface TemplateSummary {
  slug: string;
  name: string;
  description: string;
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: string;
  node_count: number;
}

const TEMPLATE_ICONS = {
  MessageSquare,
  HelpCircle,
  UserPlus,
} as const;

// `useSearchParams` (the `?new=1` deep link) needs a Suspense boundary.
export default function FlowsPage() {
  return (
    <Suspense fallback={null}>
      <FlowsPageInner />
    </Suspense>
  );
}

function FlowsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useCan("send-messages");
  const t = useTranslations("Flows.list");
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [pendingDelete, setPendingDelete] = useState<FlowRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // `?new=1` (command menu) opens the create dialog, then drops the param.
  const wantsNew = searchParams.get("new") === "1";
  useEffect(() => {
    if (!wantsNew) return;
    // One-shot URL intent; the param is consumed right below.
    if (canCreate) setCreateOpen(true);
    router.replace("/flows", { scroll: false });
  }, [wantsNew, canCreate, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [flowsRes, tmplRes] = await Promise.all([
          fetch("/api/flows"),
          fetch("/api/flows/templates"),
        ]);
        if (!flowsRes.ok) {
          throw new Error(`Failed to load flows: ${flowsRes.status}`);
        }
        const flowsJson = (await flowsRes.json()) as { flows: FlowRow[] };
        if (!cancelled) setFlows(flowsJson.flows ?? []);
        // Templates endpoint is forward-looking — if it 404s on an
        // older deployment, gracefully fall through.
        if (tmplRes.ok) {
          const tmplJson = (await tmplRes.json()) as {
            templates: TemplateSummary[];
          };
          if (!cancelled) setTemplates(tmplJson.templates ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error(t("loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          trigger_type: "keyword",
          trigger_config: { keywords: [] },
        }),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const json = (await res.json()) as { flow: FlowRow };
      setCreateOpen(false);
      setNewName("");
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t("createError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleUseTemplate(slug: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_slug: slug }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Clone failed: ${res.status}`);
      }
      const json = (await res.json()) as { flow: FlowRow };
      setCreateOpen(false);
      router.push(`/flows/${json.flow.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("cloneError");
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(flow: FlowRow) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/flows/${flow.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      toast.success(t("deleteSuccess"));
      setPendingDelete(null);
    } catch (err) {
      console.error(err);
      toast.error(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("title")}
        badge={<Badge variant="outline">{t("beta")}</Badge>}
        description={flows.length > 0 ? t("countLabel", { count: flows.length }) : t("description")}
        actions={
          <GatedButton
            canAct={canCreate}
            gateReason="create flows"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            {t("newFlow")}
          </GatedButton>
        }
      />

      <PageBody>
        {loading ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <SkeletonRows rows={5} />
          </div>
        ) : flows.length === 0 ? (
          <FlowsEmpty
            onCreate={() => setCreateOpen(true)}
            canCreate={canCreate}
            t={t}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden h-9 items-center gap-4 border-b border-border bg-card-2 px-4 text-xs font-medium text-muted-foreground md:flex">
              <span className="flex-1">{t("colFlow")}</span>
              <span className="w-24">{t("colStatus")}</span>
              <span className="w-16 text-right">{t("colRuns")}</span>
              <span className="w-28">{t("colUpdated")}</span>
              <span className="w-7" />
            </div>
            <ul className="divide-y divide-border">
              {flows.map((flow) => (
                <FlowListRow
                  key={flow.id}
                  flow={flow}
                  onEdit={() => router.push(`/flows/${flow.id}`)}
                  onRuns={() => router.push(`/flows/${flow.id}/runs`)}
                  onDelete={() => setPendingDelete(flow)}
                  t={t}
                />
              ))}
            </ul>
          </div>
        )}
      </PageBody>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm", { name: pendingDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>
              {t("createDesc")}
            </DialogDescription>
          </DialogHeader>

          {templates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("startTemplate")}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.icon] ?? FileText;
                  return (
                    <button
                      key={template.slug}
                      type="button"
                      onClick={() => handleUseTemplate(template.slug)}
                      disabled={creating}
                      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-border-strong hover:bg-card-2 disabled:opacity-50"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card-2 text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-[13px] font-medium text-foreground">
                        {template.name}
                      </span>
                      <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {template.description}
                      </span>
                      <span className="mt-auto pt-1 text-[11px] text-subtle-foreground">
                        {t("nodeCount", { count: template.node_count })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("startBlank")}
            </p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("placeholderName")}
              aria-label={t("placeholderName")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating && <Loader2 className="animate-spin" />}
              {t("createBlank")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function FlowsEmpty({
  onCreate,
  canCreate,
  t,
}: {
  onCreate: () => void;
  canCreate: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <EmptyState
        icon={Workflow}
        title={t("emptyTitle")}
        description={t("emptyDesc")}
        action={
          <GatedButton
            canAct={canCreate}
            gateReason="create flows"
            onClick={onCreate}
            size="sm"
          >
            <Plus />
            {t("createFirst")}
          </GatedButton>
        }
      />
    </div>
  );
}

function FlowListRow({
  flow,
  onEdit,
  onRuns,
  onDelete,
  t,
}: {
  flow: FlowRow;
  onEdit: () => void;
  onRuns: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const triggerSummary = describeTrigger(flow, t);
  return (
    <li className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none focus-visible:underline"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card-2 text-muted-foreground">
          <Workflow className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {flow.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {flow.description || triggerSummary}
          </span>
        </span>
      </button>
      <span className="hidden w-24 md:block">
        <Badge variant={STATUS_VARIANT[flow.status]}>
          {STATUS_LABELS(t)[flow.status]}
        </Badge>
      </span>
      <span className="hidden w-16 text-right text-[13px] text-foreground tabular-nums md:block">
        {flow.execution_count.toLocaleString()}
      </span>
      <span className="hidden w-28 text-xs text-muted-foreground tabular-nums md:block">
        {new Date(flow.updated_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("openMenu")}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRuns}>
            <History />
            {t("viewRuns")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function describeTrigger(flow: FlowRow, t: ReturnType<typeof useTranslations>): string {
  if (flow.trigger_type === "keyword") {
    const keywords = Array.isArray(flow.trigger_config.keywords)
      ? (flow.trigger_config.keywords as string[])
      : [];
    if (keywords.length === 0) return t("triggerKeywordNone");
    return t("triggerKeyword", { keywords: keywords.join(", ") });
  }
  if (flow.trigger_type === "first_inbound_message") {
    return t("triggerFirstInbound");
  }
  return t("triggerManual");
}
