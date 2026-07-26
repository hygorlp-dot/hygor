import { useId, useState } from "react";
import "./styles.css";

export function Switch({ id, checked, defaultChecked = false, onCheckedChange, disabled, label, ...props }) {
  const generatedId = useId();
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const switchId = id || `arcd-switch-${generatedId}`;
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? checked : uncontrolledChecked;
  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setUncontrolledChecked(next);
    onCheckedChange?.(next);
  };
  return <div className="arcd-check">
    <button id={switchId} type="button" className="arcd-switch" role="switch" aria-label={label} aria-checked={isChecked} data-state={isChecked ? "checked" : "unchecked"} disabled={disabled} onClick={toggle} {...props}><span className="arcd-switch__thumb" /></button>{label && <span>{label}</span>}
  </div>;
}
