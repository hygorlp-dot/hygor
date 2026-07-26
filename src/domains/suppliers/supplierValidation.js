export function validateSupplier(values) {
  const errors = {};
  if (!String(values.name || "").trim()) errors.name = "Informe o nome do fornecedor.";
  if (values.email && !String(values.email).includes("@")) errors.email = "Informe um e-mail válido.";
  return errors;
}
