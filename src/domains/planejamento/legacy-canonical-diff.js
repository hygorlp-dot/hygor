// Fase 1 da Onda 2 do raio-X (26/08/2026): compara, em memória, a saída do
// motor de CPM LEGADO (caminhoCritico, em src/LegacyApp.jsx) com a do motor
// CANÔNICO (calculateCPM, ./calculations.js) para a MESMA obra - sem gravar
// nada em disco, sem gate de build, sem tabela nova no banco. É o
// equivalente client-side, e propositalmente mais barato, do mecanismo de
// sombra usado nas migrações CORE-00X (que rodam no servidor e persistem
// divergência em `core_registry_shadow_runs`).
//
// Formalizar um rastro persistente e auditável em produção (o próximo passo
// natural, mais parecido com o CORE-00X) exige decidir ONDE gravar isso -
// uma tabela nova, ou um caminho de escrita client->servidor que hoje não
// existe - e por isso não foi feito aqui sem confirmar o escopo com o
// responsável pelo produto.
const round = value => Math.round(Number(value || 0) * 100) / 100;

export const compareCpmResults = (legacy = {}, canonical = {}) => {
  const divergencias = [];

  const duracaoLegado = Number(legacy.fimProjeto || 0);
  const duracaoCanonica = Number(canonical.projectDuration || 0);
  if (duracaoLegado !== duracaoCanonica) {
    divergencias.push({ campo: "duracaoProjeto", legado: duracaoLegado, canonico: duracaoCanonica });
  }

  const criticasLegado = new Set((legacy.criticas || []).map(String));
  const criticasCanonico = new Set((canonical.criticalPath || []).map(String));
  const somenteNoLegado = [...criticasLegado].filter(id => !criticasCanonico.has(id)).sort();
  const somenteNoCanonico = [...criticasCanonico].filter(id => !criticasLegado.has(id)).sort();
  if (somenteNoLegado.length || somenteNoCanonico.length) {
    divergencias.push({ campo: "caminhoCritico", somenteNoLegado, somenteNoCanonico });
  }

  const folgasCanonico = new Map((canonical.activities || []).map(item => [String(item.id), Number(item.totalFloat || 0)]));
  const folgasDivergentes = Object.entries(legacy.folgas || {})
    .filter(([id, folga]) => folgasCanonico.has(id) && Math.abs(round(folga) - round(folgasCanonico.get(id))) > 0.01)
    .map(([id, folga]) => ({ id, legado: round(folga), canonico: round(folgasCanonico.get(id)) }));
  if (folgasDivergentes.length) {
    divergencias.push({ campo: "folgas", itens: folgasDivergentes });
  }

  return { divergente: divergencias.length > 0, divergencias };
};
