import { forwardRef } from "react";
import { Field, useFieldIds } from "./Field.jsx";
import "./styles.css";

export const TextareaControl = forwardRef(function TextareaControl({className='',...props},ref){
  return <textarea ref={ref} data-mrc-control className={`arcd-control arcd-textarea ${className}`.trim()} {...props}/>;
});

export const Textarea = forwardRef(function Textarea({ id, label, description, required, error, className = "", fieldClassName='', ...props }, ref) {
  const ids = useFieldIds({ id, description, error });
  return <Field className={fieldClassName} label={label} required={required} description={description} error={error} htmlFor={ids.fieldId} descriptionId={ids.descriptionId} errorId={ids.errorId}>
    <TextareaControl ref={ref} id={ids.fieldId} className={className} required={required} aria-invalid={Boolean(error)} aria-describedby={ids.describedBy} {...props} />
  </Field>;
});
