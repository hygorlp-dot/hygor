// A0.1 (roadmap 7,6 → 9): mede se a equipe usa o fluxo de Compras. Conta, por
// obra e por semana, o que foi lançado em cada etapa e por quem; mede o tempo
// entre as etapas; e aponta compra feita fora do fluxo (nota de material sem
// pedido, despesa de material no caixa da obra sem pedido nem nota).
// Só lê o que os comandos já gravam (criadoEm/criadoPor, recebimentos[] dos
// itens); não grava nada.

export const SEMANAS_ADOCAO = 8;
export const ETAPAS_ADOCAO = Object.freeze([
  ["solicitacoes", "Solicitações"],
  ["cotacoes", "Cotações"],
  ["pedidos", "Pedidos"],
  ["recebimentos", "Recebimentos"],
  ["notas", "Notas"],
]);
export const SEM_AUTOR = "Sem autor registrado";

const INATIVOS = ["cancelada", "cancelado", "estornada", "estornado", "rejeitada", "rejeitado", "excluida", "excluido"];
const inativo = item => item?.ativo === false || INATIVOS.includes(String(item?.status || "").toLowerCase());
const dia = valor => (/^\d{4}-\d{2}-\d{2}/.test(String(valor || "")) ? String(valor).slice(0, 10) : "");
const diaDe = (...valores) => valores.map(dia).find(Boolean) || "";
const ms = iso => Date.parse(`${iso}T12:00:00Z`);
const somaDias = (iso, n) => new Date(ms(iso) + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (de, ate) => Math.round((ms(ate) - ms(de)) / 86400000);
const umDecimal = n => Math.round(n * 10) / 10;

// Segunda-feira da semana da data (semana de trabalho da obra).
export const inicioDaSemana = iso => somaDias(iso, -((new Date(ms(iso)).getUTCDay() + 6) % 7));

const vazio = () => Object.fromEntries(ETAPAS_ADOCAO.map(([etapa]) => [etapa, 0]));

const eventosDeCompras = (data, obras) => {
  const daObra = item => obras.has(String(item?.obraId || ""));
  const eventos = [];
  const add = (etapa, item, data, autor) => data && eventos.push({
    etapa, obraId: String(item.obraId), data, autor: String(autor || "").trim() || SEM_AUTOR,
  });
  (data?.solicitacoesCompra || []).filter(daObra).filter(s => s.status !== "rascunho")
    .forEach(s => add("solicitacoes", s, diaDe(s.criadoEm, s.data), s.criadoPor || s.solicitanteNome));
  (data?.cotacoes || []).filter(daObra)
    .forEach(c => add("cotacoes", c, diaDe(c.criadoEm, c.data), c.criadoPor));
  (data?.pedidos || []).filter(daObra).filter(p => p.status !== "rascunho").forEach(p => {
    add("pedidos", p, diaDe(p.criadoEm, p.data), p.criadoPor);
    // Um registro de chegada cobre vários itens: conta uma vez por pedido,
    // momento e responsável.
    const chegadas = new Map();
    (p.itens || []).forEach(item => (item.recebimentos || []).forEach(r => {
      const quando = diaDe(r.data, r.registradoEm);
      const chave = `${r.registradoEm || quando}|${r.responsavelId || r.responsavel || ""}`;
      if (quando && !chegadas.has(chave)) chegadas.set(chave, { quando, autor: r.responsavel });
    }));
    chegadas.forEach(({ quando, autor }) => add("recebimentos", p, quando, autor));
  });
  (data?.notasFiscais || []).filter(daObra).filter(n => !inativo(n) && n.pedidoId)
    .forEach(n => add("notas", n, diaDe(n.criadoEm, n.emissao), n.criadoPor));
  return eventos;
};

// Compra que não passou pelo fluxo: nota de material sem pedido (nota de
// terceirizado, ligada a medição, não conta) e despesa de material no caixa
// da obra sem pedido nem nota.
const forasDoFluxo = (data, obras, de, ate) => {
  const naJanela = d => d && d >= de && d <= ate;
  const daObra = item => obras.has(String(item?.obraId || ""));
  const material = item => ["", "material"].includes(String(item?.categoria || "").toLowerCase());
  const notas = (data?.notasFiscais || []).filter(n => daObra(n) && !inativo(n) && !n.pedidoId
    && !n.medicaoTercId && material(n))
    .map(n => ({ tipo: "nota", id: String(n.id), obraId: String(n.obraId), data: diaDe(n.emissao, n.criadoEm),
      descricao: `NF ${n.numero || "sem número"}`, valor: Number(n.valorBruto || 0), autor: n.criadoPor || SEM_AUTOR }))
    .filter(n => naJanela(n.data));
  const caixa = (data?.caixaObra || []).filter(m => daObra(m) && !inativo(m) && m.tipo === "despesa"
    && String(m.categoria || "").toLowerCase() === "material" && !m.pedidoId && !m.notaFiscalId)
    .map(m => ({ tipo: "caixa", id: String(m.id), obraId: String(m.obraId), data: dia(m.data),
      descricao: String(m.descricao || "Despesa de material no caixa da obra"), valor: Number(m.valor || 0),
      autor: m.registradoPor || m.criadoPor || SEM_AUTOR }))
    .filter(m => naJanela(m.data));
  const itens = [...notas, ...caixa].sort((a, b) => b.data.localeCompare(a.data) || b.valor - a.valor);
  return { itens, quantidade: itens.length, valor: itens.reduce((s, i) => s + i.valor, 0) };
};

const media = valores => (valores.length
  ? { mediaDias: umDecimal(valores.reduce((s, v) => s + v, 0) / valores.length), amostra: valores.length }
  : { mediaDias: null, amostra: 0 });

const temposDoFluxo = (data, obras, de, ate) => {
  const naJanela = d => d && d >= de && d <= ate;
  const solicitacoes = new Map((data?.solicitacoesCompra || []).map(s => [String(s.id), s]));
  const pedidos = (data?.pedidos || []).filter(p => obras.has(String(p.obraId || ""))
    && !["rascunho", "cancelado"].includes(p.status));
  const ateOPedido = pedidos.flatMap(p => {
    const s = solicitacoes.get(String(p.solicitacaoId || ""));
    const feito = diaDe(p.criadoEm, p.data), pedida = s && diaDe(s.criadoEm, s.data);
    return pedida && naJanela(feito) && feito >= pedida ? [diasEntre(pedida, feito)] : [];
  });
  const ateAEntrega = pedidos.flatMap(p => {
    const chegadas = (p.itens || []).flatMap(i => (i.recebimentos || []).map(r => diaDe(r.data, r.registradoEm))).filter(Boolean).sort();
    const feito = dia(p.data) || diaDe(p.criadoEm);
    return chegadas[0] && feito && naJanela(chegadas[0]) && chegadas[0] >= feito ? [diasEntre(feito, chegadas[0])] : [];
  });
  return { solicitacaoAtePedido: media(ateOPedido), pedidoAteEntrega: media(ateAEntrega) };
};

export function painelAdocaoCompras(data, obraIds, hoje, { semanas: n = SEMANAS_ADOCAO } = {}) {
  const obras = new Set((obraIds || []).map(String));
  const inicio = somaDias(inicioDaSemana(hoje), -7 * (n - 1));
  const semanas = Array.from({ length: n }, (_, i) => {
    const de = somaDias(inicio, 7 * i);
    return { inicio: de, fim: somaDias(de, 6) };
  });
  const indice = d => (d >= inicio && d <= hoje ? Math.floor(diasEntre(inicio, d) / 7) : -1);
  const porSemana = () => Object.fromEntries(ETAPAS_ADOCAO.map(([etapa]) => [etapa, Array(n).fill(0)]));

  const totais = porSemana();
  const linhasObra = new Map(), autores = new Map();
  eventosDeCompras(data, obras).forEach(evento => {
    const i = indice(evento.data);
    if (i < 0) return;
    totais[evento.etapa][i] += 1;
    const obra = linhasObra.get(evento.obraId) || { obraId: evento.obraId, semanas: porSemana(), total: 0, ultima: "" };
    obra.semanas[evento.etapa][i] += 1;
    obra.total += 1;
    if (evento.data > obra.ultima) obra.ultima = evento.data;
    linhasObra.set(evento.obraId, obra);
    const autor = autores.get(evento.autor) || { nome: evento.autor, ...vazio(), total: 0 };
    autor[evento.etapa] += 1;
    autor.total += 1;
    autores.set(evento.autor, autor);
  });

  const nomes = new Map((data?.obras || []).map(o => [String(o.id), o.name || o.nome || "Obra"]));
  const porObra = [...obras].map(obraId => {
    const linha = linhasObra.get(obraId) || { obraId, semanas: porSemana(), total: 0, ultima: "" };
    const etapas = Object.fromEntries(ETAPAS_ADOCAO.map(([etapa]) => [etapa, linha.semanas[etapa].reduce((s, v) => s + v, 0)]));
    return { ...linha, nome: nomes.get(obraId) || "Obra", etapas };
  }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  const totalPorEtapa = Object.fromEntries(ETAPAS_ADOCAO.map(([etapa]) => [etapa, totais[etapa].reduce((s, v) => s + v, 0)]));
  return {
    semanas, totais, totalPorEtapa,
    total: Object.values(totalPorEtapa).reduce((s, v) => s + v, 0),
    porObra,
    obrasSemUso: porObra.filter(o => !o.total).map(o => o.obraId),
    autores: [...autores.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")),
    tempos: temposDoFluxo(data, obras, inicio, hoje),
    foraDoFluxo: forasDoFluxo(data, obras, inicio, hoje),
  };
}
