import {describe,it,expect} from 'vitest';
import {getDays,getPayrollHolidays} from './attendance-engine.js';
import {buildAttendanceImport,attendanceImportIssues} from './clt-attendance.js';
import {prepareMonthlyPayslip} from './clt-preparation.js';
import {applyEmployeeCommand} from '../rh/employee-commands.js';
const employee={id:'e',name:'Operário',obra:'o',startDate:'2026-05-01',dailyRate:120,monthlySalary:2406.8,remunerationMode:'clt',version:1,vtDaily:10};
function fixture(){
  const data={employees:[employee],obras:[{id:'o',name:'Obra'}],config:{paymentHolidays:[]},attendance:{e:{}},attendanceLocks:{},financialSettlements:[{id:'real',amount:7160}]};
  for(const d of getDays(2026,8)){
    const weekday=new Date(d+'T12:00:00Z').getUTCDay();
    if(weekday>0&&weekday<6&&!getPayrollHolidays(data,2026).includes(d)){data.attendance.e[d]={status:'P',obraId:'o',ot:0};data.attendanceLocks[`${d}__o`]={locked:true};}
  }
  return data;
}
const options={reviewed:true,dsrPolicy:'weekly',saturdays:false,classifications:{}};
describe('ponto aprovado → holerite',()=>{
  it('importa só mês civil com fechamento, sem transformar ausência de registro em falta',()=>{
    const data=fixture(),ok=buildAttendanceImport(data,employee,'2026-09',options);
    expect(ok.errors).toEqual([]);expect(ok.fields.workedDays).toBeGreaterThan(18);
    delete data.attendance.e['2026-09-02'];
    const missing=buildAttendanceImport(data,employee,'2026-09',options);
    expect(missing.fields.absenceDays).toBe(0);expect(missing.errors.join(' ')).toContain('sem registro');
  });
  it('classifica faltas, meio período, extras e DSR sem duplicar semana',()=>{
    const data=fixture();data.attendance.e['2026-09-01'].status='F';data.attendance.e['2026-09-02'].status='M';data.attendance.e['2026-09-03'].ot=3;
    expect(buildAttendanceImport(data,employee,'2026-09',options).errors.length).toBeGreaterThan(0);
    const classified={...options,classifications:{'2026-09-01':{absence:'unjustified'},'2026-09-02':{absence:'unjustified'},'2026-09-03':{normal:2,special:1}}};
    const result=buildAttendanceImport(data,employee,'2026-09',classified);
    expect(result.errors).toEqual([]);expect(result.fields).toMatchObject({absenceDays:1.5,dsrLostDays:1,overtimeHours:2,extraordinaryHours:1});
  });
  it('ponto reaberto/alterado impede salvar no servidor, preservando pagamentos',()=>{
    const data=fixture(),result=buildAttendanceImport(data,employee,'2026-09',options);
    const draft={competence:'2026-09',...result.fields,attendanceSource:{options,signature:result.signature}};
    expect(attendanceImportIssues(data,employee,draft)).toEqual([]);
    data.attendanceLocks['2026-09-02__o'].locked=false;
    expect(attendanceImportIssues(data,employee,draft).join(' ')).toContain('reaberto');
    const command={type:'FUNCIONARIO_SALVO',expectedVersion:1,payload:{employee:{...employee,cltPayroll:{drafts:{'2026-09':draft}}}}};
    expect(applyEmployeeCommand(data,command).ok).toBe(false);expect(data.financialSettlements).toEqual([{id:'real',amount:7160}]);
  });
  it('não aceita adulteração dos eventos importados',()=>{
    const data=fixture(),result=buildAttendanceImport(data,employee,'2026-09',options);
    expect(attendanceImportIssues(data,employee,{competence:'2026-09',...result.fields,absenceDays:8,attendanceSource:{options,signature:result.signature}}).join(' ')).toContain('divergem');
  });
  it('preserva a origem histórica após desligamento ou lotação posteriores ao mês',()=>{
    const data=fixture(),source=buildAttendanceImport(data,employee,'2026-09',options);
    const draft={competence:'2026-09',...source.fields,attendanceSource:{options,signature:source.signature}};
    expect(attendanceImportIssues(data,{...employee,endDate:'2026-11-06',active:false,obra:'outra-obra'},draft)).toEqual([]);
    expect(attendanceImportIssues(data,{...employee,endDate:'2026-09-20',active:false},draft).join(' ')).toContain('reaberto');
  });
  it('separa dias CLT dos dias por diária no mês de transição e exige proporcionalidade',()=>{
    const data=fixture(),mixed={...employee,remunerationEffectiveFrom:'2026-09-15',remunerationHistory:[{date:'2026-05-01',mode:'daily'},{date:'2026-09-15',mode:'clt'}]};
    const result=buildAttendanceImport(data,mixed,'2026-09',options);
    expect(result.rows.every(r=>r.date>='2026-09-15')).toBe(true);
    expect(attendanceImportIssues(data,mixed,{competence:'2026-09'}).join(' ')).toContain('proporcionalidade');
    expect(attendanceImportIssues(data,mixed,{competence:'2026-09',contractPeriodReviewed:true})).toEqual([]);
  });
  it('prepara recorrências, VT e adiantamentos sem confirmar ou escrever pagamentos',()=>{
    const data=fixture();const emp={...employee,cltPayroll:{profile:{recurringRubrics:[{label:'Adicional',amount:50}],attendancePolicy:{dsrPolicy:'none'}}}};
    data.advances=[{id:'a',empId:'e',date:'2026-09-15',amount:100,status:'ativo',installments:[{dueDate:'2026-09-30',amount:100,status:'programada'}]}];
    const snapshot=JSON.stringify(data),result=prepareMonthlyPayslip(data,emp,'2026-09',{transport:true});
    expect(result.point.errors).toEqual([]);expect(result.draft.custom[0].amount).toBe(50);expect(result.draft.advanceIds).toEqual(['a']);expect(result.draft.transportCost).toBe(result.point.fields.workedDays*10);expect(result.draft.confirmed).toBe(false);expect(JSON.stringify(data)).toBe(snapshot);
  });
});
