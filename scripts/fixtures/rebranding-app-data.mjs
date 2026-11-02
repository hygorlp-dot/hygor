import { data as pilotData, profile } from "./rebranding-pilot-data.mjs";
export { profile };

// Synthetic fixtures for the operational screens. No production data or keys.
export const data = {
  ...structuredClone(pilotData),
  obras:[
    { id:"a", name:"Residencial Alameda", status:"active", cliente:"Cliente demonstração A", engineer:"Engenheira responsável", address:"Endereço de demonstração", contractStart:"2026-10-01", contractEnd:"2027-03-30", contractValue:485000, areaM2:320, contractType:"fixed_labor", faseId:"execution" },
    { id:"b", name:"Residencial Horizonte", status:"active", cliente:"Cliente demonstração B", engineer:"Engenheiro responsável", address:"Endereço de demonstração", contractStart:"2026-09-01", contractEnd:"2026-11-20", contractValue:295000, areaM2:210, contractType:"fixed_labor", faseId:"execution" },
    { id:"c", name:"Edifício Jardim das Palmeiras — áreas comuns", status:"paused", cliente:"Condomínio demonstração", contractValue:120000, areaM2:90, faseId:"planning" },
  ],
  config:{ ...pilotData.config, companyName:"MARCELL", fasesObra:[{ id:"planning", nome:"Planejamento", cor:"#355874" }, { id:"execution", nome:"Execução", cor:"#2E6652" }] },
  fases:[{id:"planning",nome:"Planejamento",cor:"#355874",ordem:1},{id:"execution",nome:"Em execução",cor:"#2E6652",ordem:2}],
  employees:[
    { id:"employee-a", name:"Ana Maria de Oliveira", role:"Engenheira civil", obra:"a", active:true, dailyRate:250, admissionDate:"2026-09-01", pixKey:"", trainings:{} },
    { id:"employee-b", name:"João Pedro da Silva", role:"Pedreiro", obra:"a", active:true, dailyRate:150, admissionDate:"2026-09-01", pixKey:"", trainings:{} },
    { id:"employee-c", name:"Maria Clara de Almeida", role:"Assistente administrativa", obra:"", workArea:"administrativo", active:true, dailyRate:130, admissionDate:"2026-08-01", pixKey:"", trainings:{} },
  ],
  orcamentos:[{
    id:"budget-a", obraId:"a", nome:"Residencial Alameda — orçamento executivo", versionStatus:"rascunho", versionNumber:1, fonte:"SINAPI", uf:"PE", dataBase:"2026-10", bdi:20, desonerado:true, areaM2:320,
    etapas:[{ id:"foundation", nome:"Fundações", parentId:"", ordem:1 }, { id:"structure", nome:"Estrutura", parentId:"", ordem:2 }, { id:"finishing", nome:"Acabamentos", parentId:"", ordem:3 }],
    itens:[
      { id:"item-a", etapaId:"foundation", descricao:"Concreto estrutural para blocos de fundação", unidade:"M3", quantidade:24, precoUnit:550, fonte:"PRÓPRIO", codigo:"01" },
      { id:"item-b", etapaId:"structure", descricao:"Armação de pilares e vigas em aço CA-50", unidade:"KG", quantidade:1850, precoUnit:12.5, fonte:"PRÓPRIO", codigo:"02" },
      { id:"item-c", etapaId:"finishing", descricao:"Revestimento cerâmico em áreas internas", unidade:"M2", quantidade:180, precoUnit:85, fonte:"PRÓPRIO", codigo:"03" },
    ],
  }],
  budgetBaselines:[],
  planos:[{
    id:"plan-a", obraId:"a", budgetId:"budget-a", inicio:"2026-10-01", diasSemana:[1,2,3,4,5], pularFeriados:true, feriados:[], marcos:[],
    tarefas:[
      { id:"task-a", etapaId:"foundation", nome:"Fundações", inicio:"2026-10-01", fim:"2026-10-23", progresso:100, custoReal:12000 },
      { id:"task-b", etapaId:"structure", nome:"Estrutura", inicio:"2026-10-26", fim:"2026-11-20", progresso:25, predecessoras:[{ id:"task-a", tipo:"FS", lag:0 }] },
      { id:"task-c", etapaId:"finishing", nome:"Acabamentos", inicio:"2026-11-23", fim:"2026-12-18", progresso:0 },
    ],
  }],
};
