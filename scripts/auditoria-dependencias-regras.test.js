// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advisoriesDoRelatorio, atingidosPor, avaliarAuditoria, versaoCorrigidaPublicada, versaoNaFaixa } from "./auditoria-dependencias-regras.mjs";

const advisory = (pacote, ghsa, severity, range) => ({ source: 1, name: pacote, dependency: pacote, title: `falha em ${pacote}`, url: `https://github.com/advisories/${ghsa}`, severity, range });
// Formato real do `npm audit --json` (v2): advisories em `via` como objeto;
// pacotes que só dependem de um vulnerável trazem `via` como string.
const relatorio = vias => ({
  auditReportVersion: 2,
  vulnerabilities: {
    ...Object.fromEntries(vias.map(v => [v.name, { name: v.name, severity: v.severity, via: [v], effects: v.name === "braces" ? ["micromatch"] : [] }])),
    ...(vias.some(v => v.name === "braces") ? {
      micromatch: { name: "micromatch", severity: "high", via: ["braces"], effects: ["tailwindcss"] },
      tailwindcss: { name: "tailwindcss", severity: "high", via: ["micromatch"], effects: [], isDirect: true },
    } : {}),
  },
  metadata: { vulnerabilities: {} },
});
const braces = advisory("braces", "GHSA-vfj7-8cjw-p6xm", "high", "<=3.0.3");
const excecaoBraces = { ghsa: "GHSA-vfj7-8cjw-p6xm", pacote: "braces", severidade: "high", escopos: ["."], revisarAte: "2026-11-09", atingidosPermitidos: { ".": ["micromatch", "tailwindcss"] }, diretosPermitidos: { ".": ["tailwindcss"] }, somenteDesenvolvimento: { ".": true } };
const base = { escopo: ".", hoje: "2026-10-10", versoesPublicadas: { braces: ["3.0.3", "2.3.2", "3.0.2"] }, pacotesDev: new Set(["braces", "micromatch", "tailwindcss"]) };

describe("versaoNaFaixa (faixas do npm audit)", () => {
  it("compara comparadores simples, compostos e alternativas", () => {
    expect(versaoNaFaixa("3.0.3", "<=3.0.3")).toBe(true);
    expect(versaoNaFaixa("3.0.4", "<=3.0.3")).toBe(false);
    expect(versaoNaFaixa("1.2.1", ">=1.0.0 <1.2.2")).toBe(true);
    expect(versaoNaFaixa("1.2.2", ">=1.0.0 <1.2.2")).toBe(false);
    expect(versaoNaFaixa("13.0.0", ">= 12.0.0 < 12.0.1")).toBe(false);
    expect(versaoNaFaixa("12.0.0", ">= 12.0.0 < 12.0.1")).toBe(true);
    expect(versaoNaFaixa("0.5.0", "<0.1.0 || >=0.5.0")).toBe(true);
    expect(versaoNaFaixa("9.9.9", "*")).toBe(true);
    expect(versaoNaFaixa("4.1.11-beta.1", "<4.1.11")).toBe(true);
  });
  it("formato desconhecido devolve null (quem chama bloqueia)", () => {
    expect(versaoNaFaixa("1.0.0", "^1.0.0")).toBe(null);
    expect(versaoNaFaixa("lixo", "<1.0.0")).toBe(null);
    expect(versaoNaFaixa("1.0.0", "")).toBe(null);
  });
});

describe("avaliarAuditoria", () => {
  it("advisory high sem exceção bloqueia; moderado não bloqueia", () => {
    const r = avaliarAuditoria({ ...base, relatorio: relatorio([braces, advisory("uuid", "GHSA-w5hq-g745-h8pq", "moderate", "<11.1.1")]), excecoes: [] });
    expect(r.falhas).toEqual(["braces GHSA-vfj7-8cjw-p6xm (high): sem correção aplicada e sem exceção registrada"]);
    expect(r.advisories.map(a => a.pacote)).toEqual(["braces", "uuid"]);
  });
  it("critical também bloqueia", () => {
    const r = avaliarAuditoria({ ...base, relatorio: relatorio([advisory("x", "GHSA-1111-2222-3333", "critical", "<2.0.0")]), excecoes: [] });
    expect(r.falhas).toHaveLength(1);
  });
  it("exceção válida (sem versão corrigida publicada) é aplicada e aparece no resultado", () => {
    const r = avaliarAuditoria({ ...base, relatorio: relatorio([braces]), excecoes: [excecaoBraces] });
    expect(r.falhas).toEqual([]);
    expect(r.excecoesAplicadas).toMatchObject([{ pacote: "braces", ultimaVulneravel: "3.0.3", revisarAte: "2026-11-09" }]);
  });
  it("exceção se revoga quando sai versão corrigida", () => {
    const r = avaliarAuditoria({ ...base, versoesPublicadas: { braces: ["3.0.3", "3.0.4"] }, relatorio: relatorio([braces]), excecoes: [excecaoBraces] });
    expect(r.falhas[0]).toContain("já existe versão corrigida (braces@3.0.4)");
    // Correção publicada fora da tag latest (ex.: latest ainda 3.0.3, 3.0.5 em outra tag) também revoga.
    expect(avaliarAuditoria({ ...base, versoesPublicadas: { braces: ["3.0.5", "3.0.3"] }, relatorio: relatorio([braces]), excecoes: [excecaoBraces] }).falhas[0]).toContain("braces@3.0.5");
    // Pré-lançamento não conta como correção.
    expect(avaliarAuditoria({ ...base, versoesPublicadas: { braces: ["3.0.3", "3.0.4-rc.1"] }, relatorio: relatorio([braces]), excecoes: [excecaoBraces] }).falhas).toEqual([]);
  });
  it("exceção vencida, de outro escopo, com severidade diferente ou sem versão consultada bloqueia", () => {
    const rel = relatorio([braces]);
    expect(avaliarAuditoria({ ...base, hoje: "2026-11-10", relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("vencida");
    expect(avaliarAuditoria({ ...base, escopo: "apps/ponto-obra", relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("sem exceção registrada");
    expect(avaliarAuditoria({ ...base, relatorio: rel, excecoes: [{ ...excecaoBraces, severidade: "moderate" }] }).falhas[0]).toContain("severidade mudou");
    expect(avaliarAuditoria({ ...base, versoesPublicadas: {}, relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("não foi possível confirmar");
    expect(avaliarAuditoria({ ...base, hoje: "2026-11-09", relatorio: rel, excecoes: [excecaoBraces] }).falhas).toEqual([]);   // último dia ainda vale
  });
  it("relatório com erro (sem rede, registro fora) bloqueia em vez de passar calado", () => {
    expect(avaliarAuditoria({ ...base, relatorio: { error: { code: "ENOTFOUND", summary: "sem rede" } }, excecoes: [] }).falhas[0]).toContain("sem rede");
    expect(avaliarAuditoria({ ...base, relatorio: null, excecoes: [] }).falhas).toHaveLength(1);
  });
  it("exceção que não é mais necessária é apontada para remoção", () => {
    const r = avaliarAuditoria({ ...base, relatorio: relatorio([]), excecoes: [excecaoBraces] });
    expect(r.falhas).toEqual([]);
    expect(r.excecoesSemUso).toEqual(["braces GHSA-vfj7-8cjw-p6xm"]);
  });
  it("advisory repetido em vários pacotes conta uma vez só", () => {
    const rel = relatorio([braces]);
    rel.vulnerabilities.chokidar = { name: "chokidar", severity: "high", via: [braces, "braces"] };
    expect(advisoriesDoRelatorio(rel)).toHaveLength(1);
  });
});

describe("exposição e advisory sem explicação", () => {
  it("exceção só vale para os pacotes atingidos registrados: dependência nova puxando o vulnerável bloqueia", () => {
    const rel = relatorio([braces]);
    rel.vulnerabilities.tailwindcss.effects = ["meu-pacote-de-producao"];
    rel.vulnerabilities["meu-pacote-de-producao"] = { name: "meu-pacote-de-producao", severity: "high", via: ["tailwindcss"], effects: [] };
    expect(atingidosPor(rel, "braces")).toEqual(["meu-pacote-de-producao", "micromatch", "tailwindcss"]);
    expect(avaliarAuditoria({ ...base, relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("passou a atingir meu-pacote-de-producao");
  });
  it("pacote high sem advisory que o explique (via fora do formato) bloqueia em vez de passar calado", () => {
    const rel = relatorio([]);
    rel.vulnerabilities.orfao = { name: "orfao", severity: "critical", via: ["pacote-que-nao-esta-no-relatorio"], effects: [] };
    expect(avaliarAuditoria({ ...base, relatorio: rel, excecoes: [] }).falhas).toContain("orfao (critical): sem advisory identificável no relatório do npm");
  });
  it("o mesmo GHSA em OUTRO pacote não some atrás da exceção (achado da revisão de segurança)", () => {
    const rel = relatorio([braces]);
    rel.vulnerabilities["zz-outro"] = { name: "zz-outro", severity: "critical", via: [{ ...braces, name: "zz-outro", dependency: "zz-outro", severity: "critical" }], effects: [] };
    const r = avaliarAuditoria({ ...base, relatorio: rel, excecoes: [excecaoBraces] });
    expect(r.advisories.map(a => a.pacote)).toEqual(["braces", "zz-outro"]);
    expect(r.falhas).toEqual(["zz-outro GHSA-vfj7-8cjw-p6xm (critical): sem correção aplicada e sem exceção registrada"]);
  });
  it("advisory sem url, severidade em maiúsculas ou desconhecida bloqueia", () => {
    const comVia = (nome, via) => { const rel = relatorio([]); rel.vulnerabilities[nome] = { name: nome, severity: via.severity, via: [via], effects: [] }; return rel; };
    expect(avaliarAuditoria({ ...base, relatorio: comVia("x", { name: "x", severity: "critical", range: "*" }), excecoes: [] }).falhas[0]).toContain("x SEM-IDENTIFICACAO (critical)");
    expect(avaliarAuditoria({ ...base, relatorio: comVia("y", { ...braces, name: "y", severity: "HIGH" }), excecoes: [] }).falhas[0]).toContain("y GHSA-vfj7-8cjw-p6xm (high)");
    expect(avaliarAuditoria({ ...base, relatorio: comVia("z", { ...braces, name: "z", severity: "severe" }), excecoes: [] }).falhas[0]).toContain("z GHSA-vfj7-8cjw-p6xm (severe)");
    expect(avaliarAuditoria({ ...base, relatorio: comVia("m", { ...braces, name: "m", severity: "moderate" }), excecoes: [] }).falhas).toEqual([]);
  });
  it("pré-lançamento compara identificador a identificador (beta.9 < beta.10)", () => {
    expect(versaoNaFaixa("1.0.0-beta.10", "<1.0.0-beta.9")).toBe(false);
    expect(versaoNaFaixa("1.0.0-beta.9", "<1.0.0-beta.10")).toBe(true);
    expect(versaoNaFaixa("1.0.0-beta", "<1.0.0-beta.1")).toBe(true);
    expect(versaoNaFaixa("1.0.0-1", "<1.0.0-alpha")).toBe(true);
  });
  it("versaoCorrigidaPublicada: maior estável fora da faixa e acima da maior vulnerável", () => {
    expect(versaoCorrigidaPublicada(["1.0.0", "1.4.0"], "<=1.4.0")).toBe(false);
    expect(versaoCorrigidaPublicada(["1.0.0", "1.4.0", "1.4.1"], "<=1.4.0")).toBe("1.4.1");
    expect(versaoCorrigidaPublicada([], "<=1.4.0")).toBe(null);
    expect(versaoCorrigidaPublicada(["1.0.0"], "^1.0.0")).toBe(null);
  });
});

describe("dependência direta, produção e prazo (segunda rodada de revisão)", () => {
  it("pacote da cadeia virando dependência direta do projeto bloqueia", () => {
    const rel = relatorio([braces]);
    rel.vulnerabilities.micromatch.isDirect = true;   // alguém pôs micromatch em dependencies
    expect(avaliarAuditoria({ ...base, relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("micromatch passou a ser dependência direta");
  });
  it("exceção 'só desenvolvimento': cadeia indo para produção no lockfile bloqueia", () => {
    const r = avaliarAuditoria({ ...base, pacotesDev: new Set(["braces", "micromatch"]), relatorio: relatorio([braces]), excecoes: [excecaoBraces] });
    expect(r.falhas[0]).toContain("tailwindcss não é mais só de desenvolvimento");
  });
  it("prazo de revisão acima de 45 dias a partir de hoje bloqueia no próprio portão", () => {
    const longe = { ...excecaoBraces, revisarAte: "2026-11-25", registradaEm: "2026-11-01" };
    expect(avaliarAuditoria({ ...base, relatorio: relatorio([braces]), excecoes: [longe] }).falhas[0]).toContain("passa de 45 dias");
    expect(avaliarAuditoria({ ...base, relatorio: relatorio([braces]), excecoes: [{ ...excecaoBraces, revisarAte: "2026-11-24" }] }).falhas).toEqual([]);
  });
  it("última versão vulnerável é a maior, não a última da lista", () => {
    expect(avaliarAuditoria({ ...base, relatorio: relatorio([braces]), excecoes: [excecaoBraces] }).excecoesAplicadas[0].ultimaVulneravel).toBe("3.0.3");
  });
});

describe("lista de exceções versionada", () => {
  const { excecoes } = JSON.parse(readFileSync(new URL("./auditoria-excecoes.json", import.meta.url), "utf8"));
  it("toda exceção tem justificativa, exposição, mitigação, risco residual, condição de saída e prazo de até 45 dias", () => {
    for (const e of excecoes) {
      expect(e.ghsa).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(["high", "critical"]).toContain(e.severidade);
      for (const campo of ["justificativa", "exposicao", "mitigacao", "riscoResidual", "condicaoDeSaida"]) expect(String(e[campo] || "").length).toBeGreaterThan(20);
      for (const escopo of e.escopos) { expect(e.caminho[escopo]).toBeTruthy(); expect(e.atingidosPermitidos[escopo]?.length).toBeGreaterThan(0); }
      const dias = (Date.parse(e.revisarAte) - Date.parse(e.registradaEm)) / 86_400_000;
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThanOrEqual(45);
    }
  });
});
