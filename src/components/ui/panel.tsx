import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A bordered content region with an optional titled header. The
 * workhorse container for dashboards, detail views and settings —
 * flatter and denser than a Card (no inner padding on the body, so
 * lists and tables sit edge-to-edge).
 */
function Panel({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

function PanelHeader({
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
    <header
      data-slot="panel-header"
      className={cn(
        "flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

function PanelBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div data-slot="panel-body" className={cn("min-h-0 flex-1 p-4", className)}>
      {children}
    </div>
  )
}

function PanelFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <footer
      data-slot="panel-footer"
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card-2 px-4 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </footer>
  )
}

export { Panel, PanelHeader, PanelBody, PanelFooter }
