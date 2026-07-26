export function normalizeEditorValues(values, schema) {
  return (schema.fields || []).reduce((normalized, field) => {
    const value = values[field.name];
    if (field.type === "number" || field.type === "currency" || field.type === "percentage") normalized[field.name] = value === "" || value === undefined ? value : Number(value);
    else normalized[field.name] = value;
    return normalized;
  }, {});
}
