import { useId } from "react";
import "./styles.css";

export function Checkbox({ id, label, className = "", ...props }) {
  const generatedId = useId();
  const checkboxId = id || `arcd-checkbox-${generatedId}`;
  return <label className={`arcd-check ${className}`.trim()} htmlFor={checkboxId}>
    <input id={checkboxId} className="arcd-check__input" type="checkbox" {...props} />
    <span className="arcd-check__box" aria-hidden="true">✓</span>{label}
  </label>;
}
