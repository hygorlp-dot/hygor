import { expect, it } from "vitest";
import { buildPilotCases, pilotMetrics, pilotReview } from "./pilot-model.js";
const data=()=>({transacoes:[{id:"pending",descricao:"PIX pendente",status:"pendente",valor:50,data:"2026-10-20"},{id:"done",descricao:"PIX automático",status:"conciliado",valor:20,automacaoConciliacao:{evidencias:[],contraparte:{nome:"Cliente"}},vinculo:{tipo:"medicao",id:"m"}}]});
it("simula sem alterar os dados e distingue propostas de automações já executadas",()=>{
 const source=data(),before=JSON.stringify(source),rows=[{tr:source.transacoes[0],automatica:true,analise:{melhorCandidata:{tipo:"nota",entidadeId:"n"}},motivo:"Segura"}];
 const cases=buildPilotCases(source,"conciliacao",{},rows);
 expect(cases.map(c=>c.prediction)).toEqual(["proposed","executed"]);expect(JSON.stringify(source)).toBe(before);
 expect(pilotMetrics(cases,{}).executedAccuracy).toEqual({sample:0,rate:null});
});
it("usa somente amostras conclusivas, separa propostas e execução e ignora avaliação desatualizada",()=>{
 const cases=buildPilotCases(data(),"conciliacao",{},[{tr:{id:"pending"},automatica:true,analise:{}}]);
 const notes={};notes[cases[0].id]=pilotReview(cases[0],{decision:"correct",reason:"Alvo incorreto",elapsedMs:1000});notes[cases[1].id]=pilotReview(cases[1],{decision:"unknown",reason:"Sem documento",elapsedMs:3000});
 const metrics=pilotMetrics(cases,notes);expect(metrics).toMatchObject({reviewed:2,corrections:1,inconclusive:1,averageMs:2000,proposedAgreement:{sample:1,rate:0},executedAccuracy:{sample:0,rate:null}});
 notes[cases[1].id]={...notes[cases[1].id],fingerprint:"outro registro"};expect(pilotMetrics(cases,notes).reviewed).toBe(1);
});
it("exige justificativa para ajustes e dúvidas e mantém o recorte da obra em Compras",()=>{
 const cases=buildPilotCases({pedidos:[{id:"a",obraId:"one"},{id:"b",obraId:"two"},{id:"c",obraId:"one",status:"cancelado"}]},"compras",{workId:"one"});expect(cases.map(c=>c.sourceId)).toEqual(["a"]);
 expect(()=>pilotReview(cases[0],{decision:"correct",reason:"",elapsedMs:5})).toThrow(/motivo/);
 expect(()=>pilotReview(cases[0],{decision:"agree",elapsedMs:NaN})).toThrow(/Tempo/);
});
it("exclui extratos arquivados e respeita a conta bancária",()=>{
 const source={transacoes:[{id:"one",status:"pendente",contaBancariaId:"a",extratoId:"archived"},{id:"two",status:"pendente",contaBancariaId:"b"}],extratos:[{id:"archived",status:"arquivado"}]};
 expect(buildPilotCases(source,"conciliacao",{accountId:"a"},[])).toEqual([]);
});
it("invalida a avaliação de compras quando a nota vinculada muda",()=>{
 const source={pedidos:[{id:"p"}],notasFiscais:[{id:"n",pedidoId:"p",valorLiquido:10}]};const [item]=buildPilotCases(source,"compras");const notes={[item.id]:pilotReview(item,{decision:"agree",elapsedMs:100})};
 source.notasFiscais[0]={...source.notasFiscais[0],valorLiquido:20};expect(pilotMetrics(buildPilotCases(source,"compras"),notes).reviewed).toBe(0);
});
