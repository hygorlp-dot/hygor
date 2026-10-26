// @vitest-environment node
//
// Matriz de comportamento da hora (fase F). Para cada situação: a batida é
// registrada? sai confiável? o que fica de evidência? o que o diagnóstico
// avisa? Junta as três peças reais: a fonte de hora do servidor
// (fonte-hora.js + ntp.js), a referência do aparelho (relogio.js) e o
// diagnóstico. Evidência ausente/vencida nunca recebe rótulo confiável;
// isso não bloqueia a gravação nem altera eventos anteriores.
import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, avaliarVerificacao, criarFonteHora } from "../../../../server/ponto-eletronico/tempo/fonte-hora.js";
import { verificarHora } from "../../../../server/ponto-eletronico/tempo/ntp.js";
import { estadoDaReferencia, horaDaMarcacao, IDADE_MAXIMA_REFERENCIA_MS, novaReferencia } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { alertaDaHora, montarDiagnostico } from "./diagnostico.js";
import { criarCenario } from "./cenario.test-helper.js";
import { enviarPendentes, sincronizarCadastro } from "./sincronizacao.js";

const AGORA = Date.parse("2026-10-01T10:00:00.000Z");
const HORA = 3_600_000;
const verificacao = (extra = {}) => ({ ok: true, servidor: "a.st1.ntp.br", verificadoEm: new Date(AGORA - HORA).toISOString(), offsetMs: 12, incertezaMs: 8, ...extra });
const EXIGENTE = { ...POLITICA_PADRAO, exigirVerificacao: true };

// Aparelho: referência pega do servidor com a evidência "tempo" dada.
function aparelho(tempo, { decorridoMs = 10 * 60_000, reiniciou = false, paredeDesviaMs = 0 } = {}) {
  const referencia = novaReferencia({ servidorMs: AGORA, monotonicoEnvioMs: 1_000, monotonicoRespostaMs: 1_200, bootId: "b1", tempo });
  const ctx = { referencia, monotonicoMs: 1_200 + decorridoMs, bootId: reiniciou ? "b2" : "b1" };
  const hora = horaDaMarcacao({ ...ctx, relogioParedeMs: AGORA + decorridoMs + paredeDesviaMs });
  return { hora, estado: estadoDaReferencia(ctx), alerta: alertaDaHora({ hora, referencia: estadoDaReferencia(ctx), statusHora: tempo?.status }) };
}
const evidenciaDoServidor = async (v, politica = POLITICA_PADRAO) =>
  criarFonteHora({ relogioHost: () => AGORA, ultimaVerificacao: async () => v, politica }).evidencia();

describe("matriz de comportamento da hora", () => {
  it("sem medição: servidor diz 'nao_verificada', batida sinalizada sem bloquear a captura", async () => {
    const tempo = await evidenciaDoServidor(null);
    expect(tempo).toMatchObject({ status: "nao_verificada", confiavel: false, source: "host", offsetMs: null, lastVerifiedAt: null });
    const { hora, alerta } = aparelho(tempo);
    expect(hora).toMatchObject({ horaConfiavel: false, fonteHora: "host" });
    expect(alerta).toMatchObject({ tom: "atencao", texto: expect.stringContaining("sem medição contra o NTP.br") });
    // Se a política exigir verificação, a mesma situação vira batida sinalizada (não recusada).
    const exigente = await evidenciaDoServidor(null, EXIGENTE);
    expect(exigente.confiavel).toBe(false);
    expect(aparelho(exigente).hora).toMatchObject({ horaConfiavel: false, motivo: expect.stringContaining("sem verificação recente") });
  });

  it("medição válida: evidência com servidor NTP, desvio e incerteza; batida confiável e diagnóstico limpo", async () => {
    const tempo = await evidenciaDoServidor(verificacao());
    expect(tempo).toMatchObject({ status: "verificada", confiavel: true, source: "host+ntp:a.st1.ntp.br", offsetMs: 12, uncertaintyMs: 8 });
    const { hora, alerta, estado } = aparelho(tempo);
    expect(hora).toMatchObject({ horaConfiavel: true, fonteHora: "host+ntp:a.st1.ntp.br", relogioAlterado: false });
    expect(estado.estado).toBe("valida");
    expect(alerta).toMatchObject({ tom: "ok", texto: "Hora válida.", acao: null, batidaConfiavel: true });
    // Relógio do celular mexido não invalida: a batida usa a hora do MARCELL e registra a divergência.
    const mexido = aparelho(tempo, { paredeDesviaMs: 10 * 60_000 });
    expect(mexido.hora).toMatchObject({ horaConfiavel: true, relogioAlterado: true });
    expect(Math.abs(mexido.hora.divergenciaMs - 10 * 60_000)).toBeLessThanOrEqual(100);   // meia latência descontada
    expect(mexido.alerta.texto).toMatch(/relógio do celular está diferente/);
  });

  it("medição vencida: depois de 30 h sem medir, 'verificacao_vencida' - não confiável mesmo na política legada", async () => {
    const velha = verificacao({ verificadoEm: new Date(AGORA - 31 * HORA).toISOString() });
    expect(avaliarVerificacao(velha, AGORA)).toMatchObject({ status: "verificacao_vencida", confiavel: false });
    expect(avaliarVerificacao(velha, AGORA, EXIGENTE)).toMatchObject({ status: "verificacao_vencida", confiavel: false });
    const tempo = await evidenciaDoServidor(velha);
    expect(aparelho(tempo).alerta).toMatchObject({ tom: "atencao", texto: expect.stringContaining("medição vencida") });
    // Medição "do futuro" (relógio do host voltou) também não vale.
    expect(avaliarVerificacao(verificacao({ verificadoEm: new Date(AGORA + HORA).toISOString() }), AGORA).status).toBe("verificacao_vencida");
  });

  it("fora da tolerância: desvio + incerteza acima de 30 s - nunca confiável, em qualquer política; batida registrada e sinalizada", async () => {
    const fora = verificacao({ offsetMs: 25_000, incertezaMs: 6_000 });
    expect(avaliarVerificacao(fora, AGORA)).toMatchObject({ status: "fora_da_tolerancia", confiavel: false });
    expect(avaliarVerificacao(verificacao({ offsetMs: 2_000 }), AGORA).status).toBe("dentro_da_tolerancia");
    const tempo = await evidenciaDoServidor(fora);
    const { hora, alerta } = aparelho(tempo);
    expect(hora).toMatchObject({ horaConfiavel: false, marcadoEmMs: expect.any(Number) });
    expect(alerta).toMatchObject({ tom: "erro", acao: "Avise o suporte do MARCELL.", batidaConfiavel: false });
    const diag = montarDiagnostico({ hora, referencia: aparelho(tempo).estado, fiscal: { fonteHora: tempo.source, statusHora: tempo.status } });
    expect(diag.find(i => i.rotulo === "Fonte de hora do servidor").valor).toMatch(/FORA da tolerância/);
  });

  it("offline: a referência vale 7 dias pelo relógio monotônico; reinício ou vencimento sinalizam sem impedir a batida", async () => {
    const tempo = await evidenciaDoServidor(verificacao());
    expect(aparelho(tempo, { decorridoMs: 3 * 24 * HORA }).hora).toMatchObject({ horaConfiavel: true, idadeReferenciaMs: 3 * 24 * HORA });
    expect(aparelho(tempo, { decorridoMs: 6 * 24 * HORA }).alerta).toMatchObject({ tom: "atencao", texto: expect.stringContaining("vence em breve") });
    const vencida = aparelho(tempo, { decorridoMs: IDADE_MAXIMA_REFERENCIA_MS + HORA });
    expect(vencida.hora).toMatchObject({ horaConfiavel: false, motivo: expect.stringContaining("7 dias") });
    expect(vencida.alerta.tom).toBe("erro");
    const reboot = aparelho(tempo, { reiniciou: true });
    expect(reboot.hora).toMatchObject({ horaConfiavel: false, fonteHora: "relogio-do-aparelho" });
    expect(reboot.alerta).toMatchObject({ tom: "atencao", texto: expect.stringContaining("reiniciou") });

    // Sem medição HLB no cenário: sincroniza, perde rede e grava sinalizado; NSR vem ao reenviar.
    const { s, a } = await criarCenario();
    await sincronizarCadastro({ armazem: a.armazem, api: a.api, monotonico: a.monotonico });
    a.online = false;
    a.passar(2 * 24 * HORA);
    const b = await a.bater();
    expect(b).toMatchObject({ horaConfiavel: false, idadeReferenciaMs: expect.any(Number) });
    expect(b.idadeReferenciaMs).toBeGreaterThanOrEqual(2 * 24 * HORA);
    a.online = true;
    expect(await enviarPendentes({ armazem: a.armazem, api: a.api })).toMatchObject({ enviadas: 1, erro: null });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => f.event_id)).toEqual([b.eventId]);
  }, 60000);

  it("NTP indisponível: todos os servidores falham → medição 'ok: false' registrada com o erro; a fonte cai para 'nao_verificada'", async () => {
    const v = await verificarHora({ enviarUdp: async () => { throw new Error("UDP bloqueado"); }, relogio: () => AGORA });
    expect(v).toMatchObject({ ok: false, erro: expect.stringContaining("UDP bloqueado") });
    expect(v.erro.split("; ")).toHaveLength(4);                               // os 4 servidores stratum 1 tentados
    expect(avaliarVerificacao(v, AGORA)).toMatchObject({ status: "nao_verificada", confiavel: false });
    // Falha ao LER a última medição (banco fora) também não derruba a hora.
    const fonte = criarFonteHora({ relogioHost: () => AGORA, ultimaVerificacao: async () => { throw new Error("banco fora"); } });
    expect(await fonte.evidencia()).toMatchObject({ serverTimeMs: AGORA, status: "nao_verificada", source: "host" });
    expect(POLITICA_PADRAO.exigirVerificacao).toBe(true);                     // evidência ausente nunca é confiável
  });
});
