import {describe,it,expect} from 'vitest';
import {workStageCosts} from './work-stage-costs.js';
import {buildFinancialLedger} from './ledger.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {COST_CONTROL_COMMAND,costPlanningFingerprint} from './cost-control.js';
import {AMENDMENT_COMMAND,valorContratoVigente} from '../obras/contract-amendments.js';

const asOf='2026-10-31',now=`${asOf}T15:00:00Z`;
const fixture=()=>({obras:[{id:'w',name:'Casa',contractValue:2000},{id:'other'}],budgetBaselines:[{obraId:'w',tipo:'controle',ativo:true,budgetId:'b'}],orcamentos:[{id:'b',obraId:'w',etapas:[{id:'s',nome:'Estrutura'},{id:'p',nome:'Pintura'}],itens:[{id:'i',etapaId:'s',quantidade:1,precoUnit:1000}]}],pedidos:[{id:'o',obraId:'w',data:asOf,status:'enviado',itens:[{id:'l',qtd:1,precoUnit:500,orcNivel1Id:'s'}]}],outrasDesp:[{id:'labor',obraId:'w',data:asOf,valor:800,etapaId:'s'}],notasFiscais:[]});
const report=d=>workStageCosts(d,buildFinancialLedger(d),'w',asOf);
const row=d=>report(d).rows.find(r=>r.id==='s');
const send=(d,type,payload,extra={})=>applyOperationalCommand(d,{type,payload,actorId:'admin',actorName:'Admin',idempotencyKey:crypto.randomUUID(),now,...extra});
const forecast=(d,p={})=>send(d,COST_CONTROL_COMMAND.COST_FORECAST_SAVED,{obraId:'w',stageId:'s',budgetId:'b',remainingCents:70000,contingencyCents:5000,fingerprint:costPlanningFingerprint(d,'w'),asOf,basis:{incurred:row(d)?.incurred||0,committed:row(d)?.committed||0,budget:row(d)?.budget||0},note:'Quantidades restantes conferidas',...p},{expectedVersion:Number(d.obras[0].costPlanning?.version||0)});
const change=(d,p={})=>send(d,AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED,{obraId:'w',amendment:{id:'change',descricao:'Troca de piso',valor:120,prazoDias:5,etapaId:'s',responsavel:'Engenharia',execucaoStatus:'em_andamento',impactoCustoRestante:80,impactoNaPrevisao:'adicional',...p}},{expectedVersion:0});

describe('previsão de custo final e mudanças',()=>{
 it('mão de obra incorrida não abate compras ainda não faturadas',()=>{
  const d=fixture();expect(row(d)).toMatchObject({incurred:80000,openCommitted:50000,automaticRemaining:50000,forecast:130000});
 });
 it('nota parcial abate apenas seu pedido, sem duplicar pagamento no custo',()=>{
  const d=fixture();d.notasFiscais=[{id:'nf',pedidoId:'o',obraId:'w',status:'aprovada',valorBruto:200,emissao:asOf,competencia:'2026-10',pagamentos:[{id:'pay',valor:100,data:asOf}]}];
  expect(row(d)).toMatchObject({incurred:100000,openCommitted:30000,automaticRemaining:30000,forecast:130000,paid:10000});
 });
 it('rateia saldo de pedido multietapas conservando todos os centavos',()=>{
  const d=fixture();d.pedidos[0].itens=[{qtd:1,precoUnit:1,orcNivel1Id:'s'},{qtd:1,precoUnit:2,orcNivel1Id:'p'}];d.notasFiscais=[{id:'nf',pedidoId:'o',obraId:'w',status:'aprovada',valorBruto:1,emissao:asOf}];
  expect(Object.fromEntries(report(d).rows.map(r=>[r.id,r.openCommitted]))).toEqual({s:67,p:133,unassigned:0});expect(report(d).totals.openCommitted).toBe(200);
 });
 it('não inclui compra de outra obra, rascunho ou cancelada',()=>{
  const d=fixture();d.pedidos.push({...d.pedidos[0],id:'other',obraId:'other'});d.pedidos[0].status='rascunho';expect(row(d).openCommitted).toBe(0);d.pedidos[0].status='cancelado';expect(row(d).openCommitted).toBe(0);
 });
 it('combina restante, reserva e mudança adicional sem criar fatos financeiros',()=>{
  const d=fixture(),changed=change(d);expect(changed.ok).toBe(true);
  const r=forecast(changed.data);expect(r.ok).toBe(true);expect(row(r.data)).toMatchObject({remaining:70000,contingency:5000,changeImpact:8000,forecast:163000});
  expect(r.data.outrasDesp).toEqual(d.outrasDesp);expect(r.data.pedidos).toEqual(d.pedidos);expect(valorContratoVigente(r.data.obras[0])).toBe(2000);
 });
 it('já incluído não soma; redução explícita diminui apenas a previsão',()=>{
  const d=fixture(),included=change(d,{impactoNaPrevisao:'ja_incluido'}).data;expect(row(included).changeImpact).toBe(0);
  const saving=change(d,{impactoCustoRestante:-80}).data;expect(row(saving)).toMatchObject({changeImpact:-8000,forecast:122000});
 });
 it('execução sem aprovação, sem responsável e sem estimativa continua com avisos',()=>{
  const d=fixture(),r=change(d,{responsavel:'',impactoCustoRestante:null,etapaId:''});expect(r.ok).toBe(true);expect(r.summary.workflowWarnings.length).toBeGreaterThan(2);expect(r.summary.workflowWarnings.every(w=>w.blocking===false)).toBe(true);
 });
 it('atualiza acompanhamento decidido sem reescrever termos aprovados',()=>{
  const d=change(fixture()).data,approved=send(d,AMENDMENT_COMMAND.CONTRACT_AMENDMENT_DECIDED,{obraId:'w',amendmentId:'change',expectedVersion:1,decision:'aprovado',evidencia:''});expect(approved.ok).toBe(true);
  const r=send(approved.data,AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED,{obraId:'w',operationalOnly:true,amendment:{id:'change',valor:999,prazoDias:999,descricao:'Reescrever',execucaoStatus:'concluida',impactoNaPrevisao:'ja_incluido',impactoCustoRestante:0,evidenciaDecisao:'E-mail conferido'}},{expectedVersion:2});
  expect(r.ok).toBe(true);expect(r.data.obras[0].aditivosContrato[0]).toMatchObject({status:'aprovado',descricao:'Troca de piso',valor:120,prazoDias:5,execucaoStatus:'concluida',evidenciaDecisao:'E-mail conferido',version:3});expect(row(r.data).changeImpact).toBe(0);
 });
 it('sem orçamento, premissas ou base atualizada salva com avisos e replay idempotente',()=>{
  const d=fixture();d.orcamentos=[];d.budgetBaselines=[];
  const cmd={type:COST_CONTROL_COMMAND.COST_FORECAST_SAVED,actorId:'admin',expectedVersion:0,idempotencyKey:'forecast-warning-replay',now,payload:{obraId:'w',stageId:'unassigned',remainingCents:10000,contingencyCents:0,budgetId:'',asOf,fingerprint:'stale',basis:{incurred:80000,committed:50000,budget:0},note:''}};
  const r=applyOperationalCommand(d,cmd);expect(r.ok).toBe(true);expect(r.summary.workflowWarnings).toHaveLength(3);expect(report(r.data).totals.remaining).toBe(10000);
  expect(applyOperationalCommand(r.data,cmd)).toMatchObject({ok:true,idempotent:true,summary:r.summary});
 });
 it('mudança de base conserva revisão e histórico com aviso de reconferência',()=>{
  const r=forecast(fixture()),d=change(r.data).data;expect(row(d)).toMatchObject({reviewValid:false,remaining:70000,contingency:5000,forecast:163000});expect(d.obras[0].costPlanning.history).toHaveLength(1);
 });
 it('versão concorrente e valores sem integridade não são sobrescritos',()=>{
  const d=change(fixture()).data;
  expect(send(d,AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED,{obraId:'w',operationalOnly:true,amendment:{id:'change'}},{expectedVersion:0}).ok).toBe(false);
  expect(change(fixture(),{impactoCustoRestante:'abc'}).ok).toBe(false);expect(forecast(fixture(),{contingencyCents:-1}).ok).toBe(false);
 });
});
