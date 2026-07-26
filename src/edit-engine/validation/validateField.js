export function validateField(field, value, values) {
  if (field.required && (value === undefined || value === null || value === "")) return "Este campo é obrigatório.";
  if (field.min !== undefined && value !== "" && Number(value) < field.min) return `Informe um valor maior ou igual a ${field.min}.`;
  if (field.max !== undefined && value !== "" && Number(value) > field.max) return `Informe um valor menor ou igual a ${field.max}.`;
  return field.validate?.(value, values) || null;
}
