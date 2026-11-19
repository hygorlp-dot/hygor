export const payrollDelayWaiverScenario = () => ({
  config:{},
  obras:[{id:"obra",name:"Obra de teste"}],
  employees:[{
    id:"e1",name:"Diarista de teste",obra:"obra",active:true,dailyRate:100,pixKey:"pix-de-teste",
    startDate:"2026-11-06",endDate:"2026-11-06",
  }],
  attendance:{e1:{"2026-11-06":{status:"P",obraId:"obra",atrasoMin:48,archivedWorkdayHours:8}}},
  advances:[],
  changeLog:[],
});

export const waivedDelayPayrollTitle = {
  id:"folha-waiver:e1",periodKey:"2026-11-Q1",employeeId:"e1",
  periodoInicio:"2026-11-06",periodoFim:"2026-11-20",liquido:100,waiveDelayDeduction:true,
  status:"em_aberto",
};
