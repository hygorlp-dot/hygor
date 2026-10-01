// Armazém em memória com a MESMA interface do armazém SQLite do app
// (src/dados/armazem-sqlite-nucleo.js). Usado nos testes e como referência do
// contrato. Batida nunca é alterada nem apagada - só ganha "enviada" e o
// estado da foto. Única exceção: realinharPendentes, que renumera batidas que
// NUNCA saíram do aparelho.
//
// Estado da foto (fotoEstado): 0 = aguardando envio, 1 = enviada ou batida
// sem foto, -1 = arquivo não existe mais no aparelho, -2 = recusada pelo
// servidor/limite (arquivo preservado).
import { HASH_INICIAL } from "../../../../src/domains/ponto-eletronico/marcacao.js";

export const FOTO = Object.freeze({ PENDENTE: 0, OK: 1, SEM_ARQUIVO: -1, RECUSADA: -2 });

export function criarArmazemMemoria() {
  const marcacoes = [];          // { ...marcacao, enviada, fotoEstado, caminhoFoto }
  let base = { nsr: 0, hash: HASH_INICIAL };  // base após alinhamento com o servidor
  const estado = new Map();
  let fila = Promise.resolve();

  const ultima = () => {
    const topo = marcacoes.reduce((a, m) => (!a || m.nsr > a.nsr ? m : a), null);
    return topo && topo.nsr > base.nsr ? { nsr: topo.nsr, hash: topo.hash } : base;
  };
  const limpa = ({ enviada, fotoEstado, caminhoFoto, motivoFoto, ...m }) => m;
  const tx = {
    async ultimaMarcacao() { return ultima(); },
    async inserirMarcacao(m, { caminhoFoto = null } = {}) {
      if (m.nsr !== ultima().nsr + 1) throw new Error("NSR fora de sequência no aparelho");
      marcacoes.push({ ...m, enviada: false, fotoEstado: m.fotoSha256 ? FOTO.PENDENTE : FOTO.OK, caminhoFoto });
    },
  };
  // Serializa as transações como o SQLite (withExclusiveTransactionAsync).
  const transacao = fn => { const r = fila.then(() => fn(tx)); fila = r.catch(() => {}); return r; };
  const comFoto = (id, f) => { const m = marcacoes.find(x => x.id === id); if (m) f(m); };

  return {
    marcacoes,
    transacao,
    async ultimaMarcacaoGlobal() { return ultima(); },
    async hashDoNsr(nsr) {
      if (Number(nsr) === base.nsr) return base.hash;
      if (Number(nsr) === 0) return HASH_INICIAL;
      return marcacoes.find(m => m.nsr === Number(nsr))?.hash ?? null;
    },
    async marcacoesPendentes(limite) {
      return marcacoes.filter(m => !m.enviada).sort((a, b) => a.nsr - b.nsr).slice(0, limite).map(limpa);
    },
    async confirmarEnviadasAte(nsr) {
      let n = 0; for (const m of marcacoes) if (!m.enviada && m.nsr <= nsr) { m.enviada = true; n++; } return n;
    },
    async fotosPendentes(limite) {
      return marcacoes.filter(m => m.enviada && m.fotoEstado === FOTO.PENDENTE && m.caminhoFoto).sort((a, b) => a.nsr - b.nsr)
        .slice(0, limite).map(m => ({ id: m.id, caminhoFoto: m.caminhoFoto }));
    },
    async fotoEnviada(id) { comFoto(id, m => { m.fotoEstado = FOTO.OK; }); },
    async fotoSemArquivo(id) { comFoto(id, m => { m.fotoEstado = FOTO.SEM_ARQUIVO; }); },
    async fotoRecusada(id, motivo) { comFoto(id, m => { m.fotoEstado = FOTO.RECUSADA; m.motivoFoto = motivo; }); },
    async salvarReferenciaHora(r) { estado.set("referencia_hora", r); },
    async referenciaHora() { return estado.get("referencia_hora") ?? null; },
    async salvarCadastro(c) { estado.set("cadastro", c); },
    async cadastro() { return estado.get("cadastro") ?? null; },
    async lerEstado(chave) { return estado.get(chave) ?? null; },
    async gravarEstado(chave, valor) { estado.set(chave, valor); },
    // Renumera SÓ as pendentes, dentro da transação (uma batida feita no meio
    // não fica de fora). recalcular(pendentes) devolve a versão renumerada.
    async realinharPendentes({ base: novaBase, recalcular }) {
      return transacao(async () => {
        const pendentes = marcacoes.filter(m => !m.enviada).sort((a, b) => a.nsr - b.nsr);
        const novas = await recalcular(pendentes.map(limpa));
        const ids = new Set(novas.map(n => n.id));
        if (novas.length !== pendentes.length || pendentes.some(p => !ids.has(p.id))) throw new Error("realinhamento perderia batidas - abortado");
        const extras = new Map(pendentes.map(m => [m.id, { caminhoFoto: m.caminhoFoto, fotoEstado: m.fotoEstado }]));
        // A cadeia local passa a continuar do servidor; as já enviadas ficam.
        base = novaBase;
        for (let i = marcacoes.length - 1; i >= 0; i--) if (!marcacoes[i].enviada) marcacoes.splice(i, 1);
        for (const m of novas) marcacoes.push({ ...m, enviada: false, ...extras.get(m.id) });
        return novas.length;
      });
    },
    async dispositivoDoBanco() { return estado.get("dispositivo_id") ?? marcacoes[0]?.dispositivoId ?? null; },
    async contagem() {
      return {
        pendentes: marcacoes.filter(m => !m.enviada).length,
        fotos: marcacoes.filter(m => m.fotoEstado === FOTO.PENDENTE).length,
        fotosComProblema: marcacoes.filter(m => m.fotoEstado < 0).length,
      };
    },
  };
}
