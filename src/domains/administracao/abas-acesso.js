// Abas de acesso por perfil: fonte única para a tela (menu, atalhos) e para
// o servidor (api/data.js), que confere a aba antes de devolver dado
// sensível. Esconder o menu no navegador não basta: a API é chamável direto.

export const ROLE_TABS = {
  admin:       ["home","tv","chat","aprov_pend","admin_central","obras","orc","plan","plan_suprimentos","rdo","conferencia","med","est","cmp","fornecedores","suprimentos","ponto","ponto_geral","ponto_app","equipe","terc","equip","equip_fin","patrimonio","licenca","folha","resc","rh_indic","dre_emp","dre","fin","conc","medicoes","caixa","relat","ia","ia_config","obsoletos","cad","config","com_dash","com_indicacoes","com_leads","com_funil","com_jornada","com_agenda","com_reunioes","com_tarefas","com_propostas","com_negociacoes","com_contratos","com_clientes","com_parceiros","com_metas","com_perdas","com_relatorios","com_workspace","com_real_estate","com_pipeline","com_relationships","com_deals","com_management"],
  engenheiro:  ["home","tv","obras","orc","plan","plan_suprimentos","rdo","conferencia","med","est","cmp","fornecedores","suprimentos","ponto","ponto_app","equipe","terc","equip","licenca","caixa","obsoletos","cad","ia"],
  engenheiro_auditor:["home","tv","obras","orc","plan","plan_suprimentos","rdo","conferencia","med","est","cmp","fornecedores","suprimentos","equipe","terc","equip","licenca","caixa","obsoletos","cad","ia"],
  compras:     ["home","tv","cmp","fornecedores","suprimentos","plan_suprimentos","est","patrimonio","cad","ia"],
  rh:          ["home","tv","ponto","ponto_geral","ponto_app","equipe","terc","folha","resc","rh_indic","conc","cad","ia"],
  financeiro:  ["home","tv","equip_fin","patrimonio","plan","cmp","fornecedores","dre_emp","dre","fin","conc","medicoes","caixa","relat","ia"],
  comercial:   ["home","tv","com_workspace","com_real_estate","com_pipeline","com_relationships","com_deals","com_management","com_funil","com_leads","com_propostas","com_negociacoes","com_agenda","com_parceiros","com_metas","com_relatorios","ia"],
  visualizador:["home","tv"],
};

export const allowedTabsForUser=user=>{
  if(!user||user.role==="admin")return ROLE_TABS.admin;
  const custom=Array.isArray(user.accessTabs)?user.accessTabs:null;
  const base=custom??(ROLE_TABS[user.role]||["home"]);
  const valid=new Set(ROLE_TABS.admin);
  // Dashboard e Modo TV são visões institucionais somente leitura; continuam
  // disponíveis mesmo em cadastros antigos cuja lista personalizada de abas
  // foi criada antes da existência do painel corporativo.
  const herdadas=user.role==="financeiro"?["equip_fin","patrimonio"]:user.role==="compras"?["patrimonio"]:user.role==="engenheiro"?["ponto"]:user.role==="rh"?["terc","conc"]:[];
  return [...new Set(["home","tv","chat","aprov_pend",...base,...herdadas])]
    .filter(tab=>valid.has(tab)&&tab!=="config")
    .filter(tab=>!(user.obraId&&tab==="patrimonio"))
    .filter(tab=>user.role!=="engenheiro_auditor"||!["ponto","ponto_geral"].includes(tab));
};

// Sem usuário, nada: allowedTabsForUser(null) devolve as abas do admin porque
// a tela de login ainda não tem perfil; no servidor isso seria uma porta aberta.
export const podeAcessarAba=(user,tab)=>!!user&&allowedTabsForUser(user).includes(tab);
