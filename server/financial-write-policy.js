// Seções cuja persistência por snapshot pertence ao legado financeiro.
// FIN-003 só permite mutá-las por comandos transacionais do motor.
export const FINANCIAL_LEGACY_SECTIONS=new Set([
  "payments","medicoes","outrasDesp","despesasEmpresa","caixaObra","transacoes",
  "notasFiscais","pedidos","pagsTerceiros","medicoesTerc","pagamentosFolha",
  "titulosFolha","reconciliationLinks","rescisoes","comercial",
  "attendance","employees","archivedLaborCosts","config","obras",
  "equipamentos","locacoesEquip","manutencoesEquip",
]);

export const hasLegacyFinancialWrite=sections=>Object.keys(sections||{})
  .some(section=>FINANCIAL_LEGACY_SECTIONS.has(section));

export const validateFinancialWritePath=({engineEnforced=false,sections={}}={})=>{
  if(!engineEnforced||!hasLegacyFinancialWrite(sections))return {ok:true};
  return {
    ok:false,
    error:"FIN-003 está ativo: alterações financeiras devem usar o comando transacional do razão, não o salvamento legado.",
  };
};
