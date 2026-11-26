// @vitest-environment node
import {it,expect,afterAll} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {applyOperationalCommand,OPERATIONAL_COMMAND as OP} from '../src/domains/sync/operational-commands.js';
import {montarRecebimento} from '../src/domains/compras/receipt.js';
import {applyReconciliationCommand,RECONCILIATION_COMMAND as RC} from '../server/reconciliation-command.js';
import {buildFinancialLedger,selectDRE,selectCashFlow} from '../src/domains/financeiro/ledger.js';
import {buildRequestedDreProjectionRows} from '../server/dre-projection.js';
import {RECORD_COMMANDS} from '../src/domains/comercial/contracts/record-commands.js';
import {fixture as commercialFixture,recordFixture,files} from '../src/domains/comercial/contracts/record-fixtures.test-helper.js';
import {THIRD_PARTY_COMMAND as TP} from '../src/domains/financeiro/third-party-commands.js';
import {applyAttendanceCommand,ATTENDANCE_COMMAND as ATT} from '../server/attendance-command.js';
import {calculateAttendanceDayCost} from '../src/domains/ponto/payroll.js';
import {buildPayrollTitles,PAYROLL_CLOSING_COMMAND as PC} from '../src/domains/ponto/payroll-closing.js';
import {BASELINE_COMMAND,proposeBaselineSnapshot} from '../src/domains/planejamento/approved-baseline.js';
import {data as planningFixture} from '../scripts/fixtures/spi-data.mjs';
const now='2026-11-17T15:00:00Z',date='2026-11-17';
let seq=0;
const evidence=[];
const command=(type,payload,expectedVersion=0)=>({type,payload,expectedVersion,now,actorId:'admin',actorName:'QA local',actorRole:'admin',idempotencyKey:`roadmap-five-${++seq}`});
const apply=(data,c)=>{const r=applyOperationalCommand(data,c);expect(r.reason).toBeUndefined();expect(r.ok).toBe(true);return r.data;};
const base=()=>({obras:[{id:'a',name:'QA A',contractType:'fixed_labor'},{id:'b',name:'QA B',contractType:'fixed_labor'}],usuarios:[{id:'admin',nome:'QA',role:'admin',active:true}],employees:[],attendance:{},attendanceLocks:{},changeLog:[],config:{laborCharges:{diaristaPercent:0}},materiais:[],fornecedores:[],solicitacoesCompra:[],pedidos:[],movEstoque:[],notasFiscais:[],medicoes:[],medicoesTerc:[],terceirizados:[],pagsTerceiros:[],transacoes:[],historicoConc:[],titulosFolha:[],pagamentosFolha:[],fechamentosFinanceiros:[]});
async function journey(run){const db=new PGlite();await db.exec('create table checkpoints(id int primary key, label text, state jsonb)');let id=0;try{await run(async(label,data)=>{
 const serialized=JSON.parse(JSON.stringify(data));
 await db.query('insert into checkpoints values($1,$2,$3)',[++id,label,JSON.stringify(serialized)]);
 const stored=(await db.query('select state from checkpoints where id=$1',[id])).rows[0].state;
 expect(stored).toEqual(serialized);
 // A different work and previous month must remain untouched throughout the journey.
 const [control,previous]=buildRequestedDreProjectionRows(stored,[{year:2026,month:10,scope:stored.obras.some(w=>w.id==='b')?'b':'w2'},{year:2026,month:9,scope:stored.obras.some(w=>w.id==='a')?'a':'w1'}]);
 expect({controlCost:control.payload.totalCustos,controlRevenue:control.payload.faturamento,previousCost:previous.payload.totalCustos,previousRevenue:previous.payload.faturamento}).toEqual({controlCost:0,controlRevenue:0,previousCost:0,previousRevenue:0});
 evidence.push({label,persistedAndReopened:true,controlScopeUnchanged:true});return stored;
 });}finally{await db.close();}}
function finance(data,{cost=0,revenue=0,out=0,input=0}={}){const ledger=buildFinancialLedger(data),dre=selectDRE(ledger,{obraId:'a'}),cash=selectCashFlow(ledger,{obraId:'a'});expect([dre.costCents,dre.revenueCents,cash.cashOutCents,cash.cashInCents]).toEqual([cost,revenue,out,input]);}
it('compra, entrega convertida, nota, pagamento e conciliação persistem sem repetir custo',async()=>journey(async save=>{
 let data=base();data.materiais=[{id:'mat',unidade:'KG'}];data.fornecedores=[{id:'forn',nome:'QA'}];
 const c=command(OP.PURCHASE_ORDER_SAVED,{order:{id:'pc',numero:'PC-QA',obraId:'a',fornecedorId:'forn',data:date,status:'enviado',itens:[{id:'line',materialId:'mat',qtd:2,precoUnit:100,unidadeRef:'KG',unidadeCompra:'SC',fatorConversao:50}]}});
 data=await save('Pedido: compromisso sem custo',apply(data,c));finance(data);
 let ids=0;const receipt=montarRecebimento(data.pedidos[0],{line:2},{quando:date,novoId:()=>`stock-${++ids}`});expect(receipt.ok).toBe(true);
 data=await save('Entrega: 2 SC = 100 KG, sem custo',apply(data,command(OP.PURCHASE_RECEIPT_RECORDED,{pedidoId:'pc',receivedQuantities:receipt.receivedQuantities,stockEntries:receipt.stockEntries},data.pedidos[0].version)));expect(data.movEstoque[0]).toMatchObject({qtd:100,valorUnit:2});finance(data);
 data=await save('Nota: custo reconhecido 20000 centavos',apply(data,command(OP.INVOICE_SAVED,{invoice:{id:'nf',obraId:'a',pedidoId:'pc',fornecedorId:'forn',numero:'QA-1',tipo:'nfe',emissao:date,vencimento:'2026-11-30',valorBruto:200,retencoes:{},rateios:[],documentos:[]}})));finance(data,{cost:20000});
 const invoiceVersion=data.notasFiscais[0].version;
 const payment=(id,valor,version)=>command(OP.PAYABLE_PAYMENT_RECORDED,{targetType:'nota',targetId:'nf',payment:{id,valor,data:date,origem:'empresa'}},version);
 const first=payment('pay',80,invoiceVersion);
 data=await save('Pagamento parcial: caixa 8000 e custo preservado',apply(data,first));finance(data,{cost:20000,out:8000});
 const partial=JSON.stringify(data);
 expect(applyOperationalCommand(data,payment('pay-restante',120,invoiceVersion)).ok).toBe(false);
 expect(JSON.stringify(data)).toBe(partial);
 data=await save('Pagamento complementar após reler a nota',apply(data,payment('pay-restante',120,data.notasFiscais[0].version)));finance(data,{cost:20000,out:20000});
 expect(applyOperationalCommand(data,first).idempotent).toBe(true);
 for(const [id,valor,paymentId] of [['bank',-80,'pay'],['bank-restante',-120,'pay-restante']]){
  data.transacoes.push({id,valor,data:date,status:'pendente',fitid:`QA-${id}`});
  const r=applyReconciliationCommand(data,{type:RC.LINK_EXISTING_PAYMENT,payload:{transactionId:id,targetType:'nota',targetId:'nf',paymentId}},{id:'admin',role:'admin',nome:'QA'});
  expect(r.resumo.ok).toBe(true);
  data=await save('Conciliação: pagamento original, sem novo custo',r.data);finance(data,{cost:20000,out:20000});
 }
 expect(data.notasFiscais[0].pagamentos).toHaveLength(2);
 expect(applyOperationalCommand(data,c).idempotent).toBe(true);
 const before=JSON.stringify(data);expect(applyOperationalCommand(data,command(OP.INVOICE_SAVED,{invoice:{...data.notasFiscais[0],id:'duplicate'}})).ok).toBe(false);expect(JSON.stringify(data)).toBe(before);
}),30000);
it('comercial aprova e sincroniza a obra por ID sem criar receita nem alterar a obra',async()=>journey(async save=>{
 let data=commercialFixture();const works=structuredClone(data.obras);data=await save('Comercial: contrato vinculado a cliente e obra',apply(data,command(RECORD_COMMANDS.SAVE,{id:'contract',record:recordFixture(),files:files()})));
 data=await save('Contrato: dados da obra conferidos explicitamente',apply(data,command(RECORD_COMMANDS.LINK_WORK,{id:'contract',fields:['area_construida'],workVersion:2},1)));
 const reviewed=structuredClone(data.commercialContractRecords[0]);reviewed.confirmacoes.obra=true;reviewed.confirmacoes.comercial=true;reviewed.cgrManual=true;reviewed.dados.prazos.motivo_cgr_manual='Valor negociado e conferido pelo operador QA';
 data=apply(data,command(RECORD_COMMANDS.SAVE,{id:'contract',record:reviewed,files:files()},reviewed.version));
 for(const [type,payload] of [[RECORD_COMMANDS.REVIEW,{}],[RECORD_COMMANDS.DECIDE,{approve:true}]])data=await save(`Contrato: ${type}`,apply(data,command(type,{id:'contract',...payload},data.commercialContractRecords[0].version)));
 const contract=data.commercialContractRecords[0];expect(contract).toMatchObject({obraId:'w1',clienteId:'c1',status:'aprovado'});expect(Number(contract.dados.obra.area_construida)).toBe(120);expect(contract.history.length).toBeGreaterThan(2);expect(data.obras).toEqual(works);expect(selectDRE(buildFinancialLedger(data),{}).revenueCents).toBe(0);
}),30000);
it('terceirizado: rascunho, aprovação e pagamento preservam autoria e custo único',async()=>journey(async save=>{
 let data=base();data.terceirizados=[{id:'terc',name:'QA Prestador',obraId:'a',active:true,etapas:[{id:'stage',nome:'Execução',valor:1000}]}];
 data=await save('Terceiro: rascunho sem custo',apply(data,command(TP.THIRD_PARTY_MEASUREMENT_RECORDED,{measurement:{id:'tm',tercId:'terc',obraId:'a',data:date,total:500,itens:[{etapaId:'stage',pctAnterior:0,pctAcum:50,valor:500}],fotos:[{id:'photo',url:'https://example.invalid/qa'}]}})));finance(data);
 expect(applyOperationalCommand(data,command(TP.THIRD_PARTY_MEASUREMENT_PAID,{measurementId:'tm',payment:{id:'early',date,pagador:'empresa'}},1)).ok).toBe(false);
 data=await save('Terceiro: aprovação reconhece custo 50000',apply(data,command(TP.THIRD_PARTY_MEASUREMENT_APPROVED,{measurementId:'tm'},1)));finance(data,{cost:50000});
 data=await save('Terceiro: pagamento não repete custo',apply(data,command(TP.THIRD_PARTY_MEASUREMENT_PAID,{measurementId:'tm',payment:{id:'tp',date,pagador:'empresa'}},2)));finance(data,{cost:50000,out:50000});expect(data.medicoesTerc[0]).toMatchObject({createdById:'admin',aprovadoPorId:'admin',pagamentoId:'tp'});expect(data.pagsTerceiros[0].medicaoTercId).toBe('tm');
}),30000);
it('ponto confirmado alimenta custo; fechamento da folha cria obrigação sem repetir custo',async()=>journey(async save=>{
 let data=base();data.employees=[{id:'person',name:'QA Pessoa',obra:'a',workArea:'campo',active:true,startDate:date,endDate:date,dailyRate:150,vtDaily:0,vrDaily:0,remunerationMode:'daily'}];
 const r=applyAttendanceCommand(data,{id:'admin',role:'admin',nome:'QA'},{action:ATT.UPSERT,operationId:'20000000-0000-4000-8000-000000000005',employeeId:'person',date,selectedObraId:'a',record:{status:'P',ot:0,obraId:'a'},confirmDailyCheck:true},now);expect(r.ok).toBe(true);
 data=await save('Ponto: presença efetivamente registrada',r.data);const day=calculateAttendanceDayCost({employee:data.employees[0],record:data.attendance.person[date],config:data.config});expect(day.totalCost).toBe(150);
 const project=state=>buildRequestedDreProjectionRows(state,[{year:2026,month:10,scope:'a'}])[0].payload;
 expect(project(data).totalCustos).toBe(150);
 const titles=buildPayrollTitles({rows:[{id:'person',name:'QA Pessoa',gross:day.laborCost,vt:0,vr:0,net:day.totalCost,obrasPorDia:[{obraId:'a',obraName:'QA A',netObra:day.totalCost}]}],closingId:'closing-qa',periodKey:'2026-11-Q1',periodoInicio:'2026-11-06',periodoFim:'2026-11-20',vencimento:'2026-11-20',payerForWork:()=> 'construtora'});
 const c=command(PC.PAYROLL_FORTNIGHT_CLOSED,{periodKey:'2026-11-Q1',closingId:'closing-qa',titles});data=await save('Folha: título de 150, custo permanece 150',apply(data,c));expect(data.titulosFolha[0].liquido).toBe(150);expect(project(data).totalCustos).toBe(150);expect(applyOperationalCommand(data,c).idempotent).toBe(true);
}),30000);

it('orçamento de controle chega à medição física e o reenvio mantém avanço, obra e DRE',async()=>journey(async save=>{
 const plan=structuredClone(planningFixture.planos.find(row=>row.obraId==='a'));
 const otherWork={...structuredClone(plan),id:'plano-controle',obraId:'b'};
 let data={...base(),planos:[plan,otherWork],
  orcamentos:structuredClone(planningFixture.orcamentos.filter(row=>row.obraId==='a')),
  budgetBaselines:structuredClone(planningFixture.budgetBaselines.filter(row=>row.obraId==='a')),
 };
 const proposal=proposeBaselineSnapshot(data,'a');
 expect(proposal.ok).toBe(true);
 data=await save('Planejamento: proposta vinculada ao orçamento de controle',apply(data,command(BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED,{
  obraId:'a',id:'planejamento-qa',reason:'Orçamento e calendário conferidos',signature:proposal.signature,
 })));
 data=await save('Planejamento: aprovação congela a versão de controle',apply(data,command(BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED,{obraId:'a',id:'planejamento-qa'},1)));
 const baseline=structuredClone(data.scheduleBaselines[0]);
 expect(baseline.snapshot).toMatchObject({budgetId:'budget-a',budgetCents:12000000});
 const {taskId,budgetCents}=baseline.snapshot.items[0];
 const item={tarefaId:taskId,pctConfirmado:30,custo:budgetCents/100};
 const measurement={id:'medicao-fisica-qa',obraId:'a',data:date,itens:[item]};
 const before=JSON.stringify(data);
 expect(applyOperationalCommand(data,command(OP.TECHNICAL_MEASUREMENT_CREATED,{measurement:{...measurement,itens:[item,item]}})).ok).toBe(false);
 expect(JSON.stringify(data)).toBe(before);
 const register=command(OP.TECHNICAL_MEASUREMENT_CREATED,{measurement});
 data=await save('Medição física: boletim confirmado altera avanço, sem faturamento',apply(data,register));finance(data);
 expect(data.medicoesObra).toMatchObject([{id:measurement.id,obraId:'a',avancoFisico:30}]);
 expect(data.planos[0].tarefas.find(row=>row.id===taskId)).toMatchObject({progresso:30,medicaoTecnicaId:measurement.id});
 expect(data.planos[1]).toEqual(otherWork);
 expect(data.scheduleBaselines[0]).toEqual(baseline);
 const repeated=applyOperationalCommand(data,register);
 expect(repeated).toMatchObject({ok:true,idempotent:true});
 expect(repeated.data).toEqual(data);
 data=await save('Cancelamento: remove avanço projetado e preserva orçamento aprovado',apply(data,command(OP.TECHNICAL_MEASUREMENT_CANCELLED,{measurementId:measurement.id,reason:'Correção da conferência física'},1)));
 expect(data.planos[0].tarefas.find(row=>row.id===taskId)).toMatchObject({progresso:0,medicaoTecnicaId:''});
 expect(data.planos[1]).toEqual(otherWork);
 expect(data.scheduleBaselines[0]).toEqual(baseline);
 finance(data);
}),30000);
afterAll(()=>{
 const report=process.env.MRC_SECTOR_TEST_REPORT||'artifacts/roadmap-usabilidade-etapa5/sector-checkpoints.json';
 mkdirSync(dirname(report),{recursive:true});
 writeFileSync(report,JSON.stringify({syntheticOnly:true,remoteWrites:0,checkpoints:evidence},null,2));
});
