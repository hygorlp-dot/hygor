// Painel "Suas obras hoje" (gestão à vista, 30/10/2026). Só leitura: junta, por
// obra ativa, dados que já existem nas fontes oficiais e classifica a situação.
// Fontes: orçado = orçamento APROVADO (rascunho nunca entra no custo × orçado);
// custo = soma dos DREs mensais desde o início até o último mês fechado (o mês
// corrente ainda rateia salário de dias que não chegaram); avanço = avancoFisicoOficial
// (mesma regra do DRE), com o cronograma só como alternativa identificada;
// etapas = cronograma do Planejamento; entrega = fim do contrato.
import { calculateBudget, getActiveBudgetBaseline, getPlanningBudget } from "../orcamentos/calculations.js";
import { montarTarefas, progressoPlano } from "../planejamento/legacy-engine.js";
import { avancoFisicoOficial } from "../dre/calculations.js";
import { remunerationModeOnDate } from "../rh/remuneration-mode.js";

// Regra aprovada pelo dono em 30/10/2026. Pontos percentuais e dias corridos.
export const SITUACAO_REGRA = Object.freeze({ criticoDesvio: 5, atencaoDesvio: 2, atencaoDiasEntrega: 30 });
export const SITUACOES = Object.freeze({ critico: "Crítico", atencao: "Atenção", ok: "Em dia" });

const ENCERRADAS = new Set(["done", "concluida", "concluido", "cancelada", "cancelado", "arquivada", "arquivado"]);
const dia = 86400000;
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / dia);
const ultimoDiaUtil = hoje => {
  const d = new Date(`${hoje}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
};
const umaCasa = valor => valor === null ? null : Math.round(valor * 10) / 10;
const statusDe = registro => (typeof registro === "string" ? registro : registro?.status) || "";

export function situacaoDaObra({ desvio, diasEntrega, pendenciasPonto }, regra = SITUACAO_REGRA) {
  if (desvio !== null && desvio > regra.criticoDesvio) return { situacao: "critico", motivo: `Custo ${fmtPontos(desvio)} à frente do avanço` };
  if (diasEntrega !== null && diasEntrega < 0) return { situacao: "critico", motivo: `Prazo vencido há ${-diasEntrega} dia(s)` };
  if (desvio !== null && desvio >= regra.atencaoDesvio) return { situacao: "atencao", motivo: `Custo ${fmtPontos(desvio)} à frente do avanço` };
  if (diasEntrega !== null && diasEntrega < regra.atencaoDiasEntrega) return { situacao: "atencao", motivo: `Entrega em ${diasEntrega} dia(s)` };
  if (pendenciasPonto > 0) return { situacao: "atencao", motivo: `${pendenciasPonto} pessoa(s) sem ponto no último dia útil` };
  return { situacao: "ok", motivo: "Sem pendências" };
}
const fmtPontos = valor => `${Math.round(valor).toLocaleString("pt-BR")} ponto${Math.round(valor) === 1 ? "" : "s"}`;

// O custo vai até o último mês fechado: no mês corrente o motor ainda rateia
// salário de dias que não chegaram (achado da revisão do DRE, 30/10/2026).
export const ultimoMesFechado = hoje => {
  const mesAtual = Number(hoje.slice(5, 7)) - 1;
  return { ano: Number(hoje.slice(0, 4)) - (mesAtual === 0 ? 1 : 0), mes: mesAtual === 0 ? 11 : mesAtual - 1 };
};

export function resumoGestaoAVista(data, { hoje, custoAcumulado, obraDoDia }) {
  const { ano, mes } = ultimoMesFechado(hoje);
  const ontemUtil = ultimoDiaUtil(hoje);
  const obras = (data.obras || []).filter(obra => obra?.id && !ENCERRADAS.has(String(obra.status || "").toLowerCase()));
  const linhas = obras.map(obra => {
    const aprovado = getActiveBudgetBaseline(data, obra.id, "controle").budget;
    const orcado = aprovado ? calculateBudget(aprovado).custoDireto : null;
    const acumulado = custoAcumulado(data, obra.id, ano, mes);
    const custo = acumulado ? acumulado.custo : null;
    const plano = (data.planos || []).find(item => item.obraId === obra.id) || null;
    const tarefas = plano ? montarTarefas(plano, getPlanningBudget(data, obra.id, plano).budget) : [];
    const medido = avancoFisicoOficial(data, obra.id);
    const cronograma = tarefas.length ? progressoPlano(tarefas) : null;
    const avanco = umaCasa(medido ?? cronograma);
    const gastoPct = umaCasa(orcado && custo !== null ? custo / orcado * 100 : null);
    const desvio = gastoPct !== null && avanco !== null ? umaCasa(gastoPct - avanco) : null;
    const atual = tarefas.find(tarefa => Number(tarefa.progresso || 0) < 100) || null;
    const totalDias = tarefas.reduce((soma, tarefa) => soma + Math.max(1, Number(tarefa.dias || 0)), 0);
    const etapas = tarefas.map(tarefa => ({
      id: tarefa.id, nome: tarefa.nome,
      estado: Number(tarefa.progresso || 0) >= 100 ? "feita" : tarefa === atual ? "atual" : "futura",
      peso: totalDias ? Math.max(1, Number(tarefa.dias || 0)) / totalDias * 100 : 0,
    }));
    const entrega = /^\d{4}-\d{2}-\d{2}$/.test(String(obra.contractEnd || "")) ? obra.contractEnd : null;
    const diasEntrega = entrega ? diasEntre(hoje, entrega) : null;
    const lotados = (data.employees || []).filter(emp => emp.active !== false && obraDoDia(emp, ontemUtil, null) === obra.id
      && remunerationModeOnDate(emp, ontemUtil) !== "mei" && (!emp.startDate || emp.startDate <= ontemUtil));
    const pendenciasPonto = lotados.filter(emp => !statusDe(data.attendance?.[emp.id]?.[ontemUtil])).length;
    const equipeHoje = (data.employees || []).filter(emp => {
      const registro = data.attendance?.[emp.id]?.[hoje];
      return ["P", "M"].includes(statusDe(registro)) && obraDoDia(emp, hoje, registro) === obra.id;
    }).length;
    return {
      id: obra.id, nome: obra.name || "Obra sem nome", orcado, custo, gastoPct, avanco,
      avancoFonte: medido !== null ? "medicao" : cronograma !== null ? "cronograma" : null,
      desvio, etapas, etapaAtual: atual?.nome || (tarefas.length ? "Cronograma concluído" : null),
      entrega, diasEntrega, equipeHoje, pendenciasPonto,
      ...situacaoDaObra({ desvio, diasEntrega, pendenciasPonto }),
    };
  });
  const ordem = { critico: 0, atencao: 1, ok: 2 };
  linhas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (b.desvio ?? -Infinity) - (a.desvio ?? -Infinity) || a.nome.localeCompare(b.nome, "pt-BR"));
  const contagem = { critico: 0, atencao: 0, ok: 0 };
  linhas.forEach(linha => { contagem[linha.situacao] += 1; });
  const custoAte = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  return { linhas, contagem, custoAte, equipeHoje: linhas.reduce((soma, linha) => soma + linha.equipeHoje, 0) };
}
