"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * Two looks:
 *  - `default` — a compact segmented control (view switches, filters).
 *  - `line`    — underlined page / panel tabs.
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "justify-center rounded-md bg-muted p-0.5 group-data-horizontal/tabs:h-8",
        line: "scrollbar-none max-w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border group-data-horizontal/tabs:h-10 group-data-horizontal/tabs:w-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex cursor-pointer items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        // Segmented
        "group-data-[variant=default]/tabs-list:h-full group-data-[variant=default]/tabs-list:flex-1 group-data-[variant=default]/tabs-list:rounded-[5px] group-data-[variant=default]/tabs-list:px-2.5 group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-xs dark:group-data-[variant=default]/tabs-list:data-active:bg-accent",
        // Underlined
        "group-data-[variant=line]/tabs-list:h-full group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:data-active:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-[13px] outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
