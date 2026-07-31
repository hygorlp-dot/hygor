import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-[var(--arcd-control-height)] w-full rounded-[var(--arcd-radius-control)] border border-[var(--arcd-border-strong)] bg-[var(--arcd-surface-card)] px-3 py-2 text-sm text-[var(--arcd-text-primary)] transition-[border-color,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--arcd-text-muted)] hover:border-[var(--arcd-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcd-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-[var(--arcd-border-default)] disabled:bg-[var(--arcd-surface-muted)] disabled:opacity-60 aria-[invalid=true]:border-[var(--arcd-danger-text)] aria-[invalid=true]:bg-[var(--arcd-danger-surface)]",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
