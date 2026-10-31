import { buildFinancialLedger, selectAccountsPayable } from "../financeiro/ledger.js";
import { calculateWithholdings } from "./withholdings.js";

const number = value => Number(String(value ?? "").replace(",", "."));
const cents = value => Math.round((Number(value) || 0) * 100);
const status = value => String(value || "").trim().toLowerCase();
const cancelled = record => record?.deletedAt != null || record?.ativo === false
  || ["cancelada", "cancelado", "estornada", "estornado", "reversed", "deleted"].includes(status(record?.status));

export function measurementProgressSummary(stages = [], percentages = {}, previous = {}) {
  const rows = stages.map(stage => {
    const prior = number(previous[stage.id] ?? 0);
    const raw = percentages[stage.id] ?? prior;
    const informed = number(raw);
    const invalid = String(raw).trim() === "" || !Number.isFinite(informed) || informed < prior || informed > 100;
    const current = Number.isFinite(informed) ? Math.max(0, Math.min(100, informed)) : prior;
    const contractCents = cents(stage.valor);
    const previousCents = Math.round(contractCents * prior / 100);
    // Same rounding as THIRD_PARTY_MEASUREMENT_RECORDED on the server.
    const incrementCents = Math.round(contractCents * (current - prior) / 100);
    const currentCents = previousCents + incrementCents;
    return {id:stage.id, previous:prior, current, invalid, contractCents, previousCents,
      incrementCents, currentCents, remainingCents:Math.max(0, contractCents-currentCents)};
  });
  const total = key => rows.reduce((sum, row) => sum + row[key], 0);
  return {rows, invalid:rows.some(row=>row.invalid), contractCents:total("contractCents"),
    previousCents:total("previousCents"), incrementCents:total("incrementCents"),
    currentCents:total("currentCents"), remainingCents:total("remainingCents")};
}

export function measurementBaseSignature(contract, previous, editMeasurement) {
  return JSON.stringify({version:Number(contract?.version || 0),
    stages:(contract?.etapas || []).map(stage=>[String(stage.id),cents(stage.valor),number(previous?.[stage.id] ?? 0)]),
    correction:editMeasurement ? [editMeasurement.id, Number(editMeasurement.version || 0),editMeasurement.status] : null});
}

export function measurementApprovalStatus(measurement) {
  if (cancelled(measurement)) return {label:"Cancelada",tone:"muted"};
  if (["rascunho","draft"].includes(status(measurement.status))) return {label:"Aguardando aprovação",tone:"warning"};
  if (["rejeitada","rejeitado"].includes(status(measurement.status))) return {label:"Correção solicitada",tone:"danger"};
  if (["arquivada","arquivado"].includes(status(measurement.status))) return {label:"Arquivada",tone:"muted"};
  if (["aprovada","aprovado"].includes(status(measurement.status))) return {label:"Aprovada",tone:"success"};
  return {label:"Registro legado",tone:"muted"};
}

/** Read-only projection. Financial balances always come from the existing ledger. */
export function thirdPartyMeasurementFinancialPanels(data = {}, {asOfDate} = {}) {
  const ledger = buildFinancialLedger(data);
  const positions = selectAccountsPayable(ledger, asOfDate ? {asOfDate} : {}).items;
  return new Map((data.medicoesTerc || []).map(measurement => {
    const contract = (data.terceirizados || []).find(item=>String(item.id)===String(measurement.tercId));
    const invoice = (data.notasFiscais || []).find(item=>!cancelled(item)
      && String(item.obraId)===String(measurement.obraId)
      && (String(item.id)===String(measurement.notaFiscalId || "") || String(item.medicaoTercId || "")===String(measurement.id)));
    const position = positions.find(item=>item.sourceType==="medicao_terceiro"
      && String(item.sourceId)===String(measurement.id) && String(item.obraId)===String(measurement.obraId));
    const approval = measurementApprovalStatus(measurement);
    const held = cancelled(measurement) || ["rascunho","draft","rejeitada","rejeitado"].includes(status(measurement.status));
    const recognizedCents = held ? 0 : position?.increaseCents || 0;
    const settledCents = position?.decreaseCents || 0;
    const balanceCents = position?.balanceCents || 0;
    const settlements = position?.events.filter(event=>event.effect==="payable_decrease") || [];
    const financial = held ? {label:"Não liberada",tone:"muted"}
      : !recognizedCents ? {label:"Conferir posição",tone:"warning"}
      : balanceCents<=1 ? {label:"Baixada",tone:"success"}
      : settledCents>0 ? {label:"Baixa parcial",tone:"warning"} : {label:"Em aberto",tone:"warning"};
    const reconciliation = !settlements.length ? "Sem baixa"
      : settlements.every(event=>event.metadata?.conciliado===true) ? "Conciliada" : "Pendente de conciliação";
    const payments = settlements.map(event => {
      const payment = event.sourceType==="pagamento_nota"
        ? (invoice?.pagamentos || []).find(item=>String(item.id)===String(event.sourceSubId))
        : (data.pagsTerceiros || []).find(item=>String(item.id)===String(event.sourceSubId))
          || (measurement.pagamentos || []).find(item=>String(item.id)===String(event.sourceSubId));
      return {id:event.id,date:event.date,amountCents:event.amountCents,
        netCents:payment?.liquido != null ? cents(payment.liquido) : null,
        issCents:payment?.issRetido != null ? cents(payment.issRetido) : null,
        inssCents:payment?.inssRetido != null ? cents(payment.inssRetido) : null,
        payer:payment?.pagador || payment?.origem || event.metadata?.pagador || event.metadata?.origem || "",
        reconciled:event.metadata?.conciliado===true,transactionId:event.transactionId || ""};
    });
    const retained = calculateWithholdings(measurement.total, contract || {});
    const preview = !payments.length && !retained.error ? {
      netCents:cents(retained.liquido),issCents:cents(retained.issRetido),inssCents:cents(retained.inssRetido),
    } : null;
    return [measurement.id,{measurement,approval,financial,reconciliation,recognizedCents,settledCents,balanceCents,
      overpaidCents:position?.overpaidCents || 0,invoice,payments,preview,
      dueDate:measurement.dataVencimento || invoice?.vencimento || position?.dueDate || "",
      competence:measurement.competencia || String(measurement.data || measurement.dataMedicao || "").slice(0,7),
      missingInvoice:!!measurement.notaFiscalId && !invoice}];
  }));
}
