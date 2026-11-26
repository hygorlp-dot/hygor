// @vitest-environment node
import {afterAll,beforeAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync} from 'node:fs';
import {buildLegacyFinancialFacts} from './financial-shadow.js';
import {applyReconciliationCommand} from './reconciliation-command.js';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
import {buildFinancialLedger,selectCashFlow} from '../src/domains/financeiro/ledger.js';
import {reconciliationEditableEntries,reconciliationClassificationFingerprint} from '../src/domains/conciliacao/classification-edit.js';

const actor={id:'test-finance',role:'financeiro'};
let db;
const sync=async(company,data)=>db.query('select financial_sync_legacy_facts($1,$2,$3::jsonb)',[
  company,actor.id,JSON.stringify(buildLegacyFinancialFacts(data,{includeDreSnapshots:false})),
]);
const rows=async(company,table)=>(await db.query(`select * from ${table} where company_id=$1 order by id`,[company])).rows;
const image=async company=>{
  const result={};
  for(const table of ['financial_titles','settlements','reconciliation_links','bank_transactions','financial_events','legacy_record_links'])result[table]=await rows(company,table);
  return result;
};
const ids=state=>Object.fromEntries(['financial_titles','settlements','reconciliation_links','bank_transactions'].map(table=>[table,state[table].map(row=>row.id)]));
const isoDate=value=>new Date(value).toISOString().slice(0,10);
const edit=(data,patch)=>{
  const transaction=data.transacoes[0];
  const result=applyReconciliationCommand(data,{type:'EDIT_CLASSIFICATION',idempotencyKey:'sql_edit_classification_0001',payload:{
    transactionId:transaction.id,expectedFingerprint:reconciliationClassificationFingerprint(data,transaction),
    entries:reconciliationEditableEntries(data,transaction).map(row=>({...row,...patch})),
  }},actor);
  expect(result.resumo.ok).toBe(true);
  return result.data;
};
const expense=()=>({obras:[],transacoes:[{id:'bank',data:'2026-11-10',valor:-275,status:'conciliado',vinculo:{tipo:'despesasEmpresa',id:'expense'},gerados:[]}],
  despesasEmpresa:[{id:'expense',valor:275,data:'2026-10-20',competencia:'2026-10',categoria:'software',descricao:'Original',pago:true,transacaoId:'bank'}]});

beforeAll(async()=>{
  db=new PGlite({extensions:{pgcrypto}});
  await db.exec('create role service_role;');
  for(const file of ['20260725_financial_engine.sql','001_sync_legacy_financial.up.sql'])await db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
},30000);
afterAll(async()=>db?.close());

it('edita despesa no SQL mantendo título, liquidação, vínculo, caixa anterior ao banco e outra empresa',async()=>{
  const before=expense();
  // IDs legados idênticos nas duas empresas precisam permanecer isolados.
  await sync('mrc',before);const otherCompany=await image('mrc');
  await sync('arcd',before);const original=await image('arcd');
  const after=edit(before,{category:'aluguel',description:'Aluguel da sede',competence:'2026-11'});
  await sync('arcd',after);await sync('arcd',after);
  const actual=await image('arcd');
  expect(ids(actual)).toEqual(ids(original));
  expect(actual.financial_titles).toHaveLength(1);
  expect(actual.financial_titles[0]).toMatchObject({original_amount:'275.00',status:'settled',metadata:{categoria:'aluguel',legacyId:'expense'}});
  expect(actual.settlements).toHaveLength(1);
  expect(actual.settlements[0]).toMatchObject({amount:'275.00',status:'active'});
  expect(isoDate(actual.settlements[0].settlement_date)).toBe('2026-10-20');
  expect(actual.reconciliation_links).toHaveLength(1);
  expect(actual.reconciliation_links[0].status).toBe('active');
  expect(actual.reconciliation_links[0]).toMatchObject({title_id:actual.financial_titles[0].id,settlement_id:actual.settlements[0].id,bank_transaction_id:actual.bank_transactions[0].id});
  expect(isoDate(actual.bank_transactions[0].booking_date)).toBe('2026-11-10');
  expect(buildFinancialLedger(after).events.filter(event=>event.effect==='cash_out').map(event=>({id:event.id,date:event.date,amountCents:event.amountCents})))
    .toEqual(buildFinancialLedger(before).events.filter(event=>event.effect==='cash_out').map(event=>({id:event.id,date:event.date,amountCents:event.amountCents})));
  expect(await image('mrc')).toEqual(otherCompany);
});

it('reclassifica receita e competência no SQL sem trocar IDs, data de recebimento ou duplicar receita',async()=>{
  const before={obras:[],transacoes:[{id:'income-bank',data:'2026-11-10',valor:500,status:'conciliado',gerados:[{tipo:'payments',id:'receipt',entidadeId:'receipt'}]}],
    payments:[{id:'receipt',amount:500,date:'2026-11-10',competencia:'2026-11',description:'Serviço',categoria:'receita_servicos',efeitoDRE:'receita',transacaoId:'income-bank',conciliado:true}]};
  await sync('income',before);const original=await image('income');
  const after=edit(before,{category:'receita_locacoes',description:'Aluguel',competence:'2026-10'});
  await sync('income',after);await sync('income',after);
  const actual=await image('income');
  expect(ids(actual)).toEqual(ids(original));
  expect(actual.financial_titles).toHaveLength(1);
  expect(actual.financial_titles[0].status).toBe('settled');
  expect(actual.financial_titles[0].metadata.categoria).toBe('receita_locacoes');
  expect(actual.settlements).toHaveLength(1);
  expect(actual.settlements[0]).toMatchObject({title_id:actual.financial_titles[0].id,status:'active',amount:'500.00'});
  expect(isoDate(actual.settlements[0].settlement_date)).toBe('2026-11-10');
  const revenue=actual.financial_events.filter(row=>row.event_type==='revenue_recognized'&&row.payload.active!==false);
  expect(revenue).toHaveLength(1);expect(Number(revenue[0].payload.amount)).toBe(500);
  expect(isoDate(revenue[0].effective_date)).toBe('2026-10-01');
  expect(selectCashFlow(buildFinancialLedger(after)).cashInCents).toBe(50000);
});

it('baixa fatura existente e nova locação geram um caixa cada, com receita nova reconhecida só uma vez',async()=>{
  const initial={obras:[{id:'work',name:'Obra'}],payments:[],historicoConc:[],
    equipamentos:[{id:'equipment',nome:'Equipamento',ativo:true,quantidadeTotal:1,tarifas:{dia:100}}],
    locacoesEquip:[{id:'rental',equipamentoId:'equipment',obraId:'work',inicio:'2026-11-01',fim:'2026-11-10',status:'encerrada',quantidade:1}],
    rentalInvoices:[{id:'invoice',rentalId:'rental',workId:'work',number:'LOC-1',competence:'2026-11',version:1,status:'issued',netAmountCents:100000,receivedAmountCents:0,openAmountCents:100000}],rentalInvoiceReceipts:[],
    transacoes:[{id:'rental-bank',data:'2026-11-10',valor:500,status:'pendente'},{id:'new-bank',data:'2026-11-11',valor:600,status:'pendente'}]};
  const linked=applyReconciliationCommand(initial,{type:'CONFIRM_RENTAL_RECEIPT',idempotencyKey:'sql_rental_link_0001',payload:{transactionId:'rental-bank',invoiceId:'invoice',expectedInvoiceVersion:1}},actor);
  expect(linked.resumo.ok).toBe(true);
  const allocated=applyReconciliationCommand(linked.data,{type:'CONFIRM_ALLOCATION',idempotencyKey:'sql_new_rental_0001',payload:{transactionId:'new-bank',competence:'2026-11',allocations:[{destination:'empresa',category:'receita_locacoes',value:600}]}},actor);
  expect(allocated.resumo.ok).toBe(true);
  await sync('rentals',allocated.data);const original=await image('rentals');
  await sync('rentals',allocated.data);const actual=await image('rentals');
  expect(ids(actual)).toEqual(ids(original));
  expect(actual.financial_titles).toHaveLength(2);expect(actual.settlements).toHaveLength(2);expect(actual.reconciliation_links).toHaveLength(2);
  const revenue=actual.financial_events.filter(row=>row.event_type==='revenue_recognized'&&row.payload.active!==false);
  expect(revenue).toHaveLength(1);expect(Number(revenue[0].payload.amount)).toBe(600);
  expect(actual.settlements.reduce((sum,row)=>sum+Number(row.amount),0)).toBe(1100);
  expect(allocated.data.rentalInvoiceReceipts).toHaveLength(1);
  expect(allocated.data.rentalInvoices[0].receivedAmountCents).toBe(50000);
  const dre=buildRequestedDreProjectionRows(allocated.data,[{year:2026,month:10,period:'mes',scope:'company_dre'}])[0].payload;
  expect(dre).toMatchObject({receitaLocacoes:1600,faturamentoTotal:1600,entradasCaixa:1100});
});
