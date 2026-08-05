export const THIRD_PARTY_INACTIVE_STATUSES = Object.freeze(new Set([
  "cancelado",
  "cancelada",
  "estornado",
  "estornada",
]));

const THIRD_PARTY_ARCHIVED_CONTRACT_STATUSES = new Set([
  "arquivado",
  "arquivada",
]);

// Define se o registro ainda produz efeito operacional/econômico. `arquivada`
// é um estado histórico usado por medições já consolidadas e, diferente de um
// cancelamento/estorno, não elimina seu efeito nem deve escondê-la da tela.
// O campo `active` pertence ao contrato; pagamentos e medições usam o status.
export function isThirdPartyRecordActive(record) {
  const status = String(record?.status || "").trim().toLowerCase();
  return !THIRD_PARTY_INACTIVE_STATUSES.has(status);
}

export function isActiveThirdPartyContract(contract) {
  const status = String(contract?.status || "").trim().toLowerCase();
  return isThirdPartyRecordActive(contract)
    && !THIRD_PARTY_ARCHIVED_CONTRACT_STATUSES.has(status)
    && contract?.active !== false;
}

// O quadro mantém contratos concluídos/inativos para consulta, mas não mostra
// os arquivados nem os cancelados. A disponibilidade para novos lançamentos é
// validada separadamente por `isActiveThirdPartyContract`.
export function isVisibleThirdPartyContract(contract) {
  const status = String(contract?.status || "").trim().toLowerCase();
  return isThirdPartyRecordActive(contract)
    && !THIRD_PARTY_ARCHIVED_CONTRACT_STATUSES.has(status);
}
