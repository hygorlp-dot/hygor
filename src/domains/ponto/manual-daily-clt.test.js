import {describe,it,expect} from 'vitest';
import {EMPLOYEE_COMMAND} from '../rh/employee-commands.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {getDays,getPayrollHolidays,prIsWeekdayIso} from './attendance-engine.js';
import {buildAttendanceImport,attendanceImportIssues} from './clt-attendance.js';
import {newManualDailyCltDraft,calculateCltPayslip,MANUAL_DAILY_CLT_CHECKS} from './clt-payslip.js';
import {prepareMonthlyPayslip} from './clt-preparation.js';
import {reviewMonthlyPayslip} from './clt-review.js';
import {buildMixedPayroll,MIXED_PAYROLL_COMMAND} from './mixed-payroll.js';
import {cltPayslipHtml} from './clt-report.js';
import {buildFinancialLedger,selectDRE,selectAccountsPayable,selectCashFlow} from '../financeiro/ledger.js';
import {registrarPagamentoEConciliar} from '../conciliacao/mutations.js';

const competence='2026-10',employeeId='piloto-k110-siclano';
const profile={registration:'QA-0002',cbo:'717020',category:'helper',attendancePolicy:{saturdays:false,dsrPolicy:'none'}};
function fixture(){
  const employee={id:employeeId,name:'Siclano — SIMULAÇÃO',cpf:'00010000208',role:'Servente de obras',
    startDate:'2026-10-06',obra:'piloto-k110',workArea:'campo',active:true,employmentRelationship:'clt',
    remunerationMode:'daily',dailyRate:120,monthlySalary:0,workdayHours:8,workStart:'08:00',
    overtimeAdditionalPercent:70,vtDaily:0,vrDaily:0,examExpiresAt:'2027-10-01',cltPayroll:{profile}};
  const created=applyOperationalCommand({employees:[],obras:[{id:'piloto-k110',name:'Obra QA'}],
    config:{companyName:'Construtora QA — SIMULAÇÃO',cnpj:'00000000000000'},attendance:{},attendanceLocks:{},
    advances:[],titulosFolha:[],pagamentosFolha:[],transacoes:[]},
  {type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,idempotencyKey:'manual-clt-create-worker',actorId:'rh-qa',actorName:'RH QA',
    now:'2026-10-06T07:00:00Z',expectedVersion:0,payload:{employee}});
  expect(created.ok).toBe(true);
  const data=created.data,worker=data.employees[0],holidays=new Set(getPayrollHolidays(data,2026));
  data.attendance[employeeId]={};
  for(const date of getDays(2026,9).filter(date=>date>=worker.startDate&&prIsWeekdayIso(date)&&!holidays.has(date))){
    data.attendance[employeeId][date]={status:'P',obraId:worker.obra,entrada:'08:00',intervaloSaida:'12:00',intervaloRetorno:'13:00',saida:'17:00',ot:0,atrasoMin:0};
    data.attendanceLocks[`${date}__${worker.obra}`]={locked:true};
  }
  const options={...profile.attendancePolicy,classifications:{},reviewed:true};
  const point=buildAttendanceImport(data,worker,competence,options);
  expect(point.errors).toEqual([]);expect(point.fields.workedDays).toBe(18);
  // Valores de uma memória independente e fictícia: não são uma validação fiscal.
  const draft={...newManualDailyCltDraft(competence,{...profile,dailyRate:120}),...point.fields,
    contractPeriodReviewed:true,attendanceSource:{signature:point.signature,options,importedAt:'2026-11-01T08:00:00Z',importedBy:'RH QA'},
    assessmentReference:'QA-OUT-2026',assessmentResponsible:'Contabilidade QA — SIMULAÇÃO',
    assessmentMemory:'SIMULAÇÃO: 18 diárias de 120 = 2160; três descansos = 360; feriado = 120; cesta = 65. Tributos recebidos na memória QA: INSS 213,29; IRRF 0; base IRRF 2426,71; FGTS 211,20. Sem pretensão de apuração fiscal real.',
    assessmentReviewChecklist:Object.fromEntries(MANUAL_DAILY_CLT_CHECKS.map(item=>[item.key,true])),
    custom:[
      {label:'Diárias trabalhadas',kind:'earning',amount:2160,inss:true,irrf:true,fgts:true,reference:'18 × 120; ponto de outubro'},
      {label:'Descansos remunerados',kind:'earning',amount:360,inss:true,irrf:true,fgts:true,reference:'Memória QA, item 2'},
      {label:'Feriado',kind:'earning',amount:120,inss:true,irrf:true,fgts:true,reference:'Memória QA, item 3'},
      {label:'Cesta',kind:'earning',amount:65,inss:false,irrf:false,fgts:false,reference:'Memória QA, item 4'},
    ],manualInss:213.29,manualIrrf:0,manualIrrfBase:2426.71,manualFgts:211.20,confirmed:true};
  return {data,worker,draft};
}
function saveDraft(data,draft,overrides={}){
  const worker=data.employees.find(e=>e.id===employeeId);
  return applyOperationalCommand(data,{type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,
    idempotencyKey:`manual-clt-save-${worker.version}`,actorId:'rh-confirmou',actorName:'RH conferente',
    now:'2026-11-01T10:00:00Z',expectedVersion:worker.version,
    payload:{employee:{...worker,cltPayroll:{...worker.cltPayroll,drafts:{...worker.cltPayroll?.drafts,[competence]:draft}}}},...overrides});
}
const periodFor=amount=>({year:2026,month:9,cycle:'2',cltPlans:{[employeeId]:{competence,amount,reference:'Saldo da memória QA conferida'}}});
function approve(data,period,rows=buildMixedPayroll(data,period).rows,overrides={}){
  return applyOperationalCommand(data,{type:MIXED_PAYROLL_COMMAND,idempotencyKey:'manual-clt-approve-qa',
    actorId:'rh-qa',actorName:'RH QA',now:'2026-11-06T10:00:00Z',
    payload:{period,rowIds:rows.map(row=>row.id),sources:Object.fromEntries(rows.map(row=>[row.id,row.source])),paymentDate:'2026-11-06'},...overrides});
}

describe('CLT por diária: memória identificada e origem auditável',()=>{
  it('reaproveita cadastro e preparação sem converter a diária em salário mensal',()=>{
    const {data,worker}=fixture(),prepared=prepareMonthlyPayslip(data,worker,competence);
    expect(prepared.draft).toMatchObject({assessmentMethod:'manual_daily_clt',dailyRate:120,salary:0,fiscalMode:'manual',confirmed:false});
    expect(prepared.draft.custom).toEqual([]);
    expect(prepared.draft.manualInss).toBe('');expect(prepared.draft.manualFgts).toBe('');
    expect(prepared.point.fields.workedDays).toBe(18);
    expect(calculateCltPayslip(prepared.draft).errors.join(' ')).toContain('memória');
  });
  it('soma a memória sem tributos automáticos e carimba a conferência no servidor',()=>{
    const {data,worker,draft}=fixture();
    const result=calculateCltPayslip(draft);
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({gross:2705,deductions:213.29,net:2491.71,inssBase:2640,fgtsBase:2640,fgts:211.20});
    expect(result.rows.some(row=>row.label==='Salário mensal')).toBe(false);
    expect(reviewMonthlyPayslip({...data,employees:[{...worker,cltPayroll:{drafts:{[competence]:draft}}}]},
      {...worker,cltPayroll:{drafts:{[competence]:draft}}},competence).errors.join(' ')).toContain('conferência identificada');
    const saved=saveDraft(data,{...draft,manualAssessmentAudit:{reviewedBy:'cliente-forjado',reviewedAt:'1999-01-01',reference:'fake'}});
    expect(saved.ok).toBe(true);
    const canonical=saved.data.employees[0].cltPayroll.drafts[competence];
    expect(canonical.manualAssessmentAudit).toEqual({reviewedBy:'rh-confirmou',reviewedByName:'RH conferente',reviewedAt:'2026-11-01T10:00:00Z',reference:'QA-OUT-2026',responsible:'Contabilidade QA — SIMULAÇÃO'});
    expect(canonical.calculated.net).toBe(2491.71);
    expect(reviewMonthlyPayslip(saved.data,saved.data.employees[0],competence).errors).toEqual([]);
    expect(draft.manualAssessmentAudit).toBeUndefined();
  });
  it.each([
    ['tributo em branco',d=>({...d,manualInss:''}),/INSS, IRRF/],
    ['rubrica sem referência',d=>({...d,custom:[{...d.custom[0],reference:''}]}),/cada rubrica/],
    ['revisão de descansos ausente',d=>({...d,assessmentReviewChecklist:{...d.assessmentReviewChecklist,rest:false}}),/conferência de diárias/],
    ['origem ausente',d=>({...d,attendanceSource:null}),/Importe.*ponto/],
    ['duplicação de tributo',d=>({...d,custom:[...d.custom,{label:'INSS extra',kind:'deduction',amount:10,inss:false,irrf:false,fgts:false,reference:'Memória QA'}]}),/sem repetir/],
  ])('não confirma %s nem deixa criar obrigação financeira',(label,change,message)=>{
    const {data,draft}=fixture(),snapshot=structuredClone(data);
    const invalid=change(draft),result=saveDraft(data,invalid);
    expect(result.ok).toBe(false);expect(result.reason).toMatch(message);expect(data).toEqual(snapshot);
    const unfinished=saveDraft(data,{...invalid,confirmed:false});expect(unfinished.ok).toBe(true);
    expect(unfinished.data.employees[0].cltPayroll.drafts[competence].manualAssessmentAudit).toBeNull();
    expect(approve(unfinished.data,periodFor(100)).ok).toBe(false);
  });
  it('invalida eventos alterados ou ponto reaberto mesmo com justificativa manual',()=>{
    const {data,draft}=fixture(),saved=saveDraft(data,draft);expect(saved.ok).toBe(true);
    const worker=saved.data.employees[0],original=worker.cltPayroll.drafts[competence];
    const stale={...original,attendanceSource:{...original.attendanceSource,manualReason:'Pretensa liberação de campos pela tela'}};
    saved.data.attendanceLocks['2026-10-20__piloto-k110']={locked:false};
    expect(attendanceImportIssues(saved.data,worker,stale).join(' ')).toMatch(/reaberto/);
    expect(saveDraft(saved.data,stale).ok).toBe(false);
    expect(approve(saved.data,periodFor(2491.71)).ok).toBe(false);
    const fresh=fixture();expect(saveDraft(fresh.data,{...fresh.draft,workedDays:19}).reason).toMatch(/divergem do ponto/);
  });
  it('confere a diária contratual e a competência vinculada ao demonstrativo',()=>{
    const {data,draft}=fixture();
    expect(saveDraft(data,{...draft,dailyRate:121}).reason).toMatch(/diária.*contratual/i);
    const wrongPeriod=structuredClone(data),worker=wrongPeriod.employees[0];
    worker.cltPayroll.drafts={'2026-11':draft};
    expect(reviewMonthlyPayslip(wrongPeriod,worker,'2026-11').errors.join(' ')).toMatch(/competência.*demonstrativo/i);
  });
  it('preserva a origem de outubro quando um reajuste futuro é cadastrado em novembro',()=>{
    const {data,draft}=fixture(),saved=saveDraft(data,draft),employee=saved.data.employees[0];
    const changed=applyOperationalCommand(saved.data,{type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,
      idempotencyKey:'manual-clt-future-raise',actorId:'rh-qa',expectedVersion:employee.version,now:'2026-11-02T10:00:00Z',
      payload:{employee:{...employee,dailyRate:130,remunerationValueEffectiveFrom:'2026-11-01',remunerationValueReason:'Reajuste fictício com vigência no próximo mês'}}});
    expect(changed.ok).toBe(true);
    expect(reviewMonthlyPayslip(changed.data,changed.data.employees[0],competence).errors).toEqual([]);
  });
  it('encaminha uma obrigação CLT, permite baixa parcial e preserva custo e caixa até o pagamento',()=>{
    const {data,draft}=fixture(),saved=saveDraft(data,draft);expect(saved.ok).toBe(true);
    const period=periodFor(2491.71),built=buildMixedPayroll(saved.data,period);
    expect(built.rows).toHaveLength(1);expect(built.rows[0]).toMatchObject({kind:'clt',isDailyClt:true,issues:[],net:2491.71,monthlyNet:2491.71});
    const result=approve(saved.data,period,built.rows);expect(result.ok).toBe(true);
    expect(result.data.titulosFolha).toHaveLength(1);expect(result.data.titulosFolha[0].snapshotCalculo.kind).toBe('clt');
    expect(result.data.pagamentosFolha).toEqual([]);
    const ledger=buildFinancialLedger(result.data);
    expect(selectDRE(ledger,{}).costCents).toBe(selectDRE(buildFinancialLedger(saved.data),{}).costCents);
    expect(selectCashFlow(ledger,{}).cashOutCents).toBe(0);
    expect(selectAccountsPayable(ledger,{}).balanceCents).toBe(249171);
    expect(approve(result.data,period,undefined,{idempotencyKey:'manual-clt-repeat-qa'}).data.titulosFolha).toHaveLength(1);
    const bank={...result.data,transacoes:[{id:'qa-payment',data:'2026-11-06',valor:-1000,direcao:'saida',status:'pendente'}]};
    const paid=registrarPagamentoEConciliar(bank,{transacaoId:'qa-payment',tipo:'tituloFolha',entidadeId:built.rows[0].id,valor:1000,operador:{id:'financeiro-qa',nome:'Financeiro QA'}});
    expect(paid.resumo.ok).toBe(true);expect(paid.data.titulosFolha[0]).toMatchObject({status:'parcial',saldo:1491.71});
    expect(paid.data.titulosFolha[0].liquidacoes).toHaveLength(1);
    expect(selectDRE(buildFinancialLedger(paid.data),{}).costCents).toBe(selectDRE(ledger,{}).costCents);
    expect(saveDraft(result.data,{...result.data.employees[0].cltPayroll.drafts[competence],assessmentMemory:'Tentativa de substituir a memória já aprovada no financeiro.'}).reason).toMatch(/já encaminhado/);
  });
  it('não usa o fechamento mensal antes do fim da competência para substituir adiantamento',()=>{
    const {data,draft}=fixture(),saved=saveDraft(data,draft),period={...periodFor(1000),cycle:'1'};
    const result=approve(saved.data,period,undefined,{now:'2026-10-20T18:00:00Z'});
    expect(result.ok).toBe(false);expect(result.reason).toMatch(/competência.*andamento/i);
  });
  it('permite preparar novembro após pagar outubro em um corte que termina em novembro',()=>{
    const {data,draft}=fixture(),saved=saveDraft(data,draft),approved=approve(saved.data,periodFor(2491.71));
    expect(approved.ok).toBe(true);
    const employee=approved.data.employees[0],next=newManualDailyCltDraft('2026-11',{...profile,dailyRate:120});
    const result=applyOperationalCommand(approved.data,{type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,
      idempotencyKey:'manual-clt-new-competence',actorId:'rh-qa',expectedVersion:employee.version,now:'2026-11-06T12:00:00Z',
      payload:{employee:{...employee,cltPayroll:{...employee.cltPayroll,drafts:{...employee.cltPayroll.drafts,'2026-11':next}}}}});
    expect(result.ok,result.reason).toBe(true);
    expect(result.data.employees[0].cltPayroll.drafts['2026-10']).toEqual(employee.cltPayroll.drafts['2026-10']);
    expect(result.data.employees[0].cltPayroll.drafts['2026-11']).toMatchObject({confirmed:false,manualAssessmentAudit:null});
  });
  it('emite memória e referência sem declarar pagamento ou converter a diária',()=>{
    const {data,worker,draft}=fixture(),escaped={...draft,assessmentMemory:'Memória <script>intrusão</script> de teste',assessmentResponsible:'Equipe <QA>'};
    const html=cltPayslipHtml({company:data.config,employee:worker,draft:escaped,result:calculateCltPayslip(draft),bodyOnly:true});
    expect(html).toContain('Diária contratual de referência');expect(html).toContain('FGTS apurado pela contabilidade');
    expect(html).toContain('QA-OUT-2026');expect(html).toContain('Memória &lt;script&gt;intrusão&lt;/script&gt;');
    expect(html).toContain('não comprova pagamento');expect(html).not.toContain('Salário contratual');
  });
});
