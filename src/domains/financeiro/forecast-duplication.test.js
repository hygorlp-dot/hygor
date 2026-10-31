import {describe,it,expect} from 'vitest';
import {forecastDuplicationWarnings as warnings} from './forecast-duplication.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {costPlanningFingerprint} from './cost-control.js';
import {workStageCosts} from './work-stage-costs.js';
import {buildFinancialLedger} from './ledger.js';

const budget={id:'b',obraId:'w',etapas:[{id:'s',nome:'Acabamentos'},{id:'child',parentId:'s'},{id:'other',nome:'Estrutura'}],itens:[]};
const change=(id='a',extra={})=>({id,numero:1,descricao:'Porcelanato da sala',valor:12000,prazoDias:5,status:'proposto',etapaId:'s',impactoCustoRestante:8000,impactoNaPrevisao:'adicional',...extra});
const revision=(version,remainingCents,extra={})=>({version,budgetId:'b',stageId:'s',remainingCents,note:'Serviços restantes conferidos',...extra});
const fixture=(extra={})=>({id:'w',name:'Casa',contractValue:200000,aditivosContrato:[change()],costPlanning:{version:2,stages:{s:revision(2,7800000)},history:[revision(1,7000000),revision(2,7800000)]},...extra});
const cover=(mode,remainingCents=7800000,amountCents=800000)=>({a:{mode,amountCents,remainingCents}});

describe('indícios de duplicidade entre aditivos e previsão',()=>{
 it('identifica aumento igual ao impacto e conserva os dados e valores',()=>{
  const work=fixture(),before=structuredClone(work),result=warnings(work,budget);
  expect(result).toHaveLength(1);expect(result[0]).toMatchObject({blocking:false,reason:'remaining_delta',amendmentIds:['a'],amountCents:800000});expect(work).toEqual(before);
 });
 it('valores iguais sem aumento, declaração ou premissa de inclusão não são prova',()=>{
  const work=fixture();work.costPlanning.history=[revision(2,7800000)];expect(warnings(work,budget)).toEqual([]);
 });
 it('compara custo restante do aditivo, não preço comercial nem reserva de risco',()=>{
  const work=fixture();work.costPlanning.stages.s.remainingCents=8200000;work.costPlanning.stages.s.contingencyCents=800000;expect(warnings(work,budget)).toEqual([]);
 });
 it('reconhece declaração estruturada de inclusão sem depender de texto ou delta',()=>{
  const work=fixture();work.costPlanning.stages.s.amendmentCoverage=cover('included');
  expect(warnings(work,budget)).toMatchObject([{reason:'declared_included'}]);
 });
 it('conferência explícita de custo separado resolve coincidência sem alterar o cálculo',()=>{
  const work=fixture();work.costPlanning.stages.s.amendmentCoverage=cover('separate');expect(warnings(work,budget)).toEqual([]);expect(work.costPlanning.stages.s.remainingCents).toBe(7800000);
 });
 it('valor restante ou impacto mudado exige nova conferência',()=>{
  const work=fixture();work.costPlanning.stages.s.amendmentCoverage=cover('separate',7000000);expect(warnings(work,budget)).toHaveLength(1);
  work.costPlanning.stages.s.amendmentCoverage=cover('separate',7800000,700000);expect(warnings(work,budget)).toHaveLength(1);
 });
 it('revisões sem mudança no restante não apagam indício ainda não conferido',()=>{
  const work=fixture();work.costPlanning.version=3;work.costPlanning.stages.s=revision(3,7800000);work.costPlanning.history.push(revision(3,7800000));expect(warnings(work,budget)).toHaveLength(1);
 });
 it('identifica soma de impactos de vários aditivos na mesma etapa',()=>{
  const work=fixture();work.aditivosContrato=[change('a',{impactoCustoRestante:5000}),change('b',{numero:2,descricao:'Rodapés',impactoCustoRestante:3000})];
  expect(warnings(work,budget)).toMatchObject([{reason:'remaining_delta_sum',amendmentIds:['a','b'],amountCents:800000}]);
 });
 it('coincidências individuais ambíguas não somam riscos como se ambos fossem comprovados',()=>{
  const work=fixture();work.aditivosContrato.push(change('b',{numero:2}));expect(warnings(work,budget)).toMatchObject([{amountCents:800000,amendmentIds:['a']},{amountCents:800000,amendmentIds:['b']}]);
 });
 it('não cruza obras, etapas ou orçamentos de revisões anteriores',()=>{
  const work=fixture();work.aditivosContrato[0].etapaId='other';expect(warnings(work,budget)).toEqual([]);
  work.aditivosContrato[0].etapaId='s';work.costPlanning.history[0].budgetId='old';expect(warnings(work,budget)).toEqual([]);
  expect(warnings(fixture({id:'another',aditivosContrato:[]}),budget)).toEqual([]);
 });
 it('considera subetapa pelo primeiro nível e mantém Sem apropriação sem inventar vínculo',()=>{
  const work=fixture();work.aditivosContrato[0].etapaId='child';expect(warnings(work,budget)).toHaveLength(1);
  work.aditivosContrato[0].etapaId='unknown';expect(warnings(work,budget)).toEqual([]);
  work.costPlanning.stages={unassigned:revision(2,7800000,{stageId:'unassigned',budgetId:''})};work.costPlanning.history=[revision(1,7000000,{stageId:'unassigned',budgetId:''})];expect(warnings(work,null)).toHaveLength(1);
 });
 it('ignora impacto já incluído, fora da previsão, zero ou não estimado',()=>{
  for(const extra of [{impactoNaPrevisao:'ja_incluido'},{impactoNaPrevisao:'nao_incluir'},{impactoCustoRestante:0},{impactoCustoRestante:null}])expect(warnings(fixture({aditivosContrato:[change('a',extra)]}),budget)).toEqual([]);
 });
 it('também identifica economia possivelmente abatida duas vezes',()=>{
  const work=fixture();work.aditivosContrato[0].impactoCustoRestante=-8000;work.costPlanning.stages.s.remainingCents=6200000;expect(warnings(work,budget)).toMatchObject([{amountCents:-800000,reason:'remaining_delta'}]);
 });
 it('premissas reconhecem inclusão por descrição ou número, com acentos',()=>{
  for(const note of ['Restante já inclui porcelanato da sala.','Incluído o custo do aditivo 1 no restante.']){
   const work=fixture();work.costPlanning.history=[];work.costPlanning.stages.s.note=note;expect(warnings(work,budget)).toMatchObject([{reason:'premises'}]);
  }
 });
 it('negação, custo separado e número de outro aditivo não geram falso aviso textual',()=>{
  for(const note of ['Não inclui porcelanato da sala.','Não está incluído o aditivo 1.','Sem incluir o aditivo 1.','Piso do aditivo 1 considerado separadamente.','O restante inclui o aditivo 12.']){
   const work=fixture();work.costPlanning.history=[];work.costPlanning.stages.s.note=note;expect(warnings(work,budget)).toEqual([]);
  }
 });
 it('conserva indício mesmo após recusa ou cancelamento se o impacto ainda estiver adicional',()=>{
  for(const status of ['recusado','cancelado'])expect(warnings(fixture({aditivosContrato:[change('a',{status})]}),budget)).toHaveLength(1);
 });
});

describe('comandos reais, avisos e histórico da conferência',()=>{
 const data=()=>({obras:[fixture()],orcamentos:[budget],budgetBaselines:[{obraId:'w',tipo:'controle',budgetId:'b',ativo:true}]});
 const command=(d,extra={})=>({type:'PREVISAO_CONCLUSAO_SALVA',actorId:'admin',actorRole:'admin',idempotencyKey:crypto.randomUUID(),expectedVersion:d.obras[0].costPlanning.version,now:'2026-10-31T15:00:00Z',payload:{obraId:'w',stageId:'s',budgetId:'b',remainingCents:7800000,contingencyCents:500000,asOf:'2026-10-31',fingerprint:costPlanningFingerprint(d,'w'),basis:{incurred:0,committed:0,budget:0},note:'Serviços restantes conferidos',...extra}});
 it('salva com aviso, mantém total e restaura aviso no replay idempotente',()=>{
  const d=data(),c=command(d),result=applyOperationalCommand(d,c);expect(result.ok).toBe(true);expect(result.summary.workflowWarnings).toEqual(expect.arrayContaining([expect.objectContaining({code:'COST_FORECAST_POSSIBLE_DUPLICATION',blocking:false})]));
  expect(workStageCosts(result.data,buildFinancialLedger(result.data),'w','2026-10-31').totals.forecast).toBe(9100000);
  expect(applyOperationalCommand(result.data,c)).toMatchObject({ok:true,idempotent:true,summary:result.summary});
 });
 it('audita conferência sem alterar valor do aditivo ou previsão e rejeita referência de outra obra',()=>{
  const d=data(),result=applyOperationalCommand(d,command(d,{amendmentCoverage:cover('separate')}));expect(result.ok).toBe(true);expect(result.summary.workflowWarnings).toEqual([expect.objectContaining({code:"FORECAST_REVIEW_JUSTIFICATION_MISSING",blocking:false})]);expect(result.data.obras[0].aditivosContrato).toEqual(d.obras[0].aditivosContrato);
  expect(result.data.obras[0].costPlanning.history.at(-1)).toMatchObject({byId:'admin',amendmentCoverage:cover('separate'),remainingCents:7800000});
  expect(applyOperationalCommand(d,command(d,{amendmentCoverage:{foreign:{mode:'included',amountCents:10,remainingCents:7800000}}})).ok).toBe(false);
 });
 it('salvar acompanhamento do aditivo também devolve aviso, sem bloquear a execução',()=>{
  const d=data(),result=applyOperationalCommand(d,{type:'ADITIVO_CONTRATO_SALVO',actorId:'admin',actorRole:'admin',idempotencyKey:crypto.randomUUID(),expectedVersion:0,now:'2026-10-31T15:00:00Z',payload:{obraId:'w',operationalOnly:true,amendment:{id:'a',execucaoStatus:'em_andamento'}}});
  expect(result.ok).toBe(true);expect(result.summary.workflowWarnings.some(w=>w.code==='COST_FORECAST_POSSIBLE_DUPLICATION')).toBe(true);expect(result.data.obras[0].aditivosContrato[0].execucaoStatus).toBe('em_andamento');
 });
});
