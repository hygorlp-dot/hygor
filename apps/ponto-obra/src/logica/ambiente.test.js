// @vitest-environment node
//
// Isolamento do ambiente no APP: o build de homologação não sai sem backend
// isolado nem apontando para a produção, e em execução o app não fala com
// servidor de outro ambiente (config/ambiente.js, app.config.js, conexao.js,
// sincronizacao.js, pareamento).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { rodadaDeSincronizacao, sincronizarCadastro } from "./sincronizacao.js";

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(__dirname, "../..");
const { resolverServidor, conferirAmbiente, ehHostDeProducao, decidirAmbienteDoPareamento, sessaoConfereCom } = require("../../config/ambiente.js");
const ler = rel => readFileSync(path.join(RAIZ, rel), "utf8");
const PADRAO = "https://pontosarcd.vercel.app/api/data";
const HOMOLOG = "https://ponto-homologacao.example.com/api/data";

describe("build: ambiente e servidor embutidos no APK", () => {
  it("PONTO_AMBIENTE é obrigatório: sem ele o build falha (nunca vira produção por omissão)", () => {
    expect(() => resolverServidor({ urlPadrao: PADRAO })).toThrow(/obrigatório/);
    expect(() => resolverServidor({ ambiente: "  ", urlPadrao: PADRAO })).toThrow(/obrigatório/);
    expect(() => resolverServidor({ ambiente: "piloto", urlPadrao: PADRAO })).toThrow(/desconhecido/);
  });

  it("produção declarada: servidor do app.json; PONTO_API_URL pode trocar (https)", () => {
    expect(resolverServidor({ ambiente: "producao", urlPadrao: PADRAO })).toEqual({ ambiente: "producao", apiUrl: PADRAO });
    expect(() => resolverServidor({ ambiente: "producao", urlEnv: "http://inseguro/api", urlPadrao: PADRAO })).toThrow(/https/);
  });

  it("homologação SEM PONTO_API_URL: o build falha", () => {
    expect(() => resolverServidor({ ambiente: "homologacao", urlPadrao: PADRAO })).toThrow(/exige PONTO_API_URL/);
    expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: "   ", urlPadrao: PADRAO })).toThrow(/exige PONTO_API_URL/);
  });

  it("homologação recusa a produção em todas as formas: aliases, previews do projeto 'pontos', maiúsculas, porta e ponto final", () => {
    for (const url of [PADRAO, "https://PONTOSARCD.vercel.app/api/data/", "https://pontos.vercel.app/api/data", "https://pontosarcd.vercel.app./api/data",
      "https://pontos-b16xggn3v-hygor-s-projects1.vercel.app/api/data", "https://pontos-git-main-hygor-s-projects1.vercel.app/api/data",
      "https://pontosarcd-git-feat-x-hygor.vercel.app:443/api/data"]) {
      expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: url })).toThrow(/PRODUÇÃO/);
    }
  });

  it("homologação exige NOME de host com 'homolog' (lista permitida): IP literal e host qualquer são recusados", () => {
    expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: "https://76.76.21.21/api/data" })).toThrow(/nome de host/);
    expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: "https://qualquer.example.com/api/data" })).toThrow(/"homolog"/);
    expect(resolverServidor({ ambiente: "homologacao", urlEnv: HOMOLOG })).toEqual({ ambiente: "homologacao", apiUrl: HOMOLOG });
  });

  it("app.config.js: homologação com PACOTE e nome próprios; eas.json sem perfil que aponte para a produção", () => {
    const fonte = ler("app.config.js");
    expect(fonte).toContain("resolverServidor({ ambiente: process.env.PONTO_AMBIENTE, urlEnv: process.env.PONTO_API_URL");
    expect(fonte).toContain("package: `${config.android.package}${SUFIXO_PACOTE_HOMOLOGACAO}`");
    const eas = JSON.parse(ler("eas.json"));
    expect(eas.build.piloto).toBeUndefined();
    expect(eas.build.homologacao.env).toEqual({ PONTO_AMBIENTE: "homologacao" });
    // A URL do backend isolado vem das variáveis do EAS (ambiente "preview"):
    // o shell local não chega ao servidor de build.
    expect(eas.build.homologacao.environment).toBe("preview");
    expect(eas.build.producao.env.PONTO_AMBIENTE).toBe("producao");
    for (const perfil of Object.values(eas.build)) {
      if (perfil.env?.PONTO_API_URL) expect(perfil.env.PONTO_AMBIENTE === "homologacao" && ehHostDeProducao(new URL(perfil.env.PONTO_API_URL).host)).toBe(false);
    }
  });
});

describe("execução: app e servidor precisam estar no mesmo ambiente", () => {
  it("iguais: ok; diferentes: recusa com mensagem clara; servidor antigo (sem campo) é produção", () => {
    expect(conferirAmbiente("homologacao", "homologacao").ok).toBe(true);
    expect(conferirAmbiente("producao", undefined).ok).toBe(true);
    expect(conferirAmbiente("homologacao", undefined)).toMatchObject({ ok: false, mensagem: expect.stringMatching(/HOMOLOGAÇÃO.*PRODUÇÃO.*NÃO foi vinculado/) });
    expect(conferirAmbiente("producao", "homologacao").ok).toBe(false);
  });

  it("pareamento: decisão pela resposta de ponto-ambiente (200, 400 antigo, 409/503, 5xx, sem rede)", () => {
    expect(decidirAmbienteDoPareamento({ ok: true, ambiente: "homologacao" }, "homologacao")).toMatchObject({ ok: true });
    expect(decidirAmbienteDoPareamento({ ok: true, ambiente: "producao" }, "homologacao")).toMatchObject({ ok: false, mensagem: expect.stringMatching(/NÃO foi vinculado/) });
    // Servidor antigo (sem a ação) = produção: o app de homologação para; o de produção segue.
    expect(decidirAmbienteDoPareamento({ ok: false, status: 400, error: "Ação do ponto eletrônico desconhecida." }, "homologacao").ok).toBe(false);
    expect(decidirAmbienteDoPareamento({ ok: false, status: 400 }, "producao").ok).toBe(true);
    // 5xx sem "ambiente": NÃO confirmado (não vira "produção").
    expect(decidirAmbienteDoPareamento({ ok: false, status: 502 }, "homologacao")).toMatchObject({ ok: false, mensagem: expect.stringMatching(/não confirmou/) });
    expect(decidirAmbienteDoPareamento({ ok: false, status: 502 }, "producao").ok).toBe(false);
    for (const r of [{ ok: false, status: 0 }, { ok: false, status: -1 }, { ok: false, status: 503, code: "AMBIENTE_NAO_CONFIRMADO" }]) {
      expect(decidirAmbienteDoPareamento(r, "homologacao")).toMatchObject({ ok: false, parar: "falha" });
    }
  });

  it("sincronização com servidor de OUTRO ambiente: não guarda cadastro (funcionários/biometrias de outro banco) e a rodada não envia batida", async () => {
    const armazem = criarArmazemMemoria();
    const chamadas = [];
    const api = async (action, corpo) => {
      chamadas.push(action);
      if (action === "ponto-sincronizar") return { ok: true, status: 200, ambiente: "producao", servidorMs: Date.now(), funcionarios: [{ id: "real", nome: "Pessoa Real" }], biometrias: [{ employeeId: "real", vetor: [1] }] };
      return { ok: true, status: 200, resultados: [] };
    };
    const monotonico = () => ({ ms: 1, bootId: "b" });
    const s = await sincronizarCadastro({ armazem, api, monotonico, ambienteApp: "homologacao" });
    expect(s).toMatchObject({ ok: false, codigo: "AMBIENTE_INCOMPATIVEL" });
    expect(await armazem.cadastro()).toBeNull();
    chamadas.length = 0;
    const r = await rodadaDeSincronizacao({ armazem, api, monotonico, corpo: {}, cadastroVencido: true, ambienteApp: "homologacao" });
    expect(r).toMatchObject({ ambienteIncompativel: true });
    expect(chamadas).toEqual(["ponto-sincronizar"]);                          // nada de ponto-enviar-marcacoes
    // Mesmo ambiente: segue normal e guarda o cadastro.
    const ok = await sincronizarCadastro({ armazem, api: async () => ({ ok: true, status: 200, ambiente: "homologacao", servidorMs: Date.now(), funcionarios: [] }), monotonico, ambienteApp: "homologacao" });
    expect(ok.ok).toBe(true);
  });

  it("sessão: só vale no mesmo ambiente e servidor; sessão antiga (sem campos) é de produção", () => {
    expect(sessaoConfereCom({ dispositivoId: "a" }, "producao", "pontosarcd.vercel.app")).toBe(true);           // aparelho de produção atual
    expect(sessaoConfereCom({ dispositivoId: "a" }, "homologacao", "ponto-homologacao.example.com")).toBe(false);
    expect(sessaoConfereCom({ ambiente: "homologacao", servidor: "ponto-homologacao.example.com" }, "homologacao", "ponto-homologacao.example.com")).toBe(true);
    expect(sessaoConfereCom({ ambiente: "homologacao", servidor: "antigo-homolog.example.com" }, "homologacao", "ponto-homologacao.example.com")).toBe(false);
    expect(sessaoConfereCom({ ambiente: "producao", servidor: "pontosarcd.vercel.app" }, "homologacao", "ponto-homologacao.example.com")).toBe(false);
    expect(sessaoConfereCom(null, "producao", "x")).toBe(false);
  });

  it("conexão e sessão: sem fallback para a produção; toda requisição declara o ambiente; sessão presa ao ambiente e ao servidor", () => {
    const conexao = ler("src/servicos/conexao.js");
    expect(conexao).not.toMatch(/apiUrl \|\| "https/);
    expect(conexao).toContain("if (!EXTRA.apiUrl) return null;");
    expect(conexao).toContain("ambienteApp: AMBIENTE");
    expect(conexao).toContain("JSON.stringify({ ...sessao, ambiente: AMBIENTE, servidor: infoDoServidor().host })");
    const app = ler("App.js");
    expect(app).toContain("if (sessao && !sessaoConfere(sessao)) {");
    expect(app).toContain("ambienteApp: AMBIENTE,");
    const pareamento = ler("src/telas/TelaPareamento.js");
    expect(pareamento.indexOf("api(\"ponto-ambiente\")")).toBeGreaterThan(-1);
    expect(pareamento.indexOf("api(\"ponto-ambiente\")")).toBeLessThan(pareamento.indexOf("api(\"ponto-parear\""));
  });
});
