import { describe, expect, it } from "vitest";
import { linkStageToTask, thirdPartyMeasurementsForProject, thirdPartyProgressByTask } from "./obra-measurements.js";

const data = () => ({
  terceirizados: [
    {id: "jh", name: "JOSÉ HENRIQUE", specialty: "eletricista", obraId: "ca106", tipoContrato: "medicao", contractValue: 6600,
      etapas: [
        {id: "inf", nome: "INFRAESTRUTURA", valor: 2900, ordem: 0, tarefaId: "t-eletrica"},
        {id: "cab", nome: "CABEAMENTO", valor: 2900, ordem: 1, tarefaId: "t-eletrica"},
        {id: "qdc", nome: "QDC", valor: 800, ordem: 2},
      ]},
    {id: "semanal", name: "PEDREIRO SEMANAL", obraId: "ca106", tipoContrato: "semanal", etapas: []},
    {id: "outra", name: "OUTRA OBRA", obraId: "k104", tipoContrato: "medicao", etapas: [{id: "x", nome: "X", valor: 10}]},
    {id: "cancel", name: "CANCELADO", obraId: "ca106", tipoContrato: "medicao", status: "cancelado", etapas: [{id: "y", nome: "Y", valor: 10}]},
  ],
  medicoesTerc: [
    {id: "m1", tercId: "jh", data: "2026-09-01", status: "aprovada", total: 1450, pagamentoId: "p1", itens: [{etapaId: "inf", pctAcum: 50}]},
    {id: "m2", tercId: "jh", data: "2026-09-10", status: "aprovada", total: 1450, itens: [{etapaId: "inf", pctAcum: 100}]},
    {id: "m3", tercId: "jh", data: "2026-09-20", status: "rascunho", total: 1450, itens: [{etapaId: "cab", pctAcum: 50}]},
    {id: "m4", tercId: "jh", data: "2026-09-21", status: "rejeitada", total: 800, itens: [{etapaId: "qdc", pctAcum: 100}]},
    {id: "m5", tercId: "jh", data: "2026-09-22", status: "cancelada", total: 999, itens: [{etapaId: "qdc", pctAcum: 100}]},
  ],
});

describe("medições de terceirizados na obra", () => {
  it("lista só os contratos por medição ativos da obra, com o avanço aprovado e o enviado", () => {
    const [jh, ...rest] = thirdPartyMeasurementsForProject(data(), "ca106");
    expect(rest).toEqual([]);
    expect(jh.etapas.map(e => [e.nome, e.pctAprovado, e.pctEnviado])).toEqual([
      ["INFRAESTRUTURA", 100, 100], ["CABEAMENTO", 0, 50], ["QDC", 0, 0],
    ]);
    expect(jh).toMatchObject({
      valorContrato: 6600, valorAprovado: 2900, valorAguardando: 1450, aMedir: 3700,
      avancoAprovado: 43.94, avancoEnviado: 65.91,
      contagem: {aguardando: 1, rejeitadas: 1, aPagar: 1, pagas: 1},
      ultimaMedicao: "2026-09-21",
    });
  });

  it("sem obra ou sem contratos devolve lista vazia", () => {
    expect(thirdPartyMeasurementsForProject(data(), "")).toEqual([]);
    expect(thirdPartyMeasurementsForProject({}, "ca106")).toEqual([]);
  });

  it("propõe o avanço de cada serviço do planejamento pelas etapas vinculadas, ponderado pelo valor", () => {
    const progress = thirdPartyProgressByTask(thirdPartyMeasurementsForProject(data(), "ca106"));
    expect([...progress.keys()]).toEqual(["t-eletrica"]);
    expect(progress.get("t-eletrica")).toMatchObject({pct: 50, pctEnviado: 75});
    expect(progress.get("t-eletrica").fontes.map(f => f.etapa)).toEqual(["INFRAESTRUTURA", "CABEAMENTO"]);
  });

  it("ignora vínculo com serviço que saiu do planejamento", () => {
    const contracts = thirdPartyMeasurementsForProject(data(), "ca106");
    expect(thirdPartyProgressByTask(contracts, new Set(["t-outra"])).size).toBe(0);
  });

  it("troca só o vínculo da etapa escolhida, preservando os demais campos", () => {
    const contract = data().terceirizados[0];
    const stages = linkStageToTask(contract, "qdc", "t-quadro");
    expect(stages[2]).toEqual({id: "qdc", nome: "QDC", valor: 800, ordem: 2, tarefaId: "t-quadro"});
    expect(stages[0]).toBe(contract.etapas[0]);
    expect(linkStageToTask(contract, "inf", "")[0].tarefaId).toBe("");
    expect(() => linkStageToTask(contract, "nao-existe", "t")).toThrow("Etapa");
  });
});
