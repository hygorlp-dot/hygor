import {describe,expect,it} from "vitest";
import {buildStageCostAttributionReadiness} from "./stage-cost-attribution.js";

const base=()=>({
  obras:[{id:"o1",name:"Obra 1"}],
  budgetBaselines:[{id:"bl1",obraId:"o1",tipo:"controle",ativo:true,budgetId:"orc1"}],
  orcamentos:[{
    id:"orc1",obraId:"o1",
    etapas:[
      {id:"fund",nome:"Fundação",ordem:1},
      {id:"sap",nome:"Sapatas",parentId:"fund"},
      {id:"estr",nome:"Estrutura",ordem:2},
    ],
    itens:[
      {id:"i1",etapaId:"sap",quantidade:100,precoUnit:100},
      {id:"i2",etapaId:"estr",quantidade:1,precoUnit:20000},
    ],
  }],
  planos:[{obraId:"o1",tarefas:[
    {id:"t1",nome:"Executar sapatas",etapaId:"plan-fund",budgetLinks:[
      {budgetItemId:"i1",allocationPercentage:100},
    ]},
    {id:"t2",nome:"Executar estrutura",etapaId:"plan-estr",budgetLinks:[
      {budgetItemId:"i2",allocationPercentage:60},
    ]},
    {id:"t3",nome:"Serviço sem vínculo",etapaId:"plan-other"},
  ]}],
  pedidos:[
    {id:"p1",obraId:"o1",status:"enviado",itens:[
      {id:"p1i1",orcNivel1Id:"fund",qtd:50,precoUnit:100,qtdRecebida:20},
    ]},
    {id:"p2",obraId:"o1",status:"enviado",itens:[
      {id:"p2i1",qtd:1,precoUnit:500},
    ]},
  ],
  materiais:[
    {id:"m1",descricao:"Cimento",precoMedio:30},
    {id:"m2",descricao:"Aço",precoMedio:10},
  ],
  movEstoque:[
    {id:"c1",obraId:"o1",materialId:"m1",tipo:"consumo",qtd:10,valorUnit:25,tarefaId:"t1"},
    {id:"c2",obraId:"o1",materialId:"m2",tipo:"consumo",qtd:20,valorUnit:10,tarefaId:"t2"},
    {id:"c3",obraId:"o1",materialId:"m1",tipo:"consumo",qtd:2,valorUnit:25,tarefaId:"t3"},
    {id:"c4",obraId:"o1",materialId:"m1",tipo:"consumo",qtd:1,valorUnit:0,tarefaId:"t1"},
    {id:"c5",obraId:"o1",materialId:"m1",tipo:"consumo",qtd:99,valorUnit:99,tarefaId:"t1",status:"estornado"},
  ],
});

describe("COST 9.6 — cobertura de apropriação por etapa",()=>{
  it("combina orçamento, compras e material aplicado somente por vínculo explícito",()=>{
    const result=buildStageCostAttributionReadiness(base(),"o1");
    expect(result.ok).toBe(true);
    expect(result.budget).toEqual({id:"orc1",baselineId:"bl1"});

    const fund=result.stages.find(row=>row.stageId==="fund");
    const estr=result.stages.find(row=>row.stageId==="estr");
    expect(fund).toMatchObject({
      budgeted:10000,
      purchaseCommitted:5000,
      purchaseReceived:2000,
      materialApplied:250,
      purchaseBalance:5000,
    });
    // R$ 200 consumidos na tarefa t2 × 60% explicitamente ligados ao item i2.
    expect(estr).toMatchObject({
      budgeted:20000,
      materialApplied:120,
    });
  });

  it("não normaliza rateio parcial para 100% e mantém o restante sem apropriação",()=>{
    const result=buildStageCostAttributionReadiness(base(),"o1");
    expect(result.unallocated).toEqual(expect.arrayContaining([
      expect.objectContaining({
        movementId:"c2",taskId:"t2",reason:"task_budget_link_partial",
        value:80,missingPercentage:40,
      }),
      expect.objectContaining({
        movementId:"c3",taskId:"t3",reason:"task_without_budget_link",value:50,
      }),
    ]));
    expect(result.material).toMatchObject({
      knownValue:500,
      allocatedValue:370,
      unallocatedValue:130,
      coveragePercent:74,
      movementCount:4,
      fullyAllocatedMovementCount:1,
    });
  });

  it("custo médio de cadastro não é promovido silenciosamente a realizado",()=>{
    const result=buildStageCostAttributionReadiness(base(),"o1");
    expect(result.material).toMatchObject({
      missingValueCount:1,
      referenceValueWithoutActualCost:30,
    });
    expect(result.unallocated).toContainEqual(expect.objectContaining({
      movementId:"c4",
      reason:"movement_without_actual_unit_cost",
      value:0,
      referenceValue:30,
    }));
  });

  it("mantém compras sem vínculo em pendência separada",()=>{
    const result=buildStageCostAttributionReadiness(base(),"o1");
    expect(result.purchasesWithoutBudgetLink).toBe(500);
    expect(result.blockers).toContain("purchases_without_budget_link");
  });

  it("não declara EAC por etapa enquanto mão de obra, terceiros e equipamentos só chegam à obra",()=>{
    const result=buildStageCostAttributionReadiness(base(),"o1");
    expect(result.capabilities).toEqual({
      purchases:"stage",
      materialApplied:"stage_when_task_linked",
      labor:"work_only",
      thirdParty:"work_only",
      equipment:"work_only",
    });
    expect(result.readyForStageEac).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      "labor_not_attributed_to_stage",
      "thirdParty_not_attributed_to_stage",
      "equipment_not_attributed_to_stage",
    ]));
  });

  it("falha explicavelmente sem baseline de controle ativa",()=>{
    const data=base();
    data.budgetBaselines=[];
    expect(buildStageCostAttributionReadiness(data,"o1")).toMatchObject({
      ok:false,
      reason:"baseline_ausente",
      stages:[],
      readyForStageEac:false,
    });
  });

  it("vínculo inválido da tarefa não é usado para apropriar custo",()=>{
    const data=base();
    data.planos[0].tarefas[0].budgetLinks=[{budgetItemId:"i1",allocationPercentage:120}];
    const result=buildStageCostAttributionReadiness(data,"o1");
    expect(result.issues).toContainEqual(expect.objectContaining({
      code:"invalid_allocation",activityId:"t1",
    }));
    expect(result.unallocated).toContainEqual(expect.objectContaining({
      movementId:"c1",reason:"invalid_task_budget_links",value:250,
    }));
    expect(result.stages.find(row=>row.stageId==="fund").materialApplied).toBe(0);
  });
});
