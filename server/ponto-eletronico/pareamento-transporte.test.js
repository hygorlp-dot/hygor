// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { criarTransporte } from "../../apps/ponto-obra/src/servicos/transporte.js";
import { classificarResposta } from "../../apps/ponto-obra/src/logica/falhas.js";
import { criarTratadorPonto } from "./handler.js";
import { bancoFalso } from "./banco-falso.test-helper.js";

// O adaptador HTTP usa as respostas do handler real; não injeta mensagens
// prontas no transporte. O banco e o relógio são isolados em memória.
let db, tratar, api, agoraMs;
beforeEach(() => {
  db = bancoFalso();
  db.tabelas.arcd_ambiente = [{ id: true, ambiente: "homologacao" }];
  agoraMs = Date.parse("2026-10-26T12:00:00.000Z");
  tratar = criarTratadorPonto({
    db, company: "arcd", ambienteDeclarado: "homologacao", supabaseUrl: "https://isoladoteste.supabase.co",
    agora: () => new Date(agoraMs),
    lerDados: async () => ({ obras: [{ id: "obra-teste", name: "Obra de teste" }], employees: [] }),
    autenticarUsuario: async body => body.accessToken === "sessao-teste" ? { id: "admin-teste", role: "admin" } : null,
  });
  api = criarTransporte({
    url: "https://ponto-homologacao.example/api/data", ambiente: "homologacao",
    fetchImpl: async (_url, { body, headers }) => {
      const pedido = JSON.parse(body);
      const resposta = await tratar({ action: pedido.action, body: pedido, headers });
      return { ok: resposta.status >= 200 && resposta.status < 300, status: resposta.status, json: async () => resposta.json };
    },
  });
});

async function gerarCodigo() {
  const resposta = await tratar({
    action: "ponto-codigo-pareamento",
    body: { accessToken: "sessao-teste", obraId: "obra-teste", nome: "Portaria de teste" },
  });
  expect(resposta.status).toBe(200);
  return resposta.json.codigo;
}

describe("mensagens reais de pareamento no transporte do aplicativo", () => {
  it("orienta gerar outro código no MARCELL quando o código não existe, sem criar vínculo", async () => {
    const resposta = await api("ponto-parear", { codigo: "00000000" });
    expect(resposta).toMatchObject({ ok: false, status: 400, code: "CODIGO_INVALIDO" });
    expect(classificarResposta(resposta)).toEqual({
      tipo: "recusado", mensagem: "Código inválido ou já usado. Gere outro no MARCELL.",
    });
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
    expect(db.tabelas.ponto_pareamentos).toHaveLength(0);
  });

  it("informa expiração no MARCELL e preserva o código sem consumo", async () => {
    const codigo = await gerarCodigo();
    agoraMs += 31 * 60 * 1000;
    const resposta = await api("ponto-parear", { codigo });
    expect(resposta).toMatchObject({ ok: false, status: 400, code: "CODIGO_EXPIRADO" });
    expect(classificarResposta(resposta)).toEqual({
      tipo: "recusado", mensagem: "Código expirado. Gere outro no MARCELL.",
    });
    expect(db.tabelas.ponto_dispositivos).toHaveLength(0);
    expect(db.tabelas.ponto_pareamentos[0].usado_em).toBeFalsy();
    expect(db.tabelas.ponto_pareamentos[0].dispositivo_id).toBeFalsy();
  });

  it("recusa reutilização com a orientação MARCELL sem alterar o vínculo criado", async () => {
    const codigo = await gerarCodigo();
    const primeiro = await api("ponto-parear", { codigo });
    expect(primeiro).toMatchObject({ ok: true, status: 200, ambiente: "homologacao", obra: { id: "obra-teste" } });
    const vinculo = structuredClone(db.tabelas.ponto_dispositivos);
    const pareamento = structuredClone(db.tabelas.ponto_pareamentos);
    const resposta = await api("ponto-parear", { codigo });
    expect(resposta).toMatchObject({ ok: false, status: 400, code: "CODIGO_INVALIDO" });
    expect(classificarResposta(resposta)).toEqual({
      tipo: "recusado", mensagem: "Código inválido ou já usado. Gere outro no MARCELL.",
    });
    expect(db.tabelas.ponto_dispositivos).toEqual(vinculo);
    expect(db.tabelas.ponto_pareamentos).toEqual(pareamento);
  });

  it("duas tentativas simultâneas criam um vínculo e entregam a recusa MARCELL à outra", async () => {
    const codigo = await gerarCodigo();
    const respostas = await Promise.all([api("ponto-parear", { codigo }), api("ponto-parear", { codigo })]);
    expect(respostas.filter(r => r.ok)).toHaveLength(1);
    const recusadas = respostas.filter(r => !r.ok);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0]).toMatchObject({ status: 400, code: "CODIGO_INVALIDO" });
    expect(classificarResposta(recusadas[0])).toEqual({
      tipo: "recusado", mensagem: "Código inválido ou já usado. Gere outro no MARCELL.",
    });
    expect(db.tabelas.ponto_dispositivos).toHaveLength(1);
    expect(db.tabelas.ponto_pareamentos[0].dispositivo_id).toBe(db.tabelas.ponto_dispositivos[0].id);
  });
});
