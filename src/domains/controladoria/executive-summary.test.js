import { describe, expect, it, vi } from "vitest";
import { createExecutiveSummaryEngine } from "./executive-summary.js";

const colors = { red:"red", orange:"orange", green:"green" };

describe("motor do resumo executivo", () => {
  it("classifica obras sem depender da camada visual", () => {
    const engine = createExecutiveSummaryEngine({
      calcDREObra:vi.fn(),
      calcDREConsolidado:vi.fn(),
      today:() => "2026-07-27",
      colors,
    });

    expect(engine.statusObraExec({
      prazo:"2026-07-20",
      pctFisico:90,
      pctFinanceiro:90,
      margem:20,
    })).toMatchObject({ k:"critica", l:"Atrasada" });
    expect(engine.statusObraExec({
      pctFisico:50,
      pctFinanceiro:65,
      margem:20,
    })).toMatchObject({ k:"atencao" });
    expect(engine.statusObraExec({
      pctFisico:50,
      pctFinanceiro:55,
      margem:20,
    })).toMatchObject({ k:"saudavel" });
  });

  it("consolida carteira e pipeline usando o DRE injetado", () => {
    const calcDREObra = vi.fn((_data, obraId) => ({
      contratoTotal:obraId === "o1" ? 1000 : 500,
      faturadoAcum:200,
      recebidoAcum:100,
      backlog:800,
      totalCustos:50,
      margemBruta:25,
      pctAvanco:10,
      pctFaturado:20,
      aReceberAcum:100,
    }));
    const dre = { faturamento:400 };
    const engine = createExecutiveSummaryEngine({
      calcDREObra,
      calcDREConsolidado:() => dre,
      today:() => "2026-07-27",
      colors,
    });
    const result = engine.calcResumoExecutivo({
      obras:[
        { id:"o1", name:"Obra 1", status:"active", contractValue:1000 },
        { id:"o2", name:"Obra 2", status:"paused", contractValue:500 },
      ],
      medicoesObra:[],
      comercial:{
        leads:[{ etapa:"novo", orcamentoEstimado:1000, probabilidade:50 }],
        contratos:[{ valor:700 }],
      },
      pedidos:[{ status:"aprovado" }],
      solicitacoesCompra:[{ status:"enviada" }],
    }, 2026, 6);

    expect(result).toMatchObject({
      dre,
      obrasAtivas:1,
      contratoTotalCarteira:1500,
      pipeline:1000,
      pipelinePonderado:500,
      contratosComerciais:700,
      comprasPendentes:1,
      solicitacoesAbertas:1,
    });
  });
});
