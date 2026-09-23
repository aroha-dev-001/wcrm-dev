import { cn } from "@/lib/utils"

/** Neutral pulsing placeholder sized by its container. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/** A few table-shaped skeleton rows for list pages. */
function SkeletonRows({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 px-4">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="ml-auto h-3 w-24" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonRows }
