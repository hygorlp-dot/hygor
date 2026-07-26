// Motor único de orçamento. Valores finais são centavos inteiros; cada
// consumidor recebe a mesma memória de cálculo, não uma fórmula própria.
export const ENGINE_VERSION = "budget-engine-1";
export const toCents = value => Math.round(Number(value || 0) * 100);
export const fromCents = value => Number(value || 0) / 100;
export const bdiEfetivo = (item, global) => item?.bdi !== "" && item?.bdi != null && Number(item.bdi) >= 0 ? Number(item.bdi) : Number(global || 0);

export const calculateItem = (item, globalBdi = 0) => {
  const quantidade=Number(item?.quantidade || 0), custoUnitario=Number(item?.precoUnit || 0), bdi=bdiEfetivo(item,globalBdi);
  const custoDiretoCentavos=Math.round(quantidade*custoUnitario*100);
  const bdiCentavos=Math.round(custoDiretoCentavos*bdi/100);
  const totalCentavos=custoDiretoCentavos+bdiCentavos;
  return {...item, quantidade, custoUnitario, bdiEfetivo:bdi, custoDiretoCentavos, bdiCentavos, totalCentavos,
    custoDireto:fromCents(custoDiretoCentavos), valorBDI:fromCents(bdiCentavos), total:fromCents(totalCentavos),
    memoriaCalculo:{quantidade,custoUnitario,bdiEfetivo:bdi,arredondamento:"centavos-half-up",engineVersion:ENGINE_VERSION}};
};

const descendants=(stages,id)=>{const ids=[id];for(let i=0;i<ids.length;i++)stages.forEach(s=>s.parentId===ids[i]&&!ids.includes(s.id)&&ids.push(s.id));return ids;};
export const calculateStage = (budget, stageId) => {
  const ids=descendants(budget.etapas||[],stageId);
  const items=(budget.itens||[]).filter(i=>i.tipo!=="titulo"&&ids.includes(i.etapaId)).map(i=>calculateItem(i,budget.bdi));
  const custoDiretoCentavos=items.reduce((s,i)=>s+i.custoDiretoCentavos,0),bdiCentavos=items.reduce((s,i)=>s+i.bdiCentavos,0);
  return {stageId,custoDiretoCentavos,bdiCentavos,totalCentavos:custoDiretoCentavos+bdiCentavos,custoDireto:fromCents(custoDiretoCentavos),valorBDI:fromCents(bdiCentavos),total:fromCents(custoDiretoCentavos+bdiCentavos)};
};

export const calculateBudget = budget => {
  const items=(budget?.itens||[]).filter(i=>i.tipo!=="titulo").map(i=>calculateItem(i,budget?.bdi));
  const custoDiretoCentavos=items.reduce((s,i)=>s+i.custoDiretoCentavos,0),valorBDICentavos=items.reduce((s,i)=>s+i.bdiCentavos,0),totalCentavos=custoDiretoCentavos+valorBDICentavos;
  const etapas=(budget?.etapas||[]).map(stage=>({...stage,...calculateStage(budget,stage.id),pct:totalCentavos?calculateStage(budget,stage.id).totalCentavos/totalCentavos*100:0}));
  return {engineVersion:ENGINE_VERSION,items,etapas,custoDiretoCentavos,valorBDICentavos,totalCentavos,custoDireto:fromCents(custoDiretoCentavos),valorBDI:fromCents(valorBDICentavos),total:fromCents(totalCentavos),porM2:Number(budget?.areaM2||0)>0?fromCents(totalCentavos)/Number(budget.areaM2):0,qtdItens:items.length};
};

// Projeção única para tela, PDF e planilhas. Consumidores de exportação não
// recalculam BDI: recebem os mesmos centavos e preços unitários do motor.
export const projectBudgetExport = budget => {
  const calculation=calculateBudget(budget);
  return {...calculation,rows:calculation.items.map(item=>({
    id:item.id,codigo:item.codigo||"",descricao:item.descricao||"",unidade:item.unidade||"",
    quantidade:item.quantidade,custoUnitario:item.custoUnitario,bdi:item.bdiEfetivo,
    // total já está expresso em moeda; não o converta novamente para centavos.
    // Essa projeção é consumida igualmente por tela, PDF e XLSX.
    precoUnitario:item.quantidade>0?item.total/item.quantidade:0,
    custoDireto:item.custoDireto,valorBDI:item.valorBDI,total:item.total,
    custoDiretoCentavos:item.custoDiretoCentavos,bdiCentavos:item.bdiCentavos,totalCentavos:item.totalCentavos,
  }))};
};

export const calculateABC = budget => {
  const calc=calculateBudget(budget),groups=new Map();
  calc.items.forEach(item=>{const key=[item.fonte||"PROPRIA",item.codigo||item.descricao,item.unidade||""].join("|");const old=groups.get(key)||{...item,quantidade:0,custoDiretoCentavos:0,bdiCentavos:0,totalCentavos:0,ocorrencias:0};old.quantidade+=item.quantidade;old.custoDiretoCentavos+=item.custoDiretoCentavos;old.bdiCentavos+=item.bdiCentavos;old.totalCentavos+=item.totalCentavos;old.ocorrencias++;groups.set(key,old);});
  let accumulated=0;const items=[...groups.values()].sort((a,b)=>b.custoDiretoCentavos-a.custoDiretoCentavos).map((item,index)=>{const pct=calc.custoDiretoCentavos?item.custoDiretoCentavos/calc.custoDiretoCentavos*100:0;const classe=accumulated<80?"A":accumulated<95?"B":"C";accumulated+=pct;return {...item,ordem:index+1,custoDireto:fromCents(item.custoDiretoCentavos),total:fromCents(item.totalCentavos),pct,pctAcum:Math.min(100,accumulated),classe};});
  return {items,totalCD:calc.custoDireto,totalComBDI:calc.total,resumo:["A","B","C"].map(classe=>{const list=items.filter(i=>i.classe===classe),cent=list.reduce((s,i)=>s+i.totalCentavos,0);return {classe,qtd:list.length,total:fromCents(cent),pctValor:calc.totalCentavos?cent/calc.totalCentavos*100:0};})};
};

export const getActiveBudgetBaseline=(data,obraId,purpose="controle")=>{
  const all=(data?.budgetBaselines||[]).filter(x=>x.obraId===obraId&&x.ativo!==false&&x.tipo===purpose);
  if(all.length!==1)return {budget:null,case:all.length?"baseline_ambigua":"baseline_ausente"};
  const budget=(data?.orcamentos||[]).find(x=>x.id===all[0].budgetId||x.versionId===all[0].budgetVersionId);
  return budget?{budget,baseline:all[0],case:null}:{budget:null,baseline:all[0],case:"versao_ausente"};
};

// Planejamento pode começar antes da aprovação financeira. A baseline ativa
// continua sendo prioritária; sem ela, respeitamos a versão já vinculada ao
// plano e só então escolhemos o rascunho mais recente da obra.
export const getPlanningBudget=(data,obraId,plan=null)=>{
  const approved=getActiveBudgetBaseline(data,obraId,"controle");
  if(approved.budget)return {...approved,source:"baseline"};
  const budgets=(data?.orcamentos||[]).filter(item=>item.obraId===obraId);
  const explicit=budgets.find(item=>
    (plan?.budgetId&&item.id===plan.budgetId)
    ||(plan?.budgetVersionId&&(item.versionId===plan.budgetVersionId||item.id===plan.budgetVersionId)));
  if(explicit)return {budget:explicit,source:"planejamento",case:null};
  const budget=[...budgets].sort((a,b)=>{
    const dateDiff=String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""));
    return dateDiff||Number(b.versionNumber||0)-Number(a.versionNumber||0);
  })[0]||null;
  return budget?{budget,source:"rascunho",case:null}:{budget:null,source:"ausente",case:"orcamento_ausente"};
};

export const budgetIsImmutable = budget => budget?.versionStatus === "aprovado" || !!budget?.lockedAt;

// Uma revisão nunca altera a versão aprovada: cria uma cópia com identidade
// própria e volta ao estado de rascunho. O chamador injeta ids/tempo para
// manter o domínio puro e facilmente testável.
export const createBudgetRevision = (budget, { id, versionId, now, actorId = "", actorName = "" }) => ({
  ...budget,
  // Coleções são copiadas também: a edição da revisão não pode compartilhar
  // referências com a versão que foi aprovada e congelada.
  etapas: (budget?.etapas || []).map(item => ({ ...item })),
  itens: (budget?.itens || []).map(item => ({ ...item })),
  referencias: [...(budget?.referencias || [])],
  auditoriaChecklist: (budget?.auditoriaChecklist || []).map(item => ({ ...item })),
  id, versionId, versionNumber: Number(budget?.versionNumber || 1) + 1,
  revisionOf: budget?.versionId || budget?.id || "", versionStatus: "rascunho",
  status: "rascunho", lockedAt: "", lockedById: "", lockedBy: "", approvedAt: "", approvedById: "", approvedBy: "",
  createdAt: now, updatedAt: now, createdById: actorId, createdBy: actorName,
});

export const adoptBudgetBaseline = (data, budgetId, { id, now, actorId = "", actorName = "", purpose = "controle" }) => {
  const budget=(data?.orcamentos||[]).find(item=>item.id===budgetId);
  if(!budget) return { ok:false, reason:"Orçamento não encontrado" };
  if(!budget.obraId) return { ok:false, reason:"Vincule o orçamento a uma obra antes de aprovar" };
  const locked={...budget, versionStatus:"aprovado", status:"aprovado", lockedAt:now, lockedById:actorId, lockedBy:actorName, approvedAt:now, approvedById:actorId, approvedBy:actorName, updatedAt:now};
  const baseline={id, obraId:budget.obraId, budgetId:budget.id, budgetVersionId:locked.versionId||locked.id, tipo:purpose, ativo:true, approvedAt:now, approvedById:actorId, approvedBy:actorName};
  const budgetBaselines=(data?.budgetBaselines||[]).map(item=>item.obraId===budget.obraId&&item.tipo===purpose&&item.ativo!==false?{...item,ativo:false,replacedAt:now,replacedByBaselineId:id}:item);
  return {ok:true,budget:locked,baseline,data:{...data,orcamentos:(data?.orcamentos||[]).map(item=>item.id===budgetId?locked:item),budgetBaselines:[...budgetBaselines,baseline]}};
};
