"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ScrollText,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { createClient } from "@/lib/supabase/client"
import type {
  Automation,
  AutomationLog,
  AutomationLogStepResult,
} from "@/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/automations/trigger-meta"
import { Page, PageBody, PageHeader } from "@/components/layout/page"
import { Badge } from "@/components/ui/badge"
import { EmptyState, ErrorState } from "@/components/ui/empty-state"
import { SkeletonRows } from "@/components/ui/skeleton"

export default function AutomationLogsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations("Automations.logs")
  const tRelative = useTranslations("Automations.relative")

  const [automation, setAutomation] = useState<Automation | null>(null)
  const [logs, setLogs] = useState<AutomationLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openLogId, setOpenLogId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [autRes, logRes] = await Promise.all([
          supabase
            .from("automations")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("automation_logs")
            .select("*, contact:contacts(id, name, phone)")
            .eq("automation_id", id)
            .order("created_at", { ascending: false })
            .limit(100),
        ])
        if (autRes.error) throw autRes.error
        if (logRes.error) throw logRes.error
        setAutomation(autRes.data as Automation | null)
        setLogs((logRes.data ?? []) as AutomationLog[])
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loadError"))
      }
    }
    load()
  }, [id])

  if (error) {
    return (
      <Page>
        <PageHeader title={t("title")} back="/automations" backLabel={t("backAria")} />
        <PageBody>
          <div className="rounded-lg border border-border bg-card">
            <ErrorState
              title={t("loadError")}
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={() => router.push("/automations")}>
                  {t("back")}
                </Button>
              }
            />
          </div>
        </PageBody>
      </Page>
    )
  }

  if (!automation || logs === null) {
    return (
      <Page>
        <PageHeader title={t("title")} back="/automations" backLabel={t("backAria")} />
        <PageBody>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <SkeletonRows rows={6} />
          </div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        back="/automations"
        backLabel={t("backAria")}
        title={automation.name}
        description={t("title")}
        actions={
          <Button variant="outline" onClick={() => router.push(`/automations/${automation.id}/edit`)}>
            {t("editAutomation")}
          </Button>
        }
      />
      <PageBody>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icon={ScrollText} title={t("emptyTitle")} description={t("emptyDesc")} />
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {logs.map((log) => {
              const isOpen = openLogId === log.id
              const stepCount = log.steps_executed?.length ?? 0
              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => setOpenLogId(isOpen ? null : log.id)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <StatusBadge status={log.status} t={t} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-foreground">
                        {log.contact?.name ?? log.contact?.phone ?? t("unknownContact")}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{log.trigger_event}</span> ·{" "}
                        {stepCount === 1 ? t("step", { count: 1 }) : t("stepPlural", { count: stepCount })}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatRelative(log.created_at, tRelative)}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-card-2 px-4 py-3 pl-11">
                      {log.error_message && (
                        <p className="mb-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                          {log.error_message}
                        </p>
                      )}
                      <ul className="space-y-1.5">
                        {(log.steps_executed ?? []).map((r, i) => (
                          <StepRow key={i} result={r} />
                        ))}
                        {(log.steps_executed ?? []).length === 0 && (
                          <li className="text-xs text-muted-foreground">{t("noSteps")}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PageBody>
    </Page>
  )
}

function StatusBadge({ status, t }: { status: AutomationLog["status"], t: ReturnType<typeof useTranslations> }) {
  const variant =
    status === "success" ? "success" : status === "partial" ? "warning" : "destructive"
  return <Badge variant={variant}>{t(`status.${status}`)}</Badge>
}

function StepRow({ result }: { result: AutomationLogStepResult }) {
  const ok = result.status === "success"
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded-full",
          ok ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
        )}
        aria-hidden
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="font-mono text-foreground">{result.step_type}</span>
      {result.detail && (
        <span className="truncate text-muted-foreground">— {result.detail}</span>
      )}
    </li>
  )
}
