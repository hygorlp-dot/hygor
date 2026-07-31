import { Checkbox, Input, Select, Switch, Textarea } from "../design-system/primitives/index.js";

export function FieldRenderer({ field, value, error, onChange, disabled, readOnly }) {
  if (field.render) return field.render({ field, value, error, onChange, disabled, readOnly });
  const common = { label: field.label, description: field.description, required: field.required, error, disabled, readOnly };
  if (field.type === "textarea") return <Textarea {...common} value={value ?? ""} onChange={event => onChange(event.target.value)} />;
  if (field.type === "select") return <Select {...common} value={value ?? ""} options={field.options || []} placeholder={field.placeholder} onChange={event => onChange(event.target.value)} />;
  if (field.type === "checkbox") return <Checkbox label={field.label} checked={Boolean(value)} disabled={disabled || readOnly} onChange={event => onChange(event.target.checked)} />;
  if (field.type === "switch") return <Switch label={field.label} checked={Boolean(value)} disabled={disabled || readOnly} onCheckedChange={onChange} />;
  if (field.type === "readonly") return <Input {...common} value={value ?? ""} readOnly />;
  const inputType = field.type === "currency" || field.type === "percentage" || field.type === "number" ? "number" : field.type || "text";
  const inputMode = field.inputMode || ({ currency: "decimal", percentage: "decimal", number: "decimal", tel: "tel", email: "email" }[field.type]);
  return <Input {...common} type={inputType} inputMode={inputMode} value={value ?? ""} min={field.min} max={field.max} onChange={event => onChange(event.target.value)} />;
}
