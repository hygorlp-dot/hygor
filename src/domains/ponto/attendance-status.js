// Situações de um dia no ponto. Até 28/10/2026 só existiam P/M/F, e férias,
// atestado e folga caíam como falta (pagamento zero). Agora são situações
// próprias: não contam como falta, não geram hora extra nem VT/VR, e pagam a
// diária pelo fator configurado (decisão D4 do roadmap de correção).

export const ATTENDANCE_STATUS = Object.freeze({
  PRESENT:"P", HALF_DAY:"M", ABSENT:"F",
  VACATION:"FE", MEDICAL_LEAVE:"AT", DAY_OFF:"FG",
});

export const WORKED_STATUSES = Object.freeze(["P","M"]);
export const LEAVE_STATUSES = Object.freeze(["FE","AT","FG"]);
export const ATTENDANCE_STATUSES = Object.freeze([...WORKED_STATUSES,"F",...LEAVE_STATUSES]);

export const ATTENDANCE_STATUS_LABEL = Object.freeze({
  P:"Presente", M:"Meio dia", F:"Falta", FE:"Férias", AT:"Atestado", FG:"Folga",
});

// Fator da diária paga em cada afastamento. Padrão: férias e atestado pagam
// o dia; folga (compensação já paga em outro dia) não paga. A empresa ajusta
// em config.attendanceLeavePayFactors (valores entre 0 e 1).
export const DEFAULT_LEAVE_PAY_FACTORS = Object.freeze({ FE:1, AT:1, FG:0 });

export const isValidAttendanceStatus = status => ATTENDANCE_STATUSES.includes(status);
export const isWorkedStatus = status => WORKED_STATUSES.includes(status);
export const isLeaveStatus = status => LEAVE_STATUSES.includes(status);

export const leavePayFactor = (status, config = {}) => {
  if (!isLeaveStatus(status)) return 0;
  const configured = Number(config?.attendanceLeavePayFactors?.[status]);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : DEFAULT_LEAVE_PAY_FACTORS[status];
};

// Quanto da jornada foi trabalhado (VT/VR, hora extra e "dias trabalhados").
export const workedFactor = status => status === "P" ? 1 : status === "M" ? 0.5 : 0;

// Quanto da diária é pago no dia.
export const payFactor = (status, config = {}) =>
  isWorkedStatus(status) ? workedFactor(status) : leavePayFactor(status, config);
