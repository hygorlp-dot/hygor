// Verificação/reforço do CORE-001 (22/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2"): o mecanismo de
// observabilidade da sombra cadastral (core_registry_shadow_runs) já existe
// desde a migration 007, mas nunca foi consultado por nada - esta é a
// primeira leitura desse histórico. Lógica pura (sem I/O) para poder testar
// sem depender de rede; scripts/check-core-registry-shadow-status.mjs busca
// os dados e só chama isto.

export const CORE_REGISTRY_TABLES = Object.freeze({
  projects: "core_projects",
  employees: "core_employees",
  employeeAssignments: "core_employee_assignments",
  employeeIdentifiers: "core_employee_identifiers",
  suppliers: "core_suppliers",
  thirdPartyProfiles: "core_third_party_profiles",
  thirdPartyContracts: "core_third_party_contracts",
});

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

// `runs` já vem ordenado do mais novo para o mais velho (order by created_at
// desc); `liveCounts` é a contagem ATUAL de linhas ativas (archived_at is
// null) de cada tabela core_* - comparado contra o que a última
// sincronização registrou em `result`, já que o RPC sempre arquiva o que
// sumiu do snapshot, então os dois números deveriam bater exatamente
// (ver core_registry_sync_legacy, migrations/007).
export const summarizeCoreRegistryShadowStatus = ({ runs = [], liveCounts = {} } = {}) => {
  const warnings = [];
  if (!runs.length) {
    warnings.push(
      "Nenhuma sincronização encontrada em core_registry_shadow_runs - o gate de sombra " +
      "nunca rodou com sucesso nesta base (ou o ambiente ainda não é produção).",
    );
    return { hasRuns: false, lastRun: null, ageMs: null, warnings };
  }

  const [lastRun, previousRun] = runs;
  const lastResult = lastRun.result || {};
  const previousResult = previousRun?.result || {};

  Object.keys(CORE_REGISTRY_TABLES).forEach(section => {
    const lastCount = num(lastResult[section]);
    const liveCount = num(liveCounts[section]);
    if (lastCount !== liveCount) {
      warnings.push(
        `${section}: a última sincronização registrou ${lastCount}, mas ` +
        `${CORE_REGISTRY_TABLES[section]} tem ${liveCount} linha(s) ativa(s) agora - ` +
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

export const formatCoreRegistryShadowStatus = summary => {
  const lines = [];
  if (!summary?.hasRuns) {
    lines.push("CORE-001: SEM HISTÓRICO - nenhuma sincronização registrada.");
    (summary?.warnings || []).forEach(warning => lines.push(`  ! ${warning}`));
    return lines;
  }
  const { lastRun, ageMs, warnings } = summary;
  const result = lastRun.result || {};
  lines.push(`CORE-001: última sincronização ${formatAge(ageMs)} (${lastRun.created_at}, ator=${lastRun.actor_id}).`);
  Object.entries(CORE_REGISTRY_TABLES).forEach(([section, table]) => {
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
