import { describe, expect, it, vi } from "vitest";
import { compactProfiles } from "./data-codec.js";
import { createCompanyWorkspaceLoader } from "./load-company-workspace.js";

const user = { id: "admin-1", nome: "Administrador", role: "admin", pin: "teste" };
const data = { usuarios: [user], obras: [{ id: "obra-a", name: "Obra A" }] };
const updatedAt = "2026-11-25T12:00:00Z";
const archivedLaborCosts = { "arquivo-1": { total: 123 } };

function setup() {
  const adapters = {
    anexarCustosArquivados: vi.fn(async () => ({ ...data, archivedLaborCosts })),
    lerIndicePerfis: vi.fn(async () => compactProfiles(data)),
    atualizarIndicePerfisSeguro: vi.fn(async () => {}),
  };
  return { ...adapters, load: createCompanyWorkspaceLoader(adapters) };
}

describe("carga autenticada da empresa", () => {
  it("entrega custos arquivados, versão e perfil público sem regravar o índice vigente", async () => {
    const { load, atualizarIndicePerfisSeguro } = setup();
    const response = await load({ data, updatedAt, user });
    expect(response).toMatchObject({
      data: { archivedLaborCosts },
      updatedAt,
      usuario: { id: user.id, role: user.role },
    });
    expect(response.usuario).not.toHaveProperty("pin");
    expect(atualizarIndicePerfisSeguro).not.toHaveBeenCalled();
  });

  it("repara um índice indisponível com a fotografia original e mantém o recorte do perfil", async () => {
    const { load, lerIndicePerfis, atualizarIndicePerfisSeguro } = setup();
    lerIndicePerfis.mockRejectedValue(new Error("índice indisponível"));
    const response = await load({ data, updatedAt, user: { id: "eng-1", role: "engenheiro", obraId: "obra-a" } });
    expect(atualizarIndicePerfisSeguro).toHaveBeenCalledExactlyOnceWith(data);
    expect(response.data.obras).toEqual(data.obras);
    expect(response.data).not.toHaveProperty("archivedLaborCosts");
  });

  it("propaga a falha dos custos arquivados antes de reparar o índice", async () => {
    const { load, anexarCustosArquivados, atualizarIndicePerfisSeguro } = setup();
    const error = new Error("arquivo indisponível");
    anexarCustosArquivados.mockRejectedValue(error);
    await expect(load({ data, updatedAt, user })).rejects.toBe(error);
    expect(atualizarIndicePerfisSeguro).not.toHaveBeenCalled();
  });
});
