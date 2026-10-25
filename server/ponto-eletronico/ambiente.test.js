import { describe, expect, it } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";

const montar = ({ declarado, marcador } = {}) => {
  const db = bancoFalso();
  db.tabelas.arcd_ambiente = marcador ? [{ id: true, ambiente: marcador }] : [];
  const tratar = criarTratadorPonto({
    db, company: "arcd", ambienteDeclarado: declarado, supabaseUrl: "https://isoladoteste.supabase.co",
    lerDados: async () => ({ obras: [{ id: "obra-a", name: "Simulação" }], employees: [] }),
    autenticarUsuario: async body => body.accessToken === "sessao" ? { id: "admin", role: "admin" } : null,
  });
  return { db, tratar };
};
const codigo = async tratar => (await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "sessao", obraId: "obra-a" } })).json.codigo;

describe("isolamento do ponto", () => {
  it("preserva o aplicativo antigo em produção", async () => {
    const { tratar } = montar();
    expect(await tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 200, json: { ok: true, ambiente: "producao" } });
    expect(await tratar({ action: "ponto-parear", body: { codigo: await codigo(tratar) } })).toMatchObject({ status: 200, json: { ambiente: "producao" } });
  });
  it.each([undefined, "producao"])("recusa todas as ações de homologação sem marcador correto (%s)", async marcador => {
    const { db, tratar } = montar({ declarado: "homologacao", marcador });
    for (const action of ["ponto-ambiente", "ponto-codigo-pareamento", "ponto-parear", "ponto-enviar-marcacoes"]) {
      expect(await tratar({ action, body: { accessToken: "sessao", obraId: "obra-a", ambienteApp: "homologacao" } })).toMatchObject({ status: 503, json: { code: "AMBIENTE_NAO_CONFIRMADO" } });
    }
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
    expect(db.tabelas.ponto_pareamentos).toHaveLength(0);
  });
  it("confirma marcador e informa o ambiente no pareamento e na sincronização", async () => {
    const { tratar } = montar({ declarado: "homologacao", marcador: "homologacao" });
    expect((await tratar({ action: "ponto-ambiente", body: { ambienteApp: "homologacao" } })).json).toEqual({ ok: true, ambiente: "homologacao" });
    const par = await tratar({ action: "ponto-parear", body: { codigo: await codigo(tratar), ambienteApp: "homologacao" } });
    expect(par.status).toBe(200);
    const sync = await tratar({ action: "ponto-sincronizar", headers: { authorization: `Bearer ${par.json.token}` }, body: { ambienteApp: "homologacao" } });
    expect(sync).toMatchObject({ status: 200, json: { ambiente: "homologacao", tempo: { confiavel: false } } });
  });
  it.each(["producao", undefined])("não consome código com ambiente incompatível ou ausente (%s)", async ambienteApp => {
    const { db, tratar } = montar({ declarado: "homologacao", marcador: "homologacao" });
    const gerado = await codigo(tratar);
    const response = await tratar({ action: "ponto-parear", body: { codigo: gerado, ambienteApp } });
    expect(response).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL" } });
    expect(db.tabelas.ponto_pareamentos[0].usado_em).toBeFalsy();
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
  });
  it("app de homologação não grava em produção", async () => {
    const { db, tratar } = montar();
    const response = await tratar({ action: "ponto-enviar-marcacoes", body: { ambienteApp: "homologacao", eventos: [{}] } });
    expect(response).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL" } });
    expect(db.tabelas.ponto_marcacoes).toHaveLength(0);
  });
  it("retirada do marcador bloqueia a próxima ação mesmo depois de uma confirmação", async () => {
    const { db, tratar } = montar({ declarado: "homologacao", marcador: "homologacao" });
    expect((await tratar({ action: "ponto-ambiente" })).status).toBe(200);
    db.tabelas.arcd_ambiente = [];
    expect(await tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 503 });
  });
  it("não transforma declaração desconhecida em produção", async () => {
    expect(await montar({ declarado: "piloto" }).tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 503 });
  });
});
