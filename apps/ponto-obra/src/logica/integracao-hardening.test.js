// @vitest-environment node
//
// REGRESSÃO CONJUNTA do hardening: #74 (PIN do responsável conferido no
// servidor), #76 (limites de tentativas no banco + trava persistente do PIN
// + segredos apagados na revogação) e #75 (métricas de fila/desempenho),
// sobre o servidor real do ponto (tratador + Postgres via PGlite) e a lógica
// real do app. Prova que as três convivem sem perder: PIN só em memória,
// validação no servidor, limites, trava persistente, métricas, fila de
// sincronização, ARP/NSR e operação offline.
//
// As RPCs do limite (auth_rate_limit_*) são instaladas no banco do teste: sem
// elas o limitador falha ABERTO (documentado em limite-pareamento.pg.test.js)
// e esta regressão não provaria bloqueio nenhum.
import { describe, expect, it, vi } from "vitest";
import { criarAparelho, criarServidor, JPEG } from "./cenario.test-helper.js";
import { abrirSessaoResponsavel, corpoCadastroBiometria } from "./pin.js";
import { CHAVE_TRAVA_PIN, criarTravaPin } from "./trava-pin.js";
import { CHAVE_DESEMPENHO, registrarTentativa, p95DoReconhecimento } from "./desempenho.js";
import { metricasDaFila, montarCorpoSincronizacao, rodadaDeSincronizacao } from "./sincronizacao.js";
import { lerMigration } from "../../../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { LIMITE_PAREAMENTO, LIMITE_PIN_RESPONSAVEL } from "../../../../server/ponto-eletronico/limite-pareamento.js";

vi.setConfig({ testTimeout: 90000, hookTimeout: 90000 });

const PIN = "2468";   // o do cenário (sintético)
const CAMPOS = { employeeId: "e1", modelo: "mobilefacenet-v1", vetor: Array.from({ length: 128 }, (_, i) => i / 128),
  fotos: [JPEG.toString("base64")], consentimento: { termoVersao: "2026-10", aceitoEm: "2026-10-01T09:59:00.000Z" } };

async function servidorComLimites() {
  const s = await criarServidor({ exigirPinNoServidor: true });
  await s.pg.exec(lerMigration("20260726_auth_rate_limit.sql"));
  await s.pg.exec(lerMigration("20260727_auth_rate_limit_success.sql"));
  return s;
}
const rodada = (a, extra = {}) => rodadaDeSincronizacao({
  armazem: a.armazem, api: a.api, monotonico: a.monotonico, cadastroVencido: true,
  lerFotoBase64: async () => null, aposEnviarFoto: async () => {}, ...extra,
});
const cadastrarRosto = (a, sessao, extra = {}) => a.api("ponto-cadastrar-biometria", corpoCadastroBiometria(sessao, { ...CAMPOS, ...extra }));
const filaNoArcd = async (s, dispositivoId) => (await s.admin("ponto-dispositivos")).json.dispositivos.find(d => d.id === dispositivoId)?.fila;

describe("hardening integrado (#74 + #75 + #76)", () => {
  it("batida offline → envio com métricas → cadastro facial com PIN no servidor; limites e métricas não interferem na fila nem no NSR", async () => {
    const s = await servidorComLimites();
    const a = await criarAparelho(s);
    expect(a.par.status).toBe(200);
    await rodada(a, { corpo: montarCorpoSincronizacao({ app: { versao: "1.0.0", build: "9", ambiente: "producao" } }) });

    // Offline: batidas ficam na fila local; desempenho anotado no estado local.
    a.online = false;
    const b1 = await a.bater(), b2 = await a.bater();
    await a.armazem.gravarEstado(CHAVE_DESEMPENHO, registrarTentativa(null, { tempos: { reconhecimento: 900, total: 1500 } }));
    const fila = metricasDaFila({ contagem: await a.armazem.contagem(), pendenteMaisAntiga: (await a.armazem.eventosPendentes(1))[0],
      reconhecimentoP95Ms: p95DoReconhecimento(await a.armazem.lerEstado(CHAVE_DESEMPENHO)), agoraMs: s.relogioServidor + 20 * 60_000 });
    expect(fila).toMatchObject({ batidasPendentes: 2 });

    // Volta a rede: a rodada leva as métricas (só números) e a ARP dá os NSR.
    a.online = true;
    const r = await rodada(a, { corpo: montarCorpoSincronizacao({ app: { versao: "1.0.0" }, metricas: fila }) });
    expect(r).toMatchObject({ revogado: false, erro: null });
    expect(r.envio).toMatchObject({ enviadas: 2 });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => f.event_id)).toEqual([b1.eventId, b2.eventId]);
    const noArcd = await filaNoArcd(s, a.dispositivoId);
    expect(noArcd).toMatchObject({ batidasPendentes: 2, reconhecimentoP95Ms: 900 });
    expect(JSON.stringify(noArcd)).not.toMatch(/e1|Zé|12345678909/);

    // PIN só em memória → conferido no servidor → cadastro aceito.
    const sessao = abrirSessaoResponsavel({ userId: "u-enc", nome: "Encarregado" }, PIN);
    expect(JSON.stringify(sessao)).not.toContain(PIN);
    expect((await cadastrarRosto(a, sessao)).status).toBe(200);
    // Sessão descartada: sem PIN no corpo, o servidor recusa.
    sessao.descartar();
    expect((await cadastrarRosto(a, sessao)).code).toBe("PIN_RESPONSAVEL_AUSENTE");
    expect(JSON.stringify(await s.sql("select * from public.ponto_biometrias"))).not.toContain(PIN);
  });

  it("ataque ao PIN pelo token do aparelho: bloqueado no servidor sem travar as batidas; outro aparelho segue; a trava local persiste ao lado das métricas", async () => {
    const s = await servidorComLimites();
    const a = await criarAparelho(s), b = await criarAparelho(s, { nome: "Portaria 2" });
    for (let i = 0; i < LIMITE_PIN_RESPONSAVEL.falhas; i++) {
      expect((await cadastrarRosto(a, abrirSessaoResponsavel({ userId: "u-enc" }, `13579${i}`))).code).toBe("PIN_RESPONSAVEL_INVALIDO");
    }
    const bloqueado = await cadastrarRosto(a, abrirSessaoResponsavel({ userId: "u-enc" }, PIN));
    expect(bloqueado).toMatchObject({ status: 429, code: "PIN_RESPONSAVEL_BLOQUEADO" });
    expect(await s.sql("select * from public.ponto_biometrias")).toEqual([]);
    // As batidas do aparelho atacado continuam sendo aceitas (o limite é só do cadastro facial).
    const batida = await a.bater();
    expect((await rodada(a, { cadastroVencido: false })).envio).toMatchObject({ enviadas: 1 });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => f.event_id)).toContain(batida.eventId);
    // Outro aparelho não herda o bloqueio.
    expect((await cadastrarRosto(b, abrirSessaoResponsavel({ userId: "u-enc" }, PIN))).status).toBe(200);

    // Trava local do PIN e estatísticas de desempenho moram no mesmo banco local, em chaves distintas.
    await a.armazem.gravarEstado(CHAVE_DESEMPENHO, registrarTentativa(null, { tempos: { total: 1200 } }));
    const trava = criarTravaPin({ armazem: a.armazem, agora: () => s.relogioServidor });
    for (let i = 0; i < 5; i++) await trava.falhou();
    const reiniciado = criarTravaPin({ armazem: a.armazem, agora: () => s.relogioServidor });
    expect((await reiniciado.situacao()).bloqueado).toBe(true);
    expect(await a.armazem.lerEstado(CHAVE_TRAVA_PIN)).toMatchObject({ erros: 5 });
    expect(p95DoReconhecimento(await a.armazem.lerEstado(CHAVE_DESEMPENHO))).toBeNull();          // sem amostra de reconhecimento
    expect(await a.armazem.lerEstado(CHAVE_DESEMPENHO)).toBeTruthy();
  });

  it("pareamento: rajada de códigos de uma origem e de muitas origens não passa dos limites; aparelhos pareados seguem operando", async () => {
    const s = await servidorComLimites();
    const a = await criarAparelho(s);
    const errado = (ip, i) => s.tratar({ action: "ponto-parear", body: { codigo: String(10000000 + i) }, headers: { "x-forwarded-for": ip } });
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => errado("203.0.113.7", i)));
    expect(rs.filter(r => r.status === 400)).toHaveLength(LIMITE_PAREAMENTO.porOrigem.falhas);
    const espalhadas = await Promise.all(Array.from({ length: 60 }, (_, i) => errado(`198.51.100.${i}`, 100 + i)));
    expect(espalhadas.filter(r => r.status === 429).length).toBeGreaterThan(0);
    // Teto global atingido: um código CERTO de outra origem espera (negação de serviço do pareamento - documentada).
    const { json: { codigo } } = await s.admin("ponto-codigo-pareamento", { obraId: "obra-a", nome: "Nova" });
    expect((await s.tratar({ action: "ponto-parear", body: { codigo }, headers: { "x-forwarded-for": "192.0.2.50" } })).json.code).toBe("PAREAMENTO_BLOQUEADO");
    // ...mas o aparelho já pareado continua batendo e enviando.
    const batida = await a.bater();
    expect((await rodada(a)).envio).toMatchObject({ enviadas: 1 });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => f.event_id)).toContain(batida.eventId);
  });

  it("revogação: segredos (hashes de PIN, vetores) saem do aparelho; batidas pendentes e métricas locais ficam", async () => {
    const s = await servidorComLimites();
    const a = await criarAparelho(s);
    await rodada(a);
    expect((await a.armazem.cadastro()).responsaveis.length).toBeGreaterThan(0);
    a.online = false;
    const pendente = await a.bater();
    await a.armazem.gravarEstado(CHAVE_DESEMPENHO, registrarTentativa(null, { tempos: { reconhecimento: 700 } }));
    a.online = true;
    await s.admin("ponto-dispositivo-revogar", { dispositivoId: a.dispositivoId });
    const r = await rodada(a);
    expect(r).toMatchObject({ revogado: true, segredosApagados: true });
    expect(await a.armazem.cadastro()).toMatchObject({ responsaveis: [], biometrias: [] });
    expect((await a.armazem.eventosPendentes(5)).map(e => e.eventId)).toEqual([pendente.eventId]);
    expect(p95DoReconhecimento(await a.armazem.lerEstado(CHAVE_DESEMPENHO))).toBe(700);
  });
});
