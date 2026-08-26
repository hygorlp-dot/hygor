export const WORKER_ELIGIBILITY=Object.freeze({FIT:"apto",RESTRICTED:"apto_restricao",DOCUMENTATION_PENDING:"documentacao_pendente",TRAINING_EXPIRED:"treinamento_vencido",EXAM_EXPIRED:"exame_vencido",BLOCKED:"bloqueado"});
// Catálogo de treinamentos (NRs) mais comuns em obras. As chaves aqui são as
// mesmas que `evaluateWorkerEligibility` espera em `worker.trainings[key]`
// (ver calculations.js) e que uma futura tela de "atividade exige X" em
// Planejamento/Segurança usaria para preencher `activity.requiredTrainings`.
export const WORKER_TRAINING_TYPES=Object.freeze([
  {key:"nr35",label:"NR-35 · Trabalho em altura"},
  {key:"nr18",label:"NR-18 · Condições de segurança na construção"},
  {key:"nr06",label:"NR-06 · Uso de EPI"},
  {key:"nr10",label:"NR-10 · Segurança em instalações elétricas"},
  {key:"nr33",label:"NR-33 · Espaços confinados"},
]);
