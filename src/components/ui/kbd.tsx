import { cn } from "@/lib/utils"

/** Keyboard key hint, e.g. <Kbd>⌘K</Kbd>. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-[4px] border border-border bg-background px-1 text-[10px] font-medium text-muted-foreground select-none dark:bg-card",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
