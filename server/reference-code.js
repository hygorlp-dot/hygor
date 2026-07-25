export const normalizeReferenceCode = value => {
  const clean = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i, "")
    .replace(/\.0$/, "");
  return /^\d+$/.test(clean) ? clean.replace(/^0+(?=\d)/, "") : clean;
};

// Bases antigas podem ter sido gravadas antes da normalização canônica e
// conservar zeros à esquerda. Consultar as variantes mantém essas cargas
// utilizáveis sem exigir que o cliente reenvie imediatamente o XLSX.
export const referenceCodeVariants = value => {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i, "")
    .replace(/\.0$/, "");
  const normalized = normalizeReferenceCode(raw);
  const variants = new Set([raw, normalized].filter(Boolean));
  if (/^\d+$/.test(normalized)) {
    for (let width = Math.max(normalized.length, 5); width <= 10; width += 1) {
      variants.add(normalized.padStart(width, "0"));
    }
  }
  return [...variants];
};
