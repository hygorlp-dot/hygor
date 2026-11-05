// E1.1: transferência de material entre obras move custo na DRE e só pode
// nascer, chegar ou ser estornada pelos comandos do servidor (custo médio
// calculado no servidor, competência fechada, saldo). E1.2: o mesmo vale para
// os ajustes de inventário (alçada de aprovação). A gravação direta da seção
// `movEstoque` (save-sections) continua aceita para os outros tipos, mas não
// pode criar, alterar nem remover esses registros.
const TRANSFER_TYPES = new Set(["transferencia_saida", "transferencia_entrada", "ajuste_saida"]);
const isTransfer = item => TRANSFER_TYPES.has(String(item?.tipo || "")) || Boolean(item?.inventarioId);
const byId = list => new Map((Array.isArray(list) ? list : []).filter(isTransfer).map(item => [String(item?.id || ""), item]));

export const stockTransferSectionViolation = (current = [], incoming = []) => {
  const before = byId(current);
  const after = byId(incoming);
  // Um registro que deixou de ser transferência também conta como alteração.
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const id = String(item?.id || "");
    if (before.has(id) && !isTransfer(item)) return id;
  }
  for (const [id, item] of after) {
    if (!before.has(id) || JSON.stringify(before.get(id)) !== JSON.stringify(item)) return id;
  }
  for (const id of before.keys()) if (!after.has(id)) return id;
  return "";
};
