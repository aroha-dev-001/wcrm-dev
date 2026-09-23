"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Zap,
  Plus,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  FileText,
  MessageCircle,
  Clock,
  Users,
  PhoneCall,
  Loader2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useCan } from "@/hooks/use-can"
import { useTranslations } from "next-intl"
import type { Automation } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import { triggerMeta, formatRelative, isKnownTrigger } from "@/lib/automations/trigger-meta"
import { cn } from "@/lib/utils"
import { Page, PageBody, PageHeader, SectionHeading } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { EmptyState, ErrorState } from "@/components/ui/empty-state"
import { SkeletonRows } from "@/components/ui/skeleton"

const TEMPLATE_ORDER: TemplateSlug[] = [
  "welcome_message",
  "out_of_office",
  "lead_qualifier",
  "follow_up_reminder",
]

const TEMPLATE_ICON: Record<TemplateSlug, typeof Zap> = {
  welcome_message: MessageCircle,
  out_of_office: Clock,
  lead_qualifier: Users,
  follow_up_reminder: PhoneCall,
}

export default function AutomationsPage() {
  const router = useRouter()
  const canCreate = useCan("send-messages")
  const t = useTranslations("Automations.list")
  const [automations, setAutomations] = useState<Automation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false })
      if (fetchErr) throw fetchErr
      setAutomations((data ?? []) as Automation[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleActive(a: Automation, next: boolean) {
    // Optimistic flip so the switch feels instant.
    setAutomations((prev) =>
      prev?.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)) ?? prev,
    )
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Roll back on error.
      setAutomations((prev) =>
        prev?.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)) ?? prev,
      )
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.updateError"))
      return
    }
    toast.success(next ? t("toasts.activated") : t("toasts.paused"))
  }

  async function duplicate(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}/duplicate`, { method: "POST" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.duplicateError"))
      return
    }
    toast.success(t("toasts.duplicated"))
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`/api/automations/${pendingDelete.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.deleteError"))
      return
    }
    toast.success(t("toasts.deleted"))
    setPendingDelete(null)
    load()
  }

  async function startFromTemplate(slug: TemplateSlug) {
    router.push(`/automations/new?template=${slug}`)
  }

  const header = (
    <PageHeader
      title={t("title")}
      description={
        automations && automations.length > 0
          ? t("countLabel", { count: automations.length })
          : t("subtitle")
      }
      actions={
        <GatedButton
          canAct={canCreate}
          gateReason="create automations"
          onClick={() => router.push("/automations/new")}
        >
          <Plus />
          {t("create")}
        </GatedButton>
      }
    />
  )

  if (error) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="rounded-lg border border-border bg-card">
            <ErrorState
              title={t("errorTitle")}
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  {t("retry")}
                </Button>
              }
            />
          </div>
        </PageBody>
      </Page>
    )
  }

  if (automations === null) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <SkeletonRows rows={5} />
          </div>
        </PageBody>
      </Page>
    )
  }

  const showTemplates = automations.length < 3

  return (
    <Page>
      {header}
      <PageBody className="space-y-6">
        {showTemplates && (
          <section>
            <SectionHeading title={t("templatesTitle")} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATE_ORDER.map((slug) => {
                const tpl = AUTOMATION_TEMPLATES[slug]
                const Icon = TEMPLATE_ICON[slug]
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => startFromTemplate(slug)}
                    className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-left transition-colors hover:border-border-strong hover:bg-card-2 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card-2 text-muted-foreground group-hover:text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground">{tpl.name}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{tpl.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {automations.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icon={Zap} title={t("emptyTitle")} description={t("emptyDesc")} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden h-9 items-center gap-4 border-b border-border bg-card-2 px-4 text-xs font-medium text-muted-foreground md:flex">
              <span className="flex-1">{t("colName")}</span>
              <span className="w-44">{t("colTrigger")}</span>
              <span className="w-16 text-right">{t("colRuns")}</span>
              <span className="w-28">{t("colLastRun")}</span>
              <span className="w-[76px]" />
            </div>
            <ul className="divide-y divide-border">
              {automations.map((a) => (
                <AutomationRow
                  key={a.id}
                  automation={a}
                  onToggle={(next) => toggleActive(a, next)}
                  onEdit={() => router.push(`/automations/${a.id}/edit`)}
                  onDuplicate={() => duplicate(a)}
                  onLogs={() => router.push(`/automations/${a.id}/logs`)}
                  onDelete={() => setPendingDelete(a)}
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
              {t("deleteDesc", { name: pendingDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function AutomationRow({
  automation,
  onToggle,
  onEdit,
  onDuplicate,
  onLogs,
  onDelete,
  t,
}: {
  automation: Automation
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onLogs: () => void
  onDelete: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const tTriggers = useTranslations("Automations.builder.triggers")
  const tRelative = useTranslations("Automations.relative")
  const meta = triggerMeta(automation.trigger_type)
  const triggerLabel = isKnownTrigger(automation.trigger_type)
    ? tTriggers(`${automation.trigger_type}.label`)
    : automation.trigger_type
  return (
    <li className="group/row flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none focus-visible:underline"
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            automation.is_active ? "bg-success" : "bg-border-strong",
          )}
          aria-label={automation.is_active ? t("statusActive") : t("statusPaused")}
          title={automation.is_active ? t("statusActive") : t("statusPaused")}
        />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {automation.name}
          </span>
          {automation.description ? (
            <span className="block truncate text-xs text-muted-foreground">
              {automation.description}
            </span>
          ) : null}
          {/* Mobile meta line (columns are hidden below md) */}
          <span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">
            {triggerLabel} ·{" "}
            {automation.execution_count === 1
              ? t("runs", { count: automation.execution_count })
              : t("runsPlural", { count: automation.execution_count })}
          </span>
        </span>
      </button>

      <span className="hidden w-44 md:block">
        <Badge className={cn("max-w-full", meta.pillClass)}>
          <span className="truncate">{triggerLabel}</span>
        </Badge>
      </span>
      <span className="hidden w-16 text-right text-[13px] text-foreground tabular-nums md:block">
        {automation.execution_count.toLocaleString()}
      </span>
      <span className="hidden w-28 truncate text-xs text-muted-foreground md:block">
        {formatRelative(automation.last_executed_at, tRelative)}
      </span>

      <div className="flex w-[76px] shrink-0 items-center justify-end gap-2">
        <Switch
          checked={automation.is_active}
          onCheckedChange={(v) => onToggle(!!v)}
          aria-label={automation.is_active ? t("deactivate") : t("activate")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("openMenu")}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy />
              {t("duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogs}>
              <FileText />
              {t("viewLogs")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
