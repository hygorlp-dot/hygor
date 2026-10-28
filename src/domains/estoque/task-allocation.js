// Aplicação do material (Onda 3.2 do roadmap de correção): todo consumo de
// estoque diz em qual tarefa do cronograma o material foi usado. É isso que
// permite "comprei 120 sacos de cimento para o reboco, o orçamento previa 95".
//
// Decisão do dono (28/10/2026): obrigatório. Exceção: obra sem cronograma
// (sem tarefas) não fica impedida de dar baixa - não há tarefa a escolher.
const DIA_MS = 86_400_000;

export const CONSUMO_TIPOS_COM_TAREFA = Object.freeze(["consumo"]);

export const tarefasDaObra = (data = {}, obraId = "") =>
  ((data.planos || []).find(plano => String(plano?.obraId) === String(obraId))?.tarefas || [])
    .filter(tarefa => tarefa && !tarefa.titulo && tarefa.id);

export const exigeTarefaNoConsumo = (data = {}, obraId = "") => tarefasDaObra(data, obraId).length > 0;

// Lista curta para o campo: primeiro as tarefas em andamento na semana da
// data do consumo (período cobre a data ± 7 dias, ou avanço entre 0 e 100%),
// depois as demais não concluídas. Concluídas ficam de fora.
export const tarefasParaConsumo = (data = {}, obraId = "", dataRef = "") => {
  const ref = Date.parse(`${dataRef || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  const ativa = tarefa => {
    const progresso = Number(tarefa.progresso || 0);
    if (progresso > 0 && progresso < 100) return true;
    const ini = Date.parse(`${tarefa.inicio}T00:00:00Z`), fim = Date.parse(`${tarefa.fim}T23:59:59Z`);
    return Number.isFinite(ini) && Number.isFinite(fim) && ini <= ref + 7 * DIA_MS && fim >= ref - 7 * DIA_MS;
  };
  const abertas = tarefasDaObra(data, obraId).filter(tarefa => Number(tarefa.progresso || 0) < 100);
  const ordenar = lista => [...lista].sort((a, b) => String(a.inicio || "").localeCompare(String(b.inicio || "")));
  return [
    ...ordenar(abertas.filter(ativa)).map(tarefa => ({ ...tarefa, emAndamento:true })),
    ...ordenar(abertas.filter(tarefa => !ativa(tarefa))).map(tarefa => ({ ...tarefa, emAndamento:false })),
  ];
};

// Validação e carimbo do consumo (servidor e tela usam a mesma regra).
export const resolverTarefaDoConsumo = (data = {}, { obraId = "", tipo = "", tarefaId = "" } = {}) => {
  if (!CONSUMO_TIPOS_COM_TAREFA.includes(tipo)) return { ok:true, campos:{} };
  if (!exigeTarefaNoConsumo(data, obraId)) return { ok:true, campos:{} };
  const tarefa = tarefasDaObra(data, obraId).find(item => String(item.id) === String(tarefaId || ""));
  if (!tarefa) return { ok:false, reason:"Informe em qual tarefa do cronograma o material foi usado." };
  return { ok:true, campos:{ tarefaId:String(tarefa.id), tarefaNome:String(tarefa.nome || ""), etapaId:String(tarefa.etapaId || "") } };
};
