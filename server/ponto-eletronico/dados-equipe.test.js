// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lerDadosEquipe } from "./dados-equipe.js";
import { encodeAppData } from "../data-codec.js";

const CORE = "base", PONTO = "base__ponto";
const linha = (key, value, extra = {}) => ({ company_id: "a", key, value, updated_at: "2026-11-01", ...extra });
function banco(linhas) {
  const consultas = [];
  return { consultas, from(tabela) {
    const filtros = [], ordens = []; let intervalo;
    const info = { tabela, filtros }; consultas.push(info);
    const q = {
      select(colunas) { info.colunas = colunas; return q; },
      eq(k, v) { filtros.push([k, "eq", v]); return q; },
      in(k, v) { filtros.push([k, "in", v]); return q; },
      like(k, v) { filtros.push([k, "like", v]); return q; },
      order(k) { ordens.push(k); return q; },
      range(a, b) { intervalo = [a, b]; return q; },
      then(ok, falha) {
        let data = linhas.filter(r => filtros.every(([k, op, v]) => op === "eq" ? r[k] === v : op === "in" ? v.includes(r[k]) : r[k].startsWith(v.slice(0, -1))));
        data = [...data].sort((a, b) => { for (const k of ordens) { const c = String(a[k]).localeCompare(String(b[k])); if (c) return c; } return 0; });
        if (intervalo) data = data.slice(intervalo[0], intervalo[1] + 1);
        return Promise.resolve({ data, error: null }).then(ok, falha);
      },
    }; return q;
  } };
}
const ler = db => lerDadosEquipe({ db, company: "a", coreKey: CORE, pontoKey: PONTO });

describe("leitura específica da equipe", () => {
  it("preserva fallback legado e retorna somente cadastro/ponto sem consultar outros domínios", async () => {
    const dados = { employees: [{ id: "e" }], obras: [{ id: "o" }], attendance: { e: { "2026-11-12": "F" } }, financeiro: ["não necessário"] };
    const db = banco([linha(CORE, dados), linha(`${CORE}__orcamentos`, { orcamentos: "grande" }), linha(CORE, { employees: [{ id: "outra empresa" }] }, { company_id: "b" })]);
    expect(await ler(db)).toEqual({ employees: dados.employees, obras: dados.obras, attendance: dados.attendance });
    expect(db.consultas).toHaveLength(2);
    expect(db.consultas[0].filtros).toContainEqual(["key", "in", [CORE, PONTO]]);
    for (const q of db.consultas) expect(q.filtros).toContainEqual(["company_id", "eq", "a"]);
  });
  it("preserva meta legado, correção por célula, tombstone e linhas sem obra", async () => {
    const db = banco([
      linha(CORE, { employees: [], obras: [], attendance: { e: { d: "P", x: "F" } } }),
      linha(PONTO, { attendance: { e: { d: "M", x: "F" } } }),
      linha(`${PONTO}__obra__a`, { attendance: { e: { d: "P", x: null } }, attendanceSyncedAt: { e: { d: "2026-11-02", x: "2026-11-02" } } }),
      linha(`${PONTO}__obra__sem_obra`, { attendance: { e: { d: null }, f: { d: "F" } }, attendanceSyncedAt: { e: { d: "2026-11-01" } } }, { updated_at: "2026-11-03" }),
    ]);
    expect((await ler(db)).attendance).toEqual({ e: { d: "P" }, f: { d: "F" } });
  });
  it("relê mudanças, exclusões e novas obras sem cache", async () => {
    const linhas = [linha(CORE, { employees: [{ id: "e" }], obras: [{ id: "a" }] })];
    const db = banco(linhas);
    expect((await ler(db)).employees).toHaveLength(1);
    linhas[0].value = { employees: [], obras: [{ id: "b" }] };
    linhas.push(linha(`${PONTO}__obra__b`, { attendance: { f: { d: "F" } } }));
    expect(await ler(db)).toEqual({ employees: [], obras: [{ id: "b" }], attendance: { f: { d: "F" } } });
  });
  it("decodifica core compactado e não grava migrações em uma consulta", async () => {
    const value = encodeAppData({ employees: [{ id: "e" }], irrelevante: "x".repeat(70000) });
    expect(value.__arcdEncoding).toBeTruthy();
    expect((await ler(banco([linha(CORE, value)]))).employees).toEqual([{ id: "e" }]);
  });
  it("pagina linhas por obra sem truncar a empresa", async () => {
    const linhas = [linha(CORE, {})];
    for (let i = 0; i < 1001; i++) linhas.push(linha(`${PONTO}__obra__${i}`, { attendance: { [i]: { d: "P" } } }));
    const db = banco(linhas);
    expect(Object.keys((await ler(db)).attendance)).toHaveLength(1001);
    expect(db.consultas).toHaveLength(3);
  });
  it("propaga erro em vez de produzir presença vazia e falsa", async () => {
    const db = banco([]);
    db.from = () => { const q = { select: () => q, eq: () => q, in: () => q, like: () => q, order: () => q, range: () => q, then: (ok, falha) => Promise.resolve({ error: new Error("402") }).then(ok, falha) }; return q; };
    await expect(ler(db)).rejects.toThrow("402");
  });
});
