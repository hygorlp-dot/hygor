export const THIRD_PARTY_INACTIVE_STATUSES = Object.freeze(new Set([
  "cancelado",
  "cancelada",
  "estornado",
  "estornada",
  "arquivado",
]));

// Define se o registro ainda produz efeito operacional/econômico. `arquivada`
// é um estado histórico usado por medições já consolidadas e, diferente de um
// cancelamento/estorno, não elimina seu efeito nem deve escondê-la da tela.
// Contratos antigos usam o masculino `arquivado` como inativação efetiva.
// O campo `active` pertence ao contrato; pagamentos e medições usam o status.
export function isThirdPartyRecordActive(record) {
  const status = String(record?.status || "").trim().toLowerCase();
  return !THIRD_PARTY_INACTIVE_STATUSES.has(status);
}

export function isActiveThirdPartyContract(contract) {
  return isThirdPartyRecordActive(contract) && contract?.active !== false;
}
