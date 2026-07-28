import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { canOperateTechnicalMeasurement } from "../src/domains/medicoes/permissions.js";
import { EQUIPMENT_COMMAND_TYPES, equipmentCommandObraId } from "../src/domains/equipamentos/commands.js";
import {
  CLIENT_MEASUREMENT_COMMAND_TYPES,
  clientMeasurementCommandObraId,
} from "../src/domains/financeiro/measurement-commands.js";
import {
  COMPANY_EXPENSE_COMMAND_TYPES,
  EXPENSE_COMMAND_TYPES,
  expenseCommandObraId,
} from "../src/domains/financeiro/expense-commands.js";
import {
  WORK_CASH_COMMAND_TYPES,
  workCashCommandObraId,
} from "../src/domains/financeiro/work-cash-commands.js";
import {
  PAYABLE_PAYMENT_COMMAND_TYPES,
  payablePaymentCommandObraId,
} from "../src/domains/financeiro/payable-payment-commands.js";
import {
  PURCHASE_CANCELLATION_COMMAND_TYPES,
  purchaseCancellationCommandObraId,
} from "../src/domains/compras/purchase-cancellation-command.js";
import {
  BANK_TRANSACTION_COMMAND_TYPES,
} from "../src/domains/conciliacao/transaction-commands.js";
import {
  THIRD_PARTY_COMMAND_TYPES,
  thirdPartyCommandObraId,
} from "../src/domains/financeiro/third-party-commands.js";
import {
  INVOICE_COMMAND_TYPES,
  invoiceCommandObraId,
} from "../src/domains/financeiro/invoice-commands.js";

export const operationalCommandObraId=(data={},command={})=>{
  const payload=command?.payload||{};
  if(EQUIPMENT_COMMAND_TYPES.has(command?.type))return equipmentCommandObraId(data,command);
  if(CLIENT_MEASUREMENT_COMMAND_TYPES.has(command?.type))return clientMeasurementCommandObraId(data,command);
  if(EXPENSE_COMMAND_TYPES.has(command?.type))return expenseCommandObraId(data,command);
  if(WORK_CASH_COMMAND_TYPES.has(command?.type))return workCashCommandObraId(data,command);
  if(PAYABLE_PAYMENT_COMMAND_TYPES.has(command?.type))return payablePaymentCommandObraId(data,command);
  if(PURCHASE_CANCELLATION_COMMAND_TYPES.has(command?.type))return purchaseCancellationCommandObraId(data,command);
  if(THIRD_PARTY_COMMAND_TYPES.has(command?.type))return thirdPartyCommandObraId(data,command);
  if(INVOICE_COMMAND_TYPES.has(command?.type))return invoiceCommandObraId(data,command);
  if(command?.type===OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED)return String(payload?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED)return String(payload?.measurement?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED)return String((data?.medicoesObra||[]).find(item=>item.id===payload?.measurementId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED)return String(payload?.report?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED)return String((data?.rdos||[]).find(item=>item.id===payload?.reportId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED)return String(payload?.record?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED)return String((data?.progressRecords||[]).find(item=>item.id===payload?.recordId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED)return String((data?.weeklyCommitments||[]).find(item=>item.id===payload?.commitmentId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED)return String((data?.weeklyCommitments||[]).find(item=>item.id===payload?.commitmentId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED)return String(payload?.commitment?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED)return String((data?.pedidos||[]).find(item=>item.id===payload?.pedidoId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED)return String(payload?.receipt?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED)return String((data?.payments||[]).find(item=>item.id===payload?.receiptId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED)return String(payload?.records?.[0]?.obraId||"");
  if([OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED,OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED,OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED,OPERATIONAL_COMMAND.QUALITY_RECORD_DETAILS_UPDATED].includes(command?.type))return String((data?.qualidadeRegistros||[]).find(item=>item.id===payload?.recordId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED)return String(payload?.analysis?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED)return String(payload?.permit?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.LOOKAHEAD_CREATED)return String(payload?.lookahead?.obraId||"");
  if([OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED].includes(command?.type))return String((data?.lookaheadWindows||[]).find(item=>item.id===payload?.lookaheadId)?.obraId||"");
  return "";
};

export const validateOperationalCommandScope=({user={},data={},command={}}={})=>{
  const obraId=operationalCommandObraId(data,command);
  if(BANK_TRANSACTION_COMMAND_TYPES.has(command.type)){
    return ["admin","financeiro"].includes(user?.role)
      ?{ok:true,obraId:"",scope:"company"}
      :{ok:false,error:"Seu perfil não pode alterar transações bancárias da empresa."};
  }
  if(COMPANY_EXPENSE_COMMAND_TYPES.has(command.type)){
    return ["admin","financeiro"].includes(user?.role)
      ?{ok:true,obraId:"",scope:"company"}
      :{ok:false,error:"Seu perfil não pode alterar despesas corporativas."};
  }
  if(EQUIPMENT_COMMAND_TYPES.has(command.type)&&!obraId){
    return user?.role==="admin"||!user?.obraId
      ? {ok:true,obraId:"",scope:"company"}
      : {ok:false,error:"Um perfil vinculado a obra não pode alterar um equipamento corporativo sem lotação."};
  }
  if(EQUIPMENT_COMMAND_TYPES.has(command.type)&&command.type===OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED&&user?.obraId){
    const equipment=(data?.equipamentos||[]).find(item=>item.id===command.payload?.transfer?.equipamentoId);
    const source=String(equipment?.obraAtualId||"");
    if(source&&source!==String(user.obraId))return {ok:false,error:"Não é permitido transferir um equipamento alocado em outra obra."};
  }
  if(!obraId)return {ok:false,error:"O comando operacional precisa estar vinculado a uma obra existente."};
  const isMeasurement=[OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED].includes(command.type);
  const allowed=isMeasurement
    ? canOperateTechnicalMeasurement(user,obraId)
    : user?.role==="admin"||!user?.obraId||String(user.obraId)===obraId;
  return allowed?{ok:true,obraId}:{ok:false,error:"Esta obra não está disponível no seu escopo operacional."};
};
