// Numeração de EAP (1, 1.1, 1.2, 2...) e nível de recuo de cada atividade do
// cronograma, para a exportação A2 ficar organizada como o orçamento: sem
// isso "PILARES/VIGAS/LAJES" do 1º pavimento e da cobertura saíam idênticos,
// soltos numa lista plana.
//
// `tarefas` já vem na ordem da árvore de etapas do orçamento (montarTarefas).
// O nível vem da profundidade da etapa (parentId); atividade avulsa, sem
// etapa, fica no primeiro nível.
export const numeracaoEap = (tarefas, etapas) => {
  const paiDe = new Map((etapas || []).map(e => [e.id, e.parentId || ""]));
  const nivelDaEtapa = etapaId => {
    let nivel = 0, atual = paiDe.get(etapaId), guarda = 0;
    while (atual && paiDe.has(atual) && guarda++ < 50) { nivel += 1; atual = paiDe.get(atual); }
    return nivel;
  };
  // `pilha` guarda o nível lógico (profundidade no orçamento) de cada
  // ancestral aberto: uma atividade só é filha de quem está mais raso que ela.
  // Assim uma subetapa cuja mãe não entrou no cronograma sobe de nível em vez
  // de aninhar a irmã debaixo dela.
  const pilha = [];
  const contadores = [];
  const resultado = new Map();
  for (const t of tarefas || []) {
    const nivel = t.etapaId && paiDe.has(t.etapaId) ? nivelDaEtapa(t.etapaId) : 0;
    while (pilha.length && pilha[pilha.length - 1] >= nivel) pilha.pop();
    const nivelEfetivo = pilha.length;
    pilha.push(nivel);
    contadores.length = nivelEfetivo + 1;
    contadores[nivelEfetivo] = (contadores[nivelEfetivo] || 0) + 1;
    resultado.set(t.id, { nivel: nivelEfetivo, codigo: contadores.slice(0, nivelEfetivo + 1).join(".") });
  }
  return resultado;
};
