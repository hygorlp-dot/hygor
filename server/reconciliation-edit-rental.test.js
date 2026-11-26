import {describe,it,expect} from 'vitest';
import {applyReconciliationCommand} from './reconciliation-command.js';
import {authorizeReconciliationCommand} from './reconciliation-policy.js';
import {reconciliationEditableEntries,reconciliationClassificationFingerprint} from '../src/domains/conciliacao/classification-edit.js';
import {buildFinancialLedger,selectCashFlow,selectDRE} from '../src/domains/financeiro/ledger.js';
import {buildLegacyFinancialFacts} from './financial-shadow.js';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
import {reconciliationCategories} from '../src/domains/conciliacao/categories.js';

const actor={id:'finance',role:'financeiro'},bank={id:'bank',data:'2026-11-10',valor:500,descricao:'Aluguel recebido',status:'pendente'};
const base=()=>({obras:[{id:'work',name:'Obra'}],transacoes:[{...bank}],payments:[],outrasDesp:[],despesasEmpresa:[],historicoConc:[]});
const command=(type,payload)=>({type,payload:{transactionId:'bank',...payload},idempotencyKey:'rental_reconciliation_0001'});
const allocate=(data,category='receita_servicos')=>applyReconciliationCommand(data,command('CONFIRM_ALLOCATION',{competence:'2026-11',allocations:[{destination:'empresa',category,value:500}]}),actor);
const edit=(data,changes={})=>{const tr=data.transacoes[0];return command('EDIT_CLASSIFICATION',{expectedFingerprint:reconciliationClassificationFingerprint(data,tr),entries:reconciliationEditableEntries(data,tr).map(row=>({...row,...changes}))});};
const companyDre=(data,month=10)=>buildRequestedDreProjectionRows(data,[{year:2026,month,scope:'company_dre',includeMemorial:true}])[0].payload;
const rental=()=>({...base(),equipamentos:[{id:'equipment',nome:'Equipamento',ativo:true,quantidadeTotal:1,tarifas:{dia:100}}],
 locacoesEquip:[{id:'rental',equipamentoId:'equipment',obraId:'work',inicio:'2026-11-01',fim:'2026-11-10',status:'encerrada',quantidade:1}],
 rentalInvoices:[{id:'invoice',rentalId:'rental',workId:'work',number:'LOC-1',competence:'2026-11',version:1,status:'issued',netAmountCents:100000,receivedAmountCents:0,openAmountCents:100000}],rentalInvoiceReceipts:[]});

describe('classificação única da conciliação e DRE',()=>{
 it('oferece locação nova no catálogo da empresa, sem usar categorias de custo da obra',()=>{
   expect(reconciliationCategories(base(),{direction:'entrada',destination:'empresa'})).toContainEqual(expect.objectContaining({id:'receita_locacoes',effect:'revenue'}));
   expect(reconciliationCategories(base(),{direction:'entrada',destination:'obra'}).some(c=>c.id==='receita_locacoes')).toBe(false);
 });
 it('edita o mesmo recebimento e move somente a linha do DRE, mantendo valor, caixa, identidade e vínculo',()=>{
   const before=allocate(base()).data,original=before.payments[0],result=applyReconciliationCommand(before,edit(before,{category:'receita_locacoes',description:'Locação de imóvel'}),actor);
   expect(result.resumo.ok).toBe(true);expect(result.data.payments).toHaveLength(1);
   expect(result.data.payments[0]).toMatchObject({id:original.id,amount:500,date:bank.data,transacaoId:'bank',categoria:'receita_locacoes',description:'Locação de imóvel'});
   expect(result.data.transacoes[0]).toMatchObject({valor:500,data:bank.data,gerados:before.transacoes[0].gerados,status:'conciliado'});
   expect(companyDre(result.data)).toMatchObject({receitaLocacoes:500,receitaCorporativa:0,faturamentoTotal:500,entradasCaixa:500});
   expect(companyDre(before)).toMatchObject({receitaLocacoes:0,receitaCorporativa:500,faturamentoTotal:500});
   const facts=buildLegacyFinancialFacts(result.data,{includeDreSnapshots:false}).facts;
   expect(facts.filter(f=>f.legacyType==='recebimento_avulso')).toHaveLength(1);expect(facts.find(f=>f.legacyType==='recebimento_avulso').legacyId).toBe(original.id);
 });
 it('atualiza competência sem mover a data do caixa nem criar outra receita',()=>{
   const before=allocate(base()).data,result=applyReconciliationCommand(before,edit(before,{competence:'2026-10'}),actor);
   expect(result.resumo.ok).toBe(true);expect(companyDre(result.data,9)).toMatchObject({receitaCorporativa:500,entradasCaixa:0});
   expect(companyDre(result.data,10)).toMatchObject({receitaCorporativa:0,entradasCaixa:500});
 });
 it('recusa estado concorrente, mudança do valor bancário e categoria inválida sem mutar a origem',()=>{
   const before=allocate(base()).data,stale=edit(before);before.payments[0].version=3;
   expect(applyReconciliationCommand(before,stale,actor).resumo.ok).toBe(false);
   for(const patch of [{amount:900},{category:'inventada'},{destination:'obra',obraId:'foreign'}]){
     const snapshot=JSON.stringify(before),result=applyReconciliationCommand(before,edit(before,patch),actor);
     expect(result.resumo.ok).toBe(false);expect(JSON.stringify(before)).toBe(snapshot);
   }
 });
 it('edita a categoria da despesa existente sem gerar outro título ou pagamento',()=>{
   const data=base();data.transacoes[0].valor=-500;
   const before=allocate(data,'software').data,id=before.despesasEmpresa[0].id;
   const result=applyReconciliationCommand(before,edit(before,{category:'aluguel',description:'Aluguel da sede'}),actor);
   expect(result.resumo.ok).toBe(true);expect(result.data.despesasEmpresa).toHaveLength(1);expect(result.data.despesasEmpresa[0]).toMatchObject({id,valor:500,dataPagamento:bank.data,categoria:'aluguel'});
   expect(selectCashFlow(buildFinancialLedger(result.data)).cashOutCents).toBe(50000);
   expect(buildLegacyFinancialFacts(result.data,{includeDreSnapshots:false}).facts.filter(f=>f.legacyType==='despesa_empresa')).toHaveLength(1);
 });
 it('bloqueia a edição de receita vinculada a origem e de competência fechada',()=>{
   const data=allocate(base()).data;data.payments[0].medicaoId='measurement';expect(reconciliationEditableEntries(data,data.transacoes[0])).toEqual([]);
   delete data.payments[0].medicaoId;data.fechamentosFinanceiros=[{competencia:'2026-11',status:'fechado'}];
   expect(applyReconciliationCommand(data,edit(data),actor).resumo.ok).toBe(false);
 });
 it.each(['rh','engenheiro','compras'])('nega a edição e a baixa de locação ao perfil %s',role=>{
   for(const type of ['EDIT_CLASSIFICATION','CONFIRM_RENTAL_RECEIPT'])expect(authorizeReconciliationCommand(base(),command(type,{}),{id:'other',role}).ok).toBe(false);
 });
 it('receita nova de locação reconhece apenas uma vez e conserva o recebimento no mês do banco',()=>{
   const result=allocate(base(),'receita_locacoes');expect(result.resumo.ok).toBe(true);
   expect(companyDre(result.data)).toMatchObject({receitaLocacoes:500,receitaCorporativa:0,faturamentoTotal:500,entradasCaixa:500});
   expect(selectDRE(buildFinancialLedger(result.data),{competence:'2026-11'}).revenueCents).toBe(50000);
 });
});

describe('vínculo de locação existente',()=>{
 it('baixa a fatura e reconhece apenas caixa, sem repetir receita de competência',()=>{
   const before=rental(),originalRevenue=companyDre(before).faturamentoTotal;
   expect(originalRevenue).toBe(1000);
   const result=applyReconciliationCommand(before,command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:1}),actor);
   expect(result.resumo.ok).toBe(true);expect(result.data.rentalInvoices[0]).toMatchObject({receivedAmountCents:50000,openAmountCents:50000,status:'partially_paid'});
   expect(result.data.rentalInvoiceReceipts).toHaveLength(1);expect(result.data.payments).toHaveLength(1);
   expect(result.data.transacoes[0]).toMatchObject({status:'conciliado',valor:500,data:bank.data,vinculo:{tipo:'rentalInvoice',id:'invoice'}});
   expect(companyDre(result.data)).toMatchObject({faturamentoTotal:originalRevenue,receitaLocacoes:1000,entradasCaixa:500});
   const fact=buildLegacyFinancialFacts(result.data,{includeDreSnapshots:false}).facts.find(f=>f.legacyType==='recebimento_avulso');
   expect(fact).toMatchObject({recognizedAmount:0,settlements:[{amount:500}]});
   expect(applyReconciliationCommand(result.data,command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:2}),actor).resumo.ok).toBe(false);
 });
 it('reaproveita recebimento operacional já cadastrado sem somar novamente a baixa',()=>{
   const data=rental();data.rentalInvoices[0]={...data.rentalInvoices[0],receivedAmountCents:50000,openAmountCents:50000,status:'partially_paid'};
   data.rentalInvoiceReceipts=[{id:'old-receipt',invoiceId:'invoice',rentalId:'rental',workId:'work',transactionId:'bank',paymentDate:bank.data,amountCents:50000,status:'confirmed'}];
   const result=applyReconciliationCommand(data,command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:1}),actor);
   expect(result.resumo.ok).toBe(true);expect(result.data.rentalInvoiceReceipts).toEqual(data.rentalInvoiceReceipts);expect(result.data.rentalInvoices).toEqual(data.rentalInvoices);
   expect(selectCashFlow(buildFinancialLedger(result.data)).cashInCents).toBe(50000);
   expect(allocate(data,'receita_locacoes').resumo.ok).toBe(false);
 });
 it('não usa recebimento de outra obra, fatura alterada, valor excedente ou banco já consumido',()=>{
   for(const change of [d=>d.rentalInvoices[0].workId='foreign',d=>d.rentalInvoices[0].openAmountCents=20000,d=>d.payments.push({id:'old',amount:500,date:bank.data,transacaoId:'bank'})]){
     const data=rental();change(data);expect(applyReconciliationCommand(data,command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:1}),actor).resumo.ok).toBe(false);
   }
   expect(applyReconciliationCommand(rental(),command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:0}),actor).resumo.ok).toBe(false);
 });
 it('desfaz somente o recebimento criado pela conciliação e mantém contrato e faturamento',()=>{
   const first=applyReconciliationCommand(rental(),command('CONFIRM_RENTAL_RECEIPT',{invoiceId:'invoice',expectedInvoiceVersion:1}),actor);
   const undone=applyReconciliationCommand(first.data,command('REVERSE_RECONCILIATION',{reason:'Fatura selecionada incorretamente'}),{id:'admin',role:'admin'});
   expect(undone.resumo.ok).toBe(true);expect(undone.data.locacoesEquip).toEqual(first.data.locacoesEquip);
   expect(undone.data.rentalInvoices[0]).toMatchObject({openAmountCents:100000,receivedAmountCents:0,status:'issued'});
   expect(undone.data.rentalInvoiceReceipts[0].status).toBe('cancelled');expect(selectCashFlow(buildFinancialLedger(undone.data)).cashInCents).toBe(0);
 });
});

it('preserva o caixa histórico de despesa anterior ao banco ao editar categoria e competência',()=>{
 const data=base();data.transacoes[0]={...bank,valor:-500,status:'conciliado',vinculo:{tipo:'despesasEmpresa',id:'old'}};
 data.despesasEmpresa=[{id:'old',valor:500,data:'2026-10-20',competencia:'2026-10',pago:true,categoria:'software',descricao:'Software',transacaoId:'bank'}];
 const before=selectCashFlow(buildFinancialLedger(data));
 const result=applyReconciliationCommand(data,edit(data,{category:'aluguel',competence:'2026-11'}),actor);
 expect(result.resumo.ok).toBe(true);expect(result.data.despesasEmpresa[0]).toMatchObject({dataPagamento:'2026-10-20',competencia:'2026-11'});
 expect(selectCashFlow(buildFinancialLedger(result.data)).events.map(e=>[e.id,e.date,e.amountCents])).toEqual(before.events.map(e=>[e.id,e.date,e.amountCents]));
});
it.each(['LINK_EXISTING_PAYMENT','LINK_PARTIAL_CASH','CONFIRM_TRANSFER','CONFIRM_REVERSAL','AUTO_MATCH'])('bloqueia %s quando a locação já consumiu o movimento',type=>{
 const data=rental();data.rentalInvoiceReceipts=[{id:'old',transactionId:'bank',status:'confirmed'}];
 const result=applyReconciliationCommand(data,command(type,{paymentId:'other',counterpartyTransactionId:'second'}),actor);
 expect(result.resumo).toMatchObject({ok:false,motivo:expect.stringContaining('locação')});expect(result.data).toBe(data);
});
it.each(['counterpartyTransactionId','originalTransactionId'])('protege também a contraparte de locação em %s',field=>{
 const data=rental();data.rentalInvoiceReceipts=[{id:'old',transactionId:'other',status:'confirmed'}];
 const result=applyReconciliationCommand(data,command('CONFIRM_TRANSFER',{[field]:'other'}),actor);
 expect(result.resumo).toMatchObject({ok:false,motivo:expect.stringContaining('locação')});expect(result.data).toBe(data);
});
