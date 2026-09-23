"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Compact segmented control for switching views or ranges. Renders a
 * radiogroup of buttons; the active option gets a raised surface.
 */
function SegmentedControl<T extends string | number>({
  value,
  onValueChange,
  options,
  size = "default",
  className,
  "aria-label": ariaLabel,
}: {
  value: T
  onValueChange: (next: T) => void
  options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[]
  size?: "default" | "sm"
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-md bg-muted p-0.5",
        size === "sm" ? "h-7" : "h-8",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&_svg]:size-3.5 [&_svg]:shrink-0",
              active
                ? "bg-background text-foreground shadow-xs dark:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
