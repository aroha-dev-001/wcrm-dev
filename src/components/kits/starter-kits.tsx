"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CircleCheck, Loader2, Smartphone, Sprout, TriangleAlert } from "lucide-react"

import { useCan } from "@/hooks/use-can"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { KitInstallReport, KitSection, StarterKitSummary } from "@/lib/kits/types"

type KitRow = StarterKitSummary & { installed: boolean }

const SECTION_ORDER: KitSection[] = [
  "flows",
  "automations",
  "tags",
  "pipeline",
  "templates",
  "knowledge",
  "quickReplies",
]

/**
 * One-click business setups. Shown on the Flows and Automations pages:
 * a full card with an install button until the kit is in, then a
 * one-line "installed" strip that still opens the try-it guide.
 */
export function StarterKits({ onInstalled }: { onInstalled?: () => void }) {
  const t = useTranslations("Kits")
  const canInstall = useCan("edit-settings")
  const [kits, setKits] = useState<KitRow[]>([])
  const [open, setOpen] = useState<KitRow | null>(null)
  // Bumped after an install so the card flips to "installed".
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/kits")
        if (!res.ok) return
        const json = (await res.json()) as { kits: KitRow[] }
        if (!cancelled) setKits(json.kits ?? [])
      } catch {
        // The gallery is an extra — a failed load just hides it.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  if (kits.length === 0) return null

  return (
    <section className="space-y-2">
      {kits.map((kit) =>
        kit.installed ? (
          <div
            key={kit.slug}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5"
          >
            <CircleCheck className="size-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 text-[13px] text-foreground">
              {t("installedStrip", { name: kit.name })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOpen(kit)}>
              <Smartphone />
              {t("howToTry")}
            </Button>
          </div>
        ) : (
          <div
            key={kit.slug}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card-2 text-success">
              <Sprout className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("cardTitle", { name: kit.name })}
                </h2>
                <Badge variant="outline">{t("oneClick")}</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{kit.tagline}</p>
              <p className="mt-1.5 text-xs text-subtle-foreground">{countsLine(kit, t)}</p>
            </div>
            <GatedButton
              canAct={canInstall}
              gateReason="install starter kits"
              onClick={() => setOpen(kit)}
            >
              <Sprout />
              {t("setUp")}
            </GatedButton>
          </div>
        ),
      )}

      {open && (
        <KitDialog
          kit={open}
          canInstall={canInstall}
          onClose={() => setOpen(null)}
          onInstalled={() => {
            setReloadKey((k) => k + 1)
            onInstalled?.()
          }}
        />
      )}
    </section>
  )
}

function countsLine(kit: StarterKitSummary, t: ReturnType<typeof useTranslations>): string {
  const c = kit.counts
  return [
    t("countFlows", { count: c.flows }),
    t("countAutomations", { count: c.automations }),
    t("countTags", { count: c.tags }),
    t("countStages", { count: c.stages }),
    t("countTemplates", { count: c.templates }),
    t("countKnowledge", { count: c.knowledge }),
    t("countQuickReplies", { count: c.quickReplies }),
  ].join(" · ")
}

function KitDialog({
  kit,
  canInstall,
  onClose,
  onInstalled,
}: {
  kit: KitRow
  canInstall: boolean
  onClose: () => void
  onInstalled: () => void
}) {
  const t = useTranslations("Kits")
  const [installing, setInstalling] = useState(false)
  const [report, setReport] = useState<KitInstallReport | null>(null)

  async function install() {
    setInstalling(true)
    try {
      const res = await fetch(`/api/kits/${kit.slug}/install`, { method: "POST" })
      const json = (await res.json().catch(() => ({}))) as {
        report?: KitInstallReport
        error?: string
      }
      if (!res.ok || !json.report) throw new Error(json.error || t("installError"))
      setReport(json.report)
      onInstalled()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("installError"))
    } finally {
      setInstalling(false)
    }
  }

  const sectionLabel = (s: KitSection) =>
    ({
      flows: t("sectionFlows"),
      automations: t("sectionAutomations"),
      tags: t("sectionTags"),
      pipeline: t("sectionPipeline"),
      templates: t("sectionTemplates"),
      knowledge: t("sectionKnowledge"),
      quickReplies: t("sectionQuickReplies"),
    })[s]

  const skippedCount = report
    ? SECTION_ORDER.reduce((n, s) => n + report.skipped[s].length, 0)
    : 0

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {report ? t("doneTitle", { name: kit.name }) : t("dialogTitle", { name: kit.name })}
          </DialogTitle>
          <DialogDescription>{report ? t("doneDesc") : kit.description}</DialogDescription>
        </DialogHeader>

        {report ? (
          <div className="space-y-4 text-[13px]">
            <ul className="space-y-2">
              {SECTION_ORDER.filter((s) => report.created[s].length > 0).map((s) => (
                <li key={s}>
                  <p className="font-medium text-foreground">
                    <CircleCheck className="mr-1.5 inline size-3.5 text-success" />
                    {sectionLabel(s)} ({report.created[s].length})
                  </p>
                  <p className="pl-5 text-xs text-muted-foreground">
                    {report.created[s].join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
            {skippedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("skippedSummary", { count: skippedCount })}
              </p>
            )}
            {report.warnings.length > 0 && (
              <div className="space-y-1 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <p className="flex items-center gap-1.5 font-medium">
                  <TriangleAlert className="size-3.5" />
                  {t("warningsTitle")}
                </p>
                {report.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
            <TryIt kit={kit} />
          </div>
        ) : (
          <div className="space-y-4 text-[13px]">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("whatYouGet")}</p>
              <p className="text-foreground">{countsLine(kit, t)}</p>
            </div>
            <TryIt kit={kit} />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("notes")}</p>
          </div>
        )}

        <DialogFooter>
          {report ? (
            <>
              <Button variant="outline" nativeButton={false} render={<Link href="/flows" />} onClick={onClose}>
                {t("viewFlows")}
              </Button>
              <Button nativeButton={false} render={<Link href="/dashboard" />} onClick={onClose}>
                {t("openDashboard")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={installing}>
                {kit.installed ? t("close") : t("cancel")}
              </Button>
              <GatedButton
                canAct={canInstall}
                gateReason="install starter kits"
                onClick={install}
                disabled={installing}
              >
                {installing ? <Loader2 className="animate-spin" /> : <Sprout />}
                {installing ? t("installing") : kit.installed ? t("addMissing") : t("install")}
              </GatedButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TryIt({ kit }: { kit: StarterKitSummary }) {
  const t = useTranslations("Kits")
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("tryIt")}</p>
      <ol className="space-y-1.5">
        {kit.tryIt.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{step.send}</span>
              <span className="text-muted-foreground"> → {step.expect}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
