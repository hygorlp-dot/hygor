const names={taxa:'Taxa administrativa',titulo:'Título de propriedade',certidao_propriedade:'Certidão de propriedade',matricula:'Matrícula do imóvel',contrato_compra:'Contrato de compra do imóvel',iptu:'Certidão de IPTU',art_projeto:'ART / RRT do projeto',art_execucao:'ART / RRT da execução',projeto:'Projeto arquitetônico',projeto_arquitetonico:'Projeto arquitetônico',prefeitura_aprovada:'Licença e projeto aprovados na Prefeitura'};
const registryKeys=new Set(['titulo','certidao_propriedade','matricula','escritura','registro_imovel','contrato_compra']);
export const LICENSING_AREAS={prefeitura:'Prefeitura',cartorio:'Cartório e imóvel',condominio:'Condomínio'};
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function licensingDocumentContext(license,key,item={},document={}) {
  const declared=normalized(document.area||item.area||document.orgao||item.orgao);
  let area=Object.hasOwn(LICENSING_AREAS,declared)?declared:'';
  if(!area&&registryKeys.has(key))area='cartorio';
  if(!area&&/cartorio|matricula|escritura|registro de imov/.test(normalized(`${key} ${document.nome||document.name||''}`)))area='cartorio';
  if(!area)area=license.tipo==='terras_alpha_caruaru'&&key!=='prefeitura_aprovada'?'condominio':'prefeitura';
  return {area,areaLabel:LICENSING_AREAS[area],stage:item.nome||names[key]||key.replaceAll('_',' '),stageId:key,stageStatus:item.status||'pendente',licenseId:license.id};
}
