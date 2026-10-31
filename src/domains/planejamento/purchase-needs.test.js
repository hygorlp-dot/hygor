import {expect,it} from "vitest";
import {planningPurchaseNeeds,planningRequestDraft} from "./purchase-needs.js";
import {changePurchaseRequestProject,validatePurchaseRequest} from "../compras/purchase-request-workflow.js";
const fixture=()=>({obras:[{id:"work"}],materiais:[{id:"steel",descricao:"Aço",unidade:"KG",ativo:true}],
 orcamentos:[{id:"budget",obraId:"work",versionStatus:"rascunho",etapas:[{id:"stage",nome:"Estrutura"}],itens:[{id:"line",etapaId:"stage",materialId:"steel",descricao:"Aço",quantidade:50,unidade:"KG",precoUnit:12}]}],
 planos:[{id:"plan",obraId:"work",budgetId:"budget",tarefas:[{id:"task",etapaId:"stage",nome:"Estrutura",inicio:"2026-11-10",fim:"2026-11-20"}]}],
 movEstoque:[{id:"entry",obraId:"work",materialId:"steel",tipo:"entrada",qtd:20}],pedidos:[],solicitacoesCompra:[]});
const scope={obraId:"work",taskId:"task",budgetId:"budget"};
it("usa identidade e quantidade da etapa sem elevar um material direto ao quadrado",()=>{
 const needs=planningPurchaseNeeds(fixture(),scope);
 expect(needs.rows[0]).toMatchObject({quantidade:50,stock:20,valid:true});expect(needs.preliminary).toBe(true);
});
it("não associa materiais por semelhança de descrição",()=>{
 const data=fixture();delete data.orcamentos[0].itens[0].materialId;
 const needs=planningPurchaseNeeds(data,scope);expect(needs.rows.some(row=>row.valid)).toBe(false);expect(planningRequestDraft(needs,()=>"item")).toBeNull();
});
it("não mistura unidades incompatíveis com o estoque",()=>{
 const data=fixture();data.orcamentos[0].itens[0].unidade="BR";
 expect(planningPurchaseNeeds(data,scope).rows[0].valid).toBe(false);
});
it("exibe pedidos da obra sem descontar quantidades sem apropriação de etapa",()=>{
 const data=fixture();data.pedidos=[{id:"order",numero:"PC-1",obraId:"work",status:"enviado",itens:[{materialId:"steel",qtd:12,qtdRecebida:2}]},{id:"other",obraId:"other",status:"enviado",itens:[{materialId:"steel",qtd:12}]}];
 const needs=planningPurchaseNeeds(data,scope);expect(needs.rows[0].orders.map(o=>o.id)).toEqual(["order"]);
 const draft=planningRequestDraft(needs,()=>"item");expect(draft.itens[0].quantidade).toBe("");expect(validatePurchaseRequest(draft).valid).toBe(false);
 expect(draft.itens[0].precoRef).toBe(12);
});
it("usa a primeira necessidade entre atividades da mesma etapa",()=>{
 const data=fixture();data.planos[0].tarefas.push({id:"task2",etapaId:"stage",inicio:"2026-11-02",fim:"2026-11-05"});
 expect(planningPurchaseNeeds(data,scope).needDate).toBe("2026-11-02");
});
it("recusa origem obsoleta, obra inexistente ou atividade sem vínculo",()=>{
 const data=fixture();expect(planningPurchaseNeeds(data,{...scope,budgetId:"old"}).error).toBeTruthy();
 expect(planningPurchaseNeeds(data,{...scope,obraId:"other"}).error).toBeTruthy();
 delete data.planos[0].tarefas[0].etapaId;expect(planningPurchaseNeeds(data,scope).error).toBeTruthy();
});
it("reabre solicitações da mesma etapa em vez de preparar duplicatas",()=>{
 const data=fixture();data.solicitacoesCompra=[{id:"request",obraId:"work",status:"enviada",planningOrigin:{planId:"plan",stageId:"stage"}}];
 const needs=planningPurchaseNeeds(data,scope);expect(needs.requests[0].id).toBe("request");expect(planningRequestDraft(needs,()=>"item")).toBeNull();
 data.solicitacoesCompra[0].status="cancelada";expect(planningRequestDraft(planningPurchaseNeeds(data,scope),()=>"item")).toBeTruthy();
});
it("mantém origem no rascunho e a remove ao mudar de obra",()=>{
 const data=fixture(),before=JSON.stringify(data),draft=planningRequestDraft(planningPurchaseNeeds(data,scope),()=>"item");
 expect(JSON.stringify(data)).toBe(before);expect(draft.planningOrigin).toMatchObject({planId:"plan",taskId:"task",stageId:"stage",budgetId:"budget"});
 expect(changePurchaseRequestProject(draft,"other").planningOrigin).toBeNull();
});
