// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { consultarEquipeObras } from "./equipe-obras.js";
vi.mock("./equipe-obras.js", () => ({ consultarEquipeObras: vi.fn(async ({ usuario, dados }) => ({ usuario, dados })) }));
afterEach(() => vi.clearAllMocks());

describe("autorização antes da leitura enxuta", () => {
  it.each([null, { role: "user" }, { role: "engenheiro", accessTabs: [] }])("não lê dados de equipe para sessão/perfil sem acesso: %j", async usuario => {
    const lerDadosEquipe = vi.fn();
    const handler = criarTratadorPonto({ db: {}, company: "a", autenticarUsuario: async () => usuario, lerDados: vi.fn(), lerDadosEquipe });
    const r = await handler({ action: "ponto-equipe-obras" });
    expect([401, 403]).toContain(r.status);
    expect(lerDadosEquipe).not.toHaveBeenCalled();
    expect(consultarEquipeObras).not.toHaveBeenCalled();
  });
  it("usa callback enxuto e preserva identidade/obra para projeção autorizada", async () => {
    const usuario = { id: "e", role: "engenheiro", obraId: "obra-a", accessTabs: ["equipe_obras"] };
    const dados = { employees: [], obras: [], attendance: {} };
    const lerDadosEquipe = vi.fn(async () => dados), lerDadosPainel = vi.fn();
    const handler = criarTratadorPonto({ db: {}, company: "a", autenticarUsuario: async () => usuario, lerDados: vi.fn(), lerDadosPainel, lerDadosEquipe });
    expect((await handler({ action: "ponto-equipe-obras" })).status).toBe(200);
    expect(lerDadosEquipe).toHaveBeenCalledTimes(1);
    expect(lerDadosPainel).not.toHaveBeenCalled();
    expect(consultarEquipeObras).toHaveBeenCalledWith(expect.objectContaining({ usuario, dados, company: "a" }));
  });
  it("mantém compatibilidade do callback anterior", async () => {
    const lerDadosPainel = vi.fn(async () => ({}));
    const handler = criarTratadorPonto({ db: {}, company: "a", autenticarUsuario: async () => ({ role: "admin" }), lerDados: vi.fn(), lerDadosPainel });
    expect((await handler({ action: "ponto-equipe-obras" })).status).toBe(200);
    expect(lerDadosPainel).toHaveBeenCalledTimes(1);
  });
});
