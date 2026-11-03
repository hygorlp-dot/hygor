import {describe,it,expect} from 'vitest';
import {data as original} from '../../../scripts/fixtures/spi-data.mjs';
import {BASELINE_COMMAND,applyBaselineCommand,proposeBaselineSnapshot,scheduleSpi} from './approved-baseline.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {validatePlanningBaselinePolicy} from '../../../server/section-authorizations.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {projectDataForUser} from '../../../server/data-projection.js';

const fixture=()=>structuredClone(original);
const cmd=(type,payload,expectedVersion=0,role='admin',now='2026-10-01T13:00:00Z')=>({type,payload,expectedVersion,actorId:'user',actorName:'Responsável fictício',actorRole:role,idempotencyKey:`baseline-test-${payload.id}-${type}`,now});
function propose(data,id='v1',expected=0,role='admin'){
 return applyOperationalCommand(data,cmd(BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED,{obraId:'a',id,reason:'Planejamento conferido para aprovação',signature:proposeBaselineSnapshot(data,'a').signature},expected,role));
}
function approve(data,id='v1',now='2026-10-01T14:00:00Z',role='admin'){
 return applyOperationalCommand(data,cmd(BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED,{obraId:'a',id},1,role,now));
}
const approved=()=>approve(propose(fixture()).data).data;
describe('linha de base aprovada e versionada',()=>{
 it('congela orçamento aprovado, calendário, atividades e pesos sem custo real nem alteração das fontes',()=>{
  const data=fixture(),before=JSON.stringify(data),p=propose(data);expect(p.ok).toBe(true);expect(JSON.stringify(data)).toBe(before);
  expect(p.data.scheduleBaselines[0]).toMatchObject({status:'rascunho',number:1,version:1,revisionOf:'',snapshot:{budgetId:'budget-a',budgetCents:12000000,method:'linear_dias_trabalhados_v1'}});
  expect(scheduleSpi(p.data,{obraId:'a',asOf:'2026-11-02'}).spi).toBeNull();
  const result=approve(p.data);expect(result.ok).toBe(true);expect(result.data.scheduleBaselines[0]).toMatchObject({status:'aprovada',version:2,approvedById:'user',approvedOn:'2026-10-01'});
 });
 it('revisão preserva integralmente a anterior, tem vínculo e a referência escolhe a última aprovação vigente',()=>{
  const data=approved(),v1=JSON.stringify(data.scheduleBaselines[0]);
  data.planos[0].tarefas[0].fim='2026-12-16';const p=propose(data,'v2',1);expect(p.ok).toBe(true);
  expect(p.data.scheduleBaselines[1].revisionOf).toBe('v1');expect(JSON.stringify(p.data.scheduleBaselines[0])).toBe(v1);
  const next=approve(p.data,'v2','2026-11-02T16:00:00Z').data;
  expect(scheduleSpi(next,{obraId:'a',asOf:'2026-11-01'}).baselineId).toBe('v1');expect(scheduleSpi(next,{obraId:'a',asOf:'2026-11-02'}).baselineId).toBe('v2');
  expect(scheduleSpi(next,{obraId:'a',asOf:'2026-11-02',baselineId:'v1'}).spi).toBe(.6);expect(JSON.stringify(next.scheduleBaselines[0])).toBe(v1);
 });
 it('impede aprovação pela engenharia, proposta sem justificativa e escrita direta que edita ou apaga o histórico',()=>{
  const proposed=propose(fixture(),'engineer-v1',0,'engenheiro');expect(proposed.ok).toBe(true);expect(approve(proposed.data,'engineer-v1',undefined,'engenheiro').ok).toBe(false);
  const data=approved(),modified=structuredClone(data);modified.scheduleBaselines[0].snapshot.budgetCents=1;
  expect(validatePlanningBaselinePolicy(data,modified,{role:'admin'})).toMatch(/comandos/);expect(validatePlanningBaselinePolicy(data,{...data,scheduleBaselines:[]},{role:'admin'})).toMatch(/imutável/);
  expect(validatePlanningBaselinePolicy(data,data,{role:'admin'})).toBe('');
  const short=cmd(BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED,{obraId:'a',id:'bad',reason:'x',signature:proposeBaselineSnapshot(fixture(),'a').signature});expect(applyOperationalCommand(fixture(),short).ok).toBe(false);
 });
 it('controla idempotência, versão concorrente e fonte alterada entre conferência, proposta e aprovação',()=>{
  const data=fixture(),command=cmd(BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED,{obraId:'a',id:'v1',reason:'Proposta conferida pela engenharia',signature:proposeBaselineSnapshot(data,'a').signature});
  const p=applyOperationalCommand(data,command);expect(applyOperationalCommand(p.data,command).idempotent).toBe(true);expect(propose(p.data,'v2',0).ok).toBe(false);
  p.data.planos[0].tarefas[0].fim='2026-12-17';expect(approve(p.data).reason).toMatch(/mudou/);
  data.planos[0].diasSemana=[1,2,3,4,5];expect(applyOperationalCommand(data,command).reason).toMatch(/mudaram/);
 });
 it('rejeita orçamento não aprovado, rateio ambíguo, lacunas de cobertura e calendário sem dias trabalhados',()=>{
  let data=fixture();delete data.orcamentos[0].lockedAt;expect(proposeBaselineSnapshot(data,'a').ok).toBe(false);
  data=fixture();data.planos[0].tarefas.push({...data.planos[0].tarefas[0],id:'ambiguous'});expect(proposeBaselineSnapshot(data,'a').reason).toMatch(/única atividade/);
  data=fixture();data.planos[0].tarefas[0].etapaId='missing';expect(proposeBaselineSnapshot(data,'a').ok).toBe(false);
  data=fixture();data.planos[0].diasSemana=[];expect(proposeBaselineSnapshot(data,'a').ok).toBe(false);
  data=fixture();data.planos[0].tarefas[0].inicio='2026-11-01';data.planos[0].tarefas[0].fim='2026-11-01';data.planos[0].diasSemana=[1,2,3,4,5];expect(proposeBaselineSnapshot(data,'a').reason).toMatch(/sem dia trabalhado/);
 });
 it('não permite que proposta concorrente ligada a uma versão anterior seja aprovada depois de outra revisão',()=>{
  const data=approved(),p2=propose(data,'v2',1),p3=propose(p2.data,'v3',2),next=approve(p3.data,'v3','2026-11-02T14:00:00Z');
  expect(next.ok).toBe(true);expect(approve(next.data,'v2','2026-11-02T15:00:00Z').reason).toMatch(/Outra revisão/);
 });
 it('respeita autor, acesso à aba, obra e perfil na fronteira do servidor; não envia fotos do diário ao financeiro',()=>{
  const data=approved(),command=cmd(BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED,{obraId:'a',id:'v1'},1);
  expect(validateOperationalCommandScope({user:{id:'u',role:'engenheiro',active:true},data,command}).ok).toBe(false);
  expect(validateOperationalCommandScope({user:{id:'u',role:'admin',obraId:'b'},data,command}).ok).toBe(false);
  data.rdos[0].fotos=[{secret:'imagem'}];const projected=projectDataForUser(data,{id:'fin',role:'financeiro',obraId:'a'});
  expect(projected.scheduleBaselines).toHaveLength(1);expect(projected.rdos[0].fotos).toBeUndefined();expect(projected.rdos.every(row=>row.obraId==='a')).toBe(true);
 });
});
describe('SPI rastreável por obra',()=>{
 it('calcula PV e EV do mesmo escopo: 50% planejado e 30% medido resultam em SPI 0,6',()=>{
  const data=approved(),before=JSON.stringify(data),result=scheduleSpi(data,{obraId:'a',asOf:'2026-11-02'});
  expect(result).toMatchObject({pv:6000000,ev:3600000,spi:.6,sv:-2400000,coverage:1,baselineId:'v1'});expect(result.rows[0]).toMatchObject({plannedDays:66,elapsedDays:33,sourceId:'daily-report'});expect(JSON.stringify(data)).toBe(before);
  data.planos[0].tarefas[0].fim='2027-02-01';expect(scheduleSpi(data,{obraId:'a',asOf:'2026-11-02'}).spi).toBe(.6);
 });
 it('não presume zero nem usa dados futuros, não revisados ou de outra obra; duplicidade invalida a medição',()=>{
  const data=approved();expect(scheduleSpi(data,{obraId:'a',asOf:'2026-10-02'}).spi).toBeNull();
  data.rdos.push({...structuredClone(data.rdos[0]),id:'future',data:'2026-11-03',servicos:data.rdos[0].servicos.map(row=>({...row,progressoAte:100}))});
  expect(scheduleSpi(data,{obraId:'a',asOf:'2026-11-02'}).spi).toBe(.6);
  data.rdos.push({...structuredClone(data.rdos.find(row=>row.id==='daily-report')),id:'duplicate'});const result=scheduleSpi(data,{obraId:'a',asOf:'2026-11-02'});expect(result).toMatchObject({spi:null,ev:null,coverage:0});expect(result.rows[0].reason).toMatch(/duplicada/);
 });
 it('quantidade de referência, unidade e atividade devem corresponder ao item congelado',()=>{
  for(const patch of [{budgetQuantity:1201},{unidade:'un'},{tarefaId:'another'},{budgetId:'changed'},{progressoAte:101}]){
   const data=approved();Object.assign(data.rdos.find(row=>row.id==='daily-report').servicos[0],patch);expect(scheduleSpi(data,{obraId:'a',asOf:'2026-11-02'}).spi).toBeNull();
  }
 });
 it('calendário congela feriados e dias da semana; distribuição conserva o valor integral ao final',()=>{
  const data=fixture();data.planos[0].tarefas[0].fim='2026-10-06';data.planos[0].diasSemana=[1,2,3,4,5];data.planos[0].feriados=[{data:'2026-10-02'}];
  const next=approve(propose(data).data).data;const result=scheduleSpi(next,{obraId:'a',asOf:'2026-10-05'});expect(result.rows[0]).toMatchObject({plannedDays:3,elapsedDays:2,plannedCents:8000000});
  expect(scheduleSpi(next,{obraId:'a',asOf:'2026-10-06'}).pv).toBe(12000000);
 });
 it('PV zero mantém SPI indisponível mesmo com medição explícita de zero; cobertura parcial nunca vira SPI integral',()=>{
  const data=approved(),source=structuredClone(data.rdos.find(row=>row.id==='daily-report'));data.scheduleBaselines[0].approvedAt='2026-09-01T12:00:00Z';data.scheduleBaselines[0].approvedOn='2026-09-01';source.data='2026-09-30';source.servicos[0].progressoAte=0;data.rdos=[source];
  const zero=scheduleSpi(data,{obraId:'a',asOf:'2026-09-30'});expect(zero).toMatchObject({pv:0,ev:0,spi:null,coverage:1});expect(zero.reason).toMatch(/planejado nulo/);
  const more=fixture();more.orcamentos.find(row=>row.id==='budget-a').itens.push({...more.orcamentos.find(row=>row.id==='budget-a').itens[0],id:'second'});const partial=approve(propose(more).data).data;const result=scheduleSpi(partial,{obraId:'a',asOf:'2026-11-02'});expect(result).toMatchObject({spi:null,ev:null,coverage:.5,pv:12000000});
 });
 it('base futura, referência inválida e obra diferente não recebem SPI; aprovação usa dia civil brasileiro',()=>{
  const data=approved();expect(scheduleSpi(data,{obraId:'a',asOf:'2026-09-30'}).spi).toBeNull();expect(scheduleSpi(data,{obraId:'a',asOf:'2026-02-30'}).spi).toBeNull();expect(scheduleSpi(data,{obraId:'b',asOf:'2026-11-02'}).spi).toBeNull();
  const next=approve(propose(fixture()).data,'v1','2026-11-02T01:00:00Z').data;expect(next.scheduleBaselines[0].approvedOn).toBe('2026-11-01');expect(scheduleSpi(next,{obraId:'a',asOf:'2026-11-01'}).baselineId).toBe('v1');
 });
});
