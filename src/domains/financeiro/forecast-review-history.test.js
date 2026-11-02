import {describe,it,expect} from 'vitest';
import {snapshotAmendmentReviews,forecastReviewHistory} from './forecast-review-history.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {costPlanningFingerprint} from './cost-control.js';

const budget={id:'b',obraId:'w',etapas:[{id:'s',nome:'Acabamentos'}],itens:[]};
const work=()=>({id:'w',name:'Casa',aditivosContrato:[{id:'a',numero:1,descricao:'Porcelanato da sala',etapaId:'s',impactoCustoRestante:8000,impactoNaPrevisao:'adicional',status:'aprovado'}]});
const coverage=(mode='separate',justification='Piso fora dos serviços estimados')=>({a:{mode,amountCents:800000,remainingCents:7800000,...(justification?{justification}:{})}});
const revision=(version=1,extra={})=>({version,budgetId:'b',stageId:'s',remainingCents:7800000,at:'2026-10-31T15:00:00Z',by:'Ana',byId:'ana',note:'Premissas originais',amendmentCoverage:coverage(),...extra});
const fixture=()=>({obras:[work(),{id:'other'}],orcamentos:[budget],budgetBaselines:[{obraId:'w',tipo:'controle',ativo:true,budgetId:'b'}]});
const command=(data,extra={})=>({type:'PREVISAO_CONCLUSAO_SALVA',actorId:'ana',actorName:'Eng. Ana',actorRole:'admin',idempotencyKey:crypto.randomUUID(),expectedVersion:data.obras[0].costPlanning?.version||0,now:'2026-10-31T15:00:00Z',payload:{obraId:'w',budgetId:'b',stageId:'s',remainingCents:7800000,contingencyCents:500000,basis:{incurred:0,committed:0,budget:0},asOf:'2026-10-31',fingerprint:costPlanningFingerprint(data,'w'),amendmentCoverage:coverage(),note:'Custos dos demais serviços; piso separado',...extra}});

describe('histórico de conferência das duplicidades',()=>{
 it('retrata decisão, valores, descrição e etapa sem depender de nomes futuros',()=>{
  const w=work(),r=revision(),details=snapshotAmendmentReviews(w,budget,r);
  expect(details[0]).toMatchObject({amendmentId:'a',amendmentNumber:1,description:'Porcelanato da sala',stageLabel:'Acabamentos',mode:'separate',justification:'Piso fora dos serviços estimados',basisCurrent:true});
  w.aditivosContrato[0].descricao='Nome alterado';budget.etapas[0].nome='Novo nome';
  expect(details[0].description).toBe('Porcelanato da sala');expect(details[0].stageLabel).toBe('Acabamentos');budget.etapas[0].nome='Acabamentos';
 });
 it('lê registros antigos sem inventar responsável, data ou justificativa individual',()=>{
  const w=work();w.costPlanning={history:[revision(1,{at:'',by:'',byId:'',amendmentCoverage:coverage('included','')})]};
  expect(forecastReviewHistory(w)[0]).toMatchObject({legacy:true,at:'',by:'',justification:'',premises:'Premissas originais',mode:'included'});
 });
 it('não duplica uma revisão atual presente no histórico e ordena pela versão',()=>{
  const w=work(),r=revision();w.costPlanning={stages:{s:r},history:[r,revision(2)]};
  expect(forecastReviewHistory(w).map(row=>row.version)).toEqual([2,1]);
 });
 it('prefere o registro persistido e recupera revisões legadas ainda disponíveis',()=>{
  const w=work(),r=revision(2);w.costPlanning={history:[revision(1),r],amendmentReviewHistory:[{...snapshotAmendmentReviews(w,budget,r)[0],version:2,at:r.at,by:r.by,legacy:false}]};
  const rows=forecastReviewHistory(w);expect(rows).toHaveLength(2);expect(rows.map(row=>row.legacy)).toEqual([false,true]);
 });
 it('registra quando a decisão carregada é de uma base anterior',()=>{
  expect(snapshotAmendmentReviews(work(),budget,revision(1,{remainingCents:7900000}))[0].basisCurrent).toBe(false);
 });
 it('retorna vazio em obra sem conferência e não mistura outras obras',()=>{
  const d=fixture();d.obras[0].costPlanning={history:[revision()]};expect(forecastReviewHistory(d.obras[1])).toEqual([]);expect(forecastReviewHistory()).toEqual([]);
 });
 it('grava autor e data do comando e conserva decisões anteriores e valores reais',()=>{
  let d=fixture();const before=structuredClone(d),first=applyOperationalCommand(d,command(d));expect(first.ok).toBe(true);d=first.data;
  const c=command(d,{amendmentCoverage:coverage('included','Piso incorporado ao restante')});c.actorId='bruno';c.actorName='Bruno';c.now='2026-10-31T16:30:00Z';
  const second=applyOperationalCommand(d,c);expect(second.ok).toBe(true);
  expect(forecastReviewHistory(second.data.obras[0])).toMatchObject([{by:'Bruno',byId:'bruno',at:'2026-10-31T16:30:00Z',mode:'included',justification:'Piso incorporado ao restante'},{by:'Eng. Ana',mode:'separate',justification:'Piso fora dos serviços estimados'}]);
  expect(second.data.obras[0].aditivosContrato).toEqual(before.obras[0].aditivosContrato);expect(second.data.obras[0].costPlanning.stages.s.remainingCents).toBe(7800000);
  expect(applyOperationalCommand(second.data,c)).toMatchObject({ok:true,idempotent:true});expect(forecastReviewHistory(applyOperationalCommand(second.data,c).data.obras[0])).toHaveLength(2);
 });
 it('justificativa ausente gera aviso, sem impedir gravação ou alterar decisão',()=>{
  const d=fixture(),r=applyOperationalCommand(d,command(d,{amendmentCoverage:coverage('separate','')}));expect(r.ok).toBe(true);
  expect(r.summary.workflowWarnings).toContainEqual(expect.objectContaining({code:'FORECAST_REVIEW_JUSTIFICATION_MISSING',blocking:false}));expect(forecastReviewHistory(r.data.obras[0])[0]).toMatchObject({mode:'separate',justification:''});
 });
 it('permite manter Ainda não conferido, auditando a justificativa disponível',()=>{
  const d=fixture(),r=applyOperationalCommand(d,command(d,{amendmentCoverage:coverage('unreviewed','Aguardando composição do fornecedor')}));expect(r.ok).toBe(true);expect(forecastReviewHistory(r.data.obras[0])[0]).toMatchObject({mode:'unreviewed',justification:'Aguardando composição do fornecedor'});
 });
 it('conserva conferências além da janela de 100 revisões da previsão',()=>{
  let d=fixture();for(let i=0;i<102;i++){const r=applyOperationalCommand(d,command(d));expect(r.ok).toBe(true);d=r.data;}
  expect(d.obras[0].costPlanning.history).toHaveLength(100);expect(forecastReviewHistory(d.obras[0])).toHaveLength(102);expect(forecastReviewHistory(d.obras[0]).at(-1).version).toBe(1);
 });
});
