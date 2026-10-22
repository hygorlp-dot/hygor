const validSelectedObra = value => value && value !== "all";

// Transferências de cada funcionário, já filtradas e em ordem decrescente de
// data, montadas UMA vez por lista de eventos (antes: filtro + ordenação do
// changeLog inteiro a cada consulta de um funcionário/dia - o maior custo da
// DRE e da folha). O dataset é imutável entre renders/requisições; a chave
// inclui o tamanho da lista por segurança.
const transferCache = new WeakMap();
const transfersOf = (employee, transferEvents) => {
  const events = Array.isArray(transferEvents) ? transferEvents : [];
  let byEmployee = transferCache.get(events);
  if (!byEmployee || byEmployee.size_ !== events.length) {
    byEmployee = new Map();
    byEmployee.size_ = events.length;
    for (const event of events) {
      if (event?.type !== "transfer" || !event.date) continue;
      const empId = String(event.empId || "");
      if (!byEmployee.has(empId)) byEmployee.set(empId, []);
      byEmployee.get(empId).push(event);
    }
    transferCache.set(events, byEmployee);
  }
  const fromLog = byEmployee.get(String(employee.id || "")) || [];
  const storedHistory = (employee.obraHistory || []).map(event => ({
    type:"transfer",empId:employee.id,date:event.date,
    fromId:event.fromObraId||event.fromId,toId:event.toObraId||event.toId,
  })).filter(event => event.date);
  return [...fromLog, ...storedHistory]
    .sort((left,right)=>String(right.date).localeCompare(String(left.date)));
};

export const resolveHistoricalEmployeeObraId = ({
  employee,
  date,
  transferEvents=[],
  obras=[],
} = {}) => {
  if(!employee||!date)return "";
  const transfers=transfersOf(employee,transferEvents);
  let obraId=String(employee.obra||employee.obraId||employee.lastObra||"");
  if(!transfers.length)return obraId;
  let byName=null;
  for(const transfer of transfers){
    if(String(transfer.date)>String(date)){
      if(transfer.fromId){obraId=String(transfer.fromId);continue;}
      byName??=new Map((obras||[]).map(obra=>[String(obra?.name||""),String(obra?.id||"")]));
      obraId=String(byName.get(String(transfer.from||""))||obraId);
      continue;
    }
    break;
  }
  return obraId;
};

// Uma única prioridade atende tela, servidor, folha e relatórios. A seleção
// explícita representa a decisão do operador para aquele lançamento; depois
// vêm o fato já persistido, a lotação histórica e, por último, a lotação atual.
export const resolveAttendanceObraId = ({
  selectedObraId,
  record,
  historicalObraId,
  employeeObraId,
} = {}) => {
  if(validSelectedObra(selectedObraId))return String(selectedObraId);
  if(record?.obraId||record?.obra)return String(record.obraId||record.obra);
  if(historicalObraId)return String(historicalObraId);
  return String(employeeObraId||"");
};

export const resolveEmployeeAttendanceObraId=({
  data={},employee,date,selectedObraId,record,
}={})=>resolveAttendanceObraId({
  selectedObraId,
  record:record??data?.attendance?.[employee?.id]?.[date],
  historicalObraId:resolveHistoricalEmployeeObraId({
    employee,date,transferEvents:data?.changeLog||[],obras:data?.obras||[],
  }),
  employeeObraId:employee?.obra||employee?.obraId||employee?.lastObra||"",
});

export const canManageAttendanceWorkforce = role =>
  ["admin", "rh"].includes(String(role || ""));

// Feriado não tem ponto: a obra que paga o feriado é a do ÚLTIMO DIA
// TRABALHADO antes dele (presença ou meio período), com a obra carimbada no
// ponto daquele dia. Sem dia trabalhado na janela, vale a lotação histórica
// na data do feriado. Ponto lançado no próprio feriado NÃO muda a obra
// (decisão de 20/10/2026: sempre a obra do dia anterior). Regra única para folha,
// DRE, base da taxa de administração e servidor.
export const HOLIDAY_OBRA_LOOKBACK_DAYS = 31;
const WORKED_STATUSES = new Set(["P", "M"]);
const statusOf = record => (typeof record === "string" ? record : record?.status) || "";
const previousIsoDate = value => {
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return date.toISOString().slice(0, 10);
};

export const resolveHolidayObraId = ({
  data = {}, employee, holidayIso, lookbackDays = HOLIDAY_OBRA_LOOKBACK_DAYS,
} = {}) => {
  const records = data?.attendance?.[employee?.id] || {};
  let date = holidayIso;
  for (let i = 0; i < lookbackDays; i++) {
    date = previousIsoDate(date);
    const record = records[date];
    if (!WORKED_STATUSES.has(statusOf(record))) continue;
    return resolveEmployeeAttendanceObraId({
      data, employee, date, record: typeof record === "string" ? { status: record } : record,
    });
  }
  return resolveEmployeeAttendanceObraId({ data, employee, date: holidayIso, record: null });
};
