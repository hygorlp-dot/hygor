import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[var(--arcd-control-height)] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--arcd-radius-md)] border text-sm font-semibold normal-case tracking-[0.01em] transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcd-focus-ring)] focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-[var(--arcd-action-primary)] bg-[var(--arcd-action-primary)] text-[var(--arcd-action-primary-text)] hover:bg-[var(--arcd-action-primary-hover)]",
        destructive: "border-[var(--arcd-danger-border)] bg-[var(--arcd-danger-surface)] text-[var(--arcd-danger-text)] hover:border-[var(--arcd-danger-text)]",
        outline: "border-[var(--arcd-border-strong)] bg-[var(--arcd-surface-card)] text-[var(--arcd-text-primary)] hover:border-[var(--arcd-text-secondary)] hover:bg-[var(--arcd-surface-muted)]",
        secondary: "border-[var(--arcd-border-default)] bg-[var(--arcd-surface-muted)] text-[var(--arcd-text-primary)] hover:bg-[var(--arcd-surface-subtle)]",
        ghost: "border-transparent bg-transparent text-[var(--arcd-text-secondary)] hover:bg-[var(--arcd-surface-muted)] hover:text-[var(--arcd-text-primary)]",
        link: "border-transparent bg-transparent text-[var(--arcd-info-text)] underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-9 px-3",
        lg: "min-h-12 px-8",
        icon: "w-[var(--arcd-control-height)] px-0",
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
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
