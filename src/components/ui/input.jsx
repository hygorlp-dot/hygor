import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-[var(--arcd-control-height)] w-full rounded-[var(--arcd-radius-md)] border border-[var(--arcd-border-strong)] bg-[var(--arcd-surface-card)] px-3 py-2 text-sm text-[var(--arcd-text-primary)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--arcd-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcd-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--arcd-surface-muted)] disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
