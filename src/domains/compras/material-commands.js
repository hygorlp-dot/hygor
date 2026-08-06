export const MATERIAL_COMMAND=Object.freeze({MATERIAL_SAVED:"INSUMO_CATALOGO_SALVO"});
export const MATERIAL_COMMAND_TYPES=new Set(Object.values(MATERIAL_COMMAND));
const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);

export const applyMaterialCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!MATERIAL_COMMAND_TYPES.has(command?.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para salvar o insumo.");
  const raw=command.payload?.material||{},id=String(raw.id||""),description=String(raw.descricao||"").trim();
  if(!id)return fail("Insumo sem identificação única.");
  if(!description)return fail("Descreva o insumo.");
  const materials=data.materiais||[],current=materials.find(item=>String(item.id)===id);
  if(current&&versionOf(current)!==Number(command.expectedVersion))return fail("O insumo foi alterado por outra pessoa. Atualize a tela e tente novamente.");
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação do insumo exige versão inicial zero.");
  const code=String(raw.codigo||"").trim();
  if(code&&materials.some(item=>String(item.id)!==id&&String(item.codigo||"").trim().toUpperCase()===code.toUpperCase()))return fail("Já existe um insumo com este código.");
  const price=Number(raw.precoMedio||0),minimum=Number(raw.estoqueMin||0);
  if(!Number.isFinite(price)||price<0||!Number.isFinite(minimum)||minimum<0)return fail("Preço médio e estoque mínimo precisam ser valores positivos.");
  const saved={...current,...raw,id,descricao:description,unidade:String(raw.unidade||"un"),categoria:String(raw.categoria||"outros"),precoMedio:price,estoqueMin:minimum,ativo:raw.ativo!==false,
    version:versionOf(current)+1,atualizadoEm:now,atualizadoPorId:String(command.actorId),atualizadoPor:String(command.actorName||"Usuário autenticado")};
  return {ok:true,entityId:id,data:{...data,materiais:current?materials.map(item=>String(item.id)===id?saved:item):[...materials,saved]}};
};
export const materialCommandObraId=()=>"";
