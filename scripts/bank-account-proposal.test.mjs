import {test} from 'vitest';
import assert from 'node:assert/strict';
import {prepareBankAccountProposal} from './bank-account-proposal.mjs';
const statement=(id,extra={})=>({id,banco:'Banco QA',conta:'000123-4',status:'ativo',...extra});
test('preserva os zeros e os estados sem modificar dados, nem inventar abertura',()=>{
 const data={extratos:[statement('s',{status:'arquivado'})],transacoes:[{id:'t',extratoId:'s',valor:10,status:'ignorado'}]},before=structuredClone(data);
 const result=prepareBankAccountProposal(data);assert.deepEqual(data,before);assert.equal(result.accounts[0].draft.conta,'000123-4');assert.equal(result.accounts[0].draft.saldoInicial,null);assert.equal(result.accounts[0].draft.titular,null);assert.equal(result.links.statements[0].statementStatus,'arquivado');assert.equal(result.links.transactions[0].status,'ignorado');assert.equal(result.executable,false);
});
test('agrupa a identidade preservada e nunca usa conta da contraparte',()=>{
 const result=prepareBankAccountProposal({extratos:[statement('s'),statement('other'),statement('unknown',{conta:''})],transacoes:[{id:'x',extratoId:'unknown',contraparteConta:'999',contraparteBanco:'Banco QA'}]});
 assert.equal(result.accounts.length,1);assert.equal(result.accounts[0].evidence.length,2);assert.equal(result.unidentifiedStatements.length,1);assert.deepEqual(result.transactionsWithoutIdentifiedStatement,['x']);
});
test('não sobrescreve vínculos existentes e aponta ambiguidade de agência',()=>{
 const result=prepareBankAccountProposal({extratos:[statement('s',{agencia:'0001'}),statement('other',{agencia:'0002'})],transacoes:[{id:'t',extratoId:'s',contaBancariaId:'existing'}]});
 assert.equal(result.accounts[0].ambiguous,true);assert.equal(result.links.transactions[0].currentAccountId,'existing');assert.equal(result.links.transactions[0].conflict,true);
});
test('reutiliza proposta de cadastro existente somente com identidade correspondente',()=>{
 const result=prepareBankAccountProposal({contasBancarias:[{id:'bank',banco:'Banco QA',conta:'000123-4'}],extratos:[statement('s')]});assert.equal(result.accounts[0].proposedId,'bank');assert.equal(result.accounts[0].action,'revisar_vinculo_ao_cadastro_existente');
});
test('alerta repetições dentro da conta sem fundir transações legítimas',()=>{
 const result=prepareBankAccountProposal({extratos:[statement('s'),statement('b',{conta:'999'})],transacoes:[{id:'t1',extratoId:'s',fitid:'fit1',data:'2026-01-01',valor:10,descricao:'PIX'},{id:'t2',extratoId:'s',fitid:'fit2',data:'2026-01-01',valor:10,descricao:'PIX'},{id:'t3',extratoId:'b',fitid:'fit1',data:'2026-01-01',valor:10,descricao:'PIX'}]});
 assert.equal(result.duplicateReview.repeatedFitid.length,0);assert.equal(result.duplicateReview.repeatedContent.length,1);assert.equal(result.links.transactions.length,3);
});
