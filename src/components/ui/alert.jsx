import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const alertVariants = cva(
  "relative w-full rounded-[var(--arcd-radius-md)] border border-[var(--arcd-border-default)] bg-[var(--arcd-surface-card)] p-4 text-[var(--arcd-text-primary)] [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[var(--arcd-text-primary)]",
  {
    variants: {
      variant: {
        default: "",
        destructive:
          "border-[var(--arcd-danger-border)] bg-[var(--arcd-danger-surface)] text-[var(--arcd-danger-text)] [&>svg]:text-[var(--arcd-danger-text)]",
        warning:
          "border-[var(--arcd-warning-border)] bg-[var(--arcd-warning-surface)] text-[var(--arcd-warning-text)] [&>svg]:text-[var(--arcd-warning-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };
