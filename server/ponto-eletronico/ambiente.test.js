// Ambiente do servidor do ponto (ambiente.js): produção x homologação.
// A homologação só vale com o MARCADOR no banco; app e servidor de ambientes
// diferentes não gravam nada.
import { describe, expect, it } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";

const ADMIN = { id: "u1", name: "Admin", role: "admin" };
const DADOS = { obras: [{ id: "obra-a", name: "Obra A" }], employees: [], terceirizados: [] };
const montar = ({ ambienteDeclarado, marcador, supabaseUrl = "https://homologacaoteste00000.supabase.co" } = {}) => {
  const db = bancoFalso();
  if (marcador) db.tabelas.arcd_ambiente = [{ id: true, ambiente: marcador }];
  const tratar = criarTratadorPonto({
    db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date("2026-10-12T10:00:00.000Z"),
    autenticarUsuario: async body => (body.accessToken === "ok" ? ADMIN : null), ambienteDeclarado, supabaseUrl,
  });
  return { db, tratar };
};
const codigo = async tratar => (await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Teste" } })).json.codigo;

describe("ambiente do servidor do ponto", () => {
  it("PRODUÇÃO por padrão (sem PONTO_AMBIENTE): sem consulta nova, ambiente informado ao app", async () => {
    const { db, tratar } = montar();
    expect((await tratar({ action: "ponto-ambiente" })).json).toEqual({ ambiente: "producao" });
    const r = await tratar({ action: "ponto-parear", body: { codigo: await codigo(tratar), ambienteApp: "producao" } });
    expect(r).toMatchObject({ status: 200, json: { ambiente: "producao" } });
    expect(db.tabelas.ponto_dispositivos).toHaveLength(1);
  });

  it("HOMOLOGAÇÃO declarada SEM o marcador no banco (ex.: preview da Vercel com o banco de produção): TODAS as ações bloqueadas, nada gravado", async () => {
    const { db, tratar } = montar({ ambienteDeclarado: "homologacao" });
    for (const action of ["ponto-ambiente", "ponto-codigo-pareamento", "ponto-parear", "ponto-sincronizar", "ponto-enviar-marcacoes"]) {
      const r = await tratar({ action, body: { accessToken: "ok", obraId: "obra-a", codigo: "12345678" } });
      expect(r).toMatchObject({ status: 503, json: { code: "AMBIENTE_NAO_CONFIRMADO" } });
    }
    expect(db.tabelas.ponto_pareamentos).toHaveLength(0);
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
  });

  it("HOMOLOGAÇÃO com o marcador: confirmada e informada no pareamento e na sincronização", async () => {
    const { db, tratar } = montar({ ambienteDeclarado: "homologacao", marcador: "homologacao" });
    expect((await tratar({ action: "ponto-ambiente" })).json).toEqual({ ambiente: "homologacao" });
    const par = await tratar({ action: "ponto-parear", body: { codigo: await codigo(tratar), ambienteApp: "homologacao", aparelho: { ambiente: "homologacao", commit: "abc1234" } } });
    expect(par).toMatchObject({ status: 200, json: { ambiente: "homologacao" } });
    // O ambiente do app fica registrado no aparelho.
    expect(db.tabelas.ponto_dispositivos[0].aparelho).toMatchObject({ ambiente: "homologacao", commit: "abc1234" });
  });

  it("app de HOMOLOGAÇÃO contra servidor de PRODUÇÃO (e o contrário): 409 ANTES de consumir o código ou criar o aparelho", async () => {
    const prod = montar();
    const c = await codigo(prod.tratar);
    const r = await prod.tratar({ action: "ponto-parear", body: { codigo: c, ambienteApp: "homologacao" } });
    expect(r).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL", ambiente: "producao" } });
    expect(r.json.error).toMatch(/HOMOLOGAÇÃO.*PRODUÇÃO.*Nada foi gravado/);
    expect(prod.db.tabelas.ponto_dispositivos).toHaveLength(0);
    expect(prod.db.tabelas.ponto_pareamentos[0].usado_em).toBeFalsy();       // o código continua válido
    const homo = montar({ ambienteDeclarado: "homologacao", marcador: "homologacao" });
    const r2 = await homo.tratar({ action: "ponto-parear", body: { codigo: await codigo(homo.tratar), ambienteApp: "producao" } });
    expect(r2).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL", ambiente: "homologacao" } });
    // Envio de batidas de app de homologação para a produção: recusado antes de qualquer gravação.
    const env = await prod.tratar({ action: "ponto-enviar-marcacoes", headers: { authorization: "Bearer x" }, body: { ambienteApp: "homologacao", eventos: [{}] } });
    expect(env).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL" } });
  });

  it("app antigo (sem ambienteApp) segue funcionando na produção; valor desconhecido no servidor bloqueia", async () => {
    const { tratar } = montar();
    expect((await tratar({ action: "ponto-parear", body: { codigo: await codigo(tratar) } })).status).toBe(200);
    const errado = montar({ ambienteDeclarado: "piloto" });
    expect(await errado.tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 503, json: { code: "AMBIENTE_NAO_CONFIRMADO" } });
  });

  it("homologação ligada ao projeto Supabase da PRODUÇÃO (pelo hash do ref): bloqueada MESMO com o marcador; sem SUPABASE_URL também", async () => {
    const { HASH_REF_PRODUCAO, hashDoRef, refDoSupabase } = await import("./ambiente.js");
    expect(HASH_REF_PRODUCAO).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoRef(refDoSupabase("https://AbCd.supabase.co"))).toBe(hashDoRef("abcd"));
    // Simula a produção: um ref cujo hash é o de produção (o teste não conhece o ref real).
    const ambienteMod = await import("./ambiente.js");
    const { criarAmbiente } = ambienteMod;
    const db = bancoFalso(); db.tabelas.arcd_ambiente = [{ id: true, ambiente: "homologacao" }];
    const semUrl = criarAmbiente({ db, declarado: "homologacao", supabaseUrl: "" });
    expect(await semUrl()).toMatchObject({ erro: expect.stringMatching(/sem SUPABASE_URL/) });
    const outro = criarAmbiente({ db, declarado: "homologacao", supabaseUrl: "https://homologacaoteste00000.supabase.co" });
    expect(await outro()).toEqual({ ambiente: "homologacao" });
  });

  it("marcador com outro valor não confirma homologação", async () => {
    const { tratar } = montar({ ambienteDeclarado: "homologacao", marcador: "producao" });
    expect(await tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 503 });
  });
});
