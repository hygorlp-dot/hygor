import {expect,it} from 'vitest';
import {projectDataForUser} from './data-projection.js';
import {authorizeSectionChanges} from './section-authorizations.js';
import {unassignedOfxEvidence,verifiedOfxEvidence} from './dre-ofx-evidence.js';
import {dreAccountPosition,dreOfxPosition} from '../src/domains/financeiro/dre-bank-position.js';
import {applyBankTransactionCommand,BANK_TRANSACTION_COMMAND} from '../src/domains/conciliacao/transaction-commands.js';
import {validateOperationalCommandScope} from './operational-command-policy.js';
import {buildFinancialLedger} from '../src/domains/financeiro/ledger.js';

const fixture=({currency='BRL',asOf='20261119',balance='490.19'}={})=>{
 const records=[{id:'a',date:'20261117',amount:'4999.19'},{id:'b',date:'20261119',amount:'-4509.00'}];
 const body=records.map(({id,date,amount})=>`<STMTTRN><DTPOSTED>${date}<TRNAMT>${amount}<FITID>${id}<MEMO>Lançamento</STMTTRN>`).join('');
 const original=Buffer.from(`<OFX><STMTRS><CURDEF>${currency}<BANKACCTFROM><BANKID>777<ACCTID>TEST</BANKACCTFROM><BANKTRANLIST><DTSTART>20261020<DTEND>20261119${body}</BANKTRANLIST><LEDGERBAL><BALAMT>${balance}<DTASOF>${asOf}</LEDGERBAL></STMTRS></OFX>`);
 return {extratos:[{id:'statement',arquivo:'test.ofx',conta:'TEST',status:'ativo',originalFile:{size:original.length,dataUrl:`data:application/octet-stream;base64,${original.toString('base64')}`}}],
 transacoes:records.map(({id,date,amount})=>({id,chave:`fit:${id}`,extratoId:'statement',data:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6)}`,valor:Number(amount),status:'conciliado'})),
 caixaObra:[{id:'aporte',transacaoId:'a',categoria:'capital_socio',valor:4999.19}]};
};

it('reconstitui o saldo inicial e exibe o saldo bancário no OFX sem conta',()=>{
 const data=fixture();
 const [evidence]=unassignedOfxEvidence(data);
 expect(evidence).toEqual({id:'statement',start:'2026-10-20',end:'2026-11-19',balanceCents:49019,count:2});
 expect(dreOfxPosition(data,evidence,{start:'2026-11-01',end:'2026-11-30'})).toMatchObject({opening:0,ending:49019,incoming:499919,outgoing:450900,contributions:499919,reference:'2026-11-19',state:'statement'});
 expect(dreOfxPosition(data,evidence,{start:'2026-11-01',end:'2026-11-18'})).toMatchObject({opening:0,ending:499919,reference:'2026-11-18',state:'statement-calculated'});
 expect(dreOfxPosition({...data,transacoes:data.transacoes.slice(0,1)},evidence,{start:'2026-11-01',end:'2026-11-19'})).toMatchObject({ending:null,state:'invalid'});
});

it('recusa saldos de moeda diferente, sem valor, sem data correspondente, com linhas faltantes ou revertidas',()=>{
 for(const data of [fixture({currency:'USD'}),fixture({asOf:'20261120'}),fixture({balance:''})])expect(unassignedOfxEvidence(data)).toEqual([]);
 for(const mutate of [data=>data.transacoes.pop(),data=>{data.transacoes[0].valor=1;},data=>{data.transacoes[0].importReversal='reversed';},data=>{data.transacoes[0].contaBancariaId='assigned';},data=>{data.extratos[0].conta='different';}]){
  const data=fixture();mutate(data);expect(unassignedOfxEvidence(data)).toEqual([]);
 }
});

it('projeta somente a evidência mínima para perfis autorizados e impede gravá-la',()=>{
 const data=fixture();
 for(const role of ['admin','financeiro']){
  const projected=projectDataForUser(data,{role});
  expect(projected.dreOfxEvidence).toEqual(unassignedOfxEvidence(data));
  expect(projectDataForUser(data,{role,obraId:'work'}).dreOfxEvidence).toBeUndefined();
  expect(authorizeSectionChanges({role},{dreOfxEvidence:projected.dreOfxEvidence})).toContain('somente leitura');
 }
 expect(projectDataForUser(data,{role:'rh'}).dreOfxEvidence).toBeUndefined();
 expect(projectDataForUser(data,{role:'financeiro'}).extratos).toBeUndefined();
});

it('vincula lote existente sem gerar movimentos ou alterar o resultado financeiro',()=>{
 const data=fixture();
 Object.assign(data.extratos[0],{banco:'Banco QA',qtd:2,importManifest:{ids:['a','b']}});
 data.contasBancarias=[{id:'account',nome:'Conta confirmada',banco:'Banco QA',conta:'TEST',ativa:true}];
 data.historicoConc=[{id:'old',acao:'conciliada'}];
 data.transacoes[1].rateios=[{id:'old-allocation',valor:4509}];
 const command={type:BANK_TRANSACTION_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED,actorId:'admin',actorRole:'admin',
  idempotencyKey:'bank-existing-statement',payload:{statementId:'statement',accountId:'account',expectedVersion:0,expectedCount:2}};
 const when='2026-11-20T12:00:00Z';
 const before=structuredClone(data);
 for(const user of [{role:'financeiro',obraId:'o'},{role:'rh'}])expect(validateOperationalCommandScope({user,data,command}).ok).toBe(false);
 expect(applyBankTransactionCommand(data,{...command,actorObraId:'o'},when).ok).toBe(false);
 expect(applyBankTransactionCommand(data,{...command,payload:{...command.payload,expectedCount:1}},when).ok).toBe(false);
 expect(applyBankTransactionCommand({...data,contasBancarias:[{...data.contasBancarias[0],ativa:false}]},command,when).ok).toBe(false);
 const linked=applyBankTransactionCommand(data,command,when);
 expect(linked.summary).toEqual({linked:2});
 expect(data).toEqual(before);
 expect(linked.data.caixaObra).toBe(data.caixaObra);
 expect(buildFinancialLedger(linked.data).events).toEqual(buildFinancialLedger(data).events);
 expect(linked.data.transacoes.map(({id,status,valor})=>({id,status,valor}))).toEqual(before.transacoes.map(({id,status,valor})=>({id,status,valor})));
 expect(linked.data.transacoes[1].rateios).toBe(data.transacoes[1].rateios);
 expect(linked.data.historicoConc.map(e=>e.acao)).toEqual(['conciliada','extrato_vinculado_conta']);
 const evidence=verifiedOfxEvidence(linked.data);
 expect(evidence).toEqual([{id:'statement',accountId:'account',start:'2026-10-20',end:'2026-11-19',balanceCents:49019,count:2}]);
 expect(dreAccountPosition(linked.data,'account',{start:'2026-11-01',end:'2026-11-30'},evidence))
  .toMatchObject({opening:0,ending:49019,reference:'2026-11-19',contributions:499919,state:'statement'});
 const duplicate={...data.transacoes[0],id:'other',extratoId:'other',contaBancariaId:'account'};
 expect(applyBankTransactionCommand({...data,transacoes:[...data.transacoes,duplicate]},command,when)).toMatchObject({ok:false,reason:expect.stringContaining('repetida')});
});
