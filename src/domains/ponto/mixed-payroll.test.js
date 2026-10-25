import {it,expect} from 'vitest';
import {buildMixedPayroll,MIXED_PAYROLL_COMMAND} from './mixed-payroll.js';
import {getQ,getPayrollHolidays,prIsWeekdayIso} from './attendance-engine.js';
import {newCltDraft} from './clt-payslip.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {buildFinancialLedger,selectDRE,selectAccountsPayable,selectCashFlow} from '../financeiro/ledger.js';
import {registrarPagamentoEConciliar} from '../conciliacao/mutations.js';

function fixture(){
  const period={year:2026,month:8,cycle:'2',cltPlans:{clt:{competence:'2026-09',amount:'700',reference:'Parcela conferida pelo RH'}}};
  const draft={...newCltDraft('2026-09',{salary:2406.8}),paymentDate:'2026-09-30',workedDays:22,registration:'001',cbo:'715210',confirmed:true};
  const daily={id:'daily',name:'Diária QA',startDate:'2026-01-01',dailyRate:100,vtDaily:0,vrDaily:0,obra:'o',active:true,remunerationMode:'daily',workdayHours:8,version:1};
  const clt={...daily,id:'clt',name:'CLT QA',cpf:'000',remunerationMode:'clt',monthlySalary:2406.8,cltPayroll:{drafts:{'2026-09':draft}}};
  const data={config:{companyName:'Empresa QA',cnpj:'00'},employees:[daily,clt],obras:[{id:'o',name:'K1-10'}],attendance:{daily:{}},attendanceLocks:{},advances:[{id:'advance',empId:'daily',date:'2026-09-22',amount:50,status:'ativo',installments:[{dueDate:'2026-09-30',amount:50}]}],pagamentosFolha:[],transacoes:[]};
  for(const date of getQ(2026,8).q2.filter(prIsWeekdayIso)){if(getPayrollHolidays(data,2026).includes(date))continue;data.attendance.daily[date]={status:'P',obraId:'o'};data.attendanceLocks[date+'__o']={locked:true};}
  return {data,period};
}
it('prepara diária e CLT no corte entre meses, aprova sem custo/caixa duplicados',()=>{
  const {data,period}=fixture(),built=buildMixedPayroll(data,period);expect(built.rows).toHaveLength(2);expect(built.start).toBe('2026-09-21');expect(built.end).toBe('2026-10-05');expect(built.rows.every(r=>!r.issues.length)).toBe(true);
  const daily=built.rows.find(r=>r.kind==='daily'),clt=built.rows.find(r=>r.kind==='clt');expect(daily.advances).toBe(50);expect(clt.competence).toBe('2026-09');expect(clt.net).toBe(700);
  const command={type:MIXED_PAYROLL_COMMAND,idempotencyKey:'mixed-payroll-test-0001',actorId:'rh',actorName:'RH',now:'2026-10-06T12:00:00Z',payload:{period,rowIds:built.rows.map(r=>r.id),sources:Object.fromEntries(built.rows.map(r=>[r.id,r.source])),paymentDate:'2026-10-06'}};
  const approved=applyOperationalCommand(data,command);expect(approved.ok).toBe(true);expect(approved.data.titulosFolha).toHaveLength(2);expect(approved.data.pagamentosFolha).toEqual([]);
  expect(applyOperationalCommand(approved.data,{...command,idempotencyKey:'mixed-payroll-test-0002'}).data.titulosFolha).toHaveLength(2);
  const ledger=buildFinancialLedger(approved.data);expect(selectDRE(ledger,{}).costCents).toBe(0);expect(selectCashFlow(ledger,{}).cashOutCents).toBe(0);expect(selectAccountsPayable(ledger,{}).balanceCents).toBe(Math.round((daily.net+700)*100));
  const next=buildMixedPayroll(approved.data,{...period,cycle:'1',cltPlans:{clt:{competence:'2026-09',amount:'2000',reference:'Outra parcela'}}});expect(next.rows.find(r=>r.kind==='clt').issues.join(' ')).toContain('excede');
});
it('bloqueia ponto incompleto, origem alterada e corte ainda aberto',()=>{
  const {data,period}=fixture(),built=buildMixedPayroll(data,period),daily=built.rows.find(r=>r.kind==='daily');
  delete data.attendance.daily['2026-09-22'];expect(buildMixedPayroll(data,period).rows.find(r=>r.kind==='daily').issues.join(' ')).toContain('sem registro');
  const command={type:MIXED_PAYROLL_COMMAND,idempotencyKey:'mixed-payroll-test-0003',actorId:'rh',now:'2026-10-06T12:00:00Z',payload:{period,rowIds:[daily.id],sources:{[daily.id]:daily.source},paymentDate:'2026-10-06'}};
  expect(applyOperationalCommand(data,command).ok).toBe(false);
  const fresh=fixture();const row=buildMixedPayroll(fresh.data,fresh.period).rows.find(r=>r.kind==='daily');expect(applyOperationalCommand(fresh.data,{...command,now:'2026-09-25T12:00:00Z',payload:{...command.payload,sources:{[row.id]:row.source}}}).reason).toContain('em andamento');
});
it('pagamento parcial usa a conciliação existente e conserva saldo',()=>{
  const {data,period}=fixture(),built=buildMixedPayroll(data,period),row=built.rows.find(r=>r.kind==='clt');
  const approved=applyOperationalCommand(data,{type:MIXED_PAYROLL_COMMAND,idempotencyKey:'mixed-payroll-test-0004',actorId:'rh',now:'2026-10-06T12:00:00Z',payload:{period,rowIds:[row.id],sources:{[row.id]:row.source},paymentDate:'2026-10-06'}});
  const withBank={...approved.data,transacoes:[{id:'bank-test',data:'2026-10-06',valor:-200,direcao:'saida',status:'pendente'}]};
  const result=registrarPagamentoEConciliar(withBank,{transacaoId:'bank-test',tipo:'tituloFolha',entidadeId:row.id,valor:200,operador:{id:'financeiro',nome:'Financeiro'}});
  expect(result.resumo.ok).toBe(true);expect(result.data.titulosFolha[0]).toMatchObject({status:'parcial',saldo:500});expect(result.data.titulosFolha[0].liquidacoes).toHaveLength(1);
});
const rowOf=(data,period,kind)=>buildMixedPayroll(data,period).rows.find(r=>r.kind===kind);
function approve(data,period,rows){return applyOperationalCommand(data,{type:MIXED_PAYROLL_COMMAND,idempotencyKey:'mixed-hardening-qa-0001',actorId:'rh',now:'2026-10-06T12:00:00Z',payload:{period,rowIds:rows.map(r=>r.id),sources:Object.fromEntries(rows.map(r=>[r.id,r.source])),paymentDate:'2026-10-06'}});}
function cltAdvanceFixture(){
  const f=fixture(),advance={id:'clt-advance',empId:'clt',date:'2026-09-22',amount:50,status:'ativo',installments:[{dueDate:'2026-09-30',amount:50}]};
  f.data.advances.push(advance);
  Object.assign(f.data.employees[1].cltPayroll.drafts['2026-09'],{advanceIds:[advance.id],advances:[{...advance}]});
  return f;
}
it.each(['em_aberto','pago'])('impede duplicar obrigação CLT legada %s sem identificação do cálculo',status=>{
  const {data,period}=fixture();data.titulosFolha=[{id:'legacy',employeeId:'clt',competencia:'2026-09',liquido:500,status,valorPago:status==='pago'?500:0}];
  const row=rowOf(data,period,'clt');expect(row.issues.join(' ')).toContain('legada');expect(approve(data,period,[row]).ok).toBe(false);expect(data.titulosFolha).toHaveLength(1);
});
it('reserva a obrigação CLT integral mesmo quando a liquidação foi parcial',()=>{
  const {data,period}=fixture();data.titulosFolha=[{id:'previous',employeeId:'clt',competencia:'2026-09',liquido:700,valorPago:200,status:'parcial',snapshotCalculo:{kind:'clt'}}];
  const row=rowOf(data,period,'clt');expect(row.available).toBe(row.monthlyNet-700);expect(row.previousPaid).toBe(200);expect(row.issues).toEqual([]);
});
it('aceita o mesmo ponto normalizado sem perder a evidência original no fechamento',()=>{
  const {data,period}=fixture(),before=rowOf(data,period,'daily');
  data.attendance.daily=Object.fromEntries(Object.entries(data.attendance.daily).map(([date,record])=>[date,{saida:'',entrada:'',intervaloSaida:'',intervaloRetorno:'',atrasoMin:'0',ot:0,...record,observacao:'',updatedAt:'2026-10-06'}]));
  data.attendanceLocks=Object.fromEntries(Object.entries(data.attendanceLocks).map(([key,lock])=>[key,{updatedAt:'2026-10-06',...lock}]));
  expect(rowOf(data,period,'daily').source).toBe(before.source);const result=approve(data,period,[before]);expect(result.ok).toBe(true);expect(result.data.titulosFolha[0].snapshotCalculo.details[0].record.updatedAt).toBe('2026-10-06');
  data.attendance.daily['2026-09-22'].ot=1;expect(approve(data,period,[before]).ok).toBe(false);
});
it('normaliza ordem de chaves e valor textual da parcela CLT sem relaxar valor alterado',()=>{
  const {data,period}=fixture(),before=rowOf(data,period,'clt');
  const equivalent={...period,cltPlans:{clt:{reference:'Parcela conferida pelo RH',amount:700,competence:'2026-09'}}};
  const draft=data.employees[1].cltPayroll.drafts['2026-09'];data.employees[1].cltPayroll.drafts['2026-09']=Object.fromEntries(Object.entries(draft).reverse());
  expect(rowOf(data,equivalent,'clt').source).toBe(before.source);expect(approve(data,equivalent,[before]).ok).toBe(true);
  equivalent.cltPlans.clt.amount=701;expect(approve(data,equivalent,[before]).ok).toBe(false);
});
it('não reutiliza parcela diária já reivindicada com identificador normalizado',()=>{
  const {data,period}=fixture();data.advances[0].id=123;
  data.titulosFolha=[{id:'other',employeeId:'other',liquido:50,snapshotCalculo:{kind:'clt',advanceRefs:[{id:'123',date:'2026-09-30',amount:50}]}}];
  const row=rowOf(data,period,'daily');expect(row.issues.join(' ')).toContain('adiantamento');expect(approve(data,period,[row]).ok).toBe(false);
});
it('compartilha a dedução mensal apenas entre parcelas do mesmo holerite CLT',()=>{
  const {data,period}=cltAdvanceFixture();data.titulosFolha=[{id:'prior',employeeId:'clt',competencia:'2026-09',liquido:100,snapshotCalculo:{kind:'clt',advanceRefs:[{id:'clt-advance',date:'2026-09-30',amount:50}]}}];
  const row=rowOf(data,period,'clt');expect(row.issues).toEqual([]);expect(approve(data,period,[row]).ok).toBe(true);
  data.titulosFolha[0].competencia='2026-08';const blocked=rowOf(data,period,'clt');expect(blocked.issues.join(' ')).toContain('reservado');expect(approve(data,period,[blocked]).ok).toBe(false);
});
it('não utiliza novamente adiantamento reivindicado por título legado sem kind',()=>{
  const {data,period}=cltAdvanceFixture();data.titulosFolha=[{id:'legacy-other',employeeId:'clt',competencia:'2026-08',liquido:100,snapshotCalculo:{advanceRefs:[{id:'clt-advance',date:'2026-09-30',amount:50}]}}];
  expect(rowOf(data,period,'clt').issues.join(' ')).toContain('reservado');
});
it('não recria o mesmo identificador de título cancelado nem altera seus pagamentos',()=>{
  const {data,period}=fixture(),row=rowOf(data,period,'daily');data.titulosFolha=[{id:row.id,employeeId:'daily',status:'cancelado',liquido:100,liquidacoes:[{id:'real',valor:100}]}];
  const snapshot=structuredClone(data);expect(approve(data,period,[row]).ok).toBe(false);expect(data).toEqual(snapshot);
});
it('responde a competência e seleção inválidas sem lançar exceção',()=>{
  const {data,period}=fixture();period.cltPlans.clt.competence='2026-99';expect(rowOf(data,period,'clt').issues).toContain('Competência inválida.');
  expect(applyOperationalCommand(data,{type:MIXED_PAYROLL_COMMAND,idempotencyKey:'mixed-invalid-0001',actorId:'rh',payload:{period,rowIds:'bad',paymentDate:'2026-10-06'}}).ok).toBe(false);
});
it('exige revisão se a mesma dedução CLT já reservada muda de valor',()=>{
  const {data,period}=cltAdvanceFixture();data.titulosFolha=[{id:'prior',employeeId:'clt',competencia:'2026-09',liquido:100,snapshotCalculo:{kind:'clt',advanceRefs:[{id:'clt-advance',date:'2026-09-30',amount:40}]}}];
  const row=rowOf(data,period,'clt');expect(row.issues.join(' ')).toContain('diverge');expect(approve(data,period,[row]).ok).toBe(false);
});
it('não transforma subtotal de empregado CLT por diária em folha líquida aprovada',()=>{
  const {data,period}=fixture();
  data.employees[0].employmentRelationship='clt';
  const snapshot=structuredClone(data),row=buildMixedPayroll(data,period).rows.find(r=>r.employeeId==='daily');
  expect(row.requiresCltAssessment).toBe(true);
  expect(row.net).toBeNull();
  expect(row.issues.join(' ')).toMatch(/CLT por diária.*apuração/i);
  expect(approve(data,period,[row]).ok).toBe(false);
  expect(data).toEqual(snapshot);
  expect(data.titulosFolha).toBeUndefined();
});
it('respeita vínculo CLT vigente no corte mesmo após uma mudança futura no cadastro',()=>{
  const {data,period}=fixture();
  Object.assign(data.employees[0],{employmentRelationship:'other',employmentRelationshipEffectiveFrom:'2026-11-01',
    employmentRelationshipHistory:[{date:'2026-01-01',relationship:'clt'},{date:'2026-11-01',relationship:'other'}]});
  const row=buildMixedPayroll(data,period).rows.find(r=>r.employeeId==='daily');
  expect(row.requiresCltAssessment).toBe(true);
  expect(approve(data,period,[row]).ok).toBe(false);
});
