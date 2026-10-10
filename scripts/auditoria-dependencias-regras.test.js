// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advisoriesDoRelatorio, avaliarAuditoria, versaoNaFaixa } from "./auditoria-dependencias-regras.mjs";

const advisory = (pacote, ghsa, severity, range) => ({ source: 1, name: pacote, dependency: pacote, title: `falha em ${pacote}`, url: `https://github.com/advisories/${ghsa}`, severity, range });
// Formato real do `npm audit --json` (v2): advisories em `via` como objeto;
// pacotes que só dependem de um vulnerável trazem `via` como string.
const relatorio = vias => ({
  auditReportVersion: 2,
  vulnerabilities: {
    ...Object.fromEntries(vias.map(v => [v.name, { name: v.name, severity: v.severity, via: [v] }])),
    micromatch: { name: "micromatch", severity: "high", via: ["braces"] },
  },
  metadata: { vulnerabilities: {} },
});
const braces = advisory("braces", "GHSA-vfj7-8cjw-p6xm", "high", "<=3.0.3");
const excecaoBraces = { ghsa: "GHSA-vfj7-8cjw-p6xm", pacote: "braces", severidade: "high", escopos: ["."], revisarAte: "2026-11-09" };
const base = { escopo: ".", hoje: "2026-10-10", ultimaVersao: { braces: "3.0.3" } };

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
    expect(r.excecoesAplicadas).toMatchObject([{ pacote: "braces", ultimaVersao: "3.0.3", revisarAte: "2026-11-09" }]);
  });
  it("exceção se revoga quando sai versão corrigida", () => {
    const r = avaliarAuditoria({ ...base, ultimaVersao: { braces: "3.0.4" }, relatorio: relatorio([braces]), excecoes: [excecaoBraces] });
    expect(r.falhas[0]).toContain("já existe versão corrigida (braces@3.0.4)");
  });
  it("exceção vencida, de outro escopo, com severidade diferente ou sem versão consultada bloqueia", () => {
    const rel = relatorio([braces]);
    expect(avaliarAuditoria({ ...base, hoje: "2026-11-10", relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("vencida");
    expect(avaliarAuditoria({ ...base, escopo: "apps/ponto-obra", relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("sem exceção registrada");
    expect(avaliarAuditoria({ ...base, relatorio: rel, excecoes: [{ ...excecaoBraces, severidade: "moderate" }] }).falhas[0]).toContain("severidade mudou");
    expect(avaliarAuditoria({ ...base, ultimaVersao: {}, relatorio: rel, excecoes: [excecaoBraces] }).falhas[0]).toContain("não foi possível confirmar");
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

describe("lista de exceções versionada", () => {
  const { excecoes } = JSON.parse(readFileSync(new URL("./auditoria-excecoes.json", import.meta.url), "utf8"));
  it("toda exceção tem justificativa, exposição, mitigação, risco residual, condição de saída e prazo de até 45 dias", () => {
    expect(excecoes.length).toBeGreaterThan(0);
    for (const e of excecoes) {
      expect(e.ghsa).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(["high", "critical"]).toContain(e.severidade);
      for (const campo of ["justificativa", "exposicao", "mitigacao", "riscoResidual", "condicaoDeSaida"]) expect(String(e[campo] || "").length).toBeGreaterThan(20);
      for (const escopo of e.escopos) expect(e.caminho[escopo]).toBeTruthy();
      const dias = (Date.parse(e.revisarAte) - Date.parse(e.registradaEm)) / 86_400_000;
      expect(dias).toBeGreaterThan(0);
      expect(dias).toBeLessThanOrEqual(45);
    }
  });
});
