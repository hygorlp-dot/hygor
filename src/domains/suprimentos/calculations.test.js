import { describe, expect, it } from "vitest";
import { addBusinessDays, availableStock, buildBudgetMaterialDemand, classifyAbc, createSupplyPlan, detectDependencyCycle, parseLocalDate, subtractBusinessDays } from "./calculations";

const calendar={ diasSemana:[1,2,3,4,5], feriados:["2026-01-01"] };
describe("motor de suprimentos", () => {
  it("calcula datas locais úteis sem sofrer efeito de fuso e respeita feriado", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(addBusinessDays("2025-12-31", 1, calendar)).toBe("2026-01-02");
    expect(subtractBusinessDays("2026-01-05", 1, calendar)).toBe("2026-01-02");
  });
  it("consolida insumo explícito e nunca vincula material apenas por texto", () => {
    const demands=buildBudgetMaterialDemand({ materials:[{id:"m1",codigo:"CIM",descricao:"Cimento",unidade:"sc"}], tasks:[{id:"t1",etapaId:"e1",inicio:"2026-02-10"}], budget:{itens:[{id:"i1",etapaId:"e1",quantidade:10,insumos:[{materialId:"m1",coef:2,precoUnit:30}]},{id:"i2",etapaId:"e1",quantidade:2,insumos:[{descricao:"Areia",coef:1,precoUnit:9}]}]} });
    expect(demands[0]).toMatchObject({materialId:"m1",quantidade:20,custoTotal:600,tarefaIds:["t1"]});
    expect(demands[1].vinculo).toBe("pendente");
  });
  it("classifica pelo percentual acumulado e permite A estratégico", () => {
    const abc=classifyAbc([{materialId:"a",custoTotal:80},{materialId:"b",custoTotal:15},{materialId:"c",custoTotal:5,estrategico:true}]);
    expect(abc.map(item=>item.classeFinal)).toEqual(["A","B","A"]);
  });
  it("exclui movimentos e pedidos cancelados do plano e respeita recebimento parcial", () => {
    expect(availableStock({obraId:"o",materialId:"m",movements:[{obraId:"o",materialId:"m",tipo:"entrada",qtd:10},{obraId:"o",materialId:"m",tipo:"entrada",qtd:7,status:"cancelado"}],reservations:[{obraId:"o",materialId:"m",qtd:3}]})).toMatchObject({fisico:10,livre:7});
    const plan=createSupplyPlan({ id:"p", obraId:"o", snapshot:{id:"s",budgetVersionId:"b"}, item:{materialId:"m",codigo:"M",descricao:"Material",unidade:"un",quantidade:20,tarefaIds:["t"],etapaIds:[],vinculo:"confirmado"}, tasks:[{id:"t",inicio:"2026-02-20"}], movements:[{obraId:"o",materialId:"m",tipo:"entrada",qtd:10}],reservations:[{obraId:"o",materialId:"m",qtd:3}],orders:[{id:"x",obraId:"o",status:"enviado",previsao:"2026-02-18",itens:[{materialId:"m",qtd:8,qtdRecebida:3}]}],profile:{id:"local",nome:"Local",engenharia:1,compra:1,fornecimento:1,logistica:1,buffer:1,total:5},calendar,now:"2026-01-01T00:00:00.000Z" });
    expect(plan.quantidadeAComprar).toBe(8);
    expect(plan.dataCompromissada).toBe("2026-02-18");
  });
  it("bloqueia ciclos de dependência", () => expect(detectDependencyCycle([{id:"a",predecessoras:["b"]},{id:"b",predecessoras:["a"]}])).toEqual(["a","b","a"]));
});
