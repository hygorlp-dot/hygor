import { calculateAttendanceDayCost } from "../ponto/payroll.js";

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

  const calculateCurrentCost = (data, obraId, days = []) => {
    const year = days[0] ? Number(days[0].slice(0, 4)) : new Date().getFullYear();
    const holidays = holidaysForYear(data, year);
    const holidaysInPeriod = days.filter(date =>
      holidays.includes(date) && weekday(date));
    let laborCost = 0;
    let benefitCost = 0;

    const workForDate = (employee, date) => {
      const record = data?.attendance?.[employee.id]?.[date];
      return record?.obraId || employee.obra || "";
    };

    (data?.employees || []).forEach(employee => {
      days.forEach(date => {
        if (workForDate(employee, date) !== obraId) return;
        if (!employedOnDate(employee, date)) return;
        if (holidaysInPeriod.includes(date)) return;
        const record = attendanceForDate(data, employee.id, date);
        const cost = calculateAttendanceDayCost({
          employee,
          record,
          config:data?.config,
        });
        laborCost += cost.laborCost;
        benefitCost += cost.benefitCost;
      });

      holidaysInPeriod.forEach(date => {
        if (!employedOnDate(employee, date)) return;
        if (workForDate(employee, date) !== obraId) return;
        laborCost += Number(holidayPayRule(data, employee, date, holidays).amount || 0);
      });
    });

    return { laborCost, benefitCost, totalCost:laborCost + benefitCost };
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
