import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-200",
    "focus-visible:ring-2 focus-visible:ring-lime/45 focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /* The one loud control on the screen: flat electric lime, black type. */
        primary: [
          "bg-lime font-semibold text-ink",
          "shadow-[0_12px_30px_-14px_rgb(214_255_66/0.7)]",
          "hover:bg-lime-strong",
          "active:bg-lime-strong active:brightness-[0.97]",
        ],
        outline: [
          "border border-white/12 bg-white/[0.03] text-mist/80",
          "hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
        ],
        ghost: "text-white/55 hover:bg-white/[0.06] hover:text-white",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[12px]",
        default: "h-11 px-5 text-[14px]",
        lg: "h-12 rounded-xl px-6 text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
