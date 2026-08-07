import { describe, expect, it } from "vitest";
import { calculateWorkCash, workCashIsEnabled } from "./work-cash.js";

describe("motor do caixa de obra", () => {
  it("ordena movimentos, calcula saldo acumulado e isola a obra", () => {
    const result = calculateWorkCash({
      caixaObra:[
        { id:"d1", obraId:"o1", tipo:"despesa", valor:30, data:"2026-07-03" },
        { id:"a1", obraId:"o1", tipo:"aporte", valor:100, data:"2026-07-01" },
        { id:"x1", obraId:"o2", tipo:"aporte", valor:999, data:"2026-07-01" },
      ],
    }, "o1");

    expect(result).toMatchObject({
      saldo:70,
      totalAportes:100,
      totalDespesas:30,
    });
    expect(result.movimentos.map(item => [item.id, item.saldoAcumulado])).toEqual([
      ["d1", 70],
      ["a1", 100],
    ]);
  });

  it("preserva no snapshot, mas retira cancelamentos e estornos do saldo",()=>{
    const result=calculateWorkCash({
      caixaObra:[
        {id:"a1",obraId:"o1",tipo:"aporte",valor:100,data:"2026-07-01",status:"ativo"},
        {id:"d1",obraId:"o1",tipo:"despesa",valor:30,data:"2026-07-02",status:"estornado"},
        {id:"a2",obraId:"o1",tipo:"aporte",valor:50,data:"2026-07-03",status:"cancelado"},
      ],
    },"o1");
    expect(result).toMatchObject({saldo:100,totalAportes:100,totalDespesas:0});
    expect(result.movimentos.map(item=>item.id)).toEqual(["a1"]);
  });

  it("reconhece o caixa real mesmo quando o marcador legado da obra está desatualizado",()=>{
    const data={
      obras:[{id:"o1",hasCaixa:false},{id:"o2",hasCaixa:false}],
      caixaObra:[
        {id:"a1",obraId:"o1",tipo:"aporte",valor:100,data:"2026-07-01",status:"ativo"},
        {id:"a2",obraId:"o2",tipo:"aporte",valor:50,data:"2026-07-01",status:"cancelado"},
      ],
    };
    expect(workCashIsEnabled(data,"o1")).toBe(true);
    expect(workCashIsEnabled(data,"o2")).toBe(false);
    expect(workCashIsEnabled({obras:[{id:"o3",caixaAtivo:"true"}]},"o3")).toBe(true);
  });
});
