export const MODULE_FLOWS = {
  painel:{title:"Resultados e análise",steps:[
    ["home","Resumo","Identifique as prioridades da empresa."],
    ["dre_emp","DRE da empresa","Compare os meses e consulte as fontes do resultado."],
    ["dre","DRE das obras","Analise o resultado de cada obra por competência."],
    ["relat","Detalhamento","Consulte os relatórios e a origem dos valores."],
  ],tools:["tv","chat","aprov_pend"]},
  fin_grp:{title:"Controle financeiro",steps:[
    ["fin","Contas e pagamentos","Confira obrigações, vencimentos e recebimentos antes de registrar uma baixa."],
    ["medicoes","Medições e cobranças","Acompanhe o que foi medido, faturado e recebido."],
    ["caixa","Caixa da obra","Consulte aportes e saídas da obra, separados das receitas do DRE."],
    ["conc","Conciliação","Vincule movimentos reais aos registros existentes, inclusive parcialmente."],
  ]},
  eng_grp:{title:"Da previsão ao resultado da obra",steps:[
    ["obras","Selecionar obra","Abra a obra para consultar contexto, documentos e responsáveis."],
    ["projetos","Projetos","Gerencie entregas, revisões e horas de engenharia e arquitetura."],
    ["orc","Orçamento e memorial","Defina os serviços, quantitativos e vínculos da memória de cálculo."],
    ["plan","Planejamento","Organize prazos e recursos com base no orçamento."],
    ["rdo","Execução","Registre o trabalho realizado e os acontecimentos do dia."],
    ["med","Medições técnicas","Confira a execução antes de avançar para a medição financeira."],
    ["conferencia","Qualidade","Acompanhe inspeções e pendências de execução."],
  ],tools:["plan_suprimentos","licenca"]},
  compras_grp:{title:"Da necessidade à entrega",steps:[
    ["cmp","Fluxo de compras","Solicite, cote, aprove, acompanhe o pedido e confira a entrega."],
    ["est","Estoque e recebimentos","Confira os materiais efetivamente recebidos na obra."],
  ],tools:["suprimentos","fornecedores"]},
  equip_grp:{title:"Da disponibilidade à cobrança",steps:[
    ["equip_fin","Operação e cobrança","Consulte a disponibilidade, acompanhe os contratos e prepare a cobrança por obra."],
    ["equip","Frota e cadastro","Mantenha os equipamentos e as unidades físicas identificados."],
  ]},
  rh_grp:{title:"Do apontamento à conferência da folha",steps:[
    ["equipe","Equipe","Confira vínculos, funções e obras dos funcionários."],
    ["ponto_geral","Ponto","Verifique presenças, ausências, jornadas e feriados."],
    ["folha","Conferir folha","Confira a competência, a composição e as pendências antes de exportar."],
    ["terc","Terceirizados","Acompanhe contratos, medições e obrigações dos prestadores."],
  ],tools:["ponto","ponto_app","resc","rh_indic"]},
  com_grp:{title:"Do relacionamento ao contrato",steps:[
    ["com_workspace","Prioridades","Veja os próximos contatos e as negociações em andamento."],
    ["com_relationships","Relacionamentos","Organize clientes, contatos e oportunidades."],
    ["com_pipeline","Oportunidades","Acompanhe o avanço de cada negociação."],
    ["com_deals","Propostas e contratos","Prepare a proposta e acompanhe contratação e transferência para a obra."],
    ["com_management","Resultados","Consulte os indicadores comerciais."],
  ],tools:["com_real_estate"]},
  admin_grp:{title:"Cadastros e governança",steps:[
    ["cad","Cadastros compartilhados","Mantenha as referências utilizadas pelos módulos."],
    ["admin_central","Acessos e auditoria","Confira operadores, permissões, aprovações e alterações registradas."],
    ["config","Configurações","Ajuste os parâmetros gerais da empresa."],
  ],tools:["ia","ia_config","obsoletos"]},
};

export function visibleModuleFlow(moduleId,allowedTabs=[]){
  const flow=MODULE_FLOWS[moduleId];
  if(!flow)return null;
  const allowed=new Set(allowedTabs);
  return {...flow,steps:flow.steps.filter(([id])=>allowed.has(id)),tools:(flow.tools||[]).filter(id=>allowed.has(id))};
}

export function normalizeWorkflowScope(scope={},user={}){
  const year=scope.year==null||scope.year===""?NaN:Number(scope.year),month=scope.month==null||scope.month===""?NaN:Number(scope.month);
  return {
    obraId:String(user?.obraId||scope.obraId||""),
    ...(Number.isInteger(year)&&year>=2000&&year<=2100?{year}:{}),
    ...(Number.isInteger(month)&&month>=0&&month<=11?{month}:{}),
    period:["mes","q1","q2"].includes(scope.period)?scope.period:"mes",
  };
}

// Preserva zero e nulo de formas distintas: um relatório ainda indisponível
// nunca pode aparecer como valor financeiro confirmado igual a zero.
export function dreImpactMetrics(kind,current,workScoped=false){
  if(!current)return null;
  const value=key=>typeof current[key]==="number"?current[key]:null;
  if(kind==="purchases")return [{label:"Compras reconhecidas no DRE",value:value("comprasCost")}];
  if(kind==="payroll")return [
    {label:"Mão de obra no DRE",value:workScoped?current.moData?.laborCost??null:value("laborCost")},
    {label:"Benefícios no DRE",value:workScoped?current.moData?.benefitCost??null:value("benefitCost")},
  ];
  // Receitas externas e manutenção da frota são corporativas no motor atual.
  // A projeção por obra não contém esse recorte e não deve sugerir que contém.
  return workScoped?[{label:"Equipamentos apropriados à obra",value:value("equipCost")}]:[
    {label:"Receita de locações no DRE",value:value("equipReceita")},
    {label:"Repasses a terceiros",value:value("equipRepasseTerceiros")},
    {label:"Manutenção da frota",value:value("equipManutencao")},
  ];
}
