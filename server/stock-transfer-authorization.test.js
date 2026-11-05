import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { authorizeOperationalCommand } from "../api/data.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";

// E1.1: transferência de material entre obras. Quem já mexe no estoque envia e
// confirma; o envio responde pela obra de origem e a chegada, pela de destino.
describe("transferência entre obras: perfil e obra no servidor", () => {
  const data = {
    obras: [{ id: "obra-a" }, { id: "obra-b" }],
    movEstoque: [{ id: "t1", obraId: "obra-a", obraDestinoId: "obra-b", materialId: "cim", tipo: "transferencia_saida", qtd: 10 }],
  };
  const enviar = { type: OPERATIONAL_COMMAND.TRANSFER_SENT, payload: { transfer: { obraOrigemId: "obra-a", obraDestinoId: "obra-b" } } };
  const receber = { type: OPERATIONAL_COMMAND.TRANSFER_RECEIVED, payload: { saidaId: "t1", entradaId: "t1-chegada" } };

  it("financeiro, RH e mestre recebem 403; admin, compras e engenharia podem", () => {
    for (const command of [enviar, receber]) {
      for (const role of ["financeiro", "rh", "mestre", "comercial", "visualizador"]) {
        expect(authorizeOperationalCommand(command.type, role)).toMatchObject({ ok: false, status: 403 });
      }
      for (const role of ["admin", "compras", "engenheiro", "engenheiro_auditor"]) {
        expect(authorizeOperationalCommand(command.type, role)).toEqual({ ok: true });
      }
    }
  });

  it("engenheiro da obra de origem envia, mas só o da obra de destino confirma a chegada", () => {
    const daOrigem = { id: "u-a", role: "engenheiro", obraId: "obra-a" };
    const doDestino = { id: "u-b", role: "engenheiro", obraId: "obra-b" };
    expect(validateOperationalCommandScope({ user: daOrigem, data, command: enviar })).toMatchObject({ ok: true });
    expect(validateOperationalCommandScope({ user: doDestino, data, command: enviar })).toMatchObject({ ok: false });
    expect(validateOperationalCommandScope({ user: doDestino, data, command: receber })).toMatchObject({ ok: true });
    expect(validateOperationalCommandScope({ user: daOrigem, data, command: receber })).toMatchObject({ ok: false });
  });
});
