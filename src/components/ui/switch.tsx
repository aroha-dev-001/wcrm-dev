"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Root: primary token when checked (responds to the active color theme),
// slate when unchecked.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[checked]:bg-primary data-[unchecked]:bg-border-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.25)] ring-0 transition-transform",
          "data-[checked]:translate-x-3.5 data-[unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
