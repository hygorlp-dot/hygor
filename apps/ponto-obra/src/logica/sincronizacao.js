// Sincronização do aparelho com o ARCD - JavaScript puro, testável no Node.
// `api(acao, corpo)` faz o POST em /api/data com o token do aparelho e
// devolve { ok, status, ...json } (nunca lança - ver servicos/conexao.js).
//
// Garantias (testadas em ponta-a-ponta.test.js e armazem-sqlite.test.js):
// - batida só deixa de ser "pendente" quando o servidor confirma um topo de
//   cadeia que bate com o hash LOCAL daquela posição;
// - foto só é apagada do aparelho depois que o servidor confirma o upload;
// - falha de rede deixa batida e foto para a próxima rodada.
import { novaReferencia } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { calcularHashMarcacao, gpsParaMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";
import { LIMITE_FOTO_BYTES, bytesDoBase64 } from "../../../../src/domains/ponto-eletronico/foto.js";

const LOTE = 200;
// GPS mais velho que isto não é mandado (nem na sincronização, nem na batida):
// melhor sem localização do que com uma localização antiga.
export const GPS_IDADE_MAXIMA_MS = 15 * 60_000;

// Último GPS válido e recente, no formato da marcação ({lat, lng, precisao}),
// ou null. gps = { lat, lng, precisao, em } (em = Date.now() da leitura).
export function gpsRecente(gps, agoraMs, idadeMaximaMs = GPS_IDADE_MAXIMA_MS) {
  const valido = gpsParaMarcacao(gps);
  if (!valido) return null;
  const em = Number(gps.em);
  if (!Number.isFinite(em) || agoraMs - em > idadeMaximaMs || em - agoraMs > 60_000) return null;
  return valido;
}

const textoCurto = (v, max = 80) => (v === null || v === undefined ? "" : String(v).slice(0, max));

// Corpo de "ponto-sincronizar": versão do app e identificação do aparelho
// (sem nada pessoal) + último GPS válido. Sem GPS a sincronização segue.
export function montarCorpoSincronizacao({ app = {}, aparelho = {}, gps = null, agoraMs = Date.now() } = {}) {
  const versao = textoCurto(app.versao, 20), build = textoCurto(app.build, 20);
  const corpo = {
    appVersao: versao ? (build ? `${versao} (${build})` : versao) : "",
    aparelho: {
      marca: textoCurto(aparelho.marca), modelo: textoCurto(aparelho.modelo), android: textoCurto(aparelho.android, 20),
      build, commit: textoCurto(app.commit, 12),
    },
  };
  const g = gpsRecente(gps, agoraMs);
  if (g) corpo.gps = g;
  return corpo;
}

// Confere se o topo que o servidor diz ter ({nsr, hash}) é o MESMO que o
// aparelho tem nessa posição. Se não for, o aparelho perdeu estado (banco
// restaurado/recriado) e as pendentes precisam ser renumeradas depois do
// servidor - nunca descartadas, nunca marcadas como enviadas.
async function topoConfere(armazem, servidor) {
  return (await armazem.hashDoNsr(Number(servidor.nsr || 0))) === String(servidor.hash || "").toLowerCase();
}

// Renumera as pendentes depois do topo do servidor. Tudo dentro de UMA
// transação do armazém: uma batida feita no meio do realinhamento entra na
// mesma conta (antes, ficava de fora e era apagada).
export async function alinharCadeia({ armazem, servidor, sha256 }) {
  const base = { nsr: Number(servidor.nsr || 0), hash: String(servidor.hash || "").toLowerCase() };
  const renumeradas = await armazem.realinharPendentes({ base, recalcular: pendentes => reencadear(pendentes, base, sha256) });
  return { renumeradas };
}

// Envia as batidas pendentes em ordem de NSR. Só marca como enviadas as que
// o servidor confirmou E cujo topo confere com o hash local.
export async function enviarPendentes({ armazem, api, sha256 }) {
  let enviadas = 0, realinhou = false;
  for (let rodada = 0; rodada < 50; rodada++) {
    const pendentes = await armazem.marcacoesPendentes(LOTE);
    if (!pendentes.length) return { enviadas, pendentes: 0, erro: null, realinhou };
    const r = await api("ponto-enviar-marcacoes", { marcacoes: pendentes });
    if (!r.ok) return { enviadas, pendentes: pendentes.length, erro: r.error || `HTTP ${r.status}`, semRede: r.status === 0, status: r.status, codigo: r.code || null, realinhou };
    const servidor = { nsr: Number(r.ultimoNsr || 0), hash: r.ultimoHash };
    if (!(await topoConfere(armazem, servidor))) {
      // O servidor tem outra cadeia nessa posição: realinha uma vez e tenta de novo.
      if (realinhou || !sha256) return { enviadas, pendentes: pendentes.length, erro: "a sequência do aparelho não confere com a do servidor", realinhou };
      await alinharCadeia({ armazem, servidor, sha256 });
      realinhou = true;
      continue;
    }
    const antes = enviadas;
    enviadas += await armazem.confirmarEnviadasAte(servidor.nsr);
    // Erro de cadeia com topo conferido = batida adulterada no aparelho:
    // para e mostra, sem repetir o mesmo lote para sempre.
    if (r.erro) return { enviadas, pendentes: pendentes.length, erro: r.erro, nsrComErro: r.nsrComErro ?? null, realinhou };
    if (enviadas === antes) return { enviadas, pendentes: pendentes.length, erro: "o servidor não confirmou nenhuma batida do lote", realinhou };
  }
  return { enviadas, pendentes: (await armazem.marcacoesPendentes(1)).length, erro: null, realinhou };
}

// Fotos só depois da batida aceita (o servidor confere a foto pelo hash que
// já está na batida). Regras:
// - arquivo sumiu do aparelho: marcada "sem arquivo" (aparece no diagnóstico)
//   e a fila segue;
// - foto acima do limite: não é enviada (o servidor recusaria), fica
//   "recusada" com o arquivo preservado;
// - servidor recusou de vez (4xx): "recusada", arquivo preservado;
// - sem rede / servidor fora / erro de leitura: continua pendente.
// O arquivo local só é apagado (aposEnviar) depois do OK do servidor.
export async function enviarFotos({ armazem, api, lerFotoBase64, aposEnviar = async () => {}, limite = 20 }) {
  const fila = await armazem.fotosPendentes(limite);
  let enviadas = 0, falhas = 0, semArquivo = 0, recusadas = 0;
  for (const item of fila) {
    let foto;
    try {
      foto = await lerFotoBase64(item.caminhoFoto);
    } catch {
      falhas++; continue;               // leitura falhou agora: tenta na próxima rodada
    }
    if (!foto) { await armazem.fotoSemArquivo(item.id); semArquivo++; continue; }
    if (bytesDoBase64(foto) > LIMITE_FOTO_BYTES) { await armazem.fotoRecusada(item.id, "acima do limite do servidor"); recusadas++; continue; }
    const r = await api("ponto-enviar-foto", { marcacaoId: item.id, foto });
    if (r.ok) {
      await armazem.fotoEnviada(item.id);
      try { await aposEnviar(item); } catch { /* apagar o arquivo local não pode travar a fila */ }
      enviadas++;
      continue;
    }
    falhas++;
    if (r.status === 0 || r.status >= 500 || r.status === 401 || r.status === 403 || r.status === 408 || r.status === 429) break;
    await armazem.fotoRecusada(item.id, String(r.error || `HTTP ${r.status}`).slice(0, 200));
    recusadas++;
  }
  return { enviadas, falhas, semArquivo, recusadas };
}

// Baixa a base única da obra (funcionários, biometrias, responsáveis,
// terceirizados), acerta a referência de hora e informa versão do app,
// aparelho e GPS. `monotonico()` devolve { ms, bootId } do relógio que não
// muda com ajuste de hora.
export async function sincronizarCadastro({ armazem, api, monotonico, sha256, corpo = {} }) {
  const envio = monotonico();
  const r = await api("ponto-sincronizar", corpo);
  const resposta = monotonico();
  if (!r.ok) return { ok: false, erro: r.error || `HTTP ${r.status}`, codigo: r.code || null, semRede: r.status === 0, status: r.status };
  // Referência só com leitura monotônica válida e sem reboot no meio.
  if (envio.bootId === resposta.bootId && Number.isFinite(envio.ms) && Number.isFinite(resposta.ms)) {
    await armazem.salvarReferenciaHora(novaReferencia({ servidorMs: r.servidorMs, monotonicoEnvioMs: envio.ms, monotonicoRespostaMs: resposta.ms, bootId: resposta.bootId }));
  }
  await armazem.salvarCadastro({
    obra: r.obra, dispositivo: r.dispositivo, funcionarios: r.funcionarios || [], terceirizados: r.terceirizados || [],
    biometrias: r.biometrias || [], responsaveis: r.responsaveis || [], sincronizadoEm: new Date(r.servidorMs).toISOString(),
  });
  // Estado perdido no aparelho (ex.: banco recriado): o topo do servidor não
  // é o que o aparelho tem nessa posição. As batidas AINDA NÃO ENVIADAS são
  // renumeradas depois do último NSR do servidor e reencadeadas - nunca
  // descartadas. É legítimo porque elas nunca saíram do aparelho; hora,
  // pessoa e foto não mudam, só a posição na sequência.
  const servidor = { nsr: Number(r.dispositivo?.ultimoNsr || 0), hash: r.dispositivo?.ultimoHash };
  if (!(await topoConfere(armazem, servidor))) {
    const { renumeradas } = await alinharCadeia({ armazem, servidor, sha256 });
    return { ok: true, cadeiaAlinhada: true, renumeradas };
  }
  return { ok: true, cadeiaAlinhada: false };
}

// Uma rodada completa (o App chama a cada minuto e depois de cada batida):
// cadastro/hora quando pedido ou vencido → batidas → fotos. Nunca lança por
// falha de rede/servidor: devolve o resumo para a tela e o diagnóstico.
// Exceção inesperada (ex.: banco) sobe para quem chamou registrar no estado.
export async function rodadaDeSincronizacao({ armazem, api, sha256, monotonico, corpo, cadastroVencido, lerFotoBase64, aposEnviarFoto }) {
  const resumo = { online: true, cadastroAtualizado: false, revogado: false, desconhecido: false, erro: null, envio: null, fotos: null };
  if (cadastroVencido) {
    const s = await sincronizarCadastro({ armazem, api, monotonico, sha256, corpo });
    if (s.codigo === "APARELHO_REVOGADO") return { ...resumo, online: true, revogado: true, erro: s.erro };
    if (s.codigo === "APARELHO_DESCONHECIDO" || s.codigo === "APARELHO_SEM_TOKEN") return { ...resumo, online: true, desconhecido: true, erro: s.erro };
    if (!s.ok) { resumo.online = !s.semRede; resumo.erro = s.erro; resumo.status = s.status; }
    resumo.cadastroAtualizado = s.ok;
  }
  const envio = await enviarPendentes({ armazem, api, sha256 });
  resumo.envio = envio;
  if (envio.codigo === "APARELHO_REVOGADO") return { ...resumo, revogado: true, erro: envio.erro };
  if (envio.codigo === "APARELHO_DESCONHECIDO") return { ...resumo, desconhecido: true, erro: envio.erro };
  if (envio.semRede) resumo.online = false;
  if (envio.erro && !resumo.erro) { resumo.erro = envio.erro; resumo.status = envio.status; }
  if (resumo.online) resumo.fotos = await enviarFotos({ armazem, api, lerFotoBase64, aposEnviar: aposEnviarFoto });
  return resumo;
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
