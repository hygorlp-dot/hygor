// These are navigation identities, not persisted business statuses.
export function workNavigationGroups(admin=false) {
  return [
    {id:'geral',label:'Geral',itens:[['geral','Visão geral',null]]},
    {id:'obra',label:'Obra',itens:[['orc','Orçamento','orc'],['plan','Planejamento','plan'],['rdo','Diário de obra','rdo'],['med','Medição física','med'],['seguranca','Segurança',null]]},
    {id:'qualidade',label:'Gestão da qualidade',itens:[['qualidade','FVS / FVM',null],['conferencia','Conferência','conferencia']]},
    {id:'suprimentos',label:'Suprimentos',itens:[['cmp','Compras','cmp'],['est','Estoque','est']]},
    {id:'financeiro',label:'Financeiro',itens:[['dre','DRE da obra','dre']]},
    {id:'rh',label:'RH',itens:[['ponto','Ponto','ponto'],['equipe','Equipe','equipe'],['terc','Terceiros','terc']]},
    {id:'recursos',label:'Recursos',itens:[['equip','Equipamentos','equip'],['licenca','Licenciamento','licenca'],['arquivos','Pastas do OneDrive',null],...(admin?[['portal','Portal do cliente',null]]:[])]},
  ];
}
export function workNavigationTarget(id,admin=false) {
  if(id==='medicoes')return {id,global:true,label:'Medições a faturar'};
  for(const group of workNavigationGroups(admin)) {
    const item=group.itens.find(item=>item[0]===id);
    if(item)return {id:item[0],label:item[1],group:group.id,global:false};
  }
  return null;
}
