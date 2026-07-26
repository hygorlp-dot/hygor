import { cn } from "../lib/cn.js";
import "./styles.css";

export function Badge({ tone = "neutral", className, children, ...props }) {
  return <span className={cn("arcd-badge", `arcd-badge--${tone}`, className)} {...props}>{children}</span>;
}
