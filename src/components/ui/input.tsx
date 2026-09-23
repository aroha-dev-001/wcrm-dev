import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Shared field chrome — used by Input, Textarea, NativeSelect and the
 * Select trigger so every text-entry surface looks identical.
 */
export const fieldClasses =
  "w-full min-w-0 rounded-md border border-input bg-background text-foreground shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:bg-card"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldClasses,
        "h-8 px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-[13px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
