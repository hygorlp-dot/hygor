import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { possiveisDuplicidades, textoAvisoDuplicidade } from "./duplicidade.js";

const saida = (extra = {}) => ({ id: "t1", valor: -800, data: "2026-10-10", descricao: "PIX CIMENTOS SILVA LTDA", status: "pendente", ...extra });
const alocacao = (obraId = "o1") => [{ destination: "obra", obraId, category: "material", value: 800 }];
const dados = (extra = {}) => ({
  fornecedores: [{ id: "f1", nome: "Cimentos Silva" }, { id: "f2", nome: "Outra Empresa" }],
  notasFiscais: [], pedidos: [], ...extra,
});
const nota = (extra = {}) => ({ id: "n1", numero: "10", obraId: "o1", fornecedorId: "f1", status: "recebida", valorBruto: 800, valorLiquido: 800, pagamentos: [], ...extra });
const pedido = (extra = {}) => ({ id: "p1", numero: "PC-1", obraId: "o1", fornecedorId: "f2", status: "enviado", itens: [{ id: "i", qtd: 8, precoUnit: 100 }], pagamentos: [], ...extra });

describe("aviso de duplicidade ao apropriar o extrato (D-E)", () => {
  it("avisa quando há nota em aberto de mesmo valor na obra, destacando o mesmo fornecedor", () => {
    const avisos = possiveisDuplicidades(dados({ notasFiscais: [nota()] }), saida(), alocacao());
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ tipo: "nota", id: "n1", documento: "NF 10", fornecedor: "Cimentos Silva", provavelmenteOMesmo: true });
  });

  it("avisa também de pedido em aberto sem nota, e põe o do mesmo fornecedor primeiro", () => {
    const avisos = possiveisDuplicidades(dados({ pedidos: [pedido()], notasFiscais: [nota({ id: "n2", numero: "11", pedidoId: "outro" })] }), saida(), alocacao());
    expect(avisos.map(aviso => aviso.id)).toEqual(["n2", "p1"]);
    expect(avisos[1].provavelmenteOMesmo).toBe(false);
  });

  it("não avisa para outra obra, valor diferente, nota sem efeito, nota paga ou entrada", () => {
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota({ obraId: "o2" })] }), saida(), alocacao())).toEqual([]);
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota({ valorLiquido: 801, valorBruto: 801 })] }), saida(), alocacao())).toEqual([]);
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota({ status: "rejeitada" })] }), saida(), alocacao())).toEqual([]);
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota({ pagamentos: [{ id: "pg", valor: 800 }] })] }), saida(), alocacao())).toEqual([]);
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota()] }), saida({ valor: 800 }), alocacao())).toEqual([]);
  });

  it("pedido que já tem nota ativa só gera o aviso da nota; rascunho e cancelado não geram", () => {
    const avisos = possiveisDuplicidades(dados({ pedidos: [pedido({ fornecedorId: "f1" })], notasFiscais: [nota({ pedidoId: "p1", valorLiquido: 800 })] }), saida(), alocacao());
    expect(avisos.map(aviso => aviso.tipo)).toEqual(["nota"]);
    expect(possiveisDuplicidades(dados({ pedidos: [pedido({ status: "rascunho" }), pedido({ id: "p2", status: "cancelado" })] }), saida(), alocacao())).toEqual([]);
  });

  it("só olha as obras do rateio e ignora destino que não é obra", () => {
    expect(possiveisDuplicidades(dados({ notasFiscais: [nota()] }), saida(), [{ destination: "empresa", category: "administrativo", value: 800 }])).toEqual([]);
  });

  it("o texto do aviso lista os documentos e não bloqueia: termina em pergunta", () => {
    const texto = textoAvisoDuplicidade(possiveisDuplicidades(dados({ notasFiscais: [nota()] }), saida(), alocacao()));
    expect(texto).toContain("NF 10");
    expect(texto).toContain("Cimentos Silva");
    expect(texto.trim().endsWith("Apropriar mesmo assim?")).toBe(true);
  });

  it("a tela pergunta antes de enviar CONFIRM_ALLOCATION e respeita o cancelamento", () => {
    const tela = readFileSync(`${process.cwd()}/src/features/conciliacao/ConciliacaoView.jsx`, "utf8");
    const confirmar = tela.slice(tela.indexOf("const confirmarApropriacao"), tela.indexOf("// Estornos também passam pelo servidor"));
    const aviso = confirmar.indexOf("possiveisDuplicidades(data,apropModal,rs)");
    const envio = confirmar.indexOf('type:"CONFIRM_ALLOCATION"');
    expect(aviso).toBeGreaterThan(-1);
    expect(aviso).toBeLessThan(envio);
    expect(confirmar).toMatch(/window\.confirm\(textoAvisoDuplicidade\(duplicidades\)\)\)return false;/);
  });
});
