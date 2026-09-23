import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** The one loading indicator used across the app. */
function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden
      className={cn("size-4 animate-spin text-muted-foreground", className)}
    />
  )
}

/** Centered spinner with an optional label, for whole-panel loads. */
function LoadingState({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-40 flex-1 flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground",
        className
      )}
    >
      <Spinner className="size-5" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  )
}

export { Spinner, LoadingState }
