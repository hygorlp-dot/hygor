import { useId } from "react";
import "./styles.css";

export function useFieldIds({ id, description, error }) {
  const generatedId = useId();
  const fieldId = id || `arcd-field-${generatedId}`;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return {
    fieldId,
    describedBy: [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
    descriptionId,
    errorId,
  };
}

export function Field({ label, required, description, error, htmlFor, children, descriptionId, errorId }) {
  return <div className="arcd-field">
    {label && <label className="arcd-field__label" htmlFor={htmlFor}>{label}{required ? " *" : null}</label>}
    {children}
    {description && <div id={descriptionId} className="arcd-field__description">{description}</div>}
    {error && <div id={errorId} className="arcd-field__error" role="alert">{error}</div>}
  </div>;
}
