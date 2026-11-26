import { expect, it } from "vitest";
import { runWithCompany } from "./company-context.js";
import { createCompanyDataReader } from "./company-data-reader.js";
import { decodeAppData, isEncodedAppData } from "./data-codec.js";

it("compacta o núcleo legado na empresa e versão lidas, mantendo o conteúdo e o carimbo", async () => {
  const updatedAt = "2026-11-24T12:00:00.123456Z";
  const value = {notes: "dados fictícios ".repeat(5000)};
  const operations = [];
  const db = {
    from(table) {
      const operation = {table, filters: []};
      operations.push(operation);
      const query = {
        select(columns) { operation.columns = columns; return query; },
        update(patch) { operation.patch = patch; return query; },
        eq(field, match) { operation.filters.push([field, match]); return query; },
        maybeSingle: async () => ({data: {value, updated_at: updatedAt}, error: null}),
        then(resolve) { resolve({error: null}); },
      };
      return query;
    },
  };
  const reader = createCompanyDataReader({
    db, coreKey: "core-test", attendanceKey: "ponto-test", splitRowKeys: {},
  });
  const core = await runWithCompany("mrc", () => reader.lerNucleo());
  expect(core).toEqual({data: {value, updated_at: updatedAt}, payload: value, updatedAt});
  expect(operations).toHaveLength(2);
  expect(operations[0]).toEqual({
    table: "company_app_data", columns: "value, updated_at",
    filters: [["company_id", "mrc"], ["key", "core-test"]],
  });
  expect(operations[1]).toEqual({
    table: "company_app_data", patch: {value: expect.any(Object)},
    filters: [["company_id", "mrc"], ["key", "core-test"], ["updated_at", updatedAt]],
  });
  expect(isEncodedAppData(operations[1].patch.value)).toBe(true);
  expect(decodeAppData(operations[1].patch.value)).toEqual(value);
});
