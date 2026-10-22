import * as React from "react";

import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-(--arcd-control-height) w-full rounded-(--arcd-radius-control) border border-(--arcd-border-strong) bg-(--arcd-surface-card) px-3 py-2 text-sm text-(--arcd-text-primary) transition-[border-color,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-(--arcd-text-muted) hover:border-(--arcd-text-secondary) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--arcd-focus-ring) focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-(--arcd-border-default) disabled:bg-(--arcd-surface-muted) disabled:opacity-60 aria-invalid:border-(--arcd-danger-text) aria-invalid:bg-(--arcd-danger-surface)",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
