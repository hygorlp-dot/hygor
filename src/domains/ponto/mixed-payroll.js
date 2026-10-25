import {getQ,getAtt,getPayrollHolidays,getHolidayPayRule,isEmployeeEmployedOnDate,prIsWeekdayIso,isAttendanceLocked} from './attendance-engine.js';
import {resolveEmployeeAttendanceObraId,resolveHolidayObraId} from './permissions.js';
import {calculateAttendanceDayCost} from './payroll.js';
import {remunerationModeOnDate} from '../rh/remuneration-mode.js';
import {advanceDeductionForPeriod,isAdvanceActive} from '../rh/advance-commands.js';
import {reviewMonthlyPayslip} from './clt-review.js';
import {calculateUnionDue,buildUnionDuePeriodKey} from './union-dues.js';
import {active} from '../financeiro/ledger.js';
import {totalLiquidadoFolha} from '../conciliacao/payroll.js';
import {money} from './clt-payslip.js';
import {validDate} from '../rh/date-validation.js';
import {isDateInClosedPeriod} from '../financeiro/workflows.js';
import {effectiveEmployeeOnDate} from '../rh/remuneration-values.js';

export const MIXED_PAYROLL_COMMAND='QUINZENA_MISTA_APROVADA';
const titleId=(employeeId,start,end,kind)=>`folha:${employeeId}:${start}:${end}:${kind}`;
const sum=rows=>money(rows.reduce((s,v)=>s+Number(v||0),0));
const sourceEmployee=e=>({id:String(e.id),name:e.name||'',version:Number(e.version||0),startDate:e.startDate||'',endDate:e.endDate||'',obra:e.obra||'',dailyRate:Number(e.dailyRate||0),vtDaily:Number(e.vtDaily||0),vrDaily:Number(e.vrDaily||0),workdayHours:Number(e.workdayHours||8),workStart:e.workStart||'07:00',overtimeAdditionalPercent:Number(e.overtimeAdditionalPercent??50),monthlySalary:Number(e.monthlySalary||0),remunerationMode:e.remunerationMode||'daily',remunerationHistory:e.remunerationHistory||[],remunerationValuesHistory:e.remunerationValuesHistory||[]});
// Only calculation inputs enter the optimistic-concurrency signature. Transport
// defaults and object insertion order must not invalidate an unchanged preview.
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])])):value;
const signature=value=>JSON.stringify(stable(value));
const sourceRecord=record=>({status:record.status||'',obraId:String(record.obraId||''),
  entrada:record.entrada||'',intervaloSaida:record.intervaloSaida||'',intervaloRetorno:record.intervaloRetorno||'',saida:record.saida||'',
  ot:Number(record.ot||0),atrasoMin:Number(record.atrasoMin||0),
  ...Object.fromEntries(['archivedDailyRate','archivedVtDaily','archivedVrDaily','archivedWorkdayHours','archivedOvertimeAdditionalPercent'].filter(k=>record[k]!=null).map(k=>[k,Number(record[k])])),
  ...(record.archivedWorkStart!=null?{archivedWorkStart:record.archivedWorkStart}:{})});
const sourceClaims=refs=>refs.map(a=>({id:String(a.id),date:a.date,amount:Number(a.amount)})).sort((a,b)=>a.id.localeCompare(b.id)||a.date.localeCompare(b.date));
const sameClaim=(a,b)=>String(a.id)===String(b.id)&&a.date===b.date;
const overlaps=(title,start,end)=>validDate(title.periodoInicio)&&validDate(title.periodoFim)&&title.periodoInicio<=end&&title.periodoFim>=start;
const unknownKind=title=>!['daily','clt'].includes(title.snapshotCalculo?.kind);
const proportional=(weights,total)=>{let left=Math.round(total*100),weight=weights.reduce((s,r)=>s+r.weight,0);return weights.map((r,i)=>{const cents=i===weights.length-1?left:Math.min(left,Math.round(total*100*r.weight/(weight||1)));left-=cents;return {obraId:r.obraId,valor:cents/100};});};
export function buildMixedPayroll(data,{year,month,cycle='1',cltPlans={}}={}){
  if(!Number.isInteger(Number(year))||Number(year)<2020||Number(year)>2100||!Number.isInteger(Number(month))||Number(month)<0||Number(month)>11||!['1','2'].includes(String(cycle)))return {rows:[],errors:['Período inválido.'],total:0};
  const period=String(cycle)==='1'?getQ(Number(year),Number(month)).q1:getQ(Number(year),Number(month)).q2,start=period[0],end=period.at(-1);
  const holidaySet=new Set([...new Set(period.map(d=>Number(d.slice(0,4))))].flatMap(y=>getPayrollHolidays(data,y)));
  const titles=(data.titulosFolha||[]).filter(active),rows=[];
  for(const employee of data.employees||[]){
    const employed=period.filter(d=>isEmployeeEmployedOnDate(employee,d));if(!employed.length)continue;
    const dailyDates=employed.filter(d=>remunerationModeOnDate(employee,d)==='daily');
    if(dailyDates.length){
      const issues=[],details=[],advanceRefs=[],workWeights=new Map();let gross=0,benefits=0,advances=0,days=0;
      const addWork=(obraId,value)=>workWeights.set(obraId,(workWeights.get(obraId)||0)+value);
      for(const date of dailyDates){
        if(!prIsWeekdayIso(date))continue;
        const record=getAtt(data,employee.id,date),obraId=resolveEmployeeAttendanceObraId({data,employee,date});
        if(holidaySet.has(date)){
          const holiday=getHolidayPayRule(data,employee,date,[...holidaySet]);gross+=Number(holiday.amount);addWork(resolveHolidayObraId({data,employee,holidayIso:date}),Number(holiday.amount));details.push({date,kind:'feriado',amount:Number(holiday.amount)});continue;
        }
        if(!record?.status){issues.push(`${date}: sem registro recebido; resolver sem presumir falta.`);continue;}
        if(!isAttendanceLocked(data,obraId,date))issues.push(`${date}: conferir e fechar o ponto.`);
        if(!['P','M','F'].includes(record.status))issues.push(`${date}: situação não reconhecida.`);
        const cost=calculateAttendanceDayCost({employee,record,config:data.config,date});
        if(!(Number(effectiveEmployeeOnDate(employee,date).dailyRate)>0))issues.push(`${date}: diária vigente não cadastrada.`);
        if(cost.delayReviewRequired)issues.push(`${date}: atraso exige análise.`);
        gross+=cost.laborCost;benefits+=cost.benefitCost;days+=cost.factor;addWork(obraId,cost.laborCost+cost.benefitCost);
        details.push({date,status:record.status,record,lock:data.attendanceLocks?.[`${date}__${obraId}`],obraId,cost});
      }
      for(const advance of (data.advances||[]).filter(a=>String(a.empId)===String(employee.id)&&isAdvanceActive(a))){
        for(const date of dailyDates){const amount=advanceDeductionForPeriod(advance,date,date);if(amount>0){advances+=amount;advanceRefs.push({id:advance.id,date,amount});}}
      }
      const union=calculateUnionDue({employee,config:data.config?.unionDues,payrollCycle:String(cycle),periodEnd:end,periodKey:buildUnionDuePeriodKey(Number(year),Number(month),String(cycle)),hasPayrollMovement:gross>0||advances>0});
      const net=money(gross+benefits-advances-Number(union.amount||0));if(net<0)issues.push('Descontos excedem o valor apurado; encaminhar ajuste identificado.');
      if(net===0)issues.push('Sem saldo positivo para encaminhar neste corte.');
      const id=titleId(employee.id,start,end,'daily'),existing=titles.find(t=>t.id===id);
      const conflicts=titles.filter(t=>String(t.employeeId)===String(employee.id)&&t.id!==id&&overlaps(t,start,end)&&t.snapshotCalculo?.kind!=='clt');
      if(conflicts.length)issues.push('Já existe obrigação de folha sobreposta. Confira o vínculo existente antes de aprovar.');
      const claimed=titles.filter(t=>t.id!==id).flatMap(t=>t.snapshotCalculo?.advanceRefs||[]);
      if(advanceRefs.some(a=>claimed.some(b=>sameClaim(a,b))))issues.push('Parcela de adiantamento já compensada em outro fechamento.');
      const weights=[...workWeights].filter(([,weight])=>weight>0).map(([obraId,weight])=>({obraId,weight}));
      rows.push({id,kind:'daily',employeeId:employee.id,name:employee.name,start,end,competence:end.slice(0,7),gross:money(gross),benefits:money(benefits),advances:money(advances),deductions:money(union.amount||0),net,days,issues,advanceRefs,details,allocations:proportional(weights,Math.max(0,net)),existing,source:signature({employee:sourceEmployee(employee),details:details.map(d=>d.record?{date:d.date,status:d.status,record:sourceRecord(d.record),locked:true,obraId:d.obraId,cost:d.cost}:d),advanceRefs:sourceClaims(advanceRefs),union,existing:existing?.id})});
    }
    if(employed.some(d=>remunerationModeOnDate(employee,d)==='clt')){
      const plan=cltPlans?.[employee.id]||{},competence=String(plan.competence||`${year}-${String(Number(month)+1).padStart(2,'0')}`),review=/^\d{4}-(0[1-9]|1[0-2])$/.test(competence)?reviewMonthlyPayslip(data,employee,competence):{errors:['Competência inválida.'],draft:null,result:null},issues=[...review.errors];
      const id=titleId(employee.id,start,end,`clt:${competence}`),existing=titles.find(t=>t.id===id);
      const legacy=titles.filter(t=>String(t.employeeId)===String(employee.id)&&t.id!==id&&unknownKind(t)&&(t.competencia===competence||overlaps(t,start,end)));
      if(legacy.length)issues.push('Já existe obrigação de folha legada nesta competência ou corte; identifique o vínculo antes de aprovar outra parcela CLT.');
      const previous=titles.filter(t=>String(t.employeeId)===String(employee.id)&&t.id!==id&&t.snapshotCalculo?.kind==='clt'&&t.competencia===competence);
      if(previous.some(t=>!Number.isFinite(Number(t.liquido))||Number(t.liquido)<0))issues.push('Obrigação CLT anterior com valor inválido; revisar o fechamento existente.');
      const reserved=sum(previous.map(t=>t.liquido)),paid=sum(previous.map(totalLiquidadoFolha)),available=money((review.result?.net||0)-reserved);
      const amount=Number(plan.amount);if(plan.amount==null||plan.amount===''||!Number.isFinite(amount)||amount<=0)issues.push('Informe a parcela CLT desta quinzena; não há percentual presumido.');
      if(amount>available+.001)issues.push('Parcela excede o saldo mensal ainda não encaminhado ao financeiro.');
      if(!employed.some(d=>d.slice(0,7)===competence))issues.push('Competência deve corresponder a um dos meses do corte.');
      if(!String(plan.reference||'').trim())issues.push('Identifique o critério da parcela confirmado pelo RH/contabilidade.');
      const advanceRefs=[];
      for(const advance of (data.advances||[]).filter(a=>String(a.empId)===String(employee.id)&&isAdvanceActive(a)&&(review.draft?.advanceIds||[]).includes(a.id))){
        const last=new Date(Date.UTC(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0)).getUTCDate();
        for(let day=1;day<=last;day++){const date=`${competence}-${String(day).padStart(2,'0')}`,amount=advanceDeductionForPeriod(advance,date,date);if(amount>0)advanceRefs.push({id:advance.id,date,amount});}
      }
      if(previous.some(t=>(t.snapshotCalculo?.advanceRefs||[]).some(a=>advanceRefs.some(b=>sameClaim(a,b)&&money(a.amount)!==money(b.amount)))))issues.push('Valor de adiantamento diverge do holerite já encaminhado; revisar o fechamento anterior.');
      // A monthly deduction is shared by instalments of that same CLT payslip,
      // never by a daily title, another competence or an unidentified legacy title.
      const claimed=titles.filter(t=>t.id!==id&&!(t.snapshotCalculo?.kind==='clt'&&String(t.employeeId)===String(employee.id)&&t.competencia===competence)).flatMap(t=>t.snapshotCalculo?.advanceRefs||[]);
      if(advanceRefs.some(a=>claimed.some(b=>sameClaim(a,b))))issues.push('Adiantamento do holerite já reservado em outro fechamento; revisar a fonte mensal.');
      rows.push({id,kind:'clt',employeeId:employee.id,name:employee.name,start,end,competence,gross:review.result?.gross||0,benefits:0,advances:review.result?.deductions||0,deductions:0,net:money(amount),monthlyNet:review.result?.net??null,previousPaid:paid,available,issues,advanceRefs,details:[],allocations:[],existing,source:signature({employee:sourceEmployee(employee),review:{draft:review.draft,result:review.result,errors:review.errors},previous:previous.map(t=>({id:t.id,net:Number(t.liquido)})).sort((a,b)=>String(a.id).localeCompare(String(b.id))),plan:{competence,amount:Number(plan.amount),reference:String(plan.reference||'').trim()}})});
    }
  }
  for(const row of rows)if((data.titulosFolha||[]).some(t=>t.id===row.id&&!active(t)))row.issues.push('Este fechamento foi cancelado ou estornado; utilize um ajuste identificado, sem recriar a obrigação.');
  return {rows,start,end,total:sum(rows.filter(r=>!r.issues.length&&!r.existing).map(r=>r.net)),errors:[]};
}
export function applyMixedPayroll(data,command,now){
  if(command.type!==MIXED_PAYROLL_COMMAND)return null;
  const {period,rowIds,sources,paymentDate}=command.payload||{};
  if(!command.actorId)return {ok:false,reason:'Operador autenticado ausente.'};
  if(!validDate(paymentDate))return {ok:false,reason:'Informe a data prevista de pagamento.'};
  if(isDateInClosedPeriod(data,paymentDate))return {ok:false,reason:'A data prevista está em período financeiro fechado.'};
  if(!Array.isArray(rowIds))return {ok:false,reason:'Selecione demonstrativos válidos.'};
  const built=buildMixedPayroll(data,period||{}),ids=[...new Set(rowIds)];
  if(!ids.length||built.errors.length)return {ok:false,reason:'Selecione demonstrativos válidos.'};
  const selected=ids.map(id=>built.rows.find(r=>r.id===id));
  if(selected.some(r=>!r))return {ok:false,reason:'O fechamento mudou. Atualize a preparação.'};
  const pending=selected.filter(r=>!r.existing);
  if(!pending.length)return {ok:true,data,entityId:ids.join('|'),idempotent:true};
  if(!Number.isFinite(new Date(now).getTime()))return {ok:false,reason:'Data de aprovação inválida.'};
  if(new Date(now).toISOString().slice(0,10)<built.end)return {ok:false,reason:'O corte ainda está em andamento. Prepare a prévia e aprove depois do último dia.'};
  for(const row of pending)if(row.issues.length||sources?.[row.id]!==row.source)return {ok:false,reason:row.issues[0]||'Os dados de origem mudaram. Atualize e aprove novamente.'};
  const claims=pending.flatMap(r=>r.advanceRefs.map(a=>({...a,kind:r.kind})));
  if(claims.some((a,i)=>claims.some((b,j)=>i!==j&&a.kind!==b.kind&&sameClaim(a,b))))return {ok:false,reason:'A mesma parcela está na diária e no CLT. Revise antes de aprovar.'};
  const records=pending.map(row=>({id:row.id,employeeId:row.employeeId,funcionarioNome:row.name,periodoInicio:row.start,periodoFim:row.end,competencia:row.competence,vencimento:paymentDate,bruto:row.kind==='daily'?row.gross:row.net,beneficios:row.benefits,adiantamentos:row.kind==='daily'?row.advances:0,descontos:row.deductions,liquido:row.net,valorPago:0,saldo:row.net,status:'em_aberto',rateiosPorObra:row.allocations,snapshotCalculo:{kind:row.kind,source:row.source,advanceRefs:row.advanceRefs,details:row.details,monthlyNet:row.monthlyNet,criterion:period.cltPlans?.[row.employeeId]?.reference||'',approvedAt:now,approvedBy:command.actorId},liquidacoes:[],criadoEm:now,fechadoEm:now,fechadoPor:command.actorName||command.actorId}));
  return {ok:true,data:{...data,titulosFolha:[...(data.titulosFolha||[]),...records]},entityId:records.map(r=>r.id).join('|')};
}
