// Armazém em memória com a MESMA interface do armazém SQLite do app
// (src/dados/armazem-sqlite-nucleo.js). Usado nos testes e como referência do
// contrato.
//
// Evento local NUNCA é alterado nem apagado nem renumerado. A sincronização
// só acrescenta, ao lado dele, o que a ARP devolveu (NSR fiscal, hash fiscal,
// estabelecimento, data de gravação) e o estado do envio/foto.
//
// Estado da foto (fotoEstado): 0 = aguardando envio, 1 = enviada ou batida
// sem foto, -1 = arquivo não existe mais no aparelho, -2 = recusada pelo
// servidor/limite (arquivo preservado).
//
// Formato 1 (LEGADO): eventos gravados por versões antigas do app ficam como
// estão (formatVersion 1, campos nsr/hash/hashAnterior) e são enviados pelo
// caminho legado (legado-v1.js).
import { HASH_INICIAL, sequenciaLegadaDoAparelho } from "../../../../src/domains/ponto-eletronico/marcacao.js";

export const FOTO = Object.freeze({ PENDENTE: 0, OK: 1, SEM_ARQUIVO: -1, RECUSADA: -2 });

// Formato 1: o "nsr" é a sequência do aparelho (legacyDeviceSequence), não NSR fiscal.
const sequenciaDe = e => (e.formatVersion === 2 ? Number(e.localSequence) : sequenciaLegadaDoAparelho(e));
const hashDe = e => (e.formatVersion === 2 ? e.localHash : e.hash);

export function criarArmazemMemoria() {
  const eventos = [];          // { ...evento, enviada, fotoEstado, caminhoFoto, fiscal }
  const estado = new Map();
  let fila = Promise.resolve();

  // Topo da cadeia local. base_cadeia só existe em bancos de versões antigas
  // (realinhamento do formato 1 - não é mais gravada).
  const ultimo = () => {
    const base = estado.get("base_cadeia") || { nsr: 0, hash: HASH_INICIAL };
    const topo = eventos.reduce((a, e) => (!a || sequenciaDe(e) > sequenciaDe(a) ? e : a), null);
    return topo && sequenciaDe(topo) > base.nsr ? { localSequence: sequenciaDe(topo), localHash: hashDe(topo) } : { localSequence: base.nsr, localHash: base.hash };
  };
  const limpa = ({ enviada, fotoEstado, caminhoFoto, motivoFoto, fiscal, ...e }) => e;
  const tx = {
    async ultimoEvento() { return ultimo(); },
    async inserirEvento(e, { caminhoFoto = null } = {}) {
      if (e.localSequence !== ultimo().localSequence + 1) throw new Error("sequência local fora de ordem no aparelho");
      if (eventos.some(x => (x.eventId || x.id) === e.eventId)) throw new Error("eventId repetido no aparelho");
      eventos.push({ ...e, enviada: false, fotoEstado: e.fotoSha256 ? FOTO.PENDENTE : FOTO.OK, caminhoFoto, fiscal: null });
    },
  };
  const transacao = fn => { const r = fila.then(() => fn(tx)); fila = r.catch(() => {}); return r; };
  const porId = id => eventos.find(e => (e.eventId || e.id) === id);
  const comFoto = (id, f) => { const e = porId(id); if (e) f(e); };

  return {
    eventos,
    transacao,
    async ultimoEventoGlobal() { return ultimo(); },
    // Pendentes em ordem de sequência local (legado formato 1 incluído).
    async eventosPendentes(limite) {
      return eventos.filter(e => !e.enviada).sort((a, b) => sequenciaDe(a) - sequenciaDe(b)).slice(0, limite).map(limpa);
    },
    // Formato 2: a ARP aceitou ESTE evento - guarda NSR/hash fiscal ao lado.
    async confirmarEvento(eventId, fiscal) {
      const e = porId(eventId);
      if (!e || e.formatVersion !== 2 || e.enviada) return false;   // escrita única, como no SQLite
      e.enviada = true;
      e.fiscal = { nsr: fiscal?.nsr ?? null, fiscalHash: fiscal?.fiscalHash ?? null, estabelecimentoId: fiscal?.estabelecimentoId ?? null, gravadoEm: fiscal?.gravadoEm ?? null };
      return true;
    },
    async registroFiscal(eventId) { return porId(eventId)?.fiscal ?? null; },
    // Formato 1 (legado): confirmação por topo de sequência, como antes.
    async confirmarLegadoAte(seq) {
      let n = 0; for (const e of eventos) if (!e.enviada && e.formatVersion !== 2 && sequenciaLegadaDoAparelho(e) <= seq) { e.enviada = true; n++; } return n;
    },
    async hashDaSequencia(seq) {
      const base = estado.get("base_cadeia");
      if (base && Number(seq) === base.nsr) return base.hash;
      if (Number(seq) === 0) return HASH_INICIAL;
      const e = eventos.find(x => sequenciaDe(x) === Number(seq));
      return e ? hashDe(e) : null;
    },
    async fotosPendentes(limite) {
      return eventos.filter(e => e.enviada && e.fotoEstado === FOTO.PENDENTE && e.caminhoFoto).sort((a, b) => sequenciaDe(a) - sequenciaDe(b))
        .slice(0, limite).map(e => ({ id: e.eventId || e.id, caminhoFoto: e.caminhoFoto }));
    },
    async fotoEnviada(id) { comFoto(id, e => { e.fotoEstado = FOTO.OK; }); },
    async fotoSemArquivo(id) { comFoto(id, e => { e.fotoEstado = FOTO.SEM_ARQUIVO; }); },
    async fotoRecusada(id, motivo) { comFoto(id, e => { e.fotoEstado = FOTO.RECUSADA; e.motivoFoto = motivo; }); },
    async salvarReferenciaHora(r) { estado.set("referencia_hora", r); },
    async referenciaHora() { return estado.get("referencia_hora") ?? null; },
    async salvarCadastro(c) { estado.set("cadastro", c); },
    async cadastro() { return estado.get("cadastro") ?? null; },
    async lerEstado(chave) { return estado.get(chave) ?? null; },
    async gravarEstado(chave, valor) { estado.set(chave, valor); },
    async dispositivoDoBanco() { return estado.get("dispositivo_id") ?? eventos[0]?.deviceId ?? eventos[0]?.dispositivoId ?? null; },
    async ultimoNsrRecebido() {
      const comNsr = eventos.filter(e => e.fiscal?.nsr);
      return comNsr.length ? Math.max(...comNsr.map(e => e.fiscal.nsr)) : null;
    },
    async contagem() {
      return {
        pendentes: eventos.filter(e => !e.enviada).length,
        fotos: eventos.filter(e => e.fotoEstado === FOTO.PENDENTE).length,
        fotosComProblema: eventos.filter(e => e.fotoEstado < 0).length,
      };
    },
  };
}
