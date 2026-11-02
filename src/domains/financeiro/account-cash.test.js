import {describe,it,expect} from 'vitest';
import {accountCashPosition,accountMoneyCents,accountMovementEntries} from './account-cash.js';

const params={accountId:'a',opening:'100',openingDate:'2026-10-01',referenceDate:'2026-10-31'};
const movement=(id,data,valor,extra={})=>({id,data,valor,contaBancariaId:'a',status:'pendente',...extra});
describe('posição local de caixa por conta',()=>{
 it('distingue ausência de abertura de zero e rejeita dinheiro inválido',()=>{
  for(const value of ['',null,undefined,NaN,Infinity,'1.001'])expect(accountMoneyCents(value)).toBeNull();
  expect(accountMoneyCents('0')).toBe(0);expect(accountMoneyCents('-2.35')).toBe(-235);
  expect(accountCashPosition({}, {...params,opening:''}).balanceCents).toBeNull();
  expect(accountCashPosition({}, {...params,opening:'0'}).balanceCents).toBe(0);
 });
 it('inclui os dois limites e isola a conta sem duplicar títulos pagos',()=>{
  const data={transacoes:[movement('before','2026-09-30',99),movement('start','2026-10-01',20),movement('end','2026-10-31',-5),movement('future','2026-11-01',33),movement('other','2026-10-02',55,{contaBancariaId:'b'})],notasFiscais:[{valorBruto:20,status:'paga'}]};
  const original=structuredClone(data),result=accountCashPosition(data,params);
  expect(result).toMatchObject({balanceCents:11500,incoming:2000,outgoing:500,canCalculate:true});
  expect(result.movements.map(m=>m.transaction.id)).toEqual(['start','end']);expect(data).toEqual(original);
 });
 it('trata transferência pela perna bancária, sem gerar receita ou despesa',()=>{
  const data={transacoes:[movement('out','2026-10-02',-20),movement('in','2026-10-02',20,{contaBancariaId:'b'})]};
  expect(accountCashPosition(data,params).balanceCents).toBe(8000);
  expect(accountCashPosition(data,{...params,accountId:'b',opening:'0'}).balanceCents).toBe(2000);
 });
 it('mantém ignorados e arquivados no caixa e inclui parciais nas pendências',()=>{
  const result=accountCashPosition({transacoes:[movement('pending','2026-10-02',10),movement('partial','2026-10-02',-2,{status:'parcial'}),movement('done','2026-10-02',-1,{status:'conciliado'}),movement('ignored','2026-10-02',-3,{status:'ignorado'}),movement('archived','2026-10-02',5,{arquivado:true}),movement('deleted','2026-10-02',999,{deletedAt:'2026-10-03'})]},params);
  expect(result.balanceCents).toBe(10900);expect(result.pending.map(m=>m.transaction.id)).toEqual(['pending','partial','archived']);expect(result.partial).toHaveLength(1);expect(result.ignored).toHaveLength(1);
 });
 it('recusa datas invertidas, calendário inválido e movimentos ambíguos',()=>{
  expect(accountCashPosition({}, {...params,openingDate:'2026-11-01'}).canCalculate).toBe(false);
  expect(accountCashPosition({}, {...params,referenceDate:'2026-02-30'}).canCalculate).toBe(false);
  for(const transacoes of [[movement('x','',1)],[movement('x','2026-10-02','abc')],[movement('x','2026-10-02',1),movement('x','2026-10-03',1)]]){
   const result=accountCashPosition({transacoes},params);expect(result.balanceCents).toBeNull();expect(result.issues).toHaveLength(1);
  }
 });
 it('muda recorte e pendências com a referência e não usa accountId genérico',()=>{
  const transacoes=[movement('first','2026-10-01',1),movement('next','2026-10-03',2),movement('generic','2026-10-02',9,{contaBancariaId:undefined,accountId:'a'})];
  const result=accountCashPosition({transacoes},{...params,referenceDate:'2026-10-02'});
  expect(result.pending).toHaveLength(1);expect(result.balanceCents).toBe(10100);
 });
 it('enriquece um movimento com origens diretas e rateios ativos sem duplicá-lo',()=>{
  const transaction=movement('t','2026-10-02',-10,{descricao:'PIX QA'});
  const data={obras:[{id:'work',name:'Obra QA'}],notasFiscais:[{id:'nf',obraId:'work',documentos:[{url:'https://example.test/nf.pdf'}]}],reconciliationLinks:[{transactionId:'t',eventId:'allocated',status:'active'}]};
  const ledger={events:[{id:'direct',sourceType:'nota_fiscal',sourceId:'nf',transactionId:'t',obraId:'work'},{id:'allocated',sourceType:'nota_fiscal',sourceId:'nf',obraId:'work'}]};
  const entries=accountMovementEntries(data,ledger,[{transaction,cents:-1000}]);
  expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({amountCents:-1000,obra:'Obra QA',record:transaction});expect(entries[0].metadata.origens).toHaveLength(2);expect(entries[0].metadata.origens[0].record.documentos[0].url).toContain('nf.pdf');
 });
});
