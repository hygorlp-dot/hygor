import {it,expect} from 'vitest';
import {buildClientAdministrationTeam,clientTeamMonth} from './client-portal-team.js';
import {calculateLaborProvision,newProvisionDraft} from '../src/domains/ponto/labor-provisions.js';
const work={id:'w',name:'Obra teste',startDate:'2026-11-01',contractType:'admin_only',adminPercentage:12};
const fixture=()=>({obras:[work,{id:'other',name:'Outra obra'}],config:{},employees:[{id:'e',name:'Equipe autorizada',role:'Pedreiro',obra:'w',startDate:'2026-11-01',remunerationMode:'clt',monthlySalary:3000,dailyRate:100,cpf:'CPF-PRIVADO',pixKey:'PIX-PRIVADO'}],attendance:{},medicoes:[]});
const read=(data,asOf='2026-11-30')=>buildClientAdministrationTeam({data,projectId:'w',asOf}).payload;
it('repasse inclui toda a mão de obra e não duplica reservas já reconhecidas',()=>{
 const data=fixture(),before=structuredClone(data),report=read(data);
 expect(report.members).toHaveLength(1);
 expect(report.available).toBe(true);expect(report.workforce.recognized).toBeGreaterThan(3000);
 expect(report.workforce.additionalReserve).toBe(0);
 expect(report.workforce.passThrough).toBe(report.workforce.recognized);
 expect(report.members[0].includedReserve).toBeGreaterThanOrEqual(report.members[0].provisions.monthly);
 expect(report.administration.calculated).toBe(Math.round(report.administration.base*12)/100);
 expect(data).toEqual(before);
});
it('repassa reserva adicional cadastrada e a inclui na taxa conforme a base do contrato',()=>{
 const data=fixture(),draft=newProvisionDraft(data.employees[0],'2026-11');draft.extraReserve=300;
 data.employees[0].laborProvisions={'2026-11':draft};data.medicoes=[{id:'m',obraId:'w',competencia:'2026-11',valorAdminPct:50,valorPrevisto:50,dataVencimento:'2026-11-30'}];
 const report=read(data);
 expect(report.workforce.additionalReserve).toBeGreaterThan(0);
 expect(report.workforce.additionalReserve).toBe(Math.round((report.members[0].provisions.monthly-report.members[0].includedReserve)*100)/100);
 expect(report.workforce.passThrough).toBe(Math.round((report.workforce.recognized+report.workforce.additionalReserve)*100)/100);
 expect(report.administration.base).toBe(Math.round((report.administration.registeredBase+report.workforce.additionalReserve)*100)/100);
 expect(report.administration.issued).toBe(50);expect(report.administration.toIssue).toBe(Math.round((report.administration.calculated-50)*100)/100);
 data.obras[0]={...work,adminBaseMaoDeObra:false};expect(read(data).administration.base).toBe(0);
});
it('usa o modelo de repasse para diárias, sem converter diária em salário nem duplicar encargos',()=>{
 const data=fixture();data.config.workforceReserve={enabled:true};data.employees[0].remunerationMode='daily';data.attendance={e:{'2026-11-12':{status:'P',obraId:'w'}}};
 const report=read(data),member=report.members[0];
 expect(member.provisions.source).toBe('referencia');expect(member.additionalCharges).toBeGreaterThan(0);expect(member.additionalReserve).toBeGreaterThan(0);
 expect(report.workforce.passThrough).toBe(Math.round((report.workforce.recognized+report.workforce.additionalCharges+report.workforce.additionalReserve)*100)/100);
 expect(data.employees[0].monthlySalary).toBe(3000);expect(data.employees[0].remunerationMode).toBe('daily');
});
it('limita pessoas e ponto à obra e ao dia da consulta e retira dados pessoais e de saúde',()=>{
 const data=fixture();data.employees.push({id:'private',name:'NOME DA OUTRA OBRA',obra:'other',dailyRate:100});
 data.attendance.e={'2026-11-10':{status:'P',obraId:'w',entrada:'07:00',saida:'17:00',note:'DIAGNOSTICO PRIVADO'},'2026-11-11':{status:'P',obraId:'other'},'2026-11-25':{status:'P',obraId:'w'}};
 const report=read(data,'2026-11-14'),text=JSON.stringify(report);
 expect(report.members[0].attendance.find(day=>day.date==='2026-11-10')).toMatchObject({start:'07:00',end:'17:00'});
 expect(report.members[0].attendance.some(day=>['2026-11-11','2026-11-25'].includes(day.date))).toBe(false);
 for(const forbidden of ['NOME DA OUTRA OBRA','CPF-PRIVADO','PIX-PRIVADO','DIAGNOSTICO PRIVADO','monthlySalary'])expect(text).not.toContain(forbidden);
});
it('não inventa provisão quando a base cadastrada está incompleta',()=>{
 const data=fixture();data.employees[0].laborProvisions={'2026-11':{...newProvisionDraft(data.employees[0],'2026-11'),base:''}};
 const report=read(data);expect(report.workforce.passThrough).toBeNull();expect(report.administration.calculated).toBeNull();expect(report.members[0].provisions.monthly).toBeNull();
});
it('rateia a reserva entre as obras sem cobrar a reserva inteira em cada obra',()=>{
 const data=fixture();data.attendance.e={'2026-11-10':{status:'P',obraId:'other'}};
 const report=read(data);const full=calculateLaborProvision(newProvisionDraft(data.employees[0],'2026-11')).monthly;
 expect(report.members[0].provisions.monthly).toBeLessThan(full);expect(report.members[0].provisions.monthly).toBeGreaterThan(0);
});
it('separa líquido fechado e não soma salário inteiro de outra obra ao repasse',()=>{
 const data=fixture();data.titulosFolha=[{id:'t',employeeId:'e',competencia:'2026-11',periodoFim:'2026-11-20',status:'em_aberto',liquido:3000,rateiosPorObra:[{obraId:'w',valor:1000},{obraId:'other',valor:2000}]}];
 expect(read(data).members[0].closedNet).toBe(1000);expect(read(data).workforce.closedNet).toBe(1000);
 data.titulosFolha[0].status='cancelado';expect(read(data).workforce.closedNet).toBeNull();
});
it('não aceita competência futura nem mês inválido',()=>{
 for(const month of ['2026-13','2026-12','../2026'])expect(()=>clientTeamMonth(month,'2026-11-14')).toThrow('mês válido');
});
it('não trata provisão não configurada como zero no repasse completo',()=>{
 const data=fixture();data.employees[0].remunerationMode='daily';data.attendance={e:{'2026-11-12':{status:'P',obraId:'w'}}};
 const report=read(data);expect(report.workforce.recognized).toBeGreaterThan(0);expect(report.workforce.pendingReserves).toBe(1);expect(report.workforce.passThrough).toBeNull();expect(report.administration.registeredCalculated).toBeGreaterThan(0);expect(report.administration.toIssue).toBeNull();
});
it('preserva histórico sem individualização no custo sem inventar ponto ou provisão',()=>{
 const data=fixture();data.archivedLaborCosts={old:{byDate:{'2026-11-10':{w:{laborCost:100,benefitCost:20}}}}};data.employees=[];
 const report=read(data);expect(report.workforce.recognized).toBe(120);expect(report.workforce.unassigned).toBe(120);expect(report.members).toEqual([]);expect(report.workforce.passThrough).toBeNull();
});
it('EPI e exames de admissão/demissão seguem como despesas reais, fora da provisão',()=>{
 const data=fixture();data.config.workforceReserve={enabled:true};const before=read(data);
 data.outrasDesp=[{id:'epi',obraId:'w',categoria:'material',data:'2026-11-12',competencia:'2026-11',valor:100,status:'aprovada',descricao:'EPI e ASO'}];
 const after=read(data);
 expect(after.members[0].provisions).toEqual(before.members[0].provisions);
 expect(after.workforce.passThrough).toBe(before.workforce.passThrough);
 expect(after.administration.base).toBe(Math.round((before.administration.base+100)*100)/100);
});
