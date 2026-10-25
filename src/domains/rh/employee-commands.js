import { validDate } from "./date-validation.js";
import {active as activeFinancialRecord} from "../financeiro/ledger.js";
import {attendanceImportIssues} from '../ponto/clt-attendance.js';
import {attendancePayModeDecision,latestClosedPayrollDate} from './attendance-pay-mode.js';
import {REMUNERATION_VALUE_FIELDS,remunerationValues} from './remuneration-values.js';

export const EMPLOYEE_COMMAND = Object.freeze({
  EMPLOYEE_SAVED:"FUNCIONARIO_SALVO",
  EMPLOYEE_PAY_MODE_SET:'FUNCIONARIO_MODALIDADE_DEFINIDA',
});

export const EMPLOYEE_COMMAND_TYPES = new Set(Object.values(EMPLOYEE_COMMAND));

const fail = reason => ({ ok:false, reason });
const versionOf = item => Number(item?.version || 0);
const employeeById = (data, id) =>
  (data.employees || []).find(item => String(item.id) === String(id));
const obraName = (data, id) =>
  (data.obras || []).find(item => String(item.id) === String(id))?.name || "Sem obra";
const finiteNonNegative = value => Number.isFinite(Number(value)) && Number(value) >= 0;

export const employeeLifecycleStatus = (employee, referenceDate = new Date().toISOString().slice(0, 10)) => {
  if (employee?.status === "arquivado") return "arquivado";
  const endDate = String(employee?.endDate || "");
  if (endDate && endDate >= String(referenceDate || "")) return "desligamento_agendado";
  if (employee?.active === false || endDate) return "desligado";
  return "ativo";
};

export const employeeCommandObraId = (data = {}, command = {}) => {
  const raw = command.payload?.employee || {};
  const current = employeeById(data, raw.id||command.payload?.employeeId);
  return String(raw.obra || current?.obra || "");
};

const appendChange = (events, event) => {
  if (event) events.push(event);
};

const employeeChangeLog = ({ data, before, employee, actorName, now }) => {
  const events = [...(data.changeLog || [])];
  const common = {
    id:`employee-${employee.id}-${now}-${events.length}`,
    date:String(now).slice(0, 10),
    empId:employee.id,
    empName:employee.name,
    operador:actorName || "Usuário autenticado",
  };
  if (!before) {
    appendChange(events, {
      ...common,
      type:"created",
      message:`Funcionário cadastrado: ${employee.name}`,
    });
    return events;
  }
  if (String(before.obra || "") !== String(employee.obra || "")) {
    appendChange(events, {
      ...common,
      type:"transfer",
      from:obraName(data, before.obra),
      to:obraName(data, employee.obra),
      fromId:String(before.obra || ""),
      toId:String(employee.obra || ""),
      message:employee.obra
        ? `${employee.name} transferido de ${obraName(data, before.obra)} para ${obraName(data, employee.obra)}`
        : `${employee.name} desvinculado da obra ${obraName(data, before.obra)}`,
    });
  }
  const scheduledNow = employee.status === "desligamento_agendado";
  const scheduledBefore = before.status === "desligamento_agendado";
  if (!scheduledBefore && scheduledNow) {
    appendChange(events, {
      ...common,
      date:employee.endDate || common.date,
      type:"dismissal_scheduled",
      from:obraName(data, before.obra),
      motivo:employee.terminationReason || "",
      message:`Desligamento de ${employee.name} agendado; último dia trabalhado em ${employee.endDate}.`,
    });
  } else if (before.active !== false && employee.active === false) {
    appendChange(events, {
      ...common,
      date:employee.endDate || common.date,
      type:employee.status === "arquivado" ? "employee_archived" : "dismissal",
      from:obraName(data, before.obra),
      motivo:employee.terminationReason || employee.motivoCancelamento || "",
      message:employee.status === "arquivado"
        ? `${employee.name} arquivado; ponto e histórico foram preservados.`
        : `${employee.name} inativado/demitido em ${employee.endDate}`,
    });
  }
  if ((before.active === false || scheduledBefore) && employee.active !== false && !scheduledNow) {
    appendChange(events, {
      ...common,
      type:"reactivation",
      message:`${employee.name} reativado.`,
    });
  }
  if (String(before.role || "") !== String(employee.role || "")) {
    appendChange(events, {
      ...common,
      type:"promotion",
      from:before.role || "Sem função registrada",
      to:employee.role || "Sem função registrada",
      message:`${employee.name} mudou de função: ${before.role || "sem função"} → ${employee.role || "sem função"}`,
    });
  }
  if (Number(before.dailyRate || 0) !== Number(employee.dailyRate || 0)) {
    appendChange(events, {
      ...common,
      type:"salary_change",
      from:Number(before.dailyRate || 0),
      to:Number(employee.dailyRate || 0),
      message:`${employee.name} teve a diária alterada.`,
    });
  }
  if((before.remunerationMode||"daily")!==employee.remunerationMode||Number(before.monthlySalary||0)!==Number(employee.monthlySalary||0))appendChange(events,{...common,type:"remuneration_change",message:`Modalidade/salário contratual de ${employee.name} alterado. Vigência: ${employee.remunerationEffectiveFrom||employee.startDate}.`,from:before.remunerationMode||"daily",to:employee.remunerationMode});
  return events;
};

const stableDraft=value=>Array.isArray(value)?value.map(stableDraft):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,stableDraft(value[key])])):value;
const sameDraft=(a,b)=>JSON.stringify(stableDraft(a))===JSON.stringify(stableDraft(b));
const financialClosedUntil=data=>(data.fechamentosFinanceiros||[]).filter(p=>p.status==='fechado'&&validDate(p.dataFim)).map(p=>p.dataFim).sort().at(-1)||'';
const protectedDraft=(data,employee,period)=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return false;
  const first=period+'-01',last=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10);
  if((data.fechamentosFinanceiros||[]).some(p=>p.status==='fechado'&&p.dataInicio<=last&&p.dataFim>=first))return true;
  if((data.titulosFolha||[]).some(t=>activeFinancialRecord(t)&&String(t.employeeId)===String(employee.id)
    &&(t.competencia===period||validDate(t.periodoInicio)&&validDate(t.periodoFim)&&t.periodoInicio<=last&&t.periodoFim>=first)))return true;
  // Archives are an existing global payroll boundary, shared with pay-mode
  // and value protection. Preserve old drafts even when only the key remains.
  const archiveBoundary=latestClosedPayrollDate({...data,titulosFolha:[],employees:[]},{...employee,cltPayroll:{}});
  return !!archiveBoundary&&first<=archiveBoundary;
};

export const applyEmployeeCommand = (
  data = {},
  command = {},
  now = new Date().toISOString(),
) => {
  if (!EMPLOYEE_COMMAND_TYPES.has(command.type)) return null;
  const decision=command.type===EMPLOYEE_COMMAND.EMPLOYEE_PAY_MODE_SET?attendancePayModeDecision(data,command,now):null;
  if(decision&&!decision.ok)return fail(decision.reason);
  const raw = decision?.employee||command.payload?.employee || {};
  const id = String(raw.id || "").trim();
  const before = employeeById(data, id);
  if (!id) return fail("O funcionário precisa de uma identificação única.");
  if (before && versionOf(before) !== Number(command.expectedVersion)) {
    return fail("O funcionário foi alterado por outra pessoa. Atualize a tela.");
  }
  if (!before && Number(command.expectedVersion || 0) !== 0) {
    return fail("A versão inicial do funcionário é inválida.");
  }
  if(before){
    for(const period of new Set([...Object.keys(before.cltPayroll?.drafts||{}),...Object.keys(raw.cltPayroll?.drafts||{})])){
      if(protectedDraft(data,before,period)&&!sameDraft(before.cltPayroll?.drafts?.[period],raw.cltPayroll?.drafts?.[period]))return fail('O holerite pertence a mês fechado, arquivado ou já encaminhado ao financeiro. Registre revisão identificada, sem alterar ou remover o demonstrativo histórico.');
    }
  }
  const name = String(raw.name || "").trim();
  for(const [period,draft] of Object.entries(raw.cltPayroll?.drafts||{})){
    if(JSON.stringify(draft)===JSON.stringify(before?.cltPayroll?.drafts?.[period]))continue;
    const issues=attendanceImportIssues(data,{...before,...raw},draft);
    if(issues.length)return fail(issues[0]);
    if(draft.attendanceSource?.manualReason&&String(draft.attendanceSource.manualReason).trim().length<10)return fail('Justifique o ajuste manual dos eventos importados.');
  }
  if (!name) return fail("Informe o nome do funcionário.");
  if (!validDate(raw.startDate)) return fail("Informe uma data de admissão válida.");
  const dailyRate = Number(raw.dailyRate || 0);
  if(raw.remunerationMode&&!["daily","clt"].includes(raw.remunerationMode))return fail("Modalidade de remuneração inválida.");
  if(raw.remunerationMode==="clt"&&!(Number.isFinite(Number(raw.monthlySalary))&&Number(raw.monthlySalary)>0))return fail("Informe o salário contratual mensal para a modalidade CLT.");
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return fail("Informe uma diária positiva para o funcionário.");
  }
  const scheduled = raw.status === "desligamento_agendado";
  const active = scheduled ? true : raw.active !== false;
  const endDate = active && !scheduled ? "" : String(raw.endDate || "");
  if ((!active || scheduled) && !validDate(endDate)) {
    return fail("Informe uma data de término válida para inativar o funcionário.");
  }
  if (endDate && String(endDate) < String(raw.startDate)) {
    return fail("A data de término não pode anteceder a admissão.");
  }
  const obraId = String(raw.obra || "");
  const workArea = ["campo","administrativo"].includes(raw.workArea)
    ? raw.workArea
    : (obraId || raw.lastObra ? "campo" : "administrativo");
  if (workArea === "administrativo" && obraId) {
    return fail("Funcionário administrativo não deve possuir lotação fixa em uma obra.");
  }
  if (obraId && !(data.obras || []).some(item => String(item.id) === obraId)) {
    return fail("A obra informada para o funcionário não existe.");
  }
  const numericFields = ["vtDaily", "vrDaily", "overtimeAdditionalPercent"];
  if (numericFields.some(field => !finiteNonNegative(raw[field] || 0))) {
    return fail("Os valores de benefícios e adicionais não podem ser negativos.");
  }
  const workdayHours = Number(raw.workdayHours || 8);
  if (!Number.isFinite(workdayHours) || workdayHours < 1 || workdayHours > 24) {
    return fail("A jornada padrão precisa estar entre 1 e 24 horas.");
  }
  const actorId = String(command.actorId || "");
  const actorName = String(command.actorName || "").trim() || "Usuário autenticado";
  if (!actorId) return fail("Sessão do usuário indisponível para salvar o funcionário.");
  const mode=raw.remunerationMode==="clt"?"clt":"daily";
  const previousMode=before?.remunerationMode==="clt"?"clt":"daily";
  const modeChanged=mode!==previousMode;
  const modeDate=String(raw.remunerationEffectiveFrom||raw.startDate);
  if(modeChanged&&(!validDate(modeDate)||modeDate<raw.startDate))return fail("Informe uma vigência da modalidade igual ou posterior à admissão.");
  const protectedUntil=before?[latestClosedPayrollDate(data,before),financialClosedUntil(data)].sort().at(-1)||'':'';
  const lifecycleChanged=before&&(String(before.endDate||'')!==endDate||(before.active!==false)!==active);
  if(lifecycleChanged&&(data.rescisoes||[]).some(r=>activeFinancialRecord(r)&&String(r.empId)===String(before.id)))return fail('O vínculo possui rescisão registrada. Solicite revisão identificada da rescisão antes de alterar desligamento ou reativação.');
  if(lifecycleChanged&&protectedUntil&&[before.endDate,endDate].some(date=>validDate(date)&&date<=protectedUntil))return fail('O desligamento ou reativação altera vínculo de período fechado. Solicite revisão identificada, preservando o histórico de ponto e custos.');
  if(before&&modeChanged&&protectedUntil&&modeDate<=protectedUntil)return fail(`A vigência deve ser posterior a ${protectedUntil}; folhas fechadas são preservadas também na edição do cadastro.`);
  if(before&&protectedUntil&&String(raw.startDate)!==String(before.startDate))return fail('A admissão participa de períodos fechados. Solicite revisão identificada, sem alterar o histórico pelo cadastro.');
  const previousValues=remunerationValues(before),nextValues=remunerationValues(raw);
  const valueChanged=before&&REMUNERATION_VALUE_FIELDS.some(key=>previousValues[key]!==nextValues[key]);
  const valueDate=String(raw.remunerationValueEffectiveFrom||'');
  if(valueChanged&&(!validDate(valueDate)||valueDate<raw.startDate||protectedUntil&&valueDate<=protectedUntil))return fail(`Alterações de valor/jornada exigem reajuste com vigência válida${protectedUntil?` posterior a ${protectedUntil}`:''}; o cadastro não recalcula períodos pagos.`);
  if(valueChanged&&String(raw.remunerationValueReason||'').trim().length<10)return fail('Informe o motivo do reajuste de valor/jornada (ao menos 10 caracteres).');
  const valuesOf=remunerationValues;
  const existingValues=before?.remunerationValuesHistory?.length?before.remunerationValuesHistory:before?[{date:before.startDate,...valuesOf(before),source:'baseline_preservada'}]:[];
  const remunerationValuesHistory=valueChanged?[...existingValues,{date:valueDate,...valuesOf(raw),reason:String(raw.remunerationValueReason).trim().slice(0,1000),changedAt:now,changedBy:actorId}]:before?.remunerationValuesHistory||[];
  const baseHistory=before?.remunerationHistory?.length?before.remunerationHistory:[{date:before?.remunerationEffectiveFrom||before?.startDate||raw.startDate,mode:previousMode}];
  const remunerationHistory=modeChanged?[...baseHistory,{date:modeDate,mode,changedAt:now,changedBy:actorId}]:before?.remunerationHistory||[];
  const employee = {
    ...raw,
    id,
    name,
    role:String(raw.role || "").trim(),
    workArea,
    obra:obraId,
    dailyRate,
    remunerationMode:mode,
    remunerationEffectiveFrom:modeChanged?modeDate:before?.remunerationEffectiveFrom||raw.remunerationEffectiveFrom||"",
    remunerationHistory,
    remunerationValuesHistory,
    remunerationValueEffectiveFrom:valueChanged?valueDate:before?.remunerationValueEffectiveFrom||'',
    remunerationValueReason:valueChanged?String(raw.remunerationValueReason).trim():before?.remunerationValueReason||'',
    payModeDecisions:decision?raw.payModeDecisions:before?.payModeDecisions||[],
    vtDaily:Number(raw.vtDaily || 0),
    vrDaily:Number(raw.vrDaily || 0),
    workdayHours,
    workStart:String(raw.workStart || "07:00"),
    overtimeAdditionalPercent:Number(raw.overtimeAdditionalPercent ?? 50),
    active,
    startDate:String(raw.startDate),
    endDate,
    status:scheduled ? "desligamento_agendado" : (raw.status === "arquivado" ? "arquivado" : (active ? "ativo" : "desligado")),
    terminationReason:active && !scheduled ? "" : String(raw.terminationReason || "Inativado").trim(),
    lastObra:active && !scheduled
      ? String(raw.lastObra || before?.lastObra || "")
      : String(raw.lastObra || before?.obra || before?.lastObra || obraId),
    version:versionOf(before) + 1,
    createdAt:before?.createdAt || now,
    createdById:before?.createdById || actorId,
    createdBy:before?.createdBy || actorName,
    updatedAt:now,
    updatedById:actorId,
    updatedBy:actorName,
  };
  const employees = before
    ? (data.employees || []).map(item => String(item.id) === id ? employee : item)
    : [...(data.employees || []), employee];
  return {
    ok:true,
    entityId:id,
    data:{
      ...data,
      employees,
      changeLog:employeeChangeLog({ data, before, employee, actorName, now }),
    },
  };
};
