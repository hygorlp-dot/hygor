import {describe,it,expect} from 'vitest';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {buildFinancialLedger} from './ledger.js';
import {workStageCosts} from './work-stage-costs.js';
import {COST_CONTROL_COMMAND as C,applyCostControlCommand,allocationSuggestions,costPlanningFingerprint} from './cost-control.js';

const fixture=()=>({obras:[{id:'a',name:'Obra Alfa',startDate:'2026-10-01'},{id:'b',name:'Obra Beta'}],
 budgetBaselines:[{obraId:'a',tipo:'controle',ativo:true,budgetId:'budget'}],
 orcamentos:[{id:'budget',obraId:'a',etapas:[{id:'s',nome:'Estrutura'},{id:'p',nome:'Pintura'},{id:'child',nome:'Lajes',parentId:'s'}],itens:[{id:'i',etapaId:'s',descricao:'Concreto usinado',quantidade:1,precoUnit:1000}]}],
 notasFiscais:[{id:'nf',obraId:'a',descricao:'Concreto usinado',numero:'123',emissao:'2026-10-01',competencia:'2026-10',valorBruto:400,status:'aprovada',documentos:[{url:'https://example.com/nota.pdf'}],pagamentos:[{id:'pg',data:'2026-10-02',valor:100}]}],
 outrasDesp:[{id:'d',obraId:'a',descricao:'Concreto usinado',data:'2026-10-01',valor:50}]});
const command=(data,type=C.COST_ALLOCATION_SAVED,extra={})=>({type,expectedVersion:0,actorId:'user',actorName:'Financeiro',idempotencyKey:'cost-control-test-00001',now:'2026-10-30T15:00:00Z',payload:{obraId:'a',budgetId:'budget',stageId:'s',sourceType:'nota_fiscal',sourceId:'nf',sourceSubId:'principal',note:'Conferido com a nota e orçamento',asOf:'2026-10-30',remainingCents:30000,fingerprint:costPlanningFingerprint(data,'a'),...extra}});
const apply=(data,c)=>applyCostControlCommand(data,c.type===C.COST_FORECAST_SAVED?{...c,payload:{...c.payload,basis:c.payload.basis||Object.fromEntries(['incurred','committed','budget'].map(k=>[k,report(data).rows.find(r=>r.id===c.payload.stageId)?.[k]??0]))}}:c,c.now);
const report=data=>workStageCosts(data,buildFinancialLedger(data),'a','2026-10-30');
describe('apropriação assistida e previsão',()=>{
 it('confirma vínculo sem alterar valores, pagamentos ou documentos e conserva o ID do evento',()=>{
  const data=fixture(),before=report(data),c=command(data),r=applyOperationalCommand(data,c);
  expect(r.ok).toBe(true);const saved=r.data.notasFiscais[0];
  expect(saved).toMatchObject({valorBruto:400,status:'aprovada',version:1,rateios:[{id:'principal',obraId:'a',etapaId:'s',valor:400}]});
  expect(saved.pagamentos).toEqual(data.notasFiscais[0].pagamentos);expect(saved.documentos).toEqual(data.notasFiscais[0].documentos);
  expect(saved.costAllocationHistory[0]).toMatchObject({byId:'user',stageId:'s'});
  const after=report(r.data);expect(after.totals.incurred).toBe(before.totals.incurred);expect(after.rows.find(r=>r.id==='s')).toMatchObject({incurred:40000,paid:10000});
  expect(after.rows.find(r=>r.id==='s').entries.incurred[0].id).toBe(before.rows.find(r=>r.id==='unassigned').entries.incurred.find(e=>e.sourceId==='nf').id);
  expect(applyOperationalCommand(r.data,c)).toMatchObject({ok:true,idempotent:true});
 });
 it('muda somente o rateio escolhido e não atribui pagamento multietapas',()=>{
  const d=fixture();d.notasFiscais[0].rateios=[{id:'r1',obraId:'a',valor:100},{id:'r2',obraId:'a',etapaId:'p',valor:300}];
  const r=apply(d,command(d,C.COST_ALLOCATION_SAVED,{sourceSubId:'r1'}));expect(r.ok).toBe(true);
  expect(r.data.notasFiscais[0].rateios[1]).toEqual(d.notasFiscais[0].rateios[1]);
  expect(report(r.data).rows.find(x=>x.id==='unassigned').paid).toBe(10000);
 });
 it('recusa rateio de outra obra e identidade ambígua',()=>{
  const d=fixture();d.notasFiscais[0].rateios=[{id:'other',obraId:'b',valor:400}];
  expect(apply(d,command(d,C.COST_ALLOCATION_SAVED,{sourceSubId:'other'})).ok).toBe(false);
  d.notasFiscais[0].rateios=[{id:'x',obraId:'a',valor:100},{id:'x',obraId:'a',valor:300}];
  expect(apply(d,command(d,C.COST_ALLOCATION_SAVED,{sourceSubId:'x'})).ok).toBe(false);
 });
 it('apropria despesas da obra pela mesma fronteira operacional',()=>{
  const d=fixture(),r=apply(d,command(d,C.COST_ALLOCATION_SAVED,{sourceType:'outra_despesa',sourceId:'d'}));
  expect(r.ok).toBe(true);expect(r.data.outrasDesp[0]).toMatchObject({valor:50,etapaId:'s',version:1});
 });
 it('bloqueia etapa inexistente, subetapa, orçamento trocado ou de outra obra',()=>{
  const d=fixture();for(const p of [{stageId:'deleted'},{stageId:'child'},{budgetId:'old'}])expect(apply(d,command(d,C.COST_ALLOCATION_SAVED,p)).ok).toBe(false);
  d.orcamentos[0].obraId='b';expect(apply(d,command(d)).ok).toBe(false);
 });
 it('bloqueia versão obsoleta, usuário ausente e período fechado por competência',()=>{
  const d=fixture();expect(apply(d,{...command(d),expectedVersion:1}).ok).toBe(false);
  expect(apply(d,{...command(d),actorId:''}).ok).toBe(false);
  d.notasFiscais[0].emissao='2026-11-05';d.fechamentosFinanceiros=[{competencia:'2026-10',status:'fechado'}];
  expect(apply(d,command(d))).toMatchObject({ok:false,reason:expect.stringContaining('fechado')});
 });
 it('sugere somente correspondência idêntica de uma única etapa',()=>{
  const d=fixture(),s=allocationSuggestions(d,report(d),'a');expect(s.find(x=>x.entry.sourceId==='nf').suggestedStageId).toBe('s');
  d.orcamentos[0].itens.push({id:'p2',etapaId:'p',descricao:'Concreto usinado'});
  expect(allocationSuggestions(d,report(d),'a').find(x=>x.entry.sourceId==='nf').suggestedStageId).toBe('');
 });
 it('salva zero como restante explícito, auditado, sem criar pagamento ou custo',()=>{
  const d=fixture(),c=command(d,C.COST_FORECAST_SAVED,{remainingCents:0}),r=apply(d,c);
  expect(r.ok).toBe(true);expect(r.data.notasFiscais).toBe(d.notasFiscais);
  expect(r.data.obras[0].costPlanning).toMatchObject({version:1,stages:{s:{remainingCents:0,byId:'user',asOf:'2026-10-30'}}});
  expect(report(r.data).rows.find(x=>x.id==='s')).toMatchObject({reviewValid:true,remaining:0,forecast:0});
 });
 it('revisão substitui somente o restante e não soma compras nem pagamentos',()=>{
  let d=fixture();d=apply(d,command(d)).data;
  const r=apply(d,command(d,C.COST_FORECAST_SAVED,{remainingCents:30000}));
  expect(report(r.data).rows.find(x=>x.id==='s')).toMatchObject({incurred:40000,paid:10000,remaining:30000,forecast:70000,deviation:-30000,reviewValid:true});
 });
 it('mudança nas fontes ou na data invalida revisão sem apagar o histórico',()=>{
  const d=fixture(),r=apply(d,command(d,C.COST_FORECAST_SAVED));
  r.data.outrasDesp.push({id:'new',obraId:'a',valor:20,data:'2026-10-30'});
  expect(report(r.data).rows.find(x=>x.id==='s')).toMatchObject({reviewValid:false,remaining:100000});
  expect(r.data.obras[0].costPlanning.history).toHaveLength(1);
  const unchanged=apply(d,command(d,C.COST_FORECAST_SAVED)).data;
  expect(workStageCosts(unchanged,buildFinancialLedger(unchanged),'a','2026-10-31').rows.find(x=>x.id==='s').reviewValid).toBe(false);
 });
 it('não aceita salvar base obsoleta, valores inválidos ou data impossível/futura',()=>{
  const d=fixture();for(const p of [{fingerprint:'old'},{remainingCents:-1},{remainingCents:NaN},{remainingCents:1.5},{asOf:'2026-02-30'},{asOf:'2026-10-31'},{note:'x'}])expect(apply(d,command(d,C.COST_FORECAST_SAVED,p)).ok).toBe(false);
  const r=apply(d,command(d,C.COST_FORECAST_SAVED));expect(apply(r.data,command(r.data,C.COST_FORECAST_SAVED))).toMatchObject({ok:false,reason:expect.stringContaining('outra pessoa')});
 });
 it('escopo servidor exige papel e obra compatíveis nos dois comandos',()=>{
  const data=fixture();for(const type of Object.values(C)){
    const c=command(data,type),scope=user=>validateOperationalCommandScope({user,data,command:c});
    expect(scope({role:'financeiro',obraId:'a'}).ok).toBe(true);expect(scope({role:'admin'}).ok).toBe(true);
    expect(scope({role:'financeiro',obraId:'b'}).ok).toBe(false);expect(scope({role:'engenheiro',obraId:'a'}).ok).toBe(false);
  }
 });
 it('normalização de nomes e defaults não altera a identidade econômica da revisão',()=>{
  const d=fixture(),normalized=structuredClone(d);
  normalized.orcamentos[0].etapas[0].nome='ESTRUTURA';normalized.notasFiscais[0].documentos=[];
  normalized.outrasDesp[0]={...normalized.outrasDesp[0],etapaId:'',orcNivel1Id:'',version:0,pago:false};
  expect(costPlanningFingerprint(normalized,'a')).toBe(costPlanningFingerprint(d,'a'));
 });
 it('mudança de custo suplementar invalida a base numérica mesmo com fatos principais iguais',()=>{
  const d=fixture(),r=apply(d,command(d,C.COST_FORECAST_SAVED));
  const ledger=buildFinancialLedger(r.data,{supplementalEvents:[{id:'supplement',effect:'cost',obraId:'a',date:'2026-10-30',competence:'2026-10',amountCents:1000,sourceType:'outra_despesa',sourceId:'d',metadata:{etapaId:'s'}}]});
  const row=workStageCosts(r.data,ledger,'a','2026-10-30').rows.find(x=>x.id==='s');
  expect(row.reviewValid).toBe(false);expect(row.remaining).toBe(99000);
 });
 it('notas legadas preservam reconhecimento ao materializar o rateio principal',()=>{
  const d=fixture();delete d.notasFiscais[0].valorBruto;d.notasFiscais[0].valorTotal=400;
  const r=apply(d,command(d));expect(r.ok).toBe(true);expect(report(r.data).totals.incurred).toBe(report(d).totals.incurred);
 });
});
