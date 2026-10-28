import { calculateAttendanceDayCost } from "../src/domains/ponto/payroll.js";
import { remunerationModeOnDate } from "../src/domains/rh/remuneration-mode.js";
import { laborChargeFactor } from "../src/domains/financeiro/labor-charges.js";
import { resolveHistoricalEmployeeObraId } from "../src/domains/ponto/permissions.js";

const employedOn = (employee, date) =>
  (!employee?.startDate || date >= employee.startDate) &&
  (!employee?.endDate || date <= employee.endDate);

const employeeSnapshot=(stored,current={})=>({
  ...current,
  ...stored,
  // Arquivos antigos não possuíam os campos CLT introduzidos depois. Neles,
  // completa apenas a remuneração pelo cadastro/histórico atual; diária,
  // benefícios, lotação e jornada que já existiam no snapshot continuam
  // prevalecendo e permanecem históricos.
  monthlySalary:stored?.monthlySalary??current?.monthlySalary??0,
  remunerationMode:stored?.remunerationMode??current?.remunerationMode??"",
  remunerationEffectiveFrom:stored?.remunerationEffectiveFrom??current?.remunerationEffectiveFrom??"",
  remunerationHistory:Array.isArray(stored?.remunerationHistory)
    ?stored.remunerationHistory
    :(Array.isArray(current?.remunerationHistory)?current.remunerationHistory:[]),
});

// Fonte financeira autoritativa de uma quinzena encerrada. O cálculo usa
// somente o arquivo imutável criado pelo servidor, nunca valores enviados pelo
// cliente. currentEmployees serve apenas para completar CAMPOS DE REMUNERAÇÃO
// que arquivos antigos ainda não salvavam; os demais campos históricos vêm do
// employeesSnapshot do arquivo.
//
// Para CLT com salário mensal:
// - o salário/encargos continuam sendo calculados pelo motor mensal vivo;
// - o arquivo guarda o benefício do dia (VT/VR) para não perdê-lo;
// - guarda também uma trilha mínima funcionário+data+obra+status, usada pelo
//   motor mensal para manter o rateio histórico por obra depois que o ponto
//   bruto sai do dataset principal.
export const summarizeArchivedCosts = (archive, config = {}, currentEmployees = []) => {
  const currentById=new Map((currentEmployees||[]).map(employee=>[String(employee?.id||""),employee]));
  const snapshots = new Map((archive?.employeesSnapshot || []).map(stored => {
    const id=String(stored?.id||"");
    return [id,employeeSnapshot(stored,currentById.get(id)||{})];
  }));
  const byDate = {};
  const cltAllocationByDate = {};

  for (const [employeeId, attendance] of Object.entries(archive?.attendance || {})) {
    const employee = snapshots.get(String(employeeId))
      ||employeeSnapshot({},currentById.get(String(employeeId))||{});
    for (const [date, raw] of Object.entries(attendance || {})) {
      if (!employedOn(employee, date)) continue;
      const record = typeof raw === "string" ? {status: raw} : (raw || {});
      const mode=remunerationModeOnDate(employee,date);
      const workId = String(
        record.obraId
        ||record.obra
        ||resolveHistoricalEmployeeObraId({employee,date})
        ||employee.obra
        ||employee.obraId
        ||""
      );

      if(mode==="clt"&&Number(employee.monthlySalary||0)>0){
        if(workId){
          cltAllocationByDate[date]={
            ...(cltAllocationByDate[date]||{}),
            [String(employeeId)]:{
              obraId:workId,
              status:String(record.status||""),
            },
          };
        }
        // O salário mensal não entra novamente aqui, mas VT/VR dependem do
        // ponto daquele dia e desapareceriam se o arquivo não os preservasse.
        const cost=calculateAttendanceDayCost({employee,record,config});
        if(cost.benefitCost>0&&workId){
          const previous=byDate[date]?.[workId]||{laborCost:0,benefitCost:0};
          byDate[date]={
            ...(byDate[date]||{}),
            [workId]:{
              laborCost:previous.laborCost,
              benefitCost:previous.benefitCost+cost.benefitCost,
            },
          };
        }
        continue;
      }

      const cost = calculateAttendanceDayCost({employee,record,config});
      const factor = cost.factor;
      if (!factor || !workId) continue;
      const charges = cost.laborCost * laborChargeFactor(mode, config);
      const previous = byDate[date]?.[workId] || {laborCost: 0, benefitCost: 0};
      byDate[date] = {
        ...(byDate[date] || {}),
        [workId]: {
          laborCost: previous.laborCost + cost.laborCost + charges,
          benefitCost: previous.benefitCost + cost.benefitCost,
        },
      };
    }
  }
  return {byDate,cltAllocationByDate};
};

export const normalizeArchivedCosts = summary => {
  const byDate = {};
  for (const [date, works] of Object.entries(summary?.byDate || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const [workId, cost] of Object.entries(works || {})) {
      if (!workId) continue;
      byDate[date] = {
        ...(byDate[date] || {}),
        [String(workId)]: {
          laborCost: Math.max(0, Number(cost?.laborCost || 0)),
          benefitCost: Math.max(0, Number(cost?.benefitCost || 0)),
        },
      };
    }
  }

  const cltAllocationByDate={};
  for(const [date,employees] of Object.entries(summary?.cltAllocationByDate||{})){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    for(const [employeeId,allocation] of Object.entries(employees||{})){
      const obraId=String(allocation?.obraId||"");
      if(!employeeId||!obraId)continue;
      cltAllocationByDate[date]={
        ...(cltAllocationByDate[date]||{}),
        [String(employeeId)]:{
          obraId,
          status:String(allocation?.status||""),
        },
      };
    }
  }
  return {byDate,cltAllocationByDate};
};
