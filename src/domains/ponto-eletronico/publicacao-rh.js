// Producer contract. This does not write attendance, calculate pay or approve a day.
export const VERSAO_CONTRATO_RH = 1;
const texto = value => String(value ?? "").trim();
const ids = values => [...new Set((values || []).map(texto).filter(Boolean))].sort();
const iso = value => {
  if (!Number.isFinite(Date.parse(value))) throw new Error("Horário inválido na publicação RH");
  return new Date(value).toISOString();
};

export function produzirPublicacaoRh(entrada, sha256) {
  const { companyId, employeeId, dataOperacional, fuso, revisao, tratamentoVersao } = entrada;
  if (![companyId, employeeId, fuso, tratamentoVersao].every(texto) || !/^\d{4}-\d{2}-\d{2}$/.test(dataOperacional)
    || !Number.isSafeInteger(revisao) || revisao < 1) throw new Error("Identidade, fuso e revisão são obrigatórios");
  new Intl.DateTimeFormat("pt-BR", { timeZone: fuso }).format();
  const eventos = (entrada.eventos || []).map(e => {
    if (texto(e.companyId) !== texto(companyId) || texto(e.employeeId) !== texto(employeeId)
      || e.tipoRegistro !== "ponto" || !texto(e.eventId) || !texto(e.dispositivoId) || !texto(e.estabelecimentoId)) {
      throw new Error("Evento de origem incompatível com a publicação");
    }
    return { eventId: texto(e.eventId), dispositivoId: texto(e.dispositivoId), estabelecimentoId: texto(e.estabelecimentoId),
      nsr: e.nsr == null ? null : texto(e.nsr), marcadoEm: iso(e.marcadoEm), obraCapturaId: texto(e.obraCapturaId) };
  }).sort((a, b) => a.eventId.localeCompare(b.eventId));
  if (ids(eventos.map(e => e.eventId)).length !== eventos.length) throw new Error("Origem contém eventId repetido");
  const conhecidos = new Set(eventos.map(e => e.eventId));
  const excecoes = ids(entrada.excecoes);
  const intervalos = (entrada.intervalos || []).map(i => {
    const eventIds = ids(i.eventIds || i.eventos);
    if (!eventIds.length || eventIds.some(id => !conhecidos.has(id))) throw new Error("Intervalo sem origem integral");
    const inicio = iso(i.inicio), fim = iso(i.fim), duracaoMs = Date.parse(fim) - Date.parse(inicio);
    if (duracaoMs <= 0 || duracaoMs > 86400000 || !texto(i.obraApropriadaId)) throw new Error("Intervalo inválido");
    return { inicio, fim, obraApropriadaId: texto(i.obraApropriadaId), duracaoMs, eventIds };
  }).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim) || a.obraApropriadaId.localeCompare(b.obraApropriadaId));
  for (let i = 1; i < intervalos.length; i++) if (intervalos[i].inicio < intervalos[i - 1].fim) throw new Error("Intervalos sobrepostos");
  const usados = new Set(intervalos.flatMap(i => i.eventIds));
  if (!eventos.length || !intervalos.length || eventos.some(e => !usados.has(e.eventId))) excecoes.push("jornada_incompleta");
  if (eventos.some(e => e.nsr === null)) excecoes.push("confirmacao_fiscal_pendente");
  if (entrada.periodoFechado) excecoes.push("revisao_periodo_fechado");
  const aprovada = entrada.aprovacao?.estado === "aprovado";
  if (aprovada && (!texto(entrada.aprovacao.responsavelId) || !entrada.aprovacao.em)) throw new Error("Aprovação sem responsável ou data");
  const estado = aprovada && !excecoes.length ? "aprovado" : "pendente";
  const identidade = [VERSAO_CONTRATO_RH, texto(companyId), texto(employeeId), dataOperacional, revisao, eventos.map(e => e.eventId)];
  const publicacaoId = `ponto-rh-v1-${sha256(JSON.stringify(identidade))}`;
  const resultado = { contratoVersao: VERSAO_CONTRATO_RH, publicacaoId, companyId: texto(companyId), employeeId: texto(employeeId),
    dataOperacional, fuso, revisao, tratamentoVersao: texto(tratamentoVersao), eventos, intervalos,
    excecoes: ids(excecoes), estado, aprovacao: aprovada ? { responsavelId: texto(entrada.aprovacao.responsavelId), em: iso(entrada.aprovacao.em) } : null };
  return { ...resultado, conteudoHash: sha256(JSON.stringify(resultado)) };
}
