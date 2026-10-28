import { calculateAttendanceDayCost } from "../ponto/payroll.js";
import { resolveEmployeeAttendanceObraId, resolveHolidayObraId } from "../ponto/permissions.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";
import { laborChargeFactor } from "./labor-charges.js";

const requiredFunction = (value, name) => {
  if (typeof value !== "function") {
    throw new TypeError(`Motor de mão de obra requer ${name}.`);
  }
  return value;
};

// Traduz o domínio operacional de Ponto em custo de competência. As regras de
// calendário continuam injetadas porque pertencem ao contexto de RH; o motor
// financeiro recebe somente os resultados necessários e não conhece a UI.
export const createLaborCostEngine = ({
  getPayrollHolidays,
  isWeekdayIso,
  isEmployeeEmployedOnDate,
  getAttendance,
  getHolidayPayRule,
} = {}) => {
  const holidaysForYear = requiredFunction(getPayrollHolidays, "getPayrollHolidays");
  const weekday = requiredFunction(isWeekdayIso, "isWeekdayIso");
  const employedOnDate = requiredFunction(isEmployeeEmployedOnDate, "isEmployeeEmployedOnDate");
  const attendanceForDate = requiredFunction(getAttendance, "getAttendance");
  const holidayPayRule = requiredFunction(getHolidayPayRule, "getHolidayPayRule");

  let cachedData = null;
  let cache = new Map();

  // Uma passada por funcionário/dia distribui o custo de TODAS as obras do
  // período (antes: a lista inteira era refeita para cada obra - 20 obras =
  // 20 passadas). O resultado fica em cache por período enquanto o objeto
  // `data` for o mesmo (o dataset é imutável entre renders/requisições).
  let periodCache = new WeakMap();
  const costsByWorkForPeriod = (data, days = []) => {
    const key = `${days[0] || ""}|${days[days.length - 1] || ""}|${days.length}`;
    const cacheable = data !== null && typeof data === "object";
    let byPeriod = cacheable ? periodCache.get(data) : null;
    if (!byPeriod) { byPeriod = new Map(); if (cacheable) periodCache.set(data, byPeriod); }
    const cached = byPeriod.get(key);
    if (cached) return cached;

    const year = days[0] ? Number(days[0].slice(0, 4)) : new Date().getFullYear();
    const holidays = holidaysForYear(data, year);
    const holidaysInPeriod = days.filter(date =>
      holidays.includes(date) && weekday(date));
    const holidaySet = new Set(holidaysInPeriod);
    const byWork = new Map();
    const bucket = obraId => {
      let item = byWork.get(obraId);
      if (!item) { item = { laborCost:0, benefitCost:0, chargesCost:0 }; byWork.set(obraId, item); }
      return item;
    };

    // Encargos e provisões (labor-charges.js) entram no custo de mão de obra
    // da competência: CLT pelo fator de encargos, diarista pelo percentual
    // configurado (0 por padrão). VT/VR não são base de encargo.
    const factorByMode = { clt:laborChargeFactor("clt", data?.config), daily:laborChargeFactor("daily", data?.config) };
    const addLabor = (item, employee, date, amount) => {
      const charges = amount * (factorByMode[remunerationModeOnDate(employee, date)] || 0);
      item.laborCost += amount + charges;
      item.chargesCost += charges;
    };
    // CLT com salário mensal no cadastro (decisão do dono, 28/10/2026): o
    // custo é o salário, não a diária × presença. Cada dia útil do mês (com
    // feriado) recebe salário ÷ dias úteis do mês e vai para a obra do dia
    // (a do ponto, ou a lotação); assim o mês fecha no salário e o rateio
    // entre obras segue os dias apontados. Falta não reduz: o desconto é
    // tratado no holerite. Sem salário cadastrado, vale a diária como antes.
    const diasUteisNoMes = new Map();
    const diasUteisDoMes = date => {
      const mes = date.slice(0, 7);
      if (!diasUteisNoMes.has(mes)) {
        const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
        let total = 0;
        for (let dia = 1; dia <= ultimo; dia += 1) if (weekday(`${mes}-${String(dia).padStart(2, "0")}`)) total += 1;
        diasUteisNoMes.set(mes, total || 1);
      }
      return diasUteisNoMes.get(mes);
    };
    const salarioMensal = (employee, date) =>
      remunerationModeOnDate(employee, date) === "clt" ? Math.max(0, Number(employee?.monthlySalary || 0)) : 0;

    (data?.employees || []).forEach(employee => {
      days.forEach(date => {
        const salario = salarioMensal(employee, date);
        if (salario > 0) {
          if (!weekday(date) || !employedOnDate(employee, date)) return;
          const feriado = holidaySet.has(date);
          const obraId = feriado
            ? resolveHolidayObraId({ data, employee, holidayIso:date })
            : resolveEmployeeAttendanceObraId({ data, employee, date });
          const item = bucket(obraId);
          addLabor(item, employee, date, salario / diasUteisDoMes(date));
          if (!feriado) {
            const record = attendanceForDate(data, employee.id, date);
            item.benefitCost += calculateAttendanceDayCost({ employee, record, config:data?.config }).benefitCost;
          }
          return;
        }
        if (holidaySet.has(date)) return;
        if (!employedOnDate(employee, date)) return;
        const record = attendanceForDate(data, employee.id, date);
        const cost = calculateAttendanceDayCost({
          employee,
          record,
          config:data?.config,
        });
        if (!cost.laborCost && !cost.benefitCost) return;
        const item = bucket(resolveEmployeeAttendanceObraId({ data, employee, date }));
        addLabor(item, employee, date, cost.laborCost);
        item.benefitCost += cost.benefitCost;
      });

      // Feriado: paga a obra do último dia trabalhado antes dele.
      holidaysInPeriod.forEach(date => {
        if (!employedOnDate(employee, date)) return;
        if (salarioMensal(employee, date) > 0) return; // já coberto pelo salário
        const amount = Number(holidayPayRule(data, employee, date, holidays).amount || 0);
        if (!amount) return;
        addLabor(bucket(resolveHolidayObraId({ data, employee, holidayIso:date })), employee, date, amount);
      });
    });

    byPeriod.set(key, byWork);
    return byWork;
  };

  const calculateCurrentCost = (data, obraId, days = []) => {
    const item = costsByWorkForPeriod(data, days).get(String(obraId ?? "")) || { laborCost:0, benefitCost:0, chargesCost:0 };
    return { laborCost:item.laborCost, benefitCost:item.benefitCost, chargesCost:item.chargesCost, totalCost:item.laborCost + item.benefitCost };
  };

  const calculateWorkLaborCost = (data, obraId, days = []) => {
    if (cachedData !== data) {
      cachedData = data;
      cache = new Map();
    }
    const key = `${obraId}|${days[0] || ""}|${days[days.length - 1] || ""}|${days.length}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const current = calculateCurrentCost(data, obraId, days);
    const selectedDates = new Set(days);
    let archivedLabor = 0;
    let archivedBenefits = 0;
    Object.values(data?.archivedLaborCosts || {}).forEach(archive => {
      Object.entries(archive?.byDate || {}).forEach(([date, works]) => {
        if (!selectedDates.has(date)) return;
        const cost = works?.[obraId];
        archivedLabor += Number(cost?.laborCost || 0);
        archivedBenefits += Number(cost?.benefitCost || 0);
      });
    });

    const result = {
      chargesCost:current.chargesCost,
      laborCost:current.laborCost + archivedLabor,
      benefitCost:current.benefitCost + archivedBenefits,
      totalCost:current.totalCost + archivedLabor + archivedBenefits,
    };
    cache.set(key, result);
    return result;
  };

  return {
    calculateCurrentCost,
    calculateWorkLaborCost,
  };
};
