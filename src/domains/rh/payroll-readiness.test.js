import {expect,it} from 'vitest';
import {payrollReadiness} from './payroll-readiness.js';
import {newProvisionDraft} from '../ponto/labor-provisions.js';
const employee=()=>({id:'e',name:'Equipe QA',role:'Pedreiro',cpf:'52998224725',phone:'81999999999',startDate:'2026-10-28',remunerationEffectiveFrom:'2026-10-28',remunerationMode:'clt',monthlySalary:2800,dailyRate:127,workArea:'administrativo',workdayHours:7,workStart:'07:00',paymentInstructions:'Pagamento em conta cadastrada',examExpiresAt:'2027-01-01',cltPayroll:{profile:{}}});
const data=e=>({employees:[e],attendance:{e:{'2026-10-28':{status:'P'}}},attendanceLocks:{},config:{},advances:[],payments:[{id:'real',amount:7160}]});
it('expõe cadastro incompleto, dias abertos, ausência de registro e estimativa não salva sem escrever dados',()=>{
  const e=employee(),d=data(e),before=structuredClone(d),r=payrollReadiness(d,e,'2026-10');
  expect(r.steps[0].issues).toEqual(expect.arrayContaining(['Matrícula','CBO (seis dígitos)','Categoria na CCT']));
  expect(r.steps[1].issues.join(' ')).toContain('não é considerado falta');
  expect(r.pointDate).toBe('2026-10-28');
  expect(r.steps[2].status).toBe('Pendente');expect(r.steps[3].status).toBe('Estimativa não salva');
  expect(d).toEqual(before);
});
it('mantém base e saldo conhecidos de provisão salva, sem confundir reserva com salário contratual',()=>{
  const e=employee();e.monthlySalary=0;e.laborProvisions={'2026-10':{...newProvisionDraft(e,'2026-10'),base:3500,openingBalance:0,usedReserve:0}};
  const r=payrollReadiness(data(e),e,'2026-10');
  expect(r.steps[0].issues).toContain('Salário contratual mensal');
  expect(r.steps[3].status).toBe('Estimativa salva');expect(r.steps[3].issues.join(' ')).not.toContain('Saldo acumulado não apurado');
  expect(e.laborProvisions['2026-10'].base).toBe(3500);
});
it('reaproveita perfil salarial legado e não torna provisão obrigatória para diária',()=>{
  const e=employee();delete e.monthlySalary;e.cltPayroll.profile.salary=2800;
  expect(payrollReadiness(data(e),e,'2026-10').steps[0].issues).not.toContain('Salário contratual mensal');
  e.remunerationMode='daily';
  expect(payrollReadiness(data(e),e,'2026-10').steps[3].status).toBe('Não incluído');
});
it('não tenta montar rascunho sem funcionário ou competência válida',()=>{
  expect(payrollReadiness({},null,'2026-10')).toBeNull();expect(payrollReadiness({},employee(),'2026-13')).toBeNull();
});
it('direciona o fechamento para dia previsto, sem escolher domingo sem registro',()=>{
  const e={...employee(),startDate:'2026-01-01',remunerationEffectiveFrom:'2026-01-01'};
  expect(payrollReadiness(data(e),e,'2026-02').pointDate).toBe('2026-02-02');
});
