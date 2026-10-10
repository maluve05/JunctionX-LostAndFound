import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
    "text-[12px] font-medium tracking-[0.16em] uppercase",
  ],
  {
    variants: {
      variant: {
        neutral: "border-white/12 bg-white/[0.04] text-mist/70",
        accent: "border-lime/30 bg-lime/10 text-lime",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
