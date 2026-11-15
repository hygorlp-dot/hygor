import {it,expect} from "vitest";
import {buildClientFinancialRows} from "./client-portal-financial.js";
import {buildClientContractPosition} from "./client-portal-contract.js";
import {portalFixture} from "./client-portal.fixture.js";
it("limita o custo de mão de obra à data da consulta mesmo com presença futura registrada",()=>{
  const source=portalFixture();
  source.employees=[{id:"e1",nome:"Pessoa privada",obra:"obra-local",dailyRate:100,vtDaily:10}];
  source.attendance={e1:{"2026-11-12":{status:"P",obraId:"obra-local"},"2026-11-18":{status:"P",obraId:"obra-local"}}};
  const summary=buildClientFinancialRows({data:source,projectId:"obra-local",asOf:"2026-11-14"}).find(row=>row.domain==="cost_summary").payload;
  // O motor também inclui os feriados pagos da empresa; comparamos com a
  // mesma origem sem a presença futura, sem reimplementar essa regra aqui.
  const withoutFuture={...source,attendance:{e1:{"2026-11-12":source.attendance.e1["2026-11-12"]}}};
  const baseline=buildClientFinancialRows({data:withoutFuture,projectId:"obra-local",asOf:"2026-11-14"}).find(row=>row.domain==="cost_summary").payload;
  expect(summary).toMatchObject({available:true,laborToDate:baseline.laborToDate,laborBenefitsToDate:10});
  expect(JSON.stringify(summary)).not.toContain("Pessoa privada");
  const later=buildClientFinancialRows({data:source,projectId:"obra-local",asOf:"2026-11-19"}).find(row=>row.domain==="cost_summary").payload;
  expect(later.laborToDate-summary.laborToDate).toBe(100);
});
it("separa valor acumulado do contrato, percentual do período e saldo real da quinzena",()=>{
  const source=portalFixture();source.obras[0].billingFrequency="quinzenal";
  source.medicoes=[{id:"m1",obraId:"obra-local",tipo:"percentual",status:"emitida",competencia:"2026-11",dataEmissao:"2026-11-10",dataVencimento:"2026-11-20",percentualAcumulado:40,percentualPeriodo:10,valorPrevisto:10000,recebimentos:[{id:"r1",valor:2500,data:"2026-11-12"},{id:"futuro",valor:500,data:"2026-11-18"}]},{id:"rascunho",obraId:"obra-local",tipo:"percentual",status:"rascunho",percentualAcumulado:99,valorPrevisto:99999}];
  const position=buildClientContractPosition({data:source,projectId:"obra-local",asOf:"2026-11-14"}).payload;
  expect(position).toMatchObject({accumulatedPercentage:40,accumulatedAmount:40000,frequency:"quinzenal"});
  expect(position.openInstallments).toHaveLength(1);expect(position.openInstallments[0]).toMatchObject({periodPercentage:10,amount:10000,paid:2500,balance:7500,dueDate:"2026-11-20"});
});
it("não inventa percentual nem cobrança quando ainda não há medição emitida",()=>{
  const source=portalFixture();source.medicoes=[];
  const position=buildClientContractPosition({data:source,projectId:"obra-local",asOf:"2026-11-14"}).payload;
  expect(position.accumulatedPercentage).toBeNull();expect(position.accumulatedAmount).toBeNull();expect(position.openInstallments).toEqual([]);
});
