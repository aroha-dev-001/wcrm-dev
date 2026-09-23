import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.12),0_1px_2px_0_oklch(0_0_0/0.08)] hover:bg-primary-hover",
        outline:
          "border-input bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent data-popup-open:bg-accent dark:bg-card dark:hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent data-popup-open:bg-accent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground data-popup-open:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/40",
        "destructive-outline":
          "border-input bg-background text-destructive shadow-xs hover:border-destructive/40 hover:bg-destructive/8 focus-visible:ring-destructive/30 dark:bg-card",
        link: "h-auto! px-0! text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[5px] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 px-4 text-sm",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[5px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
