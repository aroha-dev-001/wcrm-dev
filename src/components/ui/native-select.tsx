import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClasses } from "@/components/ui/input"

/**
 * Styled native `<select>`. Used wherever a plain dropdown is enough
 * (forms with many options, mobile-friendly pickers) so they match the
 * Input chrome instead of each call site hand-rolling classes.
 *
 * The chevron is a background image so the element needs no wrapper —
 * the class string can also be applied to an existing `<select>`.
 */
export const nativeSelectClass = cn(
  fieldClasses,
  // `native-select` (globals.css) draws the chevron.
  "native-select h-8 cursor-pointer appearance-none pr-8 pl-2.5 text-[13px]"
)

function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(nativeSelectClass, className)}
      {...props}
    />
  )
}

export { NativeSelect }
