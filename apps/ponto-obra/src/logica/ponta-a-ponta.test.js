// @vitest-environment node
//
// Aparelho e servidor juntos: as batidas são montadas pela lógica real do
// app (terminal.js) e enviadas pela sincronização real (sincronizacao.js)
// ao tratador real do servidor (server/ponto-eletronico/handler.js), sobre
// um banco em memória. Se o formato ou o encadeamento divergir entre os dois
// lados, este teste quebra.
import { createHash, pbkdf2Sync, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { criarTratadorPonto } from "../../../../server/ponto-eletronico/handler.js";
import { bancoFalso } from "../../../../server/ponto-eletronico/banco-falso.test-helper.js";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { registrarBatida } from "./terminal.js";
import { enviarFotos, enviarPendentes, reencadear, sincronizarCadastro } from "./sincronizacao.js";
import { proximaEsperaPin, verificarPinResponsavel } from "./pin.js";

const sha256 = v => createHash("sha256").update(v).digest("hex");
const pbkdf2Hex = (pin, salt, it) => pbkdf2Sync(pin, salt, it, 32, "sha256").toString("hex");
const DADOS = {
  obras: [{ id: "obra-a", name: "Residencial Alameda" }],
  usuarios: [{ id: "u-admin", role: "admin", nome: "Admin", active: true }, { id: "u-enc", role: "user", nome: "Encarregado", active: true }],
  employees: [{ id: "e1", name: "Zé Pedreiro", cpf: "123.456.789-09", obra: "obra-a", active: true }],
  terceirizados: [{ id: "t1", name: "Elétrica X", obraId: "obra-a" }],
};
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);

let db, tratar, armazem, api, relogioServidor, monotonicoMs, bootId, dispositivoId;
const monotonico = () => ({ ms: monotonicoMs, bootId });
const relogio = () => ({
  agora: () => {
    const parede = relogioServidor + 60_000; // celular 1 min adiantado
    return { ...horaDaMarcacao({ referencia: armazem._ref, monotonicoMs, bootId, relogioParedeMs: parede }), relogioParedeMs: parede };
  },
});

beforeEach(async () => {
  db = bancoFalso();
  relogioServidor = Date.parse("2026-10-01T10:00:00.000Z");
  monotonicoMs = 5_000_000; bootId = "boot-1";
  tratar = criarTratadorPonto({ db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date(relogioServidor),
    autenticarUsuario: async b => (b.accessToken === "admin" ? DADOS.usuarios[0] : null) });
  const { json: { codigo } } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "admin", obraId: "obra-a", nome: "Portaria" } });
  const par = await tratar({ action: "ponto-parear", body: { codigo } });
  dispositivoId = par.json.dispositivoId;
  let online = true;
  api = async (action, corpo) => {
    if (!online) return { ok: false, status: 0, error: "sem rede" };
    const r = await tratar({ action, body: corpo, headers: { authorization: `Bearer ${par.json.token}` } });
    return { ok: r.status === 200, status: r.status, ...r.json };
  };
  api.desligar = () => { online = false; };
  api.ligar = () => { online = true; };
  armazem = criarArmazemMemoria();
  const salvar = armazem.salvarReferenciaHora;
  armazem.salvarReferenciaHora = async r => { armazem._ref = r; return salvar(r); };
  await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "admin", userId: "u-enc", pin: "2468", obras: ["obra-a"] } });
});

const bater = (extra = {}) => registrarBatida({
  armazem, relogio: relogio(), sha256, gerarId: randomUUID, dispositivoId,
  pessoa: { tipo: "funcionario", id: "e1", cpf: "12345678909" }, identificacao: { metodo: "facial", confianca: 0.88 },
  gps: { lat: -8.28, lng: -35.97, precisao: 10 }, ...extra,
});

describe("aparelho + servidor, ponta a ponta", () => {
  it("sincroniza a base única, bate offline com a hora do servidor e envia tudo quando a rede volta", async () => {
    const s = await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    expect(s.ok).toBe(true);
    expect((await armazem.cadastro()).funcionarios.map(f => f.id)).toEqual(["e1"]);

    api.desligar();
    monotonicoMs += 2 * 3_600_000; relogioServidor += 2 * 3_600_000;  // 2 h depois, sem internet
    const b1 = await bater();
    monotonicoMs += 4 * 3_600_000; relogioServidor += 4 * 3_600_000;
    const b2 = await bater();
    expect(b1.marcadoEm).toBe("2026-10-01T12:00:00.000Z");  // hora do servidor, não a do celular adiantado
    expect(b1.horaConfiavel).toBe(true);
    expect((await enviarPendentes({ armazem, api })).semRede).toBe(true);

    api.ligar();
    const r = await enviarPendentes({ armazem, api });
    expect(r).toMatchObject({ enviadas: 2, erro: null });
    expect(db.tabelas.ponto_marcacoes.map(m => [m.nsr, m.employee_id, m.obra_id])).toEqual([[1, "e1", "obra-a"], [2, "e1", "obra-a"]]);
    expect(db.tabelas.ponto_dispositivos[0].ultimo_hash).toBe(b2.hash);
    expect(await armazem.marcacoesPendentes(10)).toEqual([]);
  });

  it("foto vai depois da batida aceita e precisa ser a mesma registrada", async () => {
    await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    const b = await bater({ fotoSha256: sha256(JPEG) });
    await armazem.anexarCaminhoFoto(b.id, "file://foto.jpg");
    expect((await enviarFotos({ armazem, api, lerFotoBase64: async () => JPEG.toString("base64") })).enviadas).toBe(0); // batida ainda não enviada
    await enviarPendentes({ armazem, api });
    expect(await enviarFotos({ armazem, api, lerFotoBase64: async () => JPEG.toString("base64") })).toEqual({ enviadas: 1, falhas: 0 });
    expect([...db.arquivos.keys()]).toEqual([`marcacoes/obra-a/2026-10-01/${b.id}.jpg`]);
  });

  it("aparelho reiniciado sem sincronizar: bate com o relógio do celular e sinaliza", async () => {
    await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    bootId = "boot-2"; monotonicoMs = 1_000;
    const b = await bater();
    expect(b.horaConfiavel).toBe(false);
    expect((await enviarPendentes({ armazem, api })).erro).toBeNull();
    expect(db.tabelas.ponto_marcacoes[0].hora_confiavel).toBe(false);
  });

  it("acesso de terceirizado entra separado do ponto CLT", async () => {
    await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    await registrarBatida({ armazem, relogio: relogio(), sha256, gerarId: randomUUID, dispositivoId,
      pessoa: { tipo: "terceiro", id: "t1" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    await enviarPendentes({ armazem, api });
    expect(db.tabelas.ponto_marcacoes[0]).toMatchObject({ tipo_registro: "acesso_terceiro", terceiro_id: "t1", employee_id: null });
  });

  it("estado do aparelho perdido: batidas não enviadas são renumeradas depois do servidor, nunca descartadas", async () => {
    await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    await bater(); await bater();
    await enviarPendentes({ armazem, api });          // servidor em NSR 2
    armazem = criarArmazemMemoria();                  // aparelho "perdeu" o banco local
    armazem.salvarReferenciaHora = async r => { armazem._ref = r; };
    const perdida = await bater();                    // NSR 1 de novo, localmente
    expect(perdida.nsr).toBe(1);
    const s = await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    expect(s).toMatchObject({ cadeiaAlinhada: true, renumeradas: 1 });
    expect((await enviarPendentes({ armazem, api })).erro).toBeNull();
    expect(db.tabelas.ponto_marcacoes.map(m => m.nsr)).toEqual([1, 2, 3]);
    expect(db.tabelas.ponto_marcacoes[2].id).toBe(perdida.id);
  });

  it("reencadear mantém hora e pessoa, só muda posição e hashes", async () => {
    const [n] = await reencadear([{ id: "x", nsr: 1, marcadoEm: "2026-10-01T10:00:00.000Z", employeeId: "e1", hashAnterior: "0".repeat(64), hash: "a".repeat(64) }], { nsr: 7, hash: "b".repeat(64) }, sha256);
    expect(n).toMatchObject({ id: "x", nsr: 8, hashAnterior: "b".repeat(64), marcadoEm: "2026-10-01T10:00:00.000Z", employeeId: "e1" });
    expect(n.hash).not.toBe("a".repeat(64));
  });

  it("PIN do encarregado confere offline contra o hash que veio do servidor", async () => {
    await sincronizarCadastro({ armazem, api, monotonico, sha256 });
    const { responsaveis } = await armazem.cadastro();
    expect(verificarPinResponsavel("2468", responsaveis, pbkdf2Hex)).toEqual({ userId: "u-enc", nome: "Encarregado" });
    expect(verificarPinResponsavel("1111", responsaveis, pbkdf2Hex)).toBeNull();
    expect(proximaEsperaPin(4)).toBe(0);
    expect(proximaEsperaPin(6)).toBe(60_000);
  });
});
