// Clonagem de orçamento (e, quando existir, do cronograma vinculado) de uma
// obra de origem para uma obra de destino. Pedido do usuário (26/08/2026):
// um botão para copiar orçamento/cronograma de outra obra, em vez de montar
// tudo do zero a cada nova obra parecida.
//
// Regra central: etapas e itens ganham ids novos (não é seguro reutilizar os
// da obra de origem - duas obras não podem compartilhar a mesma etapa). O
// cronograma (plano.tarefas/marcos) é clonado com os MESMOS ids novos de
// etapa, e as datas são deslocadas em bloco para que a tarefa mais antiga
// comece em `hoje` - preserva a duração e o encadeamento relativo entre
// tarefas sem herdar datas de uma obra que já está em andamento.

const diasEntreDatas = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const somaDiasSimples = (data, dias) => {
  if (!data) return data;
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return data;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Clona etapas (id novo, parentId remapeado) e itens (id novo, etapaId
// remapeado) de um orçamento de origem. Retorna também o mapa de ids de
// etapa (origem -> novo), necessário para clonar o cronograma em seguida.
export function clonarEstruturaOrcamento(orcOrigem, gerarId) {
  const etapaIdMap = new Map();
  (orcOrigem.etapas || []).forEach(etapa => etapaIdMap.set(etapa.id, gerarId()));

  const etapas = (orcOrigem.etapas || []).map(etapa => ({
    ...etapa,
    id: etapaIdMap.get(etapa.id),
    parentId: etapa.parentId ? (etapaIdMap.get(etapa.parentId) || "") : "",
  }));

  const itens = (orcOrigem.itens || []).map(item => ({
    ...item,
    id: gerarId(),
    etapaId: item.etapaId ? (etapaIdMap.get(item.etapaId) || "") : "",
    codigoNaoEncontrado: false,
  }));

  return { etapas, itens, etapaIdMap };
}

// Clona o plano (cronograma) de uma obra de origem, remapeando etapaId pelo
// `etapaIdMap` já produzido por clonarEstruturaOrcamento e deslocando todas
// as datas para que a tarefa mais antiga comece em `hoje`. Tarefas cujo
// etapaId não exista no mapa (etapa removida ou pertencente a outro
// orçamento) são descartadas - copiar uma etapa que não existe mais no
// destino não faz sentido.
export function clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje, gerarId }) {
  if (!planoOrigem) return { tarefas: [], marcos: [], deslocamentoDias: 0 };

  const tarefasOrigem = (planoOrigem.tarefas || []).filter(t => !t.etapaId || etapaIdMap.has(t.etapaId));
  const inicios = tarefasOrigem.map(t => t.inicio).filter(Boolean).sort();
  const menorInicio = inicios[0] || planoOrigem.inicio || hoje;
  const deslocamentoDias = diasEntreDatas(menorInicio, hoje);

  const tarefaIdMap = new Map();
  tarefasOrigem.forEach(t => tarefaIdMap.set(t.id, gerarId()));

  const tarefas = tarefasOrigem.map(t => ({
    ...t,
    id: tarefaIdMap.get(t.id),
    etapaId: t.etapaId ? (etapaIdMap.get(t.etapaId) || "") : "",
    inicio: somaDiasSimples(t.inicio, deslocamentoDias),
    fim: somaDiasSimples(t.fim, deslocamentoDias),
    depende: (t.depende || []).map(id => tarefaIdMap.get(id)).filter(Boolean),
  }));

  const marcos = (planoOrigem.marcos || []).map(m => ({
    ...m,
    id: gerarId(),
    data: somaDiasSimples(m.data, deslocamentoDias),
  }));

  return { tarefas, marcos, deslocamentoDias };
}
