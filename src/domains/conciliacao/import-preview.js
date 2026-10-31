import {applyBankTransactionCommand, BANK_TRANSACTION_COMMAND} from './transaction-commands.js';

export function validBankDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}

export function previewBankImport(data, prepared) {
  const known = new Set((data.transacoes || []).map(item => item.chave).filter(Boolean));
  const seen = new Set();
  const rows = prepared.transactions.map((transaction,index) => {
    const duplicate = known.has(transaction.chave) || seen.has(transaction.chave);
    seen.add(transaction.chave);
    return {transaction, duplicate, line:transaction.metadadosImportacao?.linha || index+1};
  });
  const result = applyBankTransactionCommand(data,{type:BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,actorId:'preview',payload:{statement:prepared.statement,transactions:prepared.transactions}});
  const invalid = prepared.invalid || [];
  return {rows, imported:result?.summary?.imported || 0, duplicates:result?.summary?.duplicates || 0,
    error:invalid.length?`${invalid.length} linha(s) inválida(s). Corrija o arquivo e selecione novamente; nenhuma linha será gravada.`:result?.ok?'':result?.reason || 'Arquivo inválido.'};
}
