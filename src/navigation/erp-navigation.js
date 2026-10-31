// Organização de apresentação. Autorizações continuam exclusivamente nas
// abas de acesso e nas políticas da API; pertencer a um módulo não dá acesso.
export const ERP_MODULES = [
  {id:"painel",label:"Visão gerencial",shortLabel:"Gestão",icon:"chart",colorKey:"yellow",
    description:"Resultados, DREs e indicadores da empresa e das obras.",
    tabs:["home","dre_emp","dre","relat","tv","chat","aprov_pend"]},
  {id:"fin_grp",label:"Financeiro",shortLabel:"Financeiro",icon:"dollar",colorKey:"purple",
    description:"Obrigações, recebimentos, cobranças, caixa e conciliação.",
    tabs:["fin","medicoes","caixa","conc"]},
  {id:"eng_grp",label:"Obras e projetos",shortLabel:"Obras",icon:"building",colorKey:"blue",
    description:"Orçamento, execução, planejamento, medições técnicas e qualidade.",
    tabs:["obras","projetos","orc","plan","plan_suprimentos","rdo","med","conferencia","licenca"]},
  {id:"compras_grp",label:"Compras e suprimentos",shortLabel:"Compras",icon:"cart",colorKey:"orange",
    description:"Solicitações, cotações, pedidos, recebimentos, estoque e fornecedores.",
    tabs:["cmp","suprimentos","est","fornecedores"]},
  {id:"equip_grp",label:"Equipamentos e locações",shortLabel:"Locações",icon:"wrench",colorKey:"orange",
    description:"Frota, disponibilidade, contratos, manutenção e cobrança de locações.",
    tabs:["equip_fin","equip"]},
  {id:"rh_grp",label:"Pessoas e terceiros",shortLabel:"Pessoas",icon:"users",colorKey:"green",
    description:"Equipes, ponto, folha, rescisões e contratos de terceirizados.",
    tabs:["equipe","equipe_obras","ponto","ponto_geral","ponto_app","folha","resc","terc","rh_indic"]},
  {id:"com_grp",label:"Comercial",shortLabel:"Comercial",icon:"users",colorKey:"green",
    description:"Relacionamentos, oportunidades, propostas e contratos.",
    tabs:["com_workspace","com_real_estate","com_pipeline","com_relationships","com_deals","com_management"],
    aliases:["com_dash","com_indicacoes","com_leads","com_funil","com_jornada","com_agenda","com_reunioes","com_tarefas","com_propostas","com_negociacoes","com_contratos","com_clientes","com_parceiros","com_metas","com_perdas","com_relatorios"]},
  {id:"admin_grp",label:"Administração",shortLabel:"Admin.",icon:"settings",colorKey:"muted",
    description:"Cadastros compartilhados, acessos, auditoria, configurações e ferramentas.",
    tabs:["admin_central","patrimonio","cad","config","ia","ia_config","obsoletos"]},
];

export const moduleForTab = tabId => ERP_MODULES.find(group=>[...group.tabs,...(group.aliases||[])].includes(tabId));

export function visibleErpModules(allowedTabs=[],colors={}) {
  const allowed=new Set(allowedTabs);
  return ERP_MODULES.map(group=>{
    const tabs=group.tabs.filter(tab=>allowed.has(tab));
    // Cadastros antigos podem autorizar somente uma tela comercial legada.
    // Mantém essa entrada acessível, sem conceder a tela nova do mesmo módulo.
    if(!tabs.length)tabs.push(...(group.aliases||[]).filter(tab=>allowed.has(tab)));
    return {...group,tabs,color:colors[group.colorKey]};
  }).filter(group=>group.tabs.length);
}

export const activeErpModule = (groups,tabId) =>
  groups.find(group=>group.id===moduleForTab(tabId)?.id)||groups[0];
