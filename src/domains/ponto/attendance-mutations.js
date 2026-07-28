import { normalizeAttendanceRecord } from "./records";

const EMPTY_RECORD = {
  status:null,
  ot:0,
  note:"",
  obraId:"",
};

const statusKeepsWorkedTime = status => ["P", "M"].includes(status);

const buildRecord = ({ previous, status, obraId }) => {
  const record=normalizeAttendanceRecord(previous) || EMPTY_RECORD;
  const keepsWorkedTime=statusKeepsWorkedTime(status);

  return {
    ...record,
    status,
    ot:keepsWorkedTime ? Number(record.ot || 0) : 0,
    entrada:keepsWorkedTime ? (record.entrada || "") : "",
    intervaloSaida:keepsWorkedTime ? (record.intervaloSaida || "") : "",
    intervaloRetorno:keepsWorkedTime ? (record.intervaloRetorno || "") : "",
    saida:keepsWorkedTime ? (record.saida || "") : "",
    workedMinutes:keepsWorkedTime ? Number(record.workedMinutes || 0) : 0,
    atrasoMin:keepsWorkedTime ? Number(record.atrasoMin || 0) : 0,
    obraId:status ? String(obraId || record.obraId || "") : String(record.obraId || ""),
  };
};

export const applyAttendanceStatus = ({
  data,
  employeeId,
  date,
  status,
  obraId,
  currentDate,
  toggle=true,
} = {}) => {
  const previous=data?.attendance?.[employeeId]?.[date];
  const normalizedPrevious=normalizeAttendanceRecord(previous);
  const nextStatus=toggle && normalizedPrevious?.status === status ? null : status;

  return {
    ...data,
    attendance:{
      ...(data?.attendance || {}),
      [employeeId]:{
        ...(data?.attendance?.[employeeId] || {}),
        [date]:buildRecord({previous,status:nextStatus,obraId}),
      },
    },
    // O primeiro lançamento do dia também confirma a equipe. Assim o
    // operador não precisa executar uma etapa separada antes de bater ponto.
    dailyCheckDate:date === currentDate ? currentDate : (data?.dailyCheckDate || ""),
  };
};

export const applyAttendanceStatusBatch = ({
  data,
  employees=[],
  date,
  status,
  obraId,
  currentDate,
} = {}) => {
  let next=data;
  for (const employee of employees) {
    next=applyAttendanceStatus({
      data:next,
      employeeId:employee.id,
      date,
      status,
      obraId,
      currentDate,
      toggle:false,
    });
  }
  return next;
};
