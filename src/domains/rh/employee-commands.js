export const EMPLOYEE_COMMAND = Object.freeze({
  EMPLOYEE_SAVED:"FUNCIONARIO_SALVO",
});

export const EMPLOYEE_COMMAND_TYPES = new Set(Object.values(EMPLOYEE_COMMAND));

const fail = reason => ({ ok:false, reason });
const versionOf = item => Number(item?.version || 0);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const employeeById = (data, id) =>
  (data.employees || []).find(item => String(item.id) === String(id));
const obraName = (data, id) =>
  (data.obras || []).find(item => String(item.id) === String(id))?.name || "Sem obra";
const finiteNonNegative = value => Number.isFinite(Number(value)) && Number(value) >= 0;

export const employeeCommandObraId = (data = {}, command = {}) => {
  const raw = command.payload?.employee || {};
  const current = employeeById(data, raw.id);
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
  if (before.active !== false && employee.active === false) {
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
  if (before.active === false && employee.active !== false) {
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
  return events;
};

export const applyEmployeeCommand = (
  data = {},
  command = {},
  now = new Date().toISOString(),
) => {
  if (!EMPLOYEE_COMMAND_TYPES.has(command.type)) return null;
  const raw = command.payload?.employee || {};
  const id = String(raw.id || "").trim();
  const before = employeeById(data, id);
  if (!id) return fail("O funcionário precisa de uma identificação única.");
  if (before && versionOf(before) !== Number(command.expectedVersion)) {
    return fail("O funcionário foi alterado por outra pessoa. Atualize a tela.");
  }
  if (!before && Number(command.expectedVersion || 0) !== 0) {
    return fail("A versão inicial do funcionário é inválida.");
  }
  const name = String(raw.name || "").trim();
  if (!name) return fail("Informe o nome do funcionário.");
  if (!validDate(raw.startDate)) return fail("Informe uma data de admissão válida.");
  const dailyRate = Number(raw.dailyRate || 0);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0) {
    return fail("Informe uma diária positiva para o funcionário.");
  }
  const active = raw.active !== false;
  const endDate = active ? "" : String(raw.endDate || "");
  if (!active && !validDate(endDate)) {
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
  const employee = {
    ...raw,
    id,
    name,
    role:String(raw.role || "").trim(),
    workArea,
    obra:obraId,
    dailyRate,
    vtDaily:Number(raw.vtDaily || 0),
    vrDaily:Number(raw.vrDaily || 0),
    workdayHours,
    workStart:String(raw.workStart || "07:00"),
    overtimeAdditionalPercent:Number(raw.overtimeAdditionalPercent ?? 50),
    active,
    startDate:String(raw.startDate),
    endDate,
    terminationReason:active ? "" : String(raw.terminationReason || "Inativado").trim(),
    lastObra:active
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
