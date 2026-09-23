import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Page scaffolding shared by every dashboard route:
 *
 *   <Page>
 *     <PageHeader title="Contacts" description="…" actions={…} />
 *     <PageBody>…</PageBody>
 *   </Page>
 *
 * The shell's <main> has no padding of its own — pages own their
 * gutters so full-bleed surfaces (inbox, flow canvas, boards) don't
 * need negative-margin hacks.
 */
export function Page({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 flex-col", className)}>{children}</div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  back,
  backLabel,
  children,
  className,
}: {
  title: ReactNode
  /** One short line under the title. */
  description?: ReactNode
  /** Right-aligned controls (primary action last). */
  actions?: ReactNode
  /** Inline marker after the title (count, Beta, status). */
  badge?: ReactNode
  /** Parent route — renders a back affordance before the title. */
  back?: string
  backLabel?: string
  /** Optional row under the title (tabs, view switcher). */
  children?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 shrink-0 border-b border-border bg-background",
        className
      )}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {back ? (
            <Link
              href={back}
              aria-label={backLabel ?? "Back"}
              title={backLabel}
              className="-ml-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" />
            </Link>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1
                className={cn(
                  "min-w-0 text-[15px] leading-6 font-semibold text-foreground",
                  // Plain titles truncate here; custom title nodes (e.g. a
                  // switcher) manage their own overflow.
                  typeof title === "string" && "truncate",
                )}
              >
                {title}
              </h1>
              {badge}
            </div>
            {description ? (
              <p className="truncate text-[13px] leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="px-4 sm:px-6">{children}</div> : null}
    </header>
  )
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex-1 px-4 py-5 sm:px-6", className)}>{children}</div>
  )
}

/** Filter / search row that sits above a table or list. */
export function PageToolbar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  )
}

/** Small uppercase-free section heading used inside page bodies. */
export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("mb-3 flex items-end justify-between gap-3", className)}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  )
}
