export const referenceBaseKey = base => [
  String(base?.fonte || "").toUpperCase(),
  String(base?.dataBase || ""),
  String(base?.uf || "").toUpperCase(),
  String(base?.fonte || "").toUpperCase() === "SINAPI"
    ? (base?.desonerado === false ? "NAO_DESONERADA" : "DESONERADA")
    : "OFICIAL",
].join("|");

export function consolidateReferenceBases(bases = []) {
  const groups = new Map();
  bases.forEach(base => {
    const key = referenceBaseKey(base);
    groups.set(key, [...(groups.get(key) || []), base]);
  });
  return [...groups.values()].map(group => {
    const ordered = [...group].sort((a, b) =>
      Number(b.status === "ready") - Number(a.status === "ready")
      || Number(b.total || 0) - Number(a.total || 0)
      || String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    return {
      ...ordered[0],
      idsEquivalentes:ordered.map(base => base.id),
      duplicadas:Math.max(0, ordered.length - 1),
    };
  }).sort((a, b) =>
    String(b.dataBase || "").localeCompare(String(a.dataBase || ""))
    || String(a.fonte || "").localeCompare(String(b.fonte || "")));
}

