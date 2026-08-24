import crypto from "node:crypto";

export const PROCUREMENT_REGISTRY_SCHEMA_VERSION = 1;

const array = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? "").trim();
const version = value => Number.isInteger(Number(value)) && Number(value) >= 0
  ? Number(value)
  : 0;
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]),
  );
};
const hash = value => crypto
  .createHash("sha256")
  .update(JSON.stringify(stable(value)))
  .digest("hex");
const withHash = row => ({ ...row, sourceHash:hash(row.payload) });

// CORE-003 (24/08/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): projeta
// data.cotacoes/data.pedidos - a fonte canônica ainda editada por comando
// operacional (src/domains/compras/purchase-order-commands.js). Propostas,
// itens e pagamentos ficam inteiros dentro de `payload`, sem tabela filha
// própria (mesmo princípio de escopo mínimo do CORE-001/CORE-002).
const quotationRow = quote => withHash({
  id:text(quote?.id),
  projectId:text(quote?.obraId),
  materialId:text(quote?.materialId),
  requestId:text(quote?.solicitacaoId),
  status:text(quote?.status || "aberta"),
  active:text(quote?.status) !== "cancelada",
  quantity:Number(quote?.qtd) || 0,
  sourceVersion:version(quote?.version),
  payload:quote || {},
});

const purchaseOrderRow = order => withHash({
  id:text(order?.id),
  projectId:text(order?.obraId),
  supplierId:text(order?.fornecedorId),
  quoteId:text(order?.cotacaoId),
  requestId:text(order?.solicitacaoId),
  numero:text(order?.numero),
  status:text(order?.status || "enviado"),
  active:text(order?.status) !== "cancelado",
  sourceVersion:version(order?.version),
  payload:order || {},
});

export const buildProcurementRegistrySnapshot = data => {
  const quotations=array(data?.cotacoes).map(quotationRow)
    .filter(row => row.id && row.projectId && row.materialId);
  const quotationIds=new Set(quotations.map(row => row.id));
  // Mesma checagem de auto-consistência que allocations já faz contra
  // equipmentIds (equipment-registry-shadow.js) - purchase_orders.quote_id
  // é FK para core_quotations POPULADA NESTA MESMA CHAMADA da RPC; um
  // pedido cujo cotacaoId não está no snapshot de cotações quebraria a FK
  // sem essa filtragem prévia.
  const purchaseOrders=array(data?.pedidos).map(purchaseOrderRow)
    .filter(row => row.id && row.projectId && row.supplierId)
    .filter(row => !row.quoteId || quotationIds.has(row.quoteId));
  const snapshot={
    schemaVersion:PROCUREMENT_REGISTRY_SCHEMA_VERSION,
    complete:true,
    quotations,purchaseOrders,
  };
  return {
    ...snapshot,
    counts:Object.fromEntries(
      Object.entries(snapshot)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, value.length]),
    ),
  };
};

const keyFor = {
  quotations:row => text(row.id),
  purchaseOrders:row => text(row.id),
};

export const compareProcurementRegistrySnapshot = (snapshot, canonical = {}) => {
  const divergences=[];
  Object.entries(keyFor).forEach(([section, getKey]) => {
    const expected=new Map(array(snapshot?.[section]).map(row => [getKey(row), row.sourceHash]));
    const actualRows=array(canonical?.[section]).filter(row => !row.archived_at);
    const actual=new Map(actualRows.map(row => [getKey(row), text(row.source_hash ?? row.sourceHash)]));
    expected.forEach((sourceHash, key) => {
      if (!actual.has(key)) divergences.push({ section, key, reason:"missing" });
      else if (actual.get(key) !== sourceHash) divergences.push({ section, key, reason:"hash_mismatch" });
    });
    actual.forEach((_, key) => {
      if (!expected.has(key)) divergences.push({ section, key, reason:"unexpected" });
    });
  });
  return divergences;
};
