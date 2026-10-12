// @vitest-environment node
//
// Isolamento do ambiente no APP: o build de homologação não sai sem backend
// isolado nem apontando para a produção, e em execução o app não fala com
// servidor de outro ambiente (config/ambiente.js, app.config.js, conexao.js).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(__dirname, "../..");
const { resolverServidor, conferirAmbiente, ehHostDeProducao } = require("../../config/ambiente.js");
const ler = rel => readFileSync(path.join(RAIZ, rel), "utf8");
const PADRAO = "https://pontosarcd.vercel.app/api/data";

describe("build: ambiente e servidor embutidos no APK", () => {
  it("produção (padrão): servidor do app.json; PONTO_API_URL pode trocar (https)", () => {
    expect(resolverServidor({ urlPadrao: PADRAO })).toEqual({ ambiente: "producao", apiUrl: PADRAO });
    expect(() => resolverServidor({ urlEnv: "http://inseguro/api", urlPadrao: PADRAO })).toThrow(/https/);
  });

  it("homologação SEM PONTO_API_URL: o build falha (nunca cai na produção em silêncio)", () => {
    expect(() => resolverServidor({ ambiente: "homologacao", urlPadrao: PADRAO })).toThrow(/exige PONTO_API_URL/);
    expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: "   ", urlPadrao: PADRAO })).toThrow(/exige PONTO_API_URL/);
  });

  it("homologação apontando para a PRODUÇÃO ou para preview da Vercel do projeto de produção: recusada", () => {
    for (const url of [PADRAO, "https://PONTOSARCD.vercel.app/api/data/", "https://pontosarcd-git-feat-x-hygor.vercel.app/api/data", "https://pontosarcd-abc123.vercel.app/api/data"]) {
      expect(() => resolverServidor({ ambiente: "homologacao", urlEnv: url })).toThrow(/PRODUÇÃO/);
    }
    expect(resolverServidor({ ambiente: "homologacao", urlEnv: "https://ponto-homologacao.example.com/api/data" }))
      .toEqual({ ambiente: "homologacao", apiUrl: "https://ponto-homologacao.example.com/api/data" });
  });

  it("valor desconhecido (ex.: o antigo 'piloto') não vira produção: falha", () => {
    expect(() => resolverServidor({ ambiente: "piloto", urlPadrao: PADRAO })).toThrow(/desconhecido/);
  });

  it("app.config.js usa a regra; eas.json: perfil de homologação sem URL embutida e sem perfil apontando para produção", () => {
    expect(ler("app.config.js")).toContain("resolverServidor({ ambiente: process.env.PONTO_AMBIENTE, urlEnv: process.env.PONTO_API_URL");
    const eas = JSON.parse(ler("eas.json"));
    expect(eas.build.piloto).toBeUndefined();
    expect(eas.build.homologacao.env).toEqual({ PONTO_AMBIENTE: "homologacao" });
    expect(eas.build.producao.env.PONTO_AMBIENTE).toBe("producao");
    for (const perfil of Object.values(eas.build)) {
      if (perfil.env?.PONTO_AMBIENTE === "homologacao" && perfil.env.PONTO_API_URL) expect(ehHostDeProducao(new URL(perfil.env.PONTO_API_URL).host)).toBe(false);
    }
  });
});

describe("execução: app e servidor precisam estar no mesmo ambiente", () => {
  it("iguais: ok; diferentes: recusa com mensagem clara; servidor antigo (sem campo) é produção", () => {
    expect(conferirAmbiente("homologacao", "homologacao").ok).toBe(true);
    expect(conferirAmbiente("producao", undefined).ok).toBe(true);
    const r = conferirAmbiente("homologacao", undefined);
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringMatching(/HOMOLOGAÇÃO.*PRODUÇÃO.*NÃO foi vinculado/) });
    expect(conferirAmbiente("producao", "homologacao").ok).toBe(false);
  });

  it("conexão: sem fallback para a produção; toda requisição declara o ambiente; pareamento confere ANTES de mandar o código", () => {
    const conexao = ler("src/servicos/conexao.js");
    expect(conexao).not.toMatch(/apiUrl \|\| "https/);
    expect(conexao).toContain("if (!EXTRA.apiUrl) return null;");
    expect(conexao).toContain("ambienteApp: AMBIENTE");
    expect(conexao).toContain("code: \"SERVIDOR_NAO_CONFIGURADO\"");
    const pareamento = ler("src/telas/TelaPareamento.js");
    expect(pareamento.indexOf("api(\"ponto-ambiente\")")).toBeGreaterThan(-1);
    expect(pareamento.indexOf("api(\"ponto-ambiente\")")).toBeLessThan(pareamento.indexOf("api(\"ponto-parear\""));
  });
});
