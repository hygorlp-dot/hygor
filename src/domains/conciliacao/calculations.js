// Regras puras do contexto de Conciliação Bancária. Sem React, DOM ou
// persistência. Extraído de LegacyApp.jsx (funções que já existiam soltas
// no arquivo, usadas pelo componente Conciliacao) para o mesmo padrão dos
// domínios já migrados (compras, dre, equipamentos).

// Normaliza texto para comparação (remove acento, caixa) - usado em toda
// comparação de nome/descrição do motor de conciliação.
export const semAcento = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "1.234,56" ou "(1.234,56)" → 1234.56 / -1234.56
export const parseValorBR = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[()]/g, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  if (isNaN(n)) return 0;
  return neg && n > 0 ? -n : n;
};

// Datas no padrão OFX (YYYYMMDD[hhmmss][fuso]) → ISO "YYYY-MM-DD"
export const dataOFXParaISO = (s) => {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

// OFX é o formato que todo banco brasileiro exporta e, melhor, traz o FITID:
// um identificador único da transação. É ele que torna a deduplicação exata,
// em vez de heurística.
export const parseOFX = (texto) => {
  const tag = (bloco, t) => {
    const m = bloco.match(new RegExp(`<${t}>([^<\r\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  const banco = tag(texto, "ORG") || tag(texto, "BANKID") || "";
  const conta = tag(texto, "ACCTID") || "";
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const trans = blocos.map(b => ({
    data: dataOFXParaISO(tag(b, "DTPOSTED")),
    descricao: (tag(b, "MEMO") || tag(b, "NAME") || "").trim(),
    valor: Number(String(tag(b, "TRNAMT")).replace(",", ".")),
    fitid: tag(b, "FITID"),
  })).filter(t => t.data && !isNaN(t.valor) && t.valor !== 0);
  return { banco, conta, trans };
};

// Chave de deduplicação: FITID quando existe; senão, impressão digital da linha.
export const chaveTransacao = (t) =>
  t.fitid ? `fit:${t.fitid}`
          : `h:${t.data}|${Number(t.valor).toFixed(2)}|${String(t.descricao).slice(0, 40).toLowerCase()}`;

// Hash simples (FNV-1a, síncrono, sem dependência) do conteúdo bruto do
// arquivo de extrato - complementa chaveTransacao (que é por linha) com uma
// impressão digital do ARQUIVO inteiro, para o relatório de importação e
// para detectar reimportação do mesmo arquivo físico.
export const hashArquivo = (texto) => {
  let h = 0x811c9dc5;
  const s = String(texto || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

// Soma dos rateios. O fechamento (soma == valor da transação, 1 centavo) é
// verificado no componente, que precisa exibir a diferença ao vivo.
export const somaRateios = (rateios) =>
  (rateios || []).reduce((s, r) => s + Number(r.valor || 0), 0);

// Sugere destino a partir das regras que o usuário foi criando. Aceita tanto
// o formato antigo (padrao/destino/obraId/categoria) quanto uma regra nova
// desativada (ativa:false), que nunca deve sugerir nada.
export const sugerirRateio = (tr, regras) => {
  const d = String(tr.descricao || "").toLowerCase();
  const regra = (regras || []).find(r => r.ativa !== false && r.padrao && d.includes(r.padrao.toLowerCase()));
  if (!regra) return null;
  return { destino: regra.destino, obraId: regra.obraId, categoria: regra.categoria, regraId: regra.id };
};

// Distância em dias entre duas datas ISO
export const diasEntre = (a, b) => {
  if (!a || !b) return 999;
  return Math.abs(Math.round(
    (new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000
  ));
};

// Painel de números da conciliação (KPIs da fila)
export const calcConciliacao = (data) => {
  const trans = data.transacoes || [];
  const pend = trans.filter(t => t.status === "pendente");
  const conc = trans.filter(t => t.status === "conciliado");
  const ign = trans.filter(t => t.status === "ignorado");
  const vPend = pend.reduce((s, t) => s + Math.abs(Number(t.valor || 0)), 0);
  const entradas = conc.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0);
  const saidas = conc.filter(t => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
  return {
    total: trans.length,
    pendentes: pend.length, conciliadas: conc.length, ignoradas: ign.length,
    valorPendente: vPend, entradas, saidas,
    pct: trans.length ? ((conc.length + ign.length) / trans.length) * 100 : 0,
  };
};

//
// VALORES FINANCEIROS EM CENTAVOS INTEIROS
//
// O app inteiro usa Number (ponto flutuante) para dinheiro. Não dá para
// reescrever tudo nesta entrega, mas toda comparação de igualdade, soma de
// rateio e validação de saldo DENTRO do motor de conciliação passa por aqui,
// para não sofrer de erro de arredondamento (0.1 + 0.2 !== 0.3).
//

export const paraCentavos = valor => Math.round(Number(valor || 0) * 100);
export const deCentavos = centavos => Number(centavos || 0) / 100;
export const igualCentavos = (a, b, toleranciaCentavos = 1) =>
  Math.abs(paraCentavos(a) - paraCentavos(b)) <= toleranciaCentavos;

//
// RECEBIMENTO DE MEDIÇÃO (correção do bug de recebimento parcial legado)
//
// Antes, marcar uma medição como recebida era um botão binário: sempre
// gravava valorRecebido = valorPrevisto, mesmo quando só uma parte entrou.
// Agora cada recebimento vira uma entrada em `recebimentos[]`; os campos
// antigos (`recebido`, `valorRecebido`, `dataPagamento`) continuam sendo
// escritos como espelho do total, para não quebrar quem ainda os lê.
export const totalRecebidoMedicao = medicao =>
  Array.isArray(medicao.recebimentos) && medicao.recebimentos.length
    ? medicao.recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0)
    : Number(medicao.valorRecebido || 0);

export const statusRecebimentoMedicao = medicao => {
  const previsto = Number(medicao.valorPrevisto || 0);
  const recebido = totalRecebidoMedicao(medicao);
  if (previsto <= 0) return recebido > 0 ? "recebida" : "em_aberto";
  if (recebido >= previsto - 0.01) return "recebida";
  if (recebido > 0) return "parcial";
  return "em_aberto";
};

// Aplica um novo recebimento (total ou parcial) a uma medição, devolvendo a
// medição atualizada. `valor` pode ser menor que o saldo (parcial) - nesse
// caso `recebido` só vira true quando o acumulado fechar com o previsto.
export const aplicarRecebimentoMedicao = (medicao, { id, valor, data, origem = "", transacaoId = "" }) => {
  const recebimentos = [
    ...(Array.isArray(medicao.recebimentos) ? medicao.recebimentos : []),
    { id: id || undefined, valor: Number(valor || 0), data: data || "", origem, transacaoId },
  ];
  const total = recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0);
  const previsto = Number(medicao.valorPrevisto || 0);
  return {
    ...medicao,
    recebimentos,
    valorRecebido: total,
    dataPagamento: data || medicao.dataPagamento || "",
    recebido: previsto > 0 ? total >= previsto - 0.01 : total > 0,
  };
};

// Remove um recebimento (por id) de uma medição - usado pelo desfazer, para
// reverter só a parcela ligada a uma conciliação específica, não o total.
export const removerRecebimentoMedicao = (medicao, recebimentoId) => {
  const recebimentos = (Array.isArray(medicao.recebimentos) ? medicao.recebimentos : [])
    .filter(r => r.id !== recebimentoId);
  const total = recebimentos.reduce((s, r) => s + Number(r.valor || 0), 0);
  const previsto = Number(medicao.valorPrevisto || 0);
  return {
    ...medicao,
    recebimentos,
    valorRecebido: total,
    dataPagamento: recebimentos.length ? recebimentos[recebimentos.length - 1].data || "" : "",
    recebido: previsto > 0 ? total >= previsto - 0.01 : total > 0,
  };
};
