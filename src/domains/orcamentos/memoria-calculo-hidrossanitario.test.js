import { describe, expect, it } from "vitest";
import {
  novoHidrossanitario, novaLinhaConexao, novaLinhaCaixa, novaLinhaPeca,
  novaLinhaContagem, novaLinhaTuboRigido, novaLinhaTuboFlexivel,
  somaQuantidade, somaComprimento,
} from "./memoria-calculo-hidrossanitario";

describe("novoHidrossanitario", () => {
  it("começa com as 8 tabelas vazias", () => {
    const h = novoHidrossanitario();
    expect(Object.keys(h)).toEqual([
      "conexoesAguaFria", "conexoesEsgoto", "caixasRalosComplementos",
      "pecasHidraulicasSanitarias", "registrosAcessorios", "calhasPluviais",
      "tubosRigidos", "tubosFlexiveis",
    ]);
    expect(Object.values(h).every(lista => Array.isArray(lista) && lista.length === 0)).toBe(true);
  });

  it("aceita sobrescrever qualquer tabela (ex.: importada do PDF)", () => {
    const h = novoHidrossanitario({ conexoesAguaFria: [novaLinhaConexao({ codigo: "F1", quantidade: 5 })] });
    expect(h.conexoesAguaFria).toHaveLength(1);
    expect(h.conexoesEsgoto).toEqual([]);
  });
});

describe("linhas padrão de cada tabela", () => {
  it("cada construtor parte zerado e aceita sobrescrever campos", () => {
    expect(novaLinhaConexao()).toEqual({ codigo: "", descricao: "", quantidade: 0 });
    expect(novaLinhaCaixa()).toEqual({ descricao: "", tipoSistema: "", quantidade: 0 });
    expect(novaLinhaPeca()).toEqual({ descricao: "", abreviatura: "", tipoSistema: "", quantidade: 0 });
    expect(novaLinhaContagem()).toEqual({ descricao: "", quantidade: 0 });
    expect(novaLinhaTuboRigido()).toEqual({ descricao: "", abreviatura: "", sistema: "", diametroMm: 0, comprimentoM: 0 });
    expect(novaLinhaTuboFlexivel()).toEqual({ descricao: "", diametroMm: 0, comprimentoM: 0 });
    expect(novaLinhaConexao({ codigo: "F1", quantidade: 5 }).codigo).toBe("F1");
  });
});

describe("somaQuantidade / somaComprimento", () => {
  it("soma o campo certo de uma lista de linhas, ignorando valores ausentes", () => {
    expect(somaQuantidade([{ quantidade: 5 }, { quantidade: 3 }, {}])).toBe(8);
    expect(somaComprimento([{ comprimentoM: 18.13 }, { comprimentoM: 68.63 }])).toBeCloseTo(86.76);
    expect(somaQuantidade([])).toBe(0);
    expect(somaQuantidade(undefined)).toBe(0);
  });
});
