import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn.js";
import { Spinner } from "./Spinner.jsx";
import "./styles.css";

export const buttonVariants = cva("arcd-button", {
  variants: { variant: { primary: "arcd-button--primary", secondary: "arcd-button--secondary", ghost: "arcd-button--ghost", danger: "arcd-button--danger", success: "arcd-button--success", link: "arcd-button--link" }, size: { sm: "arcd-button--sm", md: "", lg: "arcd-button--lg", icon: "arcd-button--icon" } },
  defaultVariants: { variant: "primary", size: "md" },
});

export const Button = forwardRef(function Button({ className, variant, size, loading = false, disabled, children, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <Spinner label="Carregando" />}{children}
  </button>;
});
