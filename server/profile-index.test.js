import { describe, expect, it, vi } from "vitest";
import { runWithCompany } from "./company-context.js";
import { createCompanyProfileIndex } from "./company-profile-index.js";
import { compactProfiles, profileIndexOutdated } from "./data-codec.js";

// O índice de login/OneDrive precisa acompanhar usuários E obras. Caso real
// (20/10/2026): a obra F-05 OÁSIS HOME PARK existia nos dados mas não no
// índice, gravado pela última vez em 28/09.
describe("índice de perfis (login e escopo do OneDrive)", () => {
  const dados = {
    usuarios: [{ id: "u1", nome: "Ana", role: "admin", pin: "h", active: true }],
    obras: [{ id: "8ln6rr8k", name: "H-02" }],
  };

  it("fica desatualizado quando surge uma obra nova", () => {
    const indice = compactProfiles(dados);
    const comObraNova = { ...dados, obras: [...dados.obras, { id: "xlddwbjqdj6p", name: "F-05 OÁSIS HOME PARK" }] };
    expect(profileIndexOutdated(indice, comObraNova)).toBe(true);
  });

  it("fica desatualizado quando muda a pasta do OneDrive ou o nome de uma obra", () => {
    const indice = compactProfiles(dados);
    expect(profileIndexOutdated(indice, { ...dados, obras: [{ id: "8ln6rr8k", name: "H-02", oneDriveFolderId: "p1" }] })).toBe(true);
    expect(profileIndexOutdated(indice, { ...dados, obras: [{ id: "8ln6rr8k", name: "H-02 Bloco A" }] })).toBe(true);
  });

  it("ignora o carimbo de atualização e campos que o índice não guarda", () => {
    const indice = { ...compactProfiles(dados), atualizadoEm: "2026-09-28T21:20:12.692Z" };
    expect(profileIndexOutdated(indice, { ...dados, employees: [{ id: "e1" }], obras: [{ id: "8ln6rr8k", name: "H-02", contractType: "admin_only" }] })).toBe(false);
  });

  it("índice ausente conta como desatualizado", () => {
    expect(profileIndexOutdated(null, dados)).toBe(true);
  });

  it("lê e atualiza o índice na empresa da operação", async () => {
    const stored = compactProfiles(dados);
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({data: {value: stored}, error: null})),
      upsert: vi.fn(async () => ({error: null})),
    };
    const from = vi.fn(() => query);
    const index = createCompanyProfileIndex({from});
    await runWithCompany("mrc", async () => {
      expect(await index.lerIndicePerfis()).toEqual(stored);
      await index.salvarIndicePerfis(dados);
    });
    expect(from.mock.calls).toEqual([["company_app_data"], ["company_app_data"]]);
    expect(query.eq.mock.calls).toEqual([["company_id", "mrc"], ["key", "arced_auth_profiles_v1"]]);
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      company_id: "mrc",
      key: "arced_auth_profiles_v1",
      value: expect.objectContaining({usuarios: stored.usuarios, obras: stored.obras}),
    }), {onConflict: "company_id,key"});
  });

  it("protege o índice de usuário vazio e tolera falha na atualização acessória", async () => {
    const from = vi.fn(() => { throw new Error("Falha simulada"); });
    const index = createCompanyProfileIndex({from});
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await index.atualizarIndicePerfisSeguro({usuarios: []});
      expect(from).not.toHaveBeenCalled();
      await expect(index.atualizarIndicePerfisSeguro(dados)).resolves.toBeUndefined();
      expect(from).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith("Não foi possível atualizar o índice de login:", "Falha simulada");
    } finally {
      log.mockRestore();
    }
  });
});
