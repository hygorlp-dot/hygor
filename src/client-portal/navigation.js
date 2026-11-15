export const PORTAL_PAGES = Object.freeze([
  {id:"home",path:"home",label:"Início",help:"cliente_inicio"},
  {id:"photos",path:"diario",label:"Diário da obra",help:"cliente_fotos",capabilities:["viewMedia","viewWeeklyUpdates"]},
  {id:"progress",path:"progresso",label:"Avanço físico",help:"cliente_progresso",capabilities:["viewProgress","viewWeeklyUpdates"]},
  {id:"costs",path:"gastos",label:"Gastos por categoria",help:"cliente_gastos",capabilities:["viewCosts"]},
  {id:"cash",path:"caixa",label:"Caixa da obra",help:"cliente_caixa",capabilities:["viewProjectCash"]},
  {id:"budget",path:"orcamento",label:"Previsto e realizado",help:"cliente_orcamento",capabilities:["viewStageBudget"]},
  {id:"purchases",path:"compras",label:"Compras e notas fiscais",help:"cliente_compras",capabilities:["viewProcurement"]},
  {id:"administration",path:"administracao-equipe",label:"Administração e equipe",help:"cliente_administracao_equipe",capabilities:["viewAdministrationTeam"]},
  {id:"decisions",path:"decisoes",label:"Decisões",help:"cliente_decisoes",capabilities:["viewDecisions","viewChanges"]},
  {id:"financial",path:"financeiro",label:"Financeiro",help:"cliente_financeiro",capabilities:["viewFinancial"]},
  {id:"documents",path:"documentos",label:"Documentos",help:"cliente_documentos",capabilities:["downloadDocuments"]},
  {id:"transparency",path:"transparencia",label:"Caixa e suprimentos",help:"cliente_transparencia",capabilities:["viewProjectCash","viewProcurement"]},
  {id:"account",path:"conta",label:"Minha conta",help:"cliente_conta"},
]);
export const canOpenPortalPage = (page,permissions={}) => Boolean(page && (!page.capabilities || page.capabilities.some(capability=>permissions[capability]===true)));
