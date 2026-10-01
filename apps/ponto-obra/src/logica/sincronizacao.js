// Sincronização do aparelho com o ARCD - JavaScript puro, testável no Node.
// `api(acao, corpo)` faz o POST em /api/data com o token do aparelho e
// devolve { ok, status, ...json }.
import { novaReferencia } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { calcularHashMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";

const LOTE = 200;

// Envia as batidas pendentes em ordem de NSR. Só marca como enviadas as que
// o servidor confirmou (ultimoNsr devolvido) - se a internet cair no meio,
// o resto continua pendente e sai na próxima rodada.
export async function enviarPendentes({ armazem, api }) {
  let enviadas = 0;
  for (let rodada = 0; rodada < 50; rodada++) {
    const pendentes = await armazem.marcacoesPendentes(LOTE);
    if (!pendentes.length) return { enviadas, pendentes: 0, erro: null };
    const r = await api("ponto-enviar-marcacoes", { marcacoes: pendentes });
    if (!r.ok) return { enviadas, pendentes: pendentes.length, erro: r.error || `HTTP ${r.status}`, semRede: r.status === 0, codigo: r.code || null };
    const antes = enviadas;
    enviadas += await armazem.confirmarEnviadasAte(Number(r.ultimoNsr || 0));
    // Erro de cadeia não deveria acontecer (o aparelho monta a cadeia): para
    // e devolve para a tela, sem ficar repetindo o mesmo lote.
    if (r.erro) return { enviadas, pendentes: pendentes.length, erro: r.erro, nsrComErro: r.nsrComErro ?? null };
    if (enviadas === antes) return { enviadas, pendentes: pendentes.length, erro: "o servidor não confirmou nenhuma batida do lote" };
  }
  return { enviadas, pendentes: (await armazem.marcacoesPendentes(1)).length, erro: null };
}

// Fotos só depois da batida aceita (o servidor confere a foto pelo hash que
// já está na batida). Foto que falha fica para a próxima rodada.
export async function enviarFotos({ armazem, api, lerFotoBase64, aposEnviar = () => {}, limite = 20 }) {
  const fila = await armazem.fotosPendentes(limite);
  let enviadas = 0, falhas = 0;
  for (const item of fila) {
    const foto = await lerFotoBase64(item.caminhoFoto);
    if (!foto) { await armazem.fotoEnviada(item.id); continue; } // arquivo sumiu: não trava a fila
    const r = await api("ponto-enviar-foto", { marcacaoId: item.id, foto });
    if (r.ok) { await armazem.fotoEnviada(item.id); await aposEnviar(item); enviadas++; } else { falhas++; if (r.status === 0) break; }
  }
  return { enviadas, falhas };
}

// Baixa a base única da obra (funcionários, biometrias, responsáveis,
// terceirizados) e acerta a referência de hora. `monotonico()` devolve
// { ms, bootId } do relógio que não muda com ajuste de hora.
export async function sincronizarCadastro({ armazem, api, monotonico, sha256 }) {
  const envio = monotonico();
  const r = await api("ponto-sincronizar", {});
  const resposta = monotonico();
  if (!r.ok) return { ok: false, erro: r.error || `HTTP ${r.status}`, codigo: r.code || null, semRede: r.status === 0 };
  if (envio.bootId === resposta.bootId) {
    await armazem.salvarReferenciaHora(novaReferencia({ servidorMs: r.servidorMs, monotonicoEnvioMs: envio.ms, monotonicoRespostaMs: resposta.ms, bootId: resposta.bootId }));
  }
  await armazem.salvarCadastro({
    obra: r.obra, dispositivo: r.dispositivo, funcionarios: r.funcionarios || [], terceirizados: r.terceirizados || [],
    biometrias: r.biometrias || [], responsaveis: r.responsaveis || [], sincronizadoEm: new Date(r.servidorMs).toISOString(),
  });
  // Estado perdido no aparelho (ex.: dados restaurados de um backup antigo):
  // o servidor já tem NSR maior que o local. As batidas AINDA NÃO ENVIADAS
  // são renumeradas depois do último NSR do servidor e reencadeadas - nunca
  // descartadas. É legítimo porque elas nunca saíram do aparelho; hora,
  // pessoa e foto não mudam, só a posição na sequência.
  const local = await armazem.ultimaMarcacaoGlobal();
  const servidorNsr = Number(r.dispositivo?.ultimoNsr || 0);
  if (servidorNsr > Number(local.nsr || 0)) {
    const novas = await reencadear(await armazem.marcacoesPendentes(Number.MAX_SAFE_INTEGER), { nsr: servidorNsr, hash: r.dispositivo.ultimoHash }, sha256);
    await armazem.reencadearPendentes({ base: { nsr: servidorNsr, hash: r.dispositivo.ultimoHash }, marcacoes: novas });
    return { ok: true, cadeiaAlinhada: true, renumeradas: novas.length };
  }
  return { ok: true, cadeiaAlinhada: false };
}

export async function reencadear(pendentes, base, sha256) {
  const novas = [];
  let anterior = base;
  for (const m of [...pendentes].sort((a, b) => a.nsr - b.nsr)) {
    const n = { ...m, nsr: anterior.nsr + 1, hashAnterior: anterior.hash };
    n.hash = await calcularHashMarcacao(n, sha256);
    novas.push(n);
    anterior = { nsr: n.nsr, hash: n.hash };
  }
  return novas;
}
