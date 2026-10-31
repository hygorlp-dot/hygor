import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-(--arcd-control-height) items-center justify-center gap-2 whitespace-nowrap rounded-(--arcd-radius-md) border text-sm font-semibold normal-case tracking-[0.01em] transition-[background-color,border-color,color,transform] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--arcd-focus-ring) focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-(--arcd-action-primary) bg-(--arcd-action-primary) text-(--arcd-action-primary-text) hover:bg-(--arcd-action-primary-hover)",
        destructive: "border-(--arcd-danger-border) bg-(--arcd-danger-surface) text-(--arcd-danger-text) hover:border-(--arcd-danger-text)",
        outline: "border-(--arcd-border-strong) bg-(--arcd-surface-card) text-(--arcd-text-primary) hover:border-(--arcd-text-secondary) hover:bg-(--arcd-surface-muted)",
        secondary: "border-(--arcd-border-default) bg-(--arcd-surface-muted) text-(--arcd-text-primary) hover:bg-(--arcd-surface-subtle)",
        ghost: "border-transparent bg-transparent text-(--arcd-text-secondary) hover:bg-(--arcd-surface-muted) hover:text-(--arcd-text-primary)",
        link: "border-transparent bg-transparent text-(--arcd-info-text) underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-9 px-3",
        lg: "min-h-12 px-8",
        icon: "w-(--arcd-control-height) px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
