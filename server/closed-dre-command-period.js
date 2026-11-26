// @ts-check
import { ATTENDANCE_COMMAND } from "./attendance-command.js";
import { closedCompetenceForDate } from "./closed-dre-mutation-guard.js";

/**
 * @typedef {{date?: string}} AttendanceDay
 * @typedef {{action?: string, date?: string, items?: AttendanceDay[], patches?: (AttendanceDay | null)[]}} AttendanceCommand
 * @typedef {{payload?: {transactionId?: string, counterpartyTransactionId?: string}}} ReconciliationCommand
 * @typedef {Record<string, unknown> & {transacoes?: {id?: string, data?: string}[]}} FinancialSnapshot
 * @typedef {{ok:true} | {ok:false, code:"CLOSED_DRE_IMMUTABLE", competence:string, error:string, transactionId?:string}} PeriodResult
 */

/** @param {AttendanceCommand | undefined} command */
const datasAlteradasPeloComandoPonto=command=>{
  if(command?.action===ATTENDANCE_COMMAND.SYNC)return (command.items||[]).map(item=>String(item.date||''));
  if(command?.action===ATTENDANCE_COMMAND.UPSERT||command?.action===ATTENDANCE_COMMAND.REVIEW)return [String(command.date||"")].filter(Boolean);
  if(command?.action===ATTENDANCE_COMMAND.BATCH_UPSERT){
    return [...new Set((Array.isArray(command.patches)?command.patches:[])
      .map(patch=>String(patch?.date||"")).filter(Boolean))];
  }
  return [];
};

/**
 * @param {FinancialSnapshot} data
 * @param {AttendanceCommand | undefined} command
 * @returns {PeriodResult}
 */
export const validarPontoEmCompetenciaAberta=(data,command)=>{
  const closed=datasAlteradasPeloComandoPonto(command)
    .map(date=>({date,closing:closedCompetenceForDate(data,date)}))
    .find(item=>item.closing);
  if(!closed)return {ok:true};
  return {
    ok:false,
    code:"CLOSED_DRE_IMMUTABLE",
    competence:closed.closing.competencia,
    error:`O ponto de ${closed.date} pertence à competência financeira fechada ${closed.closing.competencia}. O fechamento contábil não pode ser alterado por liberação de ponto.`,
  };
};

/**
 * @param {FinancialSnapshot} data
 * @param {ReconciliationCommand | undefined} command
 * @returns {PeriodResult}
 */
export const validarConciliacaoEmCompetenciaAberta=(data,command)=>{
  const ids=[
    String(command?.payload?.transactionId||""),
    String(command?.payload?.counterpartyTransactionId||""),
  ].filter(Boolean);
  for(const id of [...new Set(ids)]){
    const transaction=(data?.transacoes||[]).find(item=>String(item?.id)===id);
    const closing=closedCompetenceForDate(data,transaction?.data);
    if(!closing)continue;
    return {
      ok:false,
      code:"CLOSED_DRE_IMMUTABLE",
      competence:closing.competencia,
      transactionId:id,
      error:`A transação bancária de ${String(transaction?.data||"")} pertence à competência financeira fechada ${closing.competencia}. A conciliação histórica não pode ser alterada.`,
    };
  }
  return {ok:true};
};
