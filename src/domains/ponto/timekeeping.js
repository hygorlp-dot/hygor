const MINUTES_PER_DAY = 24 * 60;

const parseClock = value => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};
const durationBetween = (start, end, allowOvernight = true) => {
  if (start == null || end == null || start === end) return null;
  if (end > start) return end - start;
  return allowOvernight ? end + MINUTES_PER_DAY - start : null;
};

export const formatMinutes = value => {
  const minutes = Math.max(0, Math.round(Number(value || 0)));
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
};

/**
 * Calcula a jornada informada sem depender da interface.
 * Horários de entrada/saída podem atravessar meia-noite. O intervalo precisa
 * estar completamente preenchido e em ordem dentro da jornada.
 */
export const calculateTimekeeping = ({
  entrada = "",
  intervaloSaida = "",
  intervaloRetorno = "",
  saida = "",
  jornadaInicio = "07:00",
} = {}) => {
  const hasAnyClock = [entrada, intervaloSaida, intervaloRetorno, saida].some(Boolean);
  if (!hasAnyClock) {
    return { valid:true, empty:true, workedMinutes:0, breakMinutes:0, delayMinutes:0 };
  }

  const start = parseClock(entrada);
  const end = parseClock(saida);
  if (start == null || end == null) {
    return { valid:false, error:"Informe entrada e saída em horários válidos." };
  }
  const grossMinutes = durationBetween(start, end);
  if (grossMinutes == null) {
    return { valid:false, error:"Entrada e saída não podem ser iguais." };
  }

  const hasBreakStart = Boolean(intervaloSaida);
  const hasBreakEnd = Boolean(intervaloRetorno);
  if (hasBreakStart !== hasBreakEnd) {
    return { valid:false, error:"Informe a saída e o retorno do intervalo." };
  }

  let breakMinutes = 0;
  if (hasBreakStart) {
    let breakStart = parseClock(intervaloSaida);
    let breakEnd = parseClock(intervaloRetorno);
    if (breakStart == null || breakEnd == null) {
      return { valid:false, error:"O intervalo contém um horário inválido." };
    }
    if (breakStart < start) breakStart += MINUTES_PER_DAY;
    if (breakEnd < start) breakEnd += MINUTES_PER_DAY;
    const absoluteEnd = start + grossMinutes;
    if (breakEnd <= breakStart || breakStart >= absoluteEnd || breakEnd > absoluteEnd) {
      return { valid:false, error:"O intervalo precisa estar em ordem e dentro da jornada." };
    }
    breakMinutes = breakEnd - breakStart;
  }

  const workedMinutes = grossMinutes - breakMinutes;
  if (workedMinutes <= 0 || workedMinutes > MINUTES_PER_DAY) {
    return { valid:false, error:"A jornada calculada é inválida." };
  }

  const scheduledStart = parseClock(jornadaInicio);
  const delayMinutes = scheduledStart == null ? 0 : Math.max(0, start - scheduledStart);
  return {
    valid:true,
    empty:false,
    workedMinutes,
    breakMinutes,
    delayMinutes,
  };
};
