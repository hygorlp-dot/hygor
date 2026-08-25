import { describe, expect, it } from "vitest";
import { LICENSING_COMMAND, applyLicensingCommand } from "./commands.js";

const BASE = { obras: [{ id: "obra1", name: "Obra 1" }], licencas: [], condominios: [] };

describe("comandos de licenciamento", () => {
  it("ignora comandos de outro domínio", () => {
    expect(applyLicensingCommand(BASE, { type: "OUTRO_COMANDO" })).toBeNull();
  });

  it("cria o checklist de licenciamento de uma obra na versão 0", () => {
    const command = {
      type: LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED,
      idempotencyKey: "lic-0001", expectedVersion: 0,
      payload: { license: { id: "lic1", obraId: "obra1", tipo: "simplificada", protocolo: "123/2026" } },
    };
    const result = applyLicensingCommand(BASE, command, "2026-08-25T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.licencas).toEqual([
      expect.objectContaining({ id: "lic1", obraId: "obra1", protocolo: "123/2026", version: 1 }),
    ]);
  });

  it("rejeita checklist para obra inexistente", () => {
    const command = {
      type: LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED,
      idempotencyKey: "lic-0002", expectedVersion: 0,
      payload: { license: { id: "lic1", obraId: "obra-fantasma" } },
    };
    const result = applyLicensingCommand(BASE, command);
    expect(result.ok).toBe(false);
  });

  it("recusa atualizar o checklist com versão desatualizada (concorrência)", () => {
    const withLicense = {
      ...BASE,
      licencas: [{ id: "lic1", obraId: "obra1", protocolo: "123/2026", version: 3 }],
    };
    const command = {
      type: LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED,
      idempotencyKey: "lic-0003", expectedVersion: 1,
      payload: { license: { id: "lic1", obraId: "obra1", protocolo: "999/2026" } },
    };
    const result = applyLicensingCommand(withLicense, command);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/alterado por outra pessoa/);
  });

  it("atualiza o checklist quando a versão esperada bate", () => {
    const withLicense = {
      ...BASE,
      licencas: [{ id: "lic1", obraId: "obra1", protocolo: "123/2026", version: 1, createdAt: "2026-01-01T00:00:00.000Z" }],
    };
    const command = {
      type: LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED,
      idempotencyKey: "lic-0004", expectedVersion: 1,
      payload: { license: { id: "lic1", obraId: "obra1", protocolo: "999/2026" } },
    };
    const result = applyLicensingCommand(withLicense, command, "2026-08-25T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.licencas[0]).toMatchObject({
      protocolo: "999/2026", version: 2, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z",
    });
  });

  it("cria um condomínio na versão 0", () => {
    const command = {
      type: LICENSING_COMMAND.CONDOMINIUM_SAVED,
      idempotencyKey: "cond-0001", expectedVersion: 0,
      payload: { condominium: { id: "cond1", nome: "Terras Alpha", cidade: "Caruaru", uf: "PE" } },
    };
    const result = applyLicensingCommand(BASE, command);
    expect(result.ok).toBe(true);
    expect(result.data.condominios).toEqual([
      expect.objectContaining({ id: "cond1", nome: "Terras Alpha", version: 1 }),
    ]);
  });

  it("rejeita condomínio sem nome", () => {
    const command = {
      type: LICENSING_COMMAND.CONDOMINIUM_SAVED,
      idempotencyKey: "cond-0002", expectedVersion: 0,
      payload: { condominium: { id: "cond1", nome: "  " } },
    };
    const result = applyLicensingCommand(BASE, command);
    expect(result.ok).toBe(false);
  });

  it("recusa editar condomínio com versão desatualizada (concorrência)", () => {
    const withCondo = {
      ...BASE,
      condominios: [{ id: "cond1", nome: "Terras Alpha", version: 2 }],
    };
    const command = {
      type: LICENSING_COMMAND.CONDOMINIUM_SAVED,
      idempotencyKey: "cond-0003", expectedVersion: 1,
      payload: { condominium: { id: "cond1", nome: "Terras Alpha II" } },
    };
    const result = applyLicensingCommand(withCondo, command);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/alterado por outra pessoa/);
  });
});
