// Limite de tentativas do "ponto-parear" (sem login): por origem + teto global,
// no limite persistente (auth_rate_limits), com bloqueio só pela janela.
import { beforeEach, describe, expect, it } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";
import { LIMITE_PAREAMENTO, origemDaRequisicao } from "./limite-pareamento.js";
import { authRateLimitSubject } from "../app-auth-security.js";

const ADMIN = { id: "u-admin", role: "admin", nome: "Admin" };
const DADOS = { obras: [{ id: "obra-a", name: "Residencial Alameda" }], usuarios: [ADMIN], employees: [], terceirizados: [] };
const ORIGEM = { porOrigem: LIMITE_PAREAMENTO.porOrigem.falhas, global: LIMITE_PAREAMENTO.global.falhas };
const JANELA_MS = LIMITE_PAREAMENTO.porOrigem.janelaSegundos * 1000;
const de = ip => ({ "x-forwarded-for": `${ip}, 10.0.0.1` });

let relogioBanco, db, tratar;
beforeEach(() => {
  relogioBanco = Date.parse("2026-10-01T10:00:00.000Z");
  db = bancoFalso({ agora: () => relogioBanco });
  tratar = criarTratadorPonto({
    db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date("2026-10-01T10:00:00.000Z"),
    autenticarUsuario: async body => (body.accessToken === "ok" ? ADMIN : null),
  });
});

const gerarCodigo = async () => (await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Portaria" } })).json.codigo;
const errado = async (codigoCerto, headers, n = 0) => {
  // Nunca coincide com o certo (n bem menor que 10^8).
  const codigo = String((Number(codigoCerto) + 1 + n) % 100_000_000).padStart(8, "0");
  return tratar({ action: "ponto-parear", body: { codigo }, headers });
};
const parear = (codigo, headers) => tratar({ action: "ponto-parear", body: { codigo }, headers });

describe("ponto-parear - limite de tentativas", () => {
  it("N falhas da mesma origem -> 429 com code próprio e mensagem em português, até para o código certo", async () => {
    const certo = await gerarCodigo();
    for (let i = 0; i < ORIGEM.porOrigem; i++) expect((await errado(certo, de("203.0.113.7"), i)).json.code).toBe("CODIGO_INVALIDO");
    const bloqueada = await errado(certo, de("203.0.113.7"));
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.json.code).toBe("PAREAMENTO_BLOQUEADO");
    expect(bloqueada.json.error).toMatch(/Muitas tentativas de pareamento.*bloqueado por 15 min/);
    expect(bloqueada.json.tentarDeNovoEmSegundos).toBe(LIMITE_PAREAMENTO.porOrigem.janelaSegundos);
    // Nem o código certo passa pela origem bloqueada (senão o bloqueio não protegeria nada)...
    expect((await parear(certo, de("203.0.113.7"))).status).toBe(429);
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
    // ...mas outra origem não é afetada.
    expect((await parear(certo, de("198.51.100.20"))).status).toBe(200);
  });

  it("acerto dentro do limite pareia e zera o contador da origem", async () => {
    const certo = await gerarCodigo();
    for (let i = 0; i < ORIGEM.porOrigem - 1; i++) await errado(certo, de("203.0.113.7"), i);
    const r = await parear(certo, de("203.0.113.7"));
    expect(r.status).toBe(200);
    expect(r.json.token).toBeTruthy();
    // Contador da origem zerado: mais N-1 falhas ainda não bloqueiam.
    const outro = await gerarCodigo();
    for (let i = 0; i < ORIGEM.porOrigem - 1; i++) expect((await errado(outro, de("203.0.113.7"), i)).status).toBe(400);
    expect((await parear(outro, de("203.0.113.7"))).status).toBe(200);
  });

  it("o bloqueio é temporário: passada a janela, o código certo volta a funcionar", async () => {
    const certo = await gerarCodigo();
    for (let i = 0; i < ORIGEM.porOrigem; i++) await errado(certo, de("203.0.113.7"), i);
    expect((await parear(certo, de("203.0.113.7"))).status).toBe(429);
    relogioBanco += JANELA_MS - 60_000;
    const quase = await parear(certo, de("203.0.113.7"));
    expect(quase.status).toBe(429);
    expect(quase.json.tentarDeNovoEmSegundos).toBe(60);
    expect(quase.json.error).toMatch(/bloqueado por 1 min/);
    relogioBanco += 60_001;
    expect((await parear(certo, de("203.0.113.7"))).status).toBe(200);
  });

  it("teto global: falhas espalhadas por muitas origens bloqueiam todas, só pela janela", async () => {
    const certo = await gerarCodigo();
    // Cada origem fica abaixo do próprio limite; a soma atinge o teto global.
    let origem = 0;
    for (let feitas = 0; feitas < ORIGEM.global; feitas++) {
      if (feitas % (ORIGEM.porOrigem - 1) === 0) origem++;
      expect((await errado(certo, de(`192.0.2.${origem}`), feitas)).status).toBe(400);
    }
    const nova = await parear(certo, de("198.51.100.99"));
    expect(nova.status).toBe(429);
    expect(nova.json.code).toBe("PAREAMENTO_BLOQUEADO");
    // Acerto de outra origem não destrava o global; só a janela.
    relogioBanco += JANELA_MS + 1;
    expect((await parear(certo, de("198.51.100.99"))).status).toBe(200);
  });

  it("código já usado conta como falha", async () => {
    const certo = await gerarCodigo();
    expect((await parear(certo, de("203.0.113.7"))).status).toBe(200);
    for (let i = 0; i < ORIGEM.porOrigem; i++) expect((await parear(certo, de("203.0.113.8"))).json.code).toBe("CODIGO_INVALIDO");
    expect((await parear(certo, de("203.0.113.8"))).status).toBe(429);
  });

  it("código mal formado não consome tentativa", async () => {
    for (let i = 0; i < ORIGEM.porOrigem + 2; i++) expect((await parear("123", de("203.0.113.7"))).status).toBe(400);
    expect(db.tabelas.auth_rate_limits).toHaveLength(0);
  });

  it("o banco guarda só hash do sujeito: o IP cru não aparece", async () => {
    const certo = await gerarCodigo();
    await errado(certo, de("203.0.113.7"));
    const gravado = JSON.stringify(db.tabelas.auth_rate_limits);
    expect(gravado).not.toContain("203.0.113.7");
    expect(db.tabelas.auth_rate_limits.map(l => l.subject_hash)).toContain(authRateLimitSubject("arcd", "ponto-parear|origem:203.0.113.7"));
  });

  it("origem = primeiro IP de x-forwarded-for (mesmo critério de api/data.js)", () => {
    expect(origemDaRequisicao({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" })).toBe("203.0.113.7");
    expect(origemDaRequisicao({ "x-real-ip": "198.51.100.1" })).toBe("198.51.100.1");
    expect(origemDaRequisicao({})).toBe("desconhecido");
  });

  it("limite indisponível (RPC falhando) não trava o pareamento", async () => {
    const certo = await gerarCodigo();
    const rpcOriginal = db.rpc;
    db.rpc = async (nome, p) => (nome.startsWith("auth_rate_limit_") ? { data: null, error: { message: "indisponível" } } : rpcOriginal(nome, p));
    expect((await parear(certo, de("203.0.113.7"))).status).toBe(200);
  });
});
