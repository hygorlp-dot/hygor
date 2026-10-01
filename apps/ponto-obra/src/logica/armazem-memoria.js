// Armazém em memória com a MESMA interface do armazém SQLite do app
// (src/dados/armazem-sqlite.js). Usado nos testes e como referência do
// contrato. Batida nunca é alterada nem apagada - só ganha "enviada".
import { HASH_INICIAL } from "../../../../src/domains/ponto-eletronico/marcacao.js";

export function criarArmazemMemoria() {
  const marcacoes = [];          // { ...marcacao, enviada, fotoEnviada, caminhoFoto }
  let base = { nsr: 0, hash: HASH_INICIAL };  // base após alinhamento com o servidor
  let referenciaHora = null, cadastro = null;
  let fila = Promise.resolve();

  const ultima = () => (marcacoes.length ? { nsr: marcacoes.at(-1).nsr, hash: marcacoes.at(-1).hash } : base);
  const tx = {
    async ultimaMarcacao() { return ultima(); },
    async inserirMarcacao(m) {
      if (m.nsr !== ultima().nsr + 1) throw new Error("NSR fora de sequência no aparelho");
      marcacoes.push({ ...m, enviada: false, fotoEnviada: !m.fotoSha256 });
    },
  };

  return {
    marcacoes,
    // Serializa as transações como o SQLite (withExclusiveTransactionAsync).
    transacao(fn) { const r = fila.then(() => fn(tx)); fila = r.catch(() => {}); return r; },
    async ultimaMarcacaoGlobal() { return ultima(); },
    async marcacoesPendentes(limite) {
      return marcacoes.filter(m => !m.enviada).slice(0, limite).map(({ enviada, fotoEnviada, caminhoFoto, ...m }) => m);
    },
    async confirmarEnviadasAte(nsr) {
      let n = 0; for (const m of marcacoes) if (!m.enviada && m.nsr <= nsr) { m.enviada = true; n++; } return n;
    },
    async anexarCaminhoFoto(id, caminho) { const m = marcacoes.find(x => x.id === id); if (m) m.caminhoFoto = caminho; },
    async fotosPendentes(limite) { return marcacoes.filter(m => m.enviada && !m.fotoEnviada && m.caminhoFoto).slice(0, limite).map(m => ({ id: m.id, caminhoFoto: m.caminhoFoto })); },
    async fotoEnviada(id) { const m = marcacoes.find(x => x.id === id); if (m) m.fotoEnviada = true; },
    async salvarReferenciaHora(r) { referenciaHora = r; },
    async referenciaHora() { return referenciaHora; },
    async salvarCadastro(c) { cadastro = c; },
    async cadastro() { return cadastro; },
    // Substitui SÓ as pendentes pela versão renumerada; as já enviadas ficam.
    async reencadearPendentes({ base: novaBase, marcacoes: novas }) {
      const extras = new Map(marcacoes.filter(m => !m.enviada).map(m => [m.id, { caminhoFoto: m.caminhoFoto, fotoEnviada: m.fotoEnviada }]));
      // A base da cadeia local passa a ser o último NSR do servidor; as já
      // enviadas deixam de ser o topo (continuam registradas no servidor).
      base = novaBase;
      marcacoes.length = 0;
      for (const m of novas) marcacoes.push({ ...m, enviada: false, ...(extras.get(m.id) || { fotoEnviada: !m.fotoSha256 }) });
    },
  };
}
