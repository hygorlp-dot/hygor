// Verificação/reforço do CORE-003 (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2"): mesmo padrão de
// server/equipment-registry-shadow-status.js, adaptado para
// procurement_registry_shadow_runs (migration 014). Lógica pura (sem I/O)
// para poder testar sem depender de rede;
// scripts/check-procurement-registry-shadow-status.mjs busca os dados e só
// chama isto.

export const PROCUREMENT_REGISTRY_TABLES = Object.freeze({
  quotations: "core_quotations",
  purchaseOrders: "core_purchase_orders",
});

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

// `runs` já vem ordenado do mais novo para o mais velho (order by created_at
// desc); `liveCounts` é a contagem ATUAL de linhas ativas (archived_at is
// null) de cada tabela core_* - comparado contra o que a última
// sincronização registrou em `result`.
export const summarizeProcurementRegistryShadowStatus = ({ runs = [], liveCounts = {} } = {}) => {
  const warnings = [];
  if (!runs.length) {
    warnings.push(
      "Nenhuma sincronização encontrada em procurement_registry_shadow_runs - o gate de sombra " +
      "nunca rodou com sucesso nesta base (ou o ambiente ainda não é produção).",
    );
    return { hasRuns: false, lastRun: null, ageMs: null, warnings };
  }

  const [lastRun, previousRun] = runs;
  const lastResult = lastRun.result || {};
  const previousResult = previousRun?.result || {};

  Object.keys(PROCUREMENT_REGISTRY_TABLES).forEach(section => {
    const lastCount = num(lastResult[section]);
    const liveCount = num(liveCounts[section]);
    if (lastCount !== liveCount) {
      warnings.push(
        `${section}: a última sincronização registrou ${lastCount}, mas ` +
        `${PROCUREMENT_REGISTRY_TABLES[section]} tem ${liveCount} linha(s) ativa(s) agora - ` +
        "pode indicar uma sincronização mais recente que não passou pelo RPC, ou uma corrida.",
      );
    }
    const previousCount = num(previousResult[section]);
    if (previousRun && previousCount > 0 && lastCount === 0) {
      warnings.push(
        `${section}: caiu de ${previousCount} para 0 registro(s) entre as duas últimas ` +
        "sincronizações - confirme se não é perda de dado real antes de ignorar.",
      );
    }
  });

  const ageMs = Date.now() - new Date(lastRun.created_at).getTime();
  return { hasRuns: true, lastRun, ageMs, warnings };
};

const formatAge = ageMs => {
  if (ageMs == null || Number.isNaN(ageMs)) return "idade desconhecida";
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 1) return "menos de 1 hora atrás";
  if (hours < 48) return `${Math.round(hours)}h atrás`;
  return `${Math.round(hours / 24)} dia(s) atrás`;
};

export const formatProcurementRegistryShadowStatus = summary => {
  const lines = [];
  if (!summary?.hasRuns) {
    lines.push("CORE-003: SEM HISTÓRICO - nenhuma sincronização registrada.");
    (summary?.warnings || []).forEach(warning => lines.push(`  ! ${warning}`));
    return lines;
  }
  const { lastRun, ageMs, warnings } = summary;
  const result = lastRun.result || {};
  lines.push(`CORE-003: última sincronização ${formatAge(ageMs)} (${lastRun.created_at}, ator=${lastRun.actor_id}).`);
  Object.entries(PROCUREMENT_REGISTRY_TABLES).forEach(([section, table]) => {
    lines.push(`  ${table}: ${num(result[section])} registro(s) na última sincronização.`);
  });
  if (!warnings.length) {
    lines.push("  0 divergência(s) detectada(s) - contagens batem com o estado atual das tabelas.");
  } else {
    lines.push(`  ${warnings.length} alerta(s):`);
    warnings.forEach(warning => lines.push(`  ! ${warning}`));
  }
  return lines;
};
