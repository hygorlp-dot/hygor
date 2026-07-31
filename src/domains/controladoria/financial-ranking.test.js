import { describe, expect, it, vi } from "vitest";
import { createFinancialRankingEngine } from "./financial-ranking.js";

describe("ranking financeiro por obra", () => {
  it("combina o DRE canônico com pendências sem duplicar pagamentos", () => {
    const calculateWorkDre = vi.fn(() => ({
      faturamento:1000,
      recebido:900,
      totalCustos:600,
      faturadoAcum:1000,
      recebidoAcum:900,
      lucroBruto:400,
      margemBruta:40,
      margemCaixa:33.333333,
      saldoCaixa:300,
    }));
    const { calculateFinancialRanking } = createFinancialRankingEngine({ calculateWorkDre });
    const sharedPayment = { id:"pg-1", valor:100, data:"2026-07-10", conciliado:false };
    const result = calculateFinancialRanking({
      obras:[{ id:"o1", name:"Obra 1", code:"B1" }],
      notasFiscais:[{
        id:"n1",
        obraId:"o1",
        pedidoId:"p1",
        emissao:"2026-07-01",
        vencimento:"2026-07-15",
        valorLiquido:300,
        pagamentos:[sharedPayment],
      }],
      pedidos:[
        { id:"p1", obraId:"o1", status:"emitido", data:"2026-07-01", pagamentos:[sharedPayment] },
        { id:"p2", obraId:"o1", status:"emitido", data:"2026-07-02", pagamentos:[] },
      ],
      medicoes:[{
        id:"m1",
        obraId:"o1",
        valorPrevisto:200,
        valorRecebido:0,
        dataVencimento:"2026-07-12",
      }],
    }, 2026, 6);

    expect(calculateWorkDre).toHaveBeenCalledWith(expect.any(Object), "o1", 2026, 6);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id:"o1",
      posicao:1,
      conceito:"A+",
      notasVencidas:1,
      pedidosSemNota:1,
      naoConciliados:1,
      recebiveisVencidos:1,
    });
    expect(result[0].alertas).toEqual(expect.arrayContaining([
      "1 nota(s) vencida(s)",
      "1 pedido(s) sem NF",
      "1 pagamento(s) a conciliar",
      "1 recebível(is) vencido(s)",
    ]));
  });

  it("omite obra sem qualquer movimento e exige o DRE canônico", () => {
    expect(() => createFinancialRankingEngine()).toThrow("DRE por obra");
    const engine = createFinancialRankingEngine({
      calculateWorkDre:() => ({
        faturamento:0,
        recebido:0,
        totalCustos:0,
        faturadoAcum:0,
      }),
    });
    expect(engine.calculateFinancialRanking({ obras:[{ id:"o1" }] }, 2026, 6)).toEqual([]);
  });
});
