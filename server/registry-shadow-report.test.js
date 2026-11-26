import { describe, expect, it, vi } from "vitest";
import { runWithCompany } from "./company-context.js";
import { handleRegistryShadowReport, isRegistryShadowReport } from "./registry-shadow-report.js";
import { CORE_REGISTRY_TABLES } from "./core-registry-shadow-status.js";
import { EQUIPMENT_REGISTRY_TABLES } from "./equipment-registry-shadow-status.js";
import { PROCUREMENT_REGISTRY_TABLES } from "./procurement-registry-shadow-status.js";
import { ATTENDANCE_REGISTRY_TABLES } from "./attendance-registry-shadow-status.js";

const reports = [
  ["core", CORE_REGISTRY_TABLES, "cadastral"],
  ["equipment", EQUIPMENT_REGISTRY_TABLES, "de equipamentos"],
  ["procurement", PROCUREMENT_REGISTRY_TABLES, "de compras"],
  ["attendance", ATTENDANCE_REGISTRY_TABLES, "de ponto"],
];

const response = () => {
  const res = { status: vi.fn(() => res), json: vi.fn() };
  return res;
};

describe("relatórios de projeção relacional", () => {
  it.each(reports)("recusa acesso não administrativo a %s antes das consultas", async (name, _tables, label) => {
    const action = `${name}-registry-report`;
    const res = response();
    const db = { from: vi.fn() };
    const createCoreDb = vi.fn();

    expect(isRegistryShadowReport(action)).toBe(true);
    await handleRegistryShadowReport({ action, usuario: { role: "engenheiro" }, res, db, createCoreDb });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: `Apenas administradores consultam a projeção ${label}.` });
    expect(db.from).not.toHaveBeenCalled();
    expect(createCoreDb).not.toHaveBeenCalled();
  });

  it.each(reports)("consulta histórico, contagem e amostra de %s para a empresa da sessão", async (name, tables) => {
    const action = `${name}-registry-report`;
    const queries = [];
    const readDb = { from: vi.fn(table => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        then(resolve) {
          const isHistory = table.endsWith("_shadow_runs");
          const isCount = query.select.mock.calls[0][1]?.head;
          return Promise.resolve(resolve(isHistory ? { data: [] }
            : isCount ? { count: 1 } : { data: [{ id: table }] }));
        },
      };
      queries.push(query);
      return query;
    }) };
    const db = name === "core" ? { from: vi.fn() } : readDb;
    const createCoreDb = vi.fn(() => readDb);
    const res = response();

    await runWithCompany("mrc", () =>
      handleRegistryShadowReport({ action, usuario: { role: "admin" }, res, db, createCoreDb }));

    expect(createCoreDb).toHaveBeenCalledTimes(name === "core" ? 1 : 0);
    if (name === "core") expect(db.from).not.toHaveBeenCalled();
    expect(readDb.from.mock.calls.flat()).toEqual([
      `${name}_registry_shadow_runs`, ...Object.values(tables).flatMap(table => [table, table]),
    ]);
    const [history, ...details] = queries;
    expect(history.select).toHaveBeenCalledWith("result, created_at, actor_id");
    expect(history.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(history.limit).toHaveBeenCalledWith(20);
    for (const query of queries) expect(query.eq).toHaveBeenCalledWith("company_id", "mrc");
    for (const [index, query] of details.entries()) {
      expect(query.is).toHaveBeenCalledWith("archived_at", null);
      if (index % 2 === 0) {
        expect(query.select).toHaveBeenCalledWith("*", { count: "exact", head: true });
        expect(query.limit).not.toHaveBeenCalled();
      } else {
        expect(query.order).toHaveBeenCalledWith("synced_at", { ascending: false });
        expect(query.limit).toHaveBeenCalledWith(5);
      }
    }
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      liveCounts: Object.fromEntries(Object.keys(tables).map(section => [section, 1])),
      sample: Object.fromEntries(Object.entries(tables).map(([section, table]) => [section, [{ id: table }]])),
    }));
  });
});
