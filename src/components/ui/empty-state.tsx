import type { ComponentType, ReactNode } from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one empty state used across the app: a small neutral glyph, a
 * short title, an optional one-line explanation and an optional action.
 * Deliberately compact — an empty list shouldn't turn into a poster.
 *
 *  - `size="default"` — whole-page / whole-table empties.
 *  - `size="sm"`      — inside panels, sidebars and cards.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  size?: "default" | "sm"
  className?: string
}) {
  const sm = size === "sm"
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sm ? "gap-1.5 px-4 py-8" : "gap-2 px-6 py-14",
        className
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mb-1 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs",
            sm ? "size-8" : "size-10"
          )}
        >
          <Icon className={sm ? "size-4" : "size-[18px]"} />
        </div>
      ) : null}
      <p className={cn("font-medium text-foreground", sm ? "text-[13px]" : "text-sm")}>
        {title}
      </p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

/** Error variant — same geometry, danger glyph, and usually a Retry action. */
function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-1 flex size-10 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/8 text-destructive">
        <AlertCircle className="size-[18px]" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md font-mono text-xs break-words text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2 flex gap-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState, ErrorState }
