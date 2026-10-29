// Cenário comum de Folha, motor e DRE: julho tem 23 dias úteis. O CLT
// recebe R$ 2.300 no mês, com um dia (R$ 100) em outra obra e R$ 25 de
// benefícios históricos. Encargos zerados deixam a base salarial explícita.
export const archivedCltScenario=()=>{
  const employee={
    id:"clt-1",name:"CLT arquivado",active:true,obra:"o1",dailyRate:100,
    monthlySalary:2300,remunerationMode:"clt",remunerationEffectiveFrom:"2026-01-01",
    vtDaily:10,vrDaily:15,workdayHours:8,startDate:"2026-01-01",
  };
  const attendance={"clt-1":{"2026-07-10":{status:"P",obraId:"o2"}}};
  const data={
    config:{paymentHolidays:[],laborCharges:{inssPatronalPercent:0,ratPercent:0,
      terceirosPercent:0,fgtsPercent:0,multaFgtsPercent:0,provisionar13Ferias:false}},
    employees:[employee],obras:[{id:"o1",name:"Lotação atual"},{id:"o2",name:"Obra do dia"}],
    attendance:{},attendanceLocks:{},changeLog:[],advances:[],
    quinzenasArquivadas:{"2026-07-Q1":{inicio:"2026-07-06",fim:"2026-07-20"}},
    archivedLaborCosts:{"2026-07-Q1":{byDate:{"2026-07-10":{o2:{laborCost:999,benefitCost:999}}}}},
  };
  // Formato anterior à inclusão dos campos mensais: salário/modalidade
  // vêm do cadastro, mas VT/VR e obra arquivados prevalecem.
  const {monthlySalary:_salary,remunerationMode:_mode,remunerationEffectiveFrom:_from,...legacySnapshot}=employee;
  const archiveRows=[{key:"arced_ponto_v1__arq__2026-07-Q1",value:{attendance,employeesSnapshot:[legacySnapshot]}}];
  return {data,archiveRows,live:{...data,attendance,quinzenasArquivadas:{},archivedLaborCosts:{}}};
};
