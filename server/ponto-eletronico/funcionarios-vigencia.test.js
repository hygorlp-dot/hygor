// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";

const FULANO = "piloto-k110-fulano";
const SICLANO = "piloto-k110-siclano";
const ADMIN = { id: "qa-admin", role: "admin", nome: "Admin QA" };
let db, tratar, agoraMs;

beforeEach(() => {
  db = bancoFalso();
  agoraMs = Date.parse("2026-11-29T11:00:00.000Z");
  const dados = {
    obras: [{ id: "piloto-k110", name: "K1-10 — SIMULAÇÃO" }, { id: "obra-teste-b", name: "Obra B — SIMULAÇÃO" }],
    usuarios: [ADMIN, { id: "qa-encarregado", role: "user", nome: "Encarregado QA", active: true }],
    employees: [
      { id: FULANO, name: "Fulano — SIMULAÇÃO", role: "Pedreiro", obra: "piloto-k110", active: true, status: "desligamento_agendado", endDate: "2026-11-30" },
      { id: SICLANO, name: "Siclano — SIMULAÇÃO", role: "Ajudante", obra: "obra-teste-b", active: true, endDate: "2026-11-30" },
    ],
  };
  tratar = criarTratadorPonto({
    db, company: "arcd", lerDados: async () => dados,
    agora: () => new Date(agoraMs),
    autenticarUsuario: async body => body.accessToken === "sessao-qa" ? ADMIN : null,
  });
});

async function aparelho() {
  const codigo = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "sessao-qa", obraId: "piloto-k110" } });
  const pareamento = await tratar({ action: "ponto-parear", body: { codigo: codigo.json.codigo } });
  expect(pareamento.status).toBe(200);
  return { authorization: `Bearer ${pareamento.json.token}` };
}

describe("vigência de Fulano e Siclano no servidor do ponto", () => {
  it("sincroniza pelo relógio injetado e conserva ambos até o fim do último dia em Recife", async () => {
    const headers = await aparelho();
    const sincronizar = () => tratar({ action: "ponto-sincronizar", headers });
    const antes = await sincronizar();
    expect(antes.status).toBe(200);
    expect(antes.json.funcionarios.map(f => f.id)).toEqual([FULANO, SICLANO]);
    expect(antes.json.funcionarios.find(f => f.id === SICLANO).lotacaoObraId).toBe("obra-teste-b");

    agoraMs = Date.parse("2026-12-01T02:59:59.999Z");
    expect((await sincronizar()).json.funcionarios.map(f => f.id)).toEqual([FULANO, SICLANO]);
    agoraMs = Date.parse("2026-12-01T03:00:00.000Z");
    expect((await sincronizar()).json.funcionarios).toEqual([]);
  });

  it("aplica a mesma vigência ao cadastro biométrico e preserva o histórico após o término", async () => {
    const headers = await aparelho();
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "sessao-qa", userId: "qa-encarregado", pin: "2468", obras: ["piloto-k110"] } });
    const cadastrar = employeeId => tratar({ action: "ponto-cadastrar-biometria", headers, body: {
      employeeId, responsavelId: "qa-encarregado", pinResponsavel: "2468", modelo: "vetor-sintetico-de-teste",
      vetor: Array.from({ length: 128 }, () => 0.1),
      consentimento: { termoVersao: "simulacao", aceitoEm: new Date(agoraMs).toISOString() },
    } });

    expect((await cadastrar(FULANO)).status).toBe(200);
    agoraMs = Date.parse("2026-12-01T02:59:59.999Z");
    expect((await cadastrar(SICLANO)).status).toBe(200);
    const antes = await tratar({ action: "ponto-sincronizar", headers });
    expect(antes.json.biometrias.map(b => b.employeeId).sort()).toEqual([FULANO, SICLANO]);

    agoraMs = Date.parse("2026-12-01T03:00:00.000Z");
    for (const id of [FULANO, SICLANO]) expect((await cadastrar(id)).json.error).toMatch(/não está ativo/);
    const depois = await tratar({ action: "ponto-sincronizar", headers, body: { biometriasAssinatura: antes.json.biometriasAssinatura } });
    expect(depois.json.funcionarios).toEqual([]);
    expect(depois.json.biometrias).toEqual([]);
    expect(depois.json.biometriasAssinatura).not.toBe(antes.json.biometriasAssinatura);
    expect(db.tabelas.ponto_biometrias).toHaveLength(2);
  });
});
