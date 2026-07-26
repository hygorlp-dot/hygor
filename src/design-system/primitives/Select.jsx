import { forwardRef } from "react";
import { Field, useFieldIds } from "./Field.jsx";
import "./styles.css";

export const Select = forwardRef(function Select({ id, label, description, required, error, options = [], placeholder, className = "", children, ...props }, ref) {
  const ids = useFieldIds({ id, description, error });
  return <Field label={label} required={required} description={description} error={error} htmlFor={ids.fieldId} descriptionId={ids.descriptionId} errorId={ids.errorId}>
    <select ref={ref} id={ids.fieldId} className={`arcd-control arcd-select ${className}`.trim()} required={required} aria-invalid={Boolean(error)} aria-describedby={ids.describedBy} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {children || options.map(option => <option key={String(option.value)} value={option.value}>{option.label}</option>)}
    </select>
  </Field>;
});
