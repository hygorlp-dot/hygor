import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { criarTratadorPonto, ehAcaoPonto, hashPin, limparAparelho } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";
import { HASH_INICIAL, calcularHashMarcacao } from "../../src/domains/ponto-eletronico/marcacao.js";

const sha256 = v => createHash("sha256").update(v).digest("hex");

const ADMIN = { id: "u-admin", role: "admin", nome: "Admin" };
const ENCARREGADO = { id: "u-enc", role: "user", nome: "Encarregado" };
const DADOS = {
  obras: [{ id: "obra-a", name: "Residencial Alameda" }, { id: "obra-b", name: "Outra" }],
  usuarios: [ADMIN, { ...ENCARREGADO, active: true }],
  employees: [
    { id: "e1", name: "Zé Pedreiro", role: "Pedreiro", cpf: "123.456.789-09", obra: "obra-a", active: true },
    { id: "e2", name: "Fora da obra", obra: "obra-b", active: true },
  ],
  terceirizados: [{ id: "t1", name: "Elétrica X", obraId: "obra-a" }],
};
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

let db, tratar, sessao;
beforeEach(() => {
  db = bancoFalso();
  sessao = ADMIN;
  tratar = criarTratadorPonto({
    db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date("2026-10-01T10:00:00.000Z"),
    autenticarUsuario: async body => (body.accessToken === "ok" ? sessao : null),
  });
});

async function parear() {
  const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Portaria" } });
  const r = await tratar({ action: "ponto-parear", body: { codigo: json.codigo, appVersao: "1.0.0" } });
  return r.json;
}
async function marcacoes(dispositivoId, qtd, { anterior = HASH_INICIAL, inicio = 1, foto = null } = {}) {
  const lista = [];
  for (let i = 0; i < qtd; i++) {
    const m = { id: `00000000-0000-4000-8000-${String(inicio + i).padStart(12, "0")}`, dispositivoId, nsr: inicio + i, tipoRegistro: "ponto",
      employeeId: "e1", cpf: "12345678909", marcadoEm: `2026-10-01T10:0${i}:00.000Z`, horaConfiavel: true, metodo: "facial",
      confianca: 0.91, hashAnterior: anterior, fotoSha256: foto ? sha256(foto) : undefined };
    m.hash = await calcularHashMarcacao(m, sha256);
    anterior = m.hash; lista.push(m);
  }
  return lista;
}

describe("ponto eletrônico - servidor", () => {
  it("só ações 'ponto-*' são despachadas para cá", () => {
    expect(ehAcaoPonto("ponto-sincronizar")).toBe(true);
    expect(ehAcaoPonto("load")).toBe(false);
  });

  it("pareia o aparelho com código de uso único e guarda só o hash do token", async () => {
    const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Portaria" } });
    expect(json.codigo).toMatch(/^\d{8}$/);
    const r = await tratar({ action: "ponto-parear", body: { codigo: json.codigo } });
    expect(r.status).toBe(200);
    expect(r.json.obra).toEqual({ id: "obra-a", nome: "Residencial Alameda" });
    expect(db.tabelas.ponto_dispositivos[0].token_hash).toBe(sha256(r.json.token));
    expect(JSON.stringify(db.tabelas.ponto_dispositivos)).not.toContain(r.json.token);
    const segunda = await tratar({ action: "ponto-parear", body: { codigo: json.codigo } });
    expect(segunda.json.code).toBe("CODIGO_INVALIDO");
  });

  it("código expirado não pareia", async () => {
    const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a" } });
    db.tabelas.ponto_pareamentos[0].expira_em = "2026-10-01T09:00:00.000Z";
    expect((await tratar({ action: "ponto-parear", body: { codigo: json.codigo } })).json.code).toBe("CODIGO_EXPIRADO");
  });

  it("perfil sem gestão não gera código; sem sessão é recusado", async () => {
    sessao = ENCARREGADO;
    expect((await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a" } })).status).toBe(403);
    expect((await tratar({ action: "ponto-dispositivos", body: {} })).status).toBe(401);
  });

  it("sincroniza a base única: TODOS os funcionários ativos da empresa (qualquer obra), terceirizados e responsáveis da obra", async () => {
    const p = await parear();
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-a"] } });
    const r = await tratar({ action: "ponto-sincronizar", headers: { authorization: `Bearer ${p.token}` }, body: { gps: { lat: -8.2, lng: -35.9, precisao: 9 } } });
    expect(r.status).toBe(200);
    expect(r.json.funcionarios.map(f => f.id)).toEqual(["e2", "e1"]);           // e2 é lotado na obra-b e aparece no aparelho da obra-a
    expect(r.json.funcionarios.find(f => f.id === "e2").lotacaoObraId).toBe("obra-b");
    expect(r.json.terceirizados.map(t => t.id)).toEqual(["t1"]);
    expect(r.json.servidorMs).toBe(Date.parse("2026-10-01T10:00:00.000Z"));
    const [resp] = r.json.responsaveis;
    expect(resp.userId).toBe("u-enc");
    expect(hashPin("4321", resp.pinSalt, resp.pinIteracoes)).toBe(resp.pinHash);
    expect(db.tabelas.ponto_dispositivos[0].ultimo_gps).toMatchObject({ lat: -8.2, lng: -35.9 });
  });

  it("aparelho sem token, desconhecido ou revogado não sincroniza", async () => {
    expect((await tratar({ action: "ponto-sincronizar" })).json.code).toBe("APARELHO_SEM_TOKEN");
    expect((await tratar({ action: "ponto-sincronizar", headers: { authorization: "Bearer xyz" } })).json.code).toBe("APARELHO_DESCONHECIDO");
    const p = await parear();
    await tratar({ action: "ponto-dispositivo-revogar", body: { accessToken: "ok", dispositivoId: p.dispositivoId } });
    expect((await tratar({ action: "ponto-sincronizar", headers: { authorization: `Bearer ${p.token}` } })).json.code).toBe("APARELHO_REVOGADO");
  });

  it("recebe marcações encadeadas, é idempotente e recusa marcação adulterada", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    const lote = await marcacoes(p.dispositivoId, 3);
    let r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: lote } });
    expect(r.json).toMatchObject({ aceitas: 3, ultimoNsr: 3, erro: null });
    r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: lote } });
    expect(r.json).toMatchObject({ aceitas: 0, ultimoNsr: 3 });
    const proximas = await marcacoes(p.dispositivoId, 2, { inicio: 4, anterior: lote[2].hash });
    proximas[1] = { ...proximas[1], employeeId: "e2" }; // adulterada depois do hash
    r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: proximas } });
    expect(r.json.aceitas).toBe(1);
    expect(r.json.erro).toMatch(/alterada/);
    expect(db.tabelas.ponto_marcacoes).toHaveLength(4);
  });

  it("não aceita marcação de outro aparelho no lote", async () => {
    const p = await parear();
    const lote = await marcacoes("6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", 1);
    const r = await tratar({ action: "ponto-enviar-marcacoes", headers: { authorization: `Bearer ${p.token}` }, body: { marcacoes: lote } });
    expect(r.status).toBe(400);
  });

  it("foto só é aceita se for exatamente a registrada na marcação, e o ARCD vê por link assinado", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    const [m] = await marcacoes(p.dispositivoId, 1, { foto: JPEG });
    await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: [m] } });
    const outra = Buffer.from([0xff, 0xd8, 9, 9]);
    expect((await tratar({ action: "ponto-enviar-foto", headers: auth, body: { marcacaoId: m.id, foto: outra.toString("base64") } })).status).toBe(400);
    expect((await tratar({ action: "ponto-enviar-foto", headers: auth, body: { marcacaoId: m.id, foto: JPEG.toString("base64") } })).json).toEqual({ recebida: true });
    const url = await tratar({ action: "ponto-foto-url", body: { accessToken: "ok", marcacaoId: m.id } });
    expect(url.json.url).toContain(`marcacoes/obra-a/2026-10-01/${m.id}.jpg`);
  });

  it("biometria exige consentimento, funcionário ATIVO da empresa (de qualquer obra) e responsável autorizado na obra do aparelho", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-a"] } });
    const base = { employeeId: "e1", modelo: "mobilefacenet-v1", vetor: Array.from({ length: 128 }, (_, i) => i / 128), fotos: [JPEG.toString("base64")], responsavelId: "u-enc" };
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: base })).json.error).toMatch(/consentimento/);
    const consentimento = { termoVersao: "2026-10", aceitoEm: "2026-10-01T09:59:00.000Z" };
    // Funcionário lotado em OUTRA obra pode ter o rosto cadastrado aqui.
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, employeeId: "e2", consentimento } })).status).toBe(200);
    // Quem não existe ou não está ativo, não.
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, employeeId: "nao-existe", consentimento } })).json.error).toMatch(/não está ativo/);
    // Responsável SEM autorização na obra deste aparelho não cadastra.
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-b"] } });
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, consentimento } })).status).toBe(403);
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-a"] } });
    const r = await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, consentimento } });
    expect(r.status).toBe(200);
    const status = await tratar({ action: "ponto-biometria-status", body: { accessToken: "ok" } });
    expect(status.json.biometrias).toEqual(expect.arrayContaining([expect.objectContaining({ employeeId: "e1", cadastradoPor: "u-enc" }), expect.objectContaining({ employeeId: "e2" })]));
    await tratar({ action: "ponto-biometria-excluir", body: { accessToken: "ok", employeeId: "e1" } });
    expect(db.tabelas.ponto_biometrias.map(b => b.employee_id)).toEqual(["e2"]);
  });
});

describe("identificação do aparelho no servidor", () => {
  it("guarda só campos conhecidos, em texto curto", () => {
    expect(limparAparelho({ marca: "samsung", modelo: "x".repeat(200), android: 14, serial: "NAO", imei: "NAO", build: null })).toEqual({ marca: "samsung", modelo: "x".repeat(80), android: "14" });
    expect(limparAparelho("lixo")).toEqual({});
    expect(limparAparelho(null)).toEqual({});
  });
});
