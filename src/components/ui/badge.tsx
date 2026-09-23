import type * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Compact status / label badge. Colour carries meaning only through the
 * semantic variants (success / warning / danger / info); everything
 * else is neutral so a screen full of badges stays calm.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[5px] border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary-soft text-primary",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-background text-foreground dark:bg-transparent",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
        info: "border-info/25 bg-info/10 text-info",
        ghost: "border-transparent text-muted-foreground hover:bg-muted",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

function Badge({
  className,
  variant = "secondary",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

/**
 * Small coloured dot used inside badges and list rows to show a status
 * or a user-defined colour (tags, pipeline stages).
 */
function StatusDot({
  className,
  color,
  ...props
}: React.ComponentProps<"span"> & { color?: string }) {
  return (
    <span
      aria-hidden
      data-slot="status-dot"
      className={cn("inline-block size-1.5 shrink-0 rounded-full bg-current", className)}
      style={color ? { backgroundColor: color } : undefined}
      {...props}
    />
  )
}

export { Badge, StatusDot, badgeVariants }
