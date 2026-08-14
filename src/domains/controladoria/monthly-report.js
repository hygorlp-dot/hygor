import { active, selectFinancialMovements } from "../financeiro/ledger.js";
import { advanceDeductionForPeriod } from "../rh/advance-commands.js";

const requiredFunction = (value, name) => {
  if (typeof value !== "function") {
    throw new TypeError(`Relatório financeiro mensal requer ${name}.`);
  }
  return value;
};

// Projeção mensal para relatórios gerenciais. Todos os valores monetários vêm
// do DRE/razão canônico; ponto e coleções operacionais abrem apenas detalhes.
export const createMonthlyFinancialReportEngine = ({
  getDays,
  calculateWorkDre,
  calculateWorkContractProjection,
  getAttendanceStatus,
  selectMovements = selectFinancialMovements,
} = {}) => {
  const daysForMonth = requiredFunction(getDays, "o calendário do período");
  const workDre = requiredFunction(calculateWorkDre, "o DRE canônico por obra");
  const contractProjection = requiredFunction(
    calculateWorkContractProjection,
    "a projeção contratual por obra",
  );
  const attendanceStatus = requiredFunction(getAttendanceStatus, "o estado diário do ponto");
  const movements = requiredFunction(selectMovements, "o seletor de movimentos do razão");

  const calculateMonthlyFinancialReport = (data, year, month) => {
    const days = daysForMonth(year, month);
    const competence = `${year}-${String(month + 1).padStart(2, "0")}`;
    const startDate = days[0] || "";
    const endDate = days[days.length - 1] || "";
    const employees = data?.employees || [];

    return (data?.obras || []).map(work => {
      const dre = workDre(data, work.id, year, month, "mes");
      const thirdPartyDetails = (data?.pagsTerceiros || []).filter(payment =>
        active(payment)
        && payment.obraId === work.id
        && payment.pagador !== "empresa"
        && payment.date
        && payment.date.startsWith(competence));
      const terminationDetails = (data?.rescisoes || []).filter(termination =>
        termination.obraName === work.name
        && termination.demissao
        && termination.demissao.startsWith(competence));
      const employeeIds = employees
        .filter(employee => employee.obra === work.id || employee.lastObra === work.id)
        .map(employee => employee.id);
      const monthStart=`${competence}-01`;
      const monthEnd=`${competence}-${String(new Date(Number(competence.slice(0,4)),Number(competence.slice(5,7)),0).getDate()).padStart(2,"0")}`;
      const advanceDetails = (data?.advances || []).filter(advance =>
        employeeIds.includes(advance.empId)
        && advanceDeductionForPeriod(advance,monthStart,monthEnd)>0);
      const advanceTotal = advanceDetails.reduce((total, advance) =>
        total + advanceDeductionForPeriod(advance,monthStart,monthEnd), 0);
      const receiptDetails = movements(dre.ledger, {
        obraId:work.id,
        startDate,
        endDate,
      }).filter(event => event.natureza === "cash_in").map(event => ({
        id:event.id,
        date:event.data,
        amount:event.valor,
        description:event.descricao,
        tipo:event.origem,
      }));
      const { revenue:expectedRevenue } = contractProjection(data, work.id, year, month);
      const workEmployees = employees.filter(employee =>
        employee.obra === work.id || employee.lastObra === work.id);
      const attendanceDays = workEmployees.reduce((total, employee) =>
        total + days.filter(date => attendanceStatus(data, employee.id, date) === "P").length, 0);
      const absences = workEmployees.reduce((total, employee) =>
        total + days.filter(date => attendanceStatus(data, employee.id, date) === "F").length, 0);
      const activeEmployees = employees.filter(employee =>
        employee.active !== false && employee.obra === work.id).length;
      const activeThirdParties = (data?.terceirizados || []).filter(worker =>
        worker.active !== false && worker.obraId === work.id).length;
      const totalExpenses = dre.totalCustos;

      return {
        obra:work,
        moData:dre.moData,
        tercCost:dre.tercCost,
        tercDetalhes:thirdPartyDetails,
        rescTotal:dre.rescTotal,
        rescDetalhes:terminationDetails,
        adiantTotal:advanceTotal,
        adiantDetalhes:advanceDetails,
        received:dre.entradasCaixa,
        recDetalhes:receiptDetails,
        revenueEsperada:expectedRevenue,
        totalDespesas:totalExpenses,
        margem:dre.lucroBruto,
        margemEsperada:expectedRevenue - totalExpenses,
        margemPct:dre.margemBruta,
        activeEmps:activeEmployees,
        activeTercs:activeThirdParties,
        presencaDias:attendanceDays,
        faltas:absences,
      };
    });
  };

  return { calculateMonthlyFinancialReport };
};
