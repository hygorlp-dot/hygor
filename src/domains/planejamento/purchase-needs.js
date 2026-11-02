import {buildBudgetMaterialDemand,availableStock} from "../suprimentos/calculations.js";
import {getPlanningBudget} from "../orcamentos/calculations.js";
import {montarTarefas} from "./legacy-engine.js";

const inactive=value=>["cancelada","cancelado","estornada","estornado","rejeitada","rejeitado"].includes(value?.status);
const unit=value=>String(value||"").trim().toUpperCase().replace(/^UND?$/,"UN");

export function planningPurchaseNeeds(data,{obraId,taskId,budgetId}={}){
 const plan=(data.planos||[]).find(p=>p.obraId===obraId);
 const planning=getPlanningBudget(data,obraId,plan),budget=planning.budget;
 const task=montarTarefas(plan,budget).find(t=>t.id===taskId);
 if(!plan||!budget||!task||inactive(task)||!task.etapaId||!(budget.etapas||[]).some(e=>e.id===task.etapaId))return {error:"Esta atividade não possui uma etapa válida do orçamento."};
 if(budgetId&&budget.id!==budgetId)return {error:"O orçamento do planejamento mudou. Volte ao cronograma e revise a etapa."};
 const budgetLines=(budget.itens||[]).filter(i=>i.etapaId===task.etapaId&&i.tipo!=="titulo"&&!inactive(i));
 const items=buildBudgetMaterialDemand({budget:{...budget,itens:budgetLines},materials:data.materiais||[],tasks:montarTarefas(plan,budget)});
 const covered=new Set(items.flatMap(item=>item.itemOrcamentoIds));
 budgetLines.filter(item=>!covered.has(item.id)).forEach(item=>items.push({materialId:"",descricao:item.descricao||"Item sem detalhamento",unidade:item.unidade||"",quantidade:Number(item.quantidade||0),vinculo:"pendente",itemOrcamentoIds:[item.id]}));
 const rows=items.map(item=>{
  const material=(data.materiais||[]).find(m=>m.id===item.materialId&&m.ativo!==false);
  const valid=item.vinculo==="confirmado"&&material&&unit(item.unidade)===unit(material.unidade)&&Number.isFinite(item.quantidade)&&item.quantidade>0;
  const stock=availableStock({movements:data.movEstoque||[],reservations:data.reservasEstoque||[],obraId,materialId:item.materialId});
  const orders=(data.pedidos||[]).filter(p=>p.obraId===obraId&&!inactive(p)&&p.status!=="rascunho"&&(p.itens||[]).some(i=>i.materialId===item.materialId&&Number(i.qtdRecebida||0)<Number(i.qtd||0)));
  return {...item,codigo:material?.codigo||item.codigo,valid:Boolean(valid),stock:stock.livre,orders:orders.map(p=>({id:p.id,numero:p.numero||"Pedido",previsao:p.previsao||""}))};
 });
 const requests=(data.solicitacoesCompra||[]).filter(r=>r.obraId===obraId&&!inactive(r)&&r.planningOrigin?.planId===plan.id&&r.planningOrigin?.stageId===task.etapaId);
 const stageDates=montarTarefas(plan,budget).filter(t=>t.etapaId===task.etapaId&&t.inicio&&!inactive(t)).map(t=>t.inicio).sort();
 return {obraId,planId:plan.id,budgetId:budget.id,taskId:task.id,stageId:task.etapaId,taskName:task.nome,needDate:stageDates[0]||"",preliminary:planning.source==="rascunho"||["rascunho","draft"].includes(budget.versionStatus),rows,requests};
}

export function planningRequestDraft(needs,id){
 if(needs.error)return null;
 const rows=needs.rows.filter(row=>row.valid);
 if(!rows.length||needs.requests.length)return null;
 return {obraId:needs.obraId,necessidade:needs.needDate,prioridade:"normal",referenciaId:"",
  planningOrigin:{planId:needs.planId,budgetId:needs.budgetId,taskId:needs.taskId,stageId:needs.stageId,taskName:needs.taskName,needDate:needs.needDate,excludedCount:needs.rows.length-rows.length},
  observacao:`Planejamento: ${needs.taskName}. Conferir quantidades, estoque disponível e pedidos da obra antes de formalizar.`,
  // Stage totals are not per-task consumption or stock allocations. Require confirmation.
  itens:rows.map(row=>({id:id(),materialId:row.materialId,descricaoRef:row.descricao,codigoRef:row.codigo,fonteRef:"PRÓPRIO",unidadeRef:row.unidade,unidadeCompra:row.unidade,fatorConversao:1,quantidade:"",precoRef:row.custoTotal/row.quantidade,orcNivel1Id:needs.stageId,orcItemId:row.itemOrcamentoIds.length===1?row.itemOrcamentoIds[0]:"",observacao:`Referência da etapa: ${row.quantidade} ${row.unidade}. Estoque livre na obra: ${row.stock} ${row.unidade}. ${row.orders.length} pedido(s) em aberto para conferir.`,planningQuantity:row.quantidade}))};
}
