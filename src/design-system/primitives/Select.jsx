import { forwardRef } from "react";
import { Field, useFieldIds } from "./Field.jsx";
import "./styles.css";

// Controle sem Field para composições que já têm label/fieldset semântico.
export const SelectControl = forwardRef(function SelectControl({className='',children,...props},ref){
  return <select ref={ref} data-mrc-control className={`arcd-control arcd-select ${className}`.trim()} {...props}>{children}</select>;
});

export const Select = forwardRef(function Select({ id, label, description, required, error, options = [], placeholder, className = "", fieldClassName='', children, ...props }, ref) {
  const ids = useFieldIds({ id, description, error });
  return <Field className={fieldClassName} label={label} required={required} description={description} error={error} htmlFor={ids.fieldId} descriptionId={ids.descriptionId} errorId={ids.errorId}>
    <SelectControl ref={ref} id={ids.fieldId} className={className} required={required} aria-invalid={Boolean(error)} aria-describedby={ids.describedBy} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {children || options.map(option => <option key={String(option.value)} value={option.value}>{option.label}</option>)}
    </SelectControl>
  </Field>;
});
