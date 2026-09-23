import type { ReactNode } from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * A single bordered strip of key numbers, divided by hairlines — the
 * dense alternative to a row of separate metric cards.
 */
function StatStrip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <TooltipProvider>
      <div
        data-slot="stat-strip"
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border",
          className
        )}
      >
        {children}
      </div>
    </TooltipProvider>
  )
}

function Stat({
  label,
  value,
  hint,
  info,
  className,
}: {
  label: ReactNode
  value: ReactNode
  /** Secondary line — a delta, a count, a comparison. */
  hint?: ReactNode
  /** Explains how the number is calculated (shown in a tooltip). */
  info?: string
  className?: string
}) {
  return (
    <div className={cn("min-w-0 bg-card px-4 py-3", className)}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {info ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={info}
                  className="shrink-0 rounded text-subtle-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                />
              }
            >
              <Info className="size-3" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left">
              {info}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

export { StatStrip, Stat }
