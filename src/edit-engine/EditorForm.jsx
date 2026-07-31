import { Button } from "../design-system/primitives/Button.jsx";
import { FormSection } from "../design-system/patterns/FormSection.jsx";
import { FieldRenderer } from "./FieldRenderer.jsx";

export function EditorForm({ schema, values, errors, onChange, onSubmit, onCancel, status, readOnly, forbidden, footer = true }) {
  const sections = schema.sections?.length ? schema.sections : [{ id: "main", title: null }];
  const disabled = readOnly || forbidden || status === "saving";
  return <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    {forbidden && <p role="alert">Você não possui permissão para editar este registro.</p>}
    {status === "error" && !Object.keys(errors).length && <p role="alert">Não foi possível salvar. Tente novamente.</p>}
    {sections.map(section => <FormSection key={section.id} title={section.title} description={section.description}><div style={{ display: "grid", gap: "var(--arcd-space-4)" }}>{(schema.fields || []).filter(field => (field.section || "main") === section.id).map(field => <FieldRenderer key={field.name} field={field} value={values[field.name]} error={errors[field.name]} disabled={disabled} readOnly={readOnly || field.type === "readonly"} onChange={value => onChange(field.name, value)} />)}</div></FormSection>)}
    {footer && !forbidden && <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--arcd-space-2)", marginTop: "var(--arcd-space-5)" }}>{onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}<Button type="submit" disabled={disabled} loading={status === "saving"}>{status === "saving" ? "Salvando" : "Salvar"}</Button></div>}
  </form>;
}
