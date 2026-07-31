export const THIRD_PARTY_INACTIVE_STATUSES = Object.freeze(new Set([
  "cancelado",
  "cancelada",
  "estornado",
  "estornada",
  "arquivado",
  "arquivada",
]));

// Define se o registro ainda produz efeito operacional/econômico. O campo
// `active` pertence ao contrato; pagamentos e medições usam somente o status.
export function isThirdPartyRecordActive(record) {
  const status = String(record?.status || "").trim().toLowerCase();
  return !THIRD_PARTY_INACTIVE_STATUSES.has(status);
}

export function isActiveThirdPartyContract(contract) {
  return isThirdPartyRecordActive(contract) && contract?.active !== false;
}
