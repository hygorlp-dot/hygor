import {describe,it,expect} from 'vitest';
import {auditHistoricalFinance,applyHistoricalSanitation,planHistoricalSanitation,memorialConference} from './lib/historical-finance-audit.mjs';
const fixture=()=>({obras:[{id:'a'}],changeLog:[{id:'collision',type:'transfer',empId:'e',date:'2026-07-01',fromId:'a',toId:'b'},{id:'collision',type:'salary_change',empId:'e',date:'2026-07-01',from:100,to:110}],medicoes:[{id:'m',obraId:'a',competencia:'2026-07',valorPrevisto:1000}],config:{aliquotaISS:2}});
describe('saneamento histórico local e conferência financeira',()=>{
 it('reconhece a origem arquivada pelo ID canônico sem reativar a obra',()=>{
  const data={...fixture(),planos:[{id:'p',obraId:'archived'}]};
  const record={id:'archived',company_id:'arcd',name:'Obra histórica',active:false,archived_at:'2026-10-01T00:00:00Z',payload:{id:'archived'}};
  const before=structuredClone(data),audit=auditHistoricalFinance(data,{years:[2026],tables:{core_projects:[record]}});
  expect(audit.historicalWorkReferences).toEqual([{collection:'planos',id:'p',obraId:'archived',name:'Obra histórica',archivedAt:'2026-10-01T00:00:00Z',source:'core_projects'}]);
  expect(audit.unresolvedWorkReferences).toEqual([]);expect(audit.orphanWorks).toHaveLength(1);expect(data).toEqual(before);
 });
 it.each([
  {company_id:'other'}, {active:true}, {archived_at:null}, {payload:{id:'different'}}, {archived_at:'not-a-date'},
 ])('não confirma origem histórica sem correspondência íntegra: %j',extra=>{
  const data={...fixture(),planos:[{id:'p',obraId:'missing'}]};
  const record={id:'missing',company_id:'arcd',name:'Mesmo nome',active:false,archived_at:'2026-10-01T00:00:00Z',payload:{id:'missing'},...extra};
  const audit=auditHistoricalFinance(data,{years:[2026],tables:{core_projects:[record]}});
  expect(audit.historicalWorkReferences).toEqual([]);expect(audit.unresolvedWorkReferences).toHaveLength(1);
 });
 it('preserva os dois fatos e altera somente a identificação da segunda ocorrência',()=>{
  const data=fixture(),untouched=structuredClone(data),plan=planHistoricalSanitation(data),next=applyHistoricalSanitation(data,plan);
  expect(plan.patches).toHaveLength(1);expect(data).toEqual(untouched);
  expect(next.changeLog).toHaveLength(2);expect(next.changeLog[0]).toEqual(data.changeLog[0]);
  expect({...next.changeLog[1],id:'collision'}).toEqual(data.changeLog[1]);
  expect(next.medicoes).toEqual(data.medicoes);
 });
 it('é determinístico e não propõe nova alteração depois do saneamento',()=>{
  const data=fixture(),plan=planHistoricalSanitation(data);
  expect(planHistoricalSanitation(data)).toEqual(plan);
  expect(planHistoricalSanitation(applyHistoricalSanitation(data,plan)).patches).toEqual([]);
 });
 it('recusa uma cópia alterada depois do plano',()=>{
  const data=fixture(),plan=planHistoricalSanitation(data);data.medicoes[0].valorPrevisto=2000;
  expect(()=>applyHistoricalSanitation(data,plan)).toThrow(/cópia mudou/);
 });
 it('não apaga repetições idênticas nem renomeia identificações referenciadas',()=>{
  const data=fixture();data.changeLog[1]=structuredClone(data.changeLog[0]);
  expect(planHistoricalSanitation(data).patches).toEqual([]);
  const linked={...fixture(),externalReference:{eventId:'collision'}};
  expect(planHistoricalSanitation(linked)).toMatchObject({patches:[],pending:[{code:'HISTORY_ID_REQUIRES_REVIEW'}]});
 });
 it('confere fontes e tributos em centavos sem alterar os fatos',()=>{
  const data=fixture(),before=structuredClone(data),audit=auditHistoricalFinance(data,{years:[2026]});
  const july=audit.monthly[6];
  expect(july.memorial).toMatchObject({ok:true,deltas:[]});expect(july.bridge.differenceCents).toBe(0);
  expect(july.canonical.resultCents).toBe(100000);expect(july.company.resultCents).toBe(98000);expect(data).toEqual(before);
 });
 it('o saneamento não muda o DRE, a composição ou a prévia',()=>{
  const data=fixture(),next=applyHistoricalSanitation(data,planHistoricalSanitation(data));
  expect(auditHistoricalFinance(next,{years:[2026]}).monthly).toEqual(auditHistoricalFinance(data,{years:[2026]}).monthly);
 });
 it('sinaliza obra ausente sem vincular por nome parecido',()=>{
  const data={...fixture(),planos:[{id:'p',obraId:'missing'}],outrasDesp:[{id:'d',obraId:'missing',valor:20,data:'2026-07-01'}]};
  const audit=auditHistoricalFinance(data,{years:[2026]});
  expect(audit.orphanWorks).toContainEqual({collection:'planos',id:'p',obraId:'missing'});
  expect(audit.plans[0].orphanWork).toBe(true);expect(data.planos[0].obraId).toBe('missing');
 });
 it('não cria ou reabre fechamentos existentes e confere seu memorial congelado',()=>{
  const data={...fixture(),fechamentosFinanceiros:[{id:'c',competencia:'2026-07',status:'fechado',snapshot:{canonicalDre:{payload:{faturamentoTotal:10,lucroLiquido:10,memorial:{faturamentoObras:[{amountCents:1000}]},faturamentoObras:10,memorialRates:{deducaoISS:0,deducaoPIS:0,deducaoCOFINS:0,provisaoIR:0,provisaoCSLL:0}}}}}]};
  const before=structuredClone(data),audit=auditHistoricalFinance(data,{years:[2026]});
  expect(audit.closings[0]).toMatchObject({hasCanonicalPayload:true,memorial:{ok:true}});expect(data).toEqual(before);
 });
 it('preserva e identifica memorial histórico ausente',()=>{
  const data={...fixture(),fechamentosFinanceiros:[{id:'old',competencia:'2026-07',status:'fechado',snapshot:{resultCents:123}}]};
  expect(auditHistoricalFinance(data,{years:[2026]}).closings[0]).toMatchObject({hasCanonicalPayload:false,memorial:null});
 });
 it('detecta excesso no memorial mesmo com total zerado',()=>{
  const p={memorial:{manutencaoLocacoes:[{amountCents:7000}]},memorialRates:{deducaoISS:0,deducaoPIS:0,deducaoCOFINS:0,provisaoIR:0,provisaoCSLL:0}};
  expect(memorialConference(p).deltas).toContainEqual({source:'manutencaoLocacoes',expected:0,actual:7000,kind:'records',ok:false});
 });
});
