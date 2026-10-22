import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const alertVariants = cva(
  "relative w-full rounded-(--arcd-radius-md) border border-(--arcd-border-default) bg-(--arcd-surface-card) p-4 text-(--arcd-text-primary) [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-(--arcd-text-primary)",
  {
    variants: {
      variant: {
        default: "",
        destructive:
          "border-(--arcd-danger-border) bg-(--arcd-danger-surface) text-(--arcd-danger-text) [&>svg]:text-(--arcd-danger-text)",
        warning:
          "border-(--arcd-warning-border) bg-(--arcd-warning-surface) text-(--arcd-warning-text) [&>svg]:text-(--arcd-warning-text)",
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
