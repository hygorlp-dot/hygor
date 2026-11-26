// @ts-check

// Resumo da medicao para o cabecalho: quantas tarefas medidas pelo diario,
// avanco fisico geral e dias trabalhados somados.
/**
 * @param {ReadonlyArray<{titulo?: unknown, origemProgresso?: string, diasTrabalhados?: number, custo?: number, progresso?: number}> | null | undefined} tarefasFundidas
 */
export const resumoMedicao = (tarefasFundidas) => {
  const t = (tarefasFundidas || []).filter(x => !x.titulo);
  const peloDiario = t.filter(x => x.origemProgresso === "diario").length;
  const diasTotais = t.reduce((s, x) => s + (x.diasTrabalhados || 0), 0);
  const custoTotal = t.reduce((s, x) => s + (x.custo || 0), 0);
  const avancoFisico = custoTotal
    ? t.reduce((s, x) => s + (x.custo || 0) * (x.progresso || 0), 0) / custoTotal
    : 0;
  return { total: t.length, peloDiario, diasTotais, avancoFisico,temBaseValor:custoTotal>0 };
};
