import { forwardRef } from "react";
import { Field, useFieldIds } from "./Field.jsx";
import "./styles.css";

export const Textarea = forwardRef(function Textarea({ id, label, description, required, error, className = "", ...props }, ref) {
  const ids = useFieldIds({ id, description, error });
  return <Field label={label} required={required} description={description} error={error} htmlFor={ids.fieldId} descriptionId={ids.descriptionId} errorId={ids.errorId}>
    <textarea ref={ref} id={ids.fieldId} className={`arcd-control arcd-textarea ${className}`.trim()} required={required} aria-invalid={Boolean(error)} aria-describedby={ids.describedBy} {...props} />
  </Field>;
});
