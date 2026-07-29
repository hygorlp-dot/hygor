// Seções cuja persistência por snapshot pertence ao legado financeiro.
// FIN-003 só permite mutá-las por comandos transacionais do motor.
export const FINANCIAL_LEGACY_SECTIONS=new Set([
  "payments","medicoes","outrasDesp","despesasEmpresa","caixaObra","transacoes",
  "notasFiscais","pedidos","pagsTerceiros","medicoesTerc","pagamentosFolha",
  "titulosFolha","reconciliationLinks","rescisoes",
  "attendance","employees","archivedLaborCosts","config","obras",
  "equipamentos","locacoesEquip","manutencoesEquip",
]);

// O ponto é um fato operacional que alimenta o razão, não um lançamento
// financeiro criado pelo operador. Ele precisa continuar sincronizando a
// projeção canônica, mas não pode ser bloqueado pelo gate que proíbe pagamentos
// e títulos legados. A auditoria e a transação do save-sections permanecem.
export const FINANCIAL_OPERATIONAL_SOURCE_SECTIONS=new Set(["attendance"]);

// Seções que ainda possuem ao menos um escritor por snapshot no aplicativo.
// Enquanto qualquer uma delas continuar sujeita ao bloqueio do FIN-003, ligar
// o enforcement derruba um módulo funcional. A lista é deliberadamente
// explícita para funcionar como checklist de migração e gate de deploy.
//
// reconciliationLinks, archivedLaborCosts, payments, medicoes, outrasDesp,
// despesasEmpresa, transacoes, pagsTerceiros, medicoesTerc, notasFiscais,
// pedidos, rescisoes, pagamentosFolha, titulosFolha, attendance e employees
// continuam protegidas como seções financeiras legadas,
// mas não pertencem mais a este checklist:
// seus escritores foram migrados para comandos servidores idempotentes.
export const FINANCIAL_SNAPSHOT_WRITER_SECTIONS=new Set([
  "config","obras",
]);

export const FINANCIAL_MODULE_SECTION_MATRIX=Object.freeze({
  obras_configuracoes:["obras","config"],
});

export const hasLegacyFinancialWrite=sections=>Object.keys(sections||{})
  .some(section=>FINANCIAL_LEGACY_SECTIONS.has(section));

// Em sombra, o blob legado continua sendo a fonte oficial e não pode ficar
// indisponível por lentidão/concorrência na reconstrução do razão. A gravação
// auditável é confirmada primeiro; a sincronização canônica continua sendo
// homologada pelas rotinas explícitas. Quando o enforcement for ativado, a
// persistência volta obrigatoriamente à transação conjunta.
export const financialPersistenceMode=engineEnforced=>
  engineEnforced?"transactional_ledger":"audited_shadow";

export const hasBlockedLegacyFinancialWrite=sections=>Object.keys(sections||{})
  .some(section=>
    FINANCIAL_LEGACY_SECTIONS.has(section)
    && !FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section)
  );

export const validateFinancialWritePath=({engineEnforced=false,sections={}}={})=>{
  if(!engineEnforced||!hasBlockedLegacyFinancialWrite(sections))return {ok:true};
  return {
    ok:false,
    error:"FIN-003 está ativo: alterações financeiras devem usar o comando transacional do razão, não o salvamento legado.",
  };
};

export const financialEnforcementReadiness=()=>{
  const pending=[...FINANCIAL_SNAPSHOT_WRITER_SECTIONS]
    .filter(section=>
      FINANCIAL_LEGACY_SECTIONS.has(section)
      && !FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section)
    )
    .sort();
  const modules=Object.fromEntries(Object.entries(FINANCIAL_MODULE_SECTION_MATRIX)
    .map(([module,sections])=>[module,sections.filter(section=>pending.includes(section))])
    .filter(([,sections])=>sections.length));
  return {ready:pending.length===0,pending,modules};
};
