import { validateField } from "./validateField.js";

export async function validateSchema(schema, values) {
  const errors = {};
  for (const field of schema.fields || []) {
    const error = await validateField(field, values[field.name], values);
    if (error) errors[field.name] = error;
  }
  const generalErrors = await schema.validate?.(values);
  return { ...errors, ...(generalErrors || {}) };
}
