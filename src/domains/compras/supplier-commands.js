export const SUPPLIER_COMMAND=Object.freeze({
  SUPPLIER_SAVED:"FORNECEDOR_SALVO",
});

export const SUPPLIER_COMMAND_TYPES=new Set(Object.values(SUPPLIER_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);

export const applySupplierCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!SUPPLIER_COMMAND_TYPES.has(command?.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para salvar o fornecedor.");
  const raw=command.payload?.supplier||{},id=String(raw.id||"");
  const name=String(raw.nome||"").trim();
  if(!id)return fail("Fornecedor sem identificação única.");
  if(!name)return fail("Informe o nome do fornecedor.");
  const suppliers=data.fornecedores||[];
  const current=suppliers.find(item=>String(item.id)===id);
  if(current&&versionOf(current)!==Number(command.expectedVersion))return fail("O fornecedor foi alterado por outra pessoa. Atualize a tela e tente novamente.");
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação do fornecedor exige versão inicial zero.");
  const cnpj=String(raw.cnpj||"").replace(/\D/g,"");
  if(cnpj&&suppliers.some(item=>String(item.id)!==id&&String(item.cnpj||"").replace(/\D/g,"")===cnpj))return fail("Já existe um fornecedor cadastrado com este CNPJ.");
  const saved={...current,...raw,id,nome:name,categorias:Array.isArray(raw.categorias)?raw.categorias:[],ativo:raw.ativo!==false,
    version:versionOf(current)+1,updatedAt:now,atualizadoEm:now,updatedById:String(command.actorId),updatedBy:String(command.actorName||"Usuário autenticado")};
  delete saved.ramosSugeridos;
  return {ok:true,entityId:id,data:{...data,fornecedores:current?suppliers.map(item=>String(item.id)===id?saved:item):[...suppliers,saved]}};
};

export const supplierCommandObraId=()=>"";
