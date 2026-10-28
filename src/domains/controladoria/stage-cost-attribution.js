import {calculateBudget,getActiveBudgetBaseline} from "../orcamentos/calculations.js";
import {calcOrcadoComprado,niveisUmOrcamento} from "../compras/budget-tracking.js";
import {validateActivityBudgetLinks} from "../planning/engine/budget/activity-budget-links.js";
import {tarefasDaObra} from "../estoque/task-allocation.js";

const inactive=status=>["cancelado","cancelada","estornado","estornada"].includes(String(status||"").toLowerCase());
const money=value=>Math.round((Number(value||0)+Number.EPSILON)*100)/100;

const rootStageMap=budget=>{
  const stages=budget?.etapas||[];
  const byId=new Map(stages.map(stage=>[String(stage.id),stage]));
  const rootOf=id=>{
    let stage=byId.get(String(id||"")),guard=0;
    while(stage?.parentId&&guard++<50)stage=byId.get(String(stage.parentId))||stage;
    return stage?.id?String(stage.id):"";
  };
  return {
    byItem:new Map((budget?.itens||[])
      .filter(item=>item?.tipo!=="titulo"&&item?.id)
      .map(item=>[String(item.id),rootOf(item.etapaId)])),
    rootOf,
  };
};

const taskLinkErrors=(validation,taskId)=>
  (validation?.issues||[]).filter(issue=>String(issue?.activityId||"")===String(taskId||"")&&issue?.severity==="error");

const movementValue=(movement,materialsById)=>{
  const qtd=Number(movement?.qtd||0);
  const explicit=Number(movement?.valorUnit||0);
  if(qtd>0&&explicit>0)return {value:qtd*explicit,source:"movement"};
  const average=Number(materialsById.get(String(movement?.materialId||""))?.precoMedio||0);
  // O custo médio cadastrado é útil para diagnosticar o valor potencial,
  // mas NÃO vira realizado: sem valorUnit no fato de consumo, a apropriação
  // financeira fica pendente para não transformar referência em custo real.
  return {value:0,source:"missing",referenceValue:qtd>0&&average>0?qtd*average:0};
};

export const buildStageCostAttributionReadiness=(data={},obraId="")=>{
  const workId=String(obraId||"");
  const baseline=getActiveBudgetBaseline(data,workId,"controle");
  if(!baseline.budget){
    return {
      ok:false,obraId:workId,reason:baseline.case||"baseline_ausente",
      budget:null,stages:[],unallocated:[],issues:[],coverage:null,
      capabilities:{
        purchases:"stage",materialApplied:"stage_when_task_linked",
        labor:"work_only",thirdParty:"work_only",equipment:"work_only",
      },
      readyForStageEac:false,
    };
  }

  const budget=baseline.budget;
  const calculated=calculateBudget(budget);
  const tasks=tarefasDaObra(data,workId);
  const taskById=new Map(tasks.map(task=>[String(task.id),task]));
  const linkValidation=validateActivityBudgetLinks({
    activities:tasks,
    budgetItems:calculated.items,
  });
  const validLinksByTask=new Map();
  for(const link of linkValidation.links||[]){
    if(taskLinkErrors(linkValidation,link.activityId).length)continue;
    validLinksByTask.set(String(link.activityId),[
      ...(validLinksByTask.get(String(link.activityId))||[]),
      link,
    ]);
  }

  const roots=rootStageMap(budget);
  const purchases=calcOrcadoComprado(data,workId);
  const purchaseByStage=new Map((purchases.linhas||[]).map(row=>[String(row.it.id),row]));
  const materialAppliedByStage=new Map();
  const unallocated=[];
  const materialsById=new Map((data.materiais||[]).map(item=>[String(item.id),item]));
  let knownMaterialValue=0,allocatedMaterialValue=0,referenceValueWithoutCost=0;
  let materialMovementCount=0,allocatedMovementCount=0,missingValueCount=0;

  (data.movEstoque||[])
    .filter(movement=>String(movement?.obraId||"")===workId&&movement?.tipo==="consumo"&&!inactive(movement?.status))
    .forEach(movement=>{
      materialMovementCount+=1;
      const valuation=movementValue(movement,materialsById);
      if(!(valuation.value>0)){
        missingValueCount+=1;
        referenceValueWithoutCost+=Number(valuation.referenceValue||0);
        unallocated.push({
          movementId:String(movement.id||""),
          taskId:String(movement.tarefaId||""),
          reason:"movement_without_actual_unit_cost",
          value:0,
          referenceValue:money(valuation.referenceValue),
        });
        return;
      }
      const value=valuation.value;
      knownMaterialValue+=value;
      const taskId=String(movement.tarefaId||"");
      const task=taskById.get(taskId);
      if(!task){
        unallocated.push({movementId:String(movement.id||""),taskId,reason:taskId?"task_not_found":"task_missing",value:money(value)});
        return;
      }
      const errors=taskLinkErrors(linkValidation,taskId);
      if(errors.length){
        unallocated.push({
          movementId:String(movement.id||""),taskId,
          reason:"invalid_task_budget_links",value:money(value),
          issueCodes:errors.map(issue=>issue.code),
        });
        return;
      }
      const links=validLinksByTask.get(taskId)||[];
      if(!links.length){
        unallocated.push({movementId:String(movement.id||""),taskId,reason:"task_without_budget_link",value:money(value)});
        return;
      }

      let allocatedPct=0,allocatedThisMovement=0;
      for(const link of links){
        const pct=Math.max(0,Math.min(100,Number(link.allocationPercentage||0)));
        if(!(pct>0))continue;
        const stageId=roots.byItem.get(String(link.budgetItemId||""));
        if(!stageId){
          unallocated.push({
            movementId:String(movement.id||""),taskId,
            budgetItemId:String(link.budgetItemId||""),
            reason:"budget_item_without_root_stage",
            value:money(value*pct/100),
          });
          continue;
        }
        const portion=value*pct/100;
        allocatedPct+=pct;
        allocatedThisMovement+=portion;
        materialAppliedByStage.set(stageId,(materialAppliedByStage.get(stageId)||0)+portion);
      }
      const remainderPct=Math.max(0,100-allocatedPct);
      if(remainderPct>0.0001){
        unallocated.push({
          movementId:String(movement.id||""),taskId,
          reason:"task_budget_link_partial",
          value:money(value*remainderPct/100),
          missingPercentage:money(remainderPct),
        });
      }
      if(allocatedThisMovement>0){
        allocatedMaterialValue+=allocatedThisMovement;
        if(remainderPct<=0.0001)allocatedMovementCount+=1;
      }
    });

  const stages=niveisUmOrcamento(budget).map(stage=>{
    const purchase=purchaseByStage.get(String(stage.id))||{};
    const materialApplied=materialAppliedByStage.get(String(stage.id))||0;
    return {
      stageId:String(stage.id),
      description:stage.descricao,
      budgeted:money(stage.orcado),
      purchaseCommitted:money(purchase.comprometido),
      purchaseReceived:money(purchase.recebido),
      purchaseDraft:money(purchase.previsto),
      materialApplied:money(materialApplied),
      purchaseBalance:money(stage.orcado-Number(purchase.comprometido||0)),
      purchaseAlert:purchase.alerta||"ok",
    };
  });

  const coverage=knownMaterialValue>0?allocatedMaterialValue/knownMaterialValue*100:100;
  const capabilities={
    purchases:"stage",
    materialApplied:"stage_when_task_linked",
    // Não inventamos rateio para estas três fontes: hoje o fato identifica a
    // obra, não a tarefa/item orçamentário. EAC por etapa só será liberado
    // quando a apropriação nascer no fato de origem.
    labor:"work_only",
    thirdParty:"work_only",
    equipment:"work_only",
  };
  const blockingCapabilities=Object.entries(capabilities)
    .filter(([,value])=>value==="work_only")
    .map(([key])=>key);

  return {
    ok:true,obraId:workId,
    budget:{id:String(budget.id||""),baselineId:String(baseline.baseline?.id||"")},
    stages,
    purchasesWithoutBudgetLink:money(purchases.semApropriacao),
    material:{
      movementCount:materialMovementCount,
      fullyAllocatedMovementCount:allocatedMovementCount,
      missingValueCount,
      knownValue:money(knownMaterialValue),
      allocatedValue:money(allocatedMaterialValue),
      unallocatedValue:money(Math.max(0,knownMaterialValue-allocatedMaterialValue)),
      referenceValueWithoutActualCost:money(referenceValueWithoutCost),
      coveragePercent:money(coverage),
    },
    unallocated,
    issues:linkValidation.issues||[],
    capabilities,
    blockers:[
      ...(purchases.semApropriacao>0?["purchases_without_budget_link"]:[]),
      ...(unallocated.length?["material_applied_not_fully_attributed"]:[]),
      ...blockingCapabilities.map(source=>`${source}_not_attributed_to_stage`),
    ],
    readyForStageEac:false,
  };
};
