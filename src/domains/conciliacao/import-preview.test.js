import {expect,it} from 'vitest';
import {previewBankImport,validBankDate} from './import-preview.js';
import {applyBankTransactionCommand,BANK_TRANSACTION_COMMAND} from './transaction-commands.js';
const transaction={id:'new',data:'2026-10-30',descricao:'PIX',valor:-100,chave:'key'};
const prepared={statement:{id:'s',arquivo:'bank.ofx'},transactions:[transaction,{...transaction,id:'repeated'},{...transaction,id:'other',chave:'other'}]};
it('prévia usa a deduplicação do comando, sem alterar os dados',()=>{
 const data={transacoes:[{...transaction,id:'stored'}]};
 const plan=previewBankImport(data,prepared);
 expect(plan.error).toBe('');expect(plan.imported).toBe(1);expect(plan.duplicates).toBe(2);
 expect(data.transacoes).toHaveLength(1);
});
it('linha inválida bloqueia o lote e identifica datas impossíveis',()=>{
 expect(validBankDate('2026-02-31')).toBe(false);expect(validBankDate('2028-02-29')).toBe(true);
 expect(previewBankImport({}, {...prepared,invalid:[{linha:5}]}).error).toMatch(/1 linha/);
 const result=applyBankTransactionCommand({}, {type:BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,actorId:'fin',payload:{...prepared,transactions:[{...transaction,data:'2026-02-31'}]}});
 expect(result.ok).toBe(false);
});
it('uma importação concorrente é ignorada de novo pelo servidor',()=>{
 const command={type:BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,actorId:'fin',payload:prepared};
 const first=applyBankTransactionCommand({},command);
 const repeated=applyBankTransactionCommand(first.data,{...command,payload:{statement:{...prepared.statement,id:'s2'},transactions:prepared.transactions.map(row=>({...row,id:row.id+'2'}))}});
 expect(repeated.summary.imported).toBe(0);expect(repeated.data.transacoes).toHaveLength(2);
});
