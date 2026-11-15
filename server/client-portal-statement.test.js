import {it,expect} from 'vitest';
import {portalAccountabilityFixture} from './client-portal-accountability.fixture.js';
import {buildClientStatement} from './client-portal-statement.js';
import {buildClientAdministrationTeam} from './client-portal-team.js';
import {calculateContractProjection} from '../src/domains/dre/calculations.js';
import {createClientStatementPdf,createStatementEmail} from './client-portal-statement-pdf.js';

it('as opções alteram a base e preservam todos os custos, inclusive no contrato misto',()=>{
 const costs={materialCost:200,tercCost:300,equipCost:80,fieldEngineeringCost:120,outrasTotal:20};
 for(const contractType of ['admin_only','fixed_labor_admin']){
  const base={contractType,adminPercentage:12,adminBaseMaoDeObra:true,adminBaseEquipamentos:false,adminBaseEngenhariaCampo:false};
  const off=calculateContractProjection(base,100,costs),on=calculateContractProjection({...base,adminBaseEquipamentos:true,adminBaseEngenhariaCampo:true},100,costs);
  expect(off.totalCost).toBe(820);expect(on.totalCost).toBe(820);expect(on.adminBase-off.adminBase).toBe(200);
  expect(calculateContractProjection({...base,adminBaseEquipamentos:true},100,costs).adminBase-off.adminBase).toBe(80);
 }
});
const fixture=()=>{
 const data=portalAccountabilityFixture(),team=buildClientAdministrationTeam({data,projectId:'obra-local',asOf:'2026-11-14'}).payload;
 const portal={project:{id:'obra-local',name:data.obras[0].name},costSummaries:[{available:true}],administrationTeam:[team],projectCashSummary:[{balance:80}],projectCashMovements:[{id:'out',date:'2026-11-12',type:'Despesa',amount:20,balance:80},{id:'in',date:'2026-10-30',type:'Aporte',amount:100,balance:100}],measurements:[],invoices:[]};
 return {data,portal,projectId:'obra-local',asOf:'2026-11-14',month:'2026-11',permissions:{viewCosts:true,viewFinancial:true,viewProjectCash:true}};
};
it('concilia o mês, distingue pagamentos e reservas, não trata EPI como reserva e gera PDF real',async()=>{
 const input=fixture(),before=structuredClone(input.data),report=buildClientStatement(input);
 expect(report.categories.find(row=>row.category==='terceirizado').recognized).toBe(3000);
 expect(report.categories.find(row=>row.category==='equipamento').recognized).toBe(800);
 expect(report.categories.find(row=>row.category==='engenharia_campo').recognized).toBe(1200);
 expect(report.categories.find(row=>row.category==='material').recognized).toBe(3680);
 expect(report.options).toMatchObject({equipment:false,fieldEngineering:false,fieldEngineeringCost:1200});
 expect(report.cash).toMatchObject({opening:100,entries:0,exits:20,closing:80});
 expect(Math.round(report.passThrough*100)).toBe(Math.round(report.recognized*100)+Math.round(report.workforce.additionalCharges*100)+Math.round(report.workforce.additionalReserve*100));
 const pdf=await createClientStatementPdf(report);expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.length).toBeGreaterThan(5000);
 const email=createStatementEmail(report,'cliente@example.test',pdf);expect(email).toContain('From: financeiro@marcelleng.com.br');expect(email).toContain('X-Unsent: 1');expect(email).toContain('Content-Type: application/pdf');
 expect(()=>createStatementEmail(report,'cliente@example.test\r\nBcc: outra@example.test',pdf)).toThrow();
 expect(input.data).toEqual(before);
});
it('não inclui caixa ou cobrança sem liberação e não transforma dados ausentes em repasse zero',()=>{
 const input=fixture();input.permissions={};input.portal.administrationTeam=[];
 const report=buildClientStatement(input);expect(report.cash).toBeNull();expect(report.administration).toBeNull();expect(report.categories).toEqual([]);expect(report.passThrough).toBeNull();
 expect(()=>buildClientStatement({...input,month:'2099-01'})).toThrow();
});
it('recalcula cobranças históricas sem descontar recebimentos posteriores ao período',()=>{
 const input=fixture();input.month='2026-10';
 input.data.medicoes=[{id:'old',obraId:'obra-local',competencia:'2026-10',dataEmissao:'2026-10-10',valorPrevisto:100,recebimentos:[{id:'later',data:'2026-11-01',valor:100}]}];
 input.portal.measurements=[{id:'old',period:'2026-10',amount:100,description:'Cobrança de outubro'}];
 expect(buildClientStatement(input).charges[0].balance).toBe(100);
});
it('simula todas as combinações de incidência sem mudar o custo reconhecido ou as reservas',()=>{
 const input=fixture(),off=input.portal.administrationTeam[0];
 for(const [equipment,engineering,increase]of [[true,false,96],[false,true,144],[true,true,240]]){
  const data=structuredClone(input.data);Object.assign(data.obras[0],{adminBaseEquipamentos:equipment,adminBaseEngenhariaCampo:engineering});
  const team=buildClientAdministrationTeam({data,projectId:'obra-local',asOf:'2026-11-14'}).payload;
  expect(Math.round((team.administration.calculated-off.administration.calculated)*100)/100).toBe(increase);
  expect(team.workforce).toEqual(off.workforce);
 }
});
