import { expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { buildOperationalCommandAudit } from "./operational-command-audit.js";

it("preserva o extrato como entidade primária e a chave idempotente da operação", () => {
  const type = OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED;
  const audit = buildOperationalCommandAudit({
    type,
    payload: {statement: {id: "extrato"}, targets: [{id: "movimento"}]},
    idempotencyKey: "importacao-audit-001",
  });
  expect(audit).toEqual({
    before: {command: type, entityId: "extrato"},
    after: {command: type, idempotencyKey: "importacao-audit-001"},
  });
});

it("ignora identificadores vazios e usa o primeiro item quando há uma lista", () => {
  const {before} = buildOperationalCommandAudit({
    type: OPERATIONAL_COMMAND.ASSETS_IMPORTED,
    payload: {assetId: "", assets: [{id: "ativo-1"}, {id: "ativo-2"}]},
  });
  expect(before.entityId).toBe("ativo-1");
});

it("mantém os valores de auditoria para comandos sem uma entidade no payload", () => {
  expect(buildOperationalCommandAudit({type: OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED}).before.entityId)
    .toBe("company-config");
  expect(buildOperationalCommandAudit({type: OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED, payload: null}).before.entityId)
    .toBe("");
});
