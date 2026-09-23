import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClasses } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClasses,
        "flex field-sizing-content min-h-16 px-2.5 py-2 text-base leading-relaxed md:text-[13px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
