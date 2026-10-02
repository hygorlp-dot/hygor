// Ações, permissões e histórico de uma locação na Central operacional.
// Puro. As regras de QUEM pode o quê vêm de rental-command-roles.js (a mesma
// tabela que o servidor usa); as condições de QUANDO cada ação existe são as
// da lista antiga de locações, apenas movidas para cá para serem testáveis e
// compartilhadas pela linha, pelo menu e pelo painel de detalhe.
import { OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import { RENTAL_COMMAND_ROLES } from "./rental-command-roles.js";
import { RENTAL_CHECKPOINT_TYPE, rentalDeliveryBalance, rentalDispatchBalance, rentalReturnBalance } from "./rental-checkpoints.js";
import { availableRentalTransitions, rentalStateLabel } from "./rental-lifecycle.js";
import { formatDateFull } from "./rental-period.js";

// ------------------------------------------------------- ações e permissões ----
export const CHECKPOINT_BY_STATE = Object.freeze({
  ready_for_dispatch: RENTAL_CHECKPOINT_TYPE.SEPARATION, in_transport: RENTAL_CHECKPOINT_TYPE.DISPATCH,
  delivered: RENTAL_CHECKPOINT_TYPE.DELIVERY, returned: RENTAL_CHECKPOINT_TYPE.RETURN, under_inspection: RENTAL_CHECKPOINT_TYPE.INSPECTION,
});
export const CHECKPOINT_LABEL = Object.freeze({
  separation: "Separação", partial_dispatch: "Expedição parcial", dispatch: "Expedição", partial_delivery: "Entrega parcial",
  delivery: "Entrega", partial_return: "Devolução parcial", return: "Devolução", inspection: "Inspeção", adjustment: "Conclusão do ajuste",
});

// Cada ação da tela dispara um comando do servidor. A permissão da ação é a
// do comando (RENTAL_COMMAND_ROLES, a mesma tabela do servidor) mais o escopo
// de obra de perfis vinculados a uma obra (mesma regra de
// validateOperationalCommandScope). server/rental-action-permissions.test.js
// confere, ação por ação e papel por papel, que tela e servidor concordam.
const C = OPERATIONAL_COMMAND;
export const RENTAL_ACTION_COMMAND = Object.freeze({
  avancar: C.EQUIPMENT_RENTAL_TRANSITIONED, expedicao_parcial: C.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
  entrega_parcial: C.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED, ajuste: C.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
  devolucao_parcial: C.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED, encerrar: C.EQUIPMENT_RENTAL_CLOSED,
  medir: C.EQUIPMENT_RENTAL_CHARGE_MEASURED, cobranca: C.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,
  faturar: C.EQUIPMENT_RENTAL_INVOICE_ISSUED, receber: C.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,
  aditivo: C.EQUIPMENT_RENTAL_AMENDED, substituir: C.EQUIPMENT_RENTAL_UNIT_REPLACED,
  editar: C.EQUIPMENT_RENTAL_SAVED, excluir: C.EQUIPMENT_RENTAL_CANCELLED,
});

export const canRunRentalCommand = (user, rental, commandType) => {
  if (!user?.role || !RENTAL_COMMAND_ROLES[commandType]?.includes(user.role)) return false;
  return user.role === "admin" || !user.obraId || String(user.obraId) === String(rental?.obraId || "");
};

// Ações disponíveis para uma locação, na ordem em que aparecem no menu e no
// detalhe. As condições são EXATAMENTE as da lista antiga (EquipamentosView):
// só foram movidas para cá para serem testáveis e compartilhadas pela linha, o
// menu e o painel de detalhe. Cada ação carrega o `command` que dispara.
export const rentalRowActions = (row, user) => {
  const rental = row.rental;
  const cps = rental.rentalCheckpoints || [];
  const state = row.lifecycleState;
  const open = row.emAberto;
  const hasAdjustment = cps.some(item => item.type === RENTAL_CHECKPOINT_TYPE.ADJUSTMENT && item.status !== "cancelled");
  const actions = [];
  const add = (kind, label, group, extra = {}) => {
    const command = RENTAL_ACTION_COMMAND[kind];
    if (canRunRentalCommand(user, rental, command)) actions.push({ id: extra.id || kind, kind, command, label, group, ...extra });
  };

  if (open) {
    availableRentalTransitions(state, { checkpoints: cps }).filter(next => !["cancelled", "closed"].includes(next)).forEach(next => {
      const type = CHECKPOINT_BY_STATE[next];
      const recorded = cps.some(item => item.type === type && item.status !== "cancelled");
      add("avancar", type && !recorded ? `Checklist: ${CHECKPOINT_LABEL[type]}` : `Avançar: ${rentalStateLabel(next)}`, "ciclo", { id: `avancar:${next}`, nextState: next });
    });
    if (state === "ready_for_dispatch" && rentalDispatchBalance(rental, cps).remainingQuantity > 1) add("expedicao_parcial", "Expedição parcial", "ciclo");
    if (state === "in_transport" && rentalDeliveryBalance(rental, cps).remainingQuantity > 1) add("entrega_parcial", "Entrega parcial", "ciclo");
    if (state === "awaiting_adjustment" && !hasAdjustment) add("ajuste", "Registrar ajuste concluído", "ciclo");
    if (state === "pickup_requested" && rentalReturnBalance(rental, cps).remainingQuantity > 1) add("devolucao_parcial", "Devolução parcial", "ciclo");
    if (!rental.lifecycleState || state === "under_inspection" || (state === "awaiting_adjustment" && hasAdjustment)) add("encerrar", "Encerrar", "ciclo");
  }
  if (!row.cancelada) {
    add("medir", "Medir competência", "cobranca");
    add("cobranca", "Adicionar cobrança", "cobranca");
    if (row.hasItemsToInvoice) add("faturar", "Emitir fatura", "cobranca");
    row.openInvoices.forEach(invoice => add("receber", `Vincular recebimento · ${invoice.number}`, "cobranca", { id: `receber:${invoice.id}`, invoiceId: invoice.id }));
    if (open && ["contracted", "delivered", "active", "pickup_requested"].includes(state)) add("aditivo", "Prorrogar / renovar", "contrato");
    if (open && (rental.equipmentUnitIds || []).length > 0 && ["separating", "ready_for_dispatch", "in_transport", "delivered", "active", "pickup_requested"].includes(state)) add("substituir", "Substituir unidade", "contrato");
    add("editar", "Editar locação", "contrato");
    add("excluir", "Excluir locação", "admin", { danger: true });
  }
  return actions;
};

// A ação principal da linha: "Medir competência", no dia a dia de quem fatura.
export const primaryRowAction = actions => actions.find(item => item.kind === "medir") || null;

export const isReadOnlyFor = (row, user) =>
  !canRunRentalCommand(user, row.rental, C.EQUIPMENT_RENTAL_SAVED) && !canRunRentalCommand(user, row.rental, C.EQUIPMENT_RENTAL_CHARGE_MEASURED);

// Locação que a tela mostra "Em andamento" (data) mas cujo término já foi
// programado (`fim` preenchido): pelas regras vigentes, as ações de CICLO
// (avançar, aditivo, substituir, encerrar...) só existem para locação sem
// `fim`. A regra legada não muda; isto só explica a ausência, como informação
// operacional (não é erro). Só aparece para quem poderia operar o contrato.
export const rentalCycleNote = (row, user) => {
  if (row.situacao !== "em_andamento" || row.emAberto || row.cancelada) return "";
  if (!canRunRentalCommand(user, row.rental, C.EQUIPMENT_RENTAL_SAVED)) return "";
  return `Ciclo indisponível — término programado em ${formatDateFull(row.fim)}`;
};

// Linha do tempo do detalhe: só junta registros que a locação já guarda.
const CHECKPOINT_TIMELINE_LABEL = CHECKPOINT_LABEL;
export const rentalTimeline = row => {
  const rental = row.rental;
  const events = [];
  if (rental.inicio) events.push({ at: rental.inicio, label: "Início da locação", detail: row.obraRotulo });
  (rental.lifecycleHistory || []).forEach(item => events.push({ at: String(item.at || "").slice(0, 10), label: `Ciclo: ${rentalStateLabel(item.to)}`, detail: [item.actorName, item.reason].filter(Boolean).join(" · ") }));
  (rental.rentalCheckpoints || []).filter(item => item.status !== "cancelled").forEach(item => events.push({ at: String(item.date || item.createdAt || "").slice(0, 10), label: `Checklist: ${CHECKPOINT_TIMELINE_LABEL[item.type] || item.type}`, detail: [item.responsible || item.createdBy, item.quantity ? `${item.quantity} un` : ""].filter(Boolean).join(" · ") }));
  (rental.rentalAmendments || []).forEach(item => events.push({ at: String(item.createdAt || "").slice(0, 10), label: item.type === "renewal" ? "Renovação" : "Prorrogação", detail: [item.newEndDate ? `novo término ${formatDateFull(item.newEndDate)}` : "", item.reason].filter(Boolean).join(" · ") }));
  (rental.rentalReplacements || []).forEach(item => events.push({ at: String(item.date || item.createdAt || "").slice(0, 10), label: "Unidade substituída", detail: item.reason || "" }));
  if (rental.fim && !row.cancelada) events.push({ at: rental.fim, label: "Encerramento", detail: "" });
  if (row.cancelada) events.push({ at: String(rental.cancelledAt || "").slice(0, 10), label: "Locação excluída", detail: rental.cancellationReason || "" });
  return events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
};

