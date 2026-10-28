// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarCenario, criarAparelho } from "./cenario.test-helper";
import { sincronizarCadastro, enviarPendentes } from "./sincronizacao";
import { criarTratadorPonto } from "../../../../server/ponto-eletronico/handler";
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
let s;
afterEach(async () => { await s?.pg.close(); });
const sync = a => sincronizarCadastro({ armazem: a.armazem, api: a.api, monotonico: a.monotonico });
const enviar = a => enviarPendentes({ armazem: a.armazem, api: a.api });
const painel = async () => (await s.admin("ponto-equipe-obras")).json;
describe("app → ARP/Postgres → Equipe nas Obras", () => {
  it("aceita o formato do APK atual sem tipos de evento e preserva a batida sincronizada", async () => {
    const c = await criarCenario(); s = c.s; const a = c.a;
    await sync(a); a.passar(60000);
    const evento = await a.bater();
    expect(evento.tipoEvento).toBeUndefined();
    expect(evento.versaoJornada).toBeUndefined();
    expect((await enviar(a)).enviadas).toBe(1);
    const pessoa = (await painel()).pessoas.find(p => p.id === "e1");
    expect(pessoa.situacao).toBe("conferir");
    expect(pessoa.eventos).toEqual(expect.arrayContaining([expect.objectContaining({ eventId: evento.eventId, obraId: "obra-a" })]));
    expect((await s.eventos()).find(m => m.event_id === evento.eventId).payload.localHash).toBe(evento.localHash);
  });
  it("reutiliza foto de cadastro com URL temporária sem expor biometria e lê falta confirmada", async () => {
    const c = await criarCenario(); s = c.s;
    s.dados.attendance = { e2: { "2026-10-01": { status: "F" } } };
    s.db.arquivos.set("cadastro/e1/foto.jpg", new Uint8Array([255, 216]));
    const r = await s.db.from("ponto_biometrias").insert({ company_id: "arcd", employee_id: "e1", modelo: "teste", vetor: Array(64).fill(0), fotos: [{ caminho: "cadastro/e1/foto.jpg" }], consentimento: { termoVersao: "teste", aceitoEm: "2026-10-01" }, cadastrado_por: "u-enc" });
    expect(r.error).toBeNull();
    const resultado = await painel();
    expect(resultado.pessoas.find(p => p.id === "e1").fotoUrl).toBe("https://assinado/cadastro/e1/foto.jpg");
    expect(resultado.pessoas.find(p => p.id === "e2").situacao).toBe("falta");
    expect(JSON.stringify(resultado)).not.toContain('"vetor"');
  });
});
