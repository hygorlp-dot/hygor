// Escrita ao vivo de cotação/pedido em core_quotations/core_purchase_orders
// (migration 014, CORE-003) - mesmo espírito de purchase-request-live-write.js
// (24/08/2026): lógica pura (sem I/O), chamada por api/data.js como efeito
// colateral de melhor esforço depois que o comando operacional já foi
// processado com sucesso no caminho existente. O blob continua sendo a
// única fonte de verdade operacional.
//
// Diferença real em relação a purchase_requests: estas duas tabelas também
// são alvo da sincronização em LOTE (server/procurement-registry-shadow.js),
// que compara `source_hash` (SHA-256 do payload) a cada deploy. Por isso as
// linhas aqui reaproveitam quotationRow/purchaseOrderRow do módulo de
// sombra, em vez de recalcular o hash por conta própria - qualquer
// divergência de cálculo entre os dois caminhos geraria um falso positivo
// de "hash_mismatch" na próxima sincronização em lote, mascarando uma
// divergência de cálculo como se fosse uma divergência de dado real.
//
// Escopo desta rodada (decisão do usuário, 31/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): só QUOTATION_SAVED e
// PURCHASE_ORDER_SAVED disparam escrita ao vivo. Decidir uma cotação
// (PURCHASE_ORDER_CREATED_FROM_QUOTE, que também muda a cotação para
// "decidida"), os dois cancelamentos (PURCHASE_QUOTE_CANCELLED,
// PURCHASE_CANCELLED) e anexação de documento continuam só na
// sincronização em lote (próximo deploy) - reservado para uma rodada
// futura, não é uma lacuna esquecida.

import { purchaseOrderRow, quotationRow } from "./procurement-registry-shadow.js";

const text = value => String(value ?? "").trim();

export const buildQuotationLiveRow = (companyId, quote) => {
  const row = quotationRow(quote);
  return {
    company_id: text(companyId),
    id: row.id,
    project_id: row.projectId,
    material_id: row.materialId,
    request_id: row.requestId || null,
    status: row.status,
    active: row.active,
    quantity: row.quantity,
    source_version: row.sourceVersion,
    source_hash: row.sourceHash,
    payload: row.payload,
    synced_at: new Date().toISOString(),
  };
};

export const buildPurchaseOrderLiveRow = (companyId, order) => {
  const row = purchaseOrderRow(order);
  return {
    company_id: text(companyId),
    id: row.id,
    project_id: row.projectId,
    supplier_id: row.supplierId,
    quote_id: row.quoteId || null,
    request_id: row.requestId || null,
    numero: row.numero,
    status: row.status,
    active: row.active,
    source_version: row.sourceVersion,
    source_hash: row.sourceHash,
    payload: row.payload,
    synced_at: new Date().toISOString(),
  };
};
