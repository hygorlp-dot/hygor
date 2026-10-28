const list=(data,key)=>Array.isArray(data?.[key])?data[key]:[];
const text=(value,max=500)=>String(value??"").trim().slice(0,max);
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const normalizeKey=value=>String(value||"").replace(/\D/g,"");
const normalizeIdentity=value=>String(value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const versionOf=value=>Number(value?.version||0);
const nextAssetTag=assets=>{
  const max=(assets||[]).reduce((current,item)=>{
    const match=String(item?.assetTag||"").match(/^PAT-(\d{1,12})$/i);
    return match?Math.max(current,Number(match[1])||0):current;
  },0);
  return `PAT-${String(max+1).padStart(6,"0")}`;
};
const validDate=value=>!value||/^\d{4}-\d{2}-\d{2}$/.test(String(value));
const fail=reason=>({ok:false,reason});

export const PATRIMONY_COMMAND=Object.freeze({
  ASSET_SAVED:"PATRIMONIO_EMPRESA_SALVO",
  ASSETS_IMPORTED:"PATRIMONIO_EMPRESA_IMPORTADO_NF",
  ASSET_MOVED:"PATRIMONIO_EMPRESA_MOVIMENTADO",
  ASSET_STATUS_CHANGED:"PATRIMONIO_EMPRESA_STATUS_ALTERADO",
});

export const PATRIMONY_COMMAND_TYPES=new Set(Object.values(PATRIMONY_COMMAND));

export const COMPANY_ASSET_STATUS=Object.freeze({
  ACTIVE:"ativo",
  IN_USE:"em_uso",
  MAINTENANCE:"manutencao",
  LOST:"extraviado",
  DISPOSED:"baixado",
});
const STATUSES=new Set(Object.values(COMPANY_ASSET_STATUS));

export const COMPANY_ASSET_LOCATION_TYPES=Object.freeze({
  COMPANY:"empresa",
  WAREHOUSE:"almoxarifado",
  WORK:"obra",
  EMPLOYEE:"funcionario",
  THIRD_PARTY:"terceiro",
  OTHER:"outro",
});
const LOCATION_TYPES=new Set(Object.values(COMPANY_ASSET_LOCATION_TYPES));

const normalizeDocument=doc=>({
  name:text(doc?.name||doc?.nome,180),
  url:text(doc?.url,2000),
  path:text(doc?.path,600),
  mime:text(doc?.mime||doc?.tipo,120),
  size:Math.max(0,number(doc?.size||doc?.tamanho)),
});

const normalizeInvoice=invoice=>({
  number:text(invoice?.number||invoice?.numero,40),
  series:text(invoice?.series||invoice?.serie,20),
  accessKey:normalizeKey(invoice?.accessKey||invoice?.chave).slice(0,44),
  issueDate:text(invoice?.issueDate||invoice?.emissao,10),
  supplierName:text(invoice?.supplierName||invoice?.fornecedorNome,200),
  supplierDocument:normalizeKey(invoice?.supplierDocument||invoice?.documentoFornecedor).slice(0,14),
  totalValue:Math.max(0,number(invoice?.totalValue||invoice?.valorBruto)),
  itemNumber:Math.max(0,Math.trunc(number(invoice?.itemNumber||invoice?.nItem))),
  unitIndex:Math.max(1,Math.trunc(number(invoice?.unitIndex)||1)),
  sourceQuantity:Math.max(0,number(invoice?.sourceQuantity||invoice?.quantidade)),
  supplierId:text(invoice?.supplierId,120),
  itemDescription:text(invoice?.itemDescription||invoice?.descricaoItem,500),
  itemValue:Math.max(0,number(invoice?.itemValue||invoice?.valorItem)),
  source:["xml","ai","manual"].includes(String(invoice?.source))?String(invoice.source):"manual",
  confidence:Math.max(0,Math.min(1,number(invoice?.confidence))),
  document:normalizeDocument(invoice?.document),
});

export const normalizeCompanyAsset=asset=>({
  id:text(asset?.id,120),
  assetTag:text(asset?.assetTag||asset?.patrimonio,80).toUpperCase(),
  name:text(asset?.name||asset?.nome,200),
  category:text(asset?.category||asset?.categoria,120),
  description:text(asset?.description||asset?.descricao,1000),
  manufacturer:text(asset?.manufacturer||asset?.fabricante,120),
  model:text(asset?.model||asset?.modelo,120),
  serialNumber:text(asset?.serialNumber||asset?.numeroSerie,120),
  imei:text(asset?.imei,40),
  plate:text(asset?.plate||asset?.placa,20).toUpperCase(),
  acquisitionValue:Math.max(0,number(asset?.acquisitionValue||asset?.valorAquisicao)),
  acquisitionDate:text(asset?.acquisitionDate||asset?.dataAquisicao,10),
  status:STATUSES.has(String(asset?.status))?String(asset.status):COMPANY_ASSET_STATUS.ACTIVE,
  location:{
    type:LOCATION_TYPES.has(String(asset?.location?.type))?String(asset.location.type):COMPANY_ASSET_LOCATION_TYPES.COMPANY,
    label:text(asset?.location?.label,200),
    referenceId:text(asset?.location?.referenceId,120),
  },
  custodian:{
    type:["employee","user","external",""].includes(String(asset?.custodian?.type||""))?String(asset?.custodian?.type||""):"",
    id:text(asset?.custodian?.id,120),
    name:text(asset?.custodian?.name,200),
  },
  invoice:normalizeInvoice(asset?.invoice),
  photo:normalizeDocument(asset?.photo),
  notes:text(asset?.notes||asset?.observacoes,2000),
});

const identityConflict=(assets,currentId,field,value)=>{
  const wanted=normalizeIdentity(value);
  if(!wanted)return false;
  return assets.some(item=>String(item.id)!==String(currentId)
    &&normalizeIdentity(item?.[field])===wanted);
};

const appendHistory=(record,{type,actorId,actorName,now,before,details,key})=>({
  ...record,
  operationalHistory:[...(record?.operationalHistory||[]),{
    id:`asset_${String(type).toLowerCase()}_${String(key||now).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,120)}`,
    type,at:now,actorId:actorId||"",actorName:actorName||"",
    before:before||null,after:details||null,
  }].slice(-300),
});

export const applyPatrimonyCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PATRIMONY_COMMAND_TYPES.has(command?.type))return null;
  const assets=list(data,"companyAssets");
  const payload=command.payload||{};

  if(command.type===PATRIMONY_COMMAND.ASSETS_IMPORTED){
    const rawAssets=Array.isArray(payload.assets)?payload.assets:[];
    if(!rawAssets.length||rawAssets.length>500)return fail("A importação precisa conter entre 1 e 500 bens patrimoniais.");
    let next=data;
    const ids=[];
    for(let index=0;index<rawAssets.length;index+=1){
      const raw=rawAssets[index];
      const subKey=`${command.idempotencyKey||"asset-import"}-${index+1}`;
      const result=applyPatrimonyCommand(next,{
        ...command,
        type:PATRIMONY_COMMAND.ASSET_SAVED,
        expectedVersion:0,
        idempotencyKey:subKey,
        payload:{asset:raw},
      },now);
      if(!result?.ok)return fail(`Item ${index+1}: ${result?.reason||"bem patrimonial inválido"}`);
      next=result.data;
      ids.push(result.entityId);
    }
    return {ok:true,data:next,entityId:`patrimony-import:${text(payload.invoiceAccessKey||command.idempotencyKey,120)}`,summary:{created:ids.length,assetIds:ids}};
  }

  if(command.type===PATRIMONY_COMMAND.ASSET_SAVED){
    const normalized=normalizeCompanyAsset(payload.asset||{});
    const input={...normalized,assetTag:normalized.assetTag||nextAssetTag(assets)};
    if(!input.id||!input.name)return fail("Informe o bem e a identificação do cadastro.");
    if(!validDate(input.acquisitionDate)||!validDate(input.invoice.issueDate))return fail("Data de aquisição ou da nota fiscal inválida.");
    if(input.invoice.accessKey&&input.invoice.accessKey.length!==44)return fail("A chave da NF-e precisa ter 44 dígitos.");
    const current=assets.find(item=>String(item.id)===input.id);
    if(command.expectedVersion!=null&&versionOf(current)!==Number(command.expectedVersion))return fail("Este patrimônio foi alterado por outra pessoa. Atualize a tela.");
    if(current){
      if(String(input.status)!==String(current.status))return fail("Altere a situação pela ação própria de status para manter o histórico patrimonial.");
      const currentLocation=JSON.stringify(current.location||{});
      const nextLocation=JSON.stringify(input.location||{});
      const currentCustodian=JSON.stringify(current.custodian||{});
      const nextCustodian=JSON.stringify(input.custodian||{});
      if(currentLocation!==nextLocation||currentCustodian!==nextCustodian)return fail("Movimente o patrimônio pela ação própria de localização/responsável para manter a rastreabilidade.");
    }
    if(identityConflict(assets,input.id,"assetTag",input.assetTag))return fail("Já existe um bem ativo com este código patrimonial.");
    if(identityConflict(assets,input.id,"serialNumber",input.serialNumber))return fail("Já existe um bem ativo com este número de série.");
    if(identityConflict(assets,input.id,"imei",input.imei))return fail("Já existe um bem ativo com este IMEI.");
    const duplicateInvoiceItem=input.invoice.accessKey&&input.invoice.itemNumber
      &&assets.some(item=>String(item.id)!==input.id
        &&normalizeKey(item?.invoice?.accessKey)===input.invoice.accessKey
        &&Number(item?.invoice?.itemNumber||0)===input.invoice.itemNumber
        &&Number(item?.invoice?.unitIndex||1)===input.invoice.unitIndex
        &&normalizeIdentity(item?.name)===normalizeIdentity(input.name));
    if(duplicateInvoiceItem)return fail("Este item da NF-e já parece ter sido cadastrado como patrimônio.");
    let record={
      ...(current||{}),...input,active:current?.active!==false,
      version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:now,createdById:command.actorId||""}:{}),
    };
    record=appendHistory(record,{type:current?"ASSET_UPDATED":"ASSET_CREATED",actorId:command.actorId,actorName:command.actorName,now,before:current||null,details:{assetTag:record.assetTag,status:record.status,location:record.location,custodian:record.custodian,photo:record.photo},key:command.idempotencyKey});
    return {ok:true,data:{...data,companyAssets:current?assets.map(item=>item.id===record.id?record:item):[...assets,record]},entityId:record.id};
  }

  const assetId=text(payload.assetId,120);
  const current=assets.find(item=>String(item.id)===assetId);
  if(!current)return fail("Patrimônio não encontrado.");
  if(command.expectedVersion!=null&&versionOf(current)!==Number(command.expectedVersion))return fail("Este patrimônio foi alterado por outra pessoa. Atualize a tela.");

  if(command.type===PATRIMONY_COMMAND.ASSET_MOVED){
    const location={
      type:LOCATION_TYPES.has(String(payload.location?.type))?String(payload.location.type):COMPANY_ASSET_LOCATION_TYPES.OTHER,
      label:text(payload.location?.label,200),
      referenceId:text(payload.location?.referenceId,120),
    };
    const custodian={
      type:["employee","user","external",""].includes(String(payload.custodian?.type||""))?String(payload.custodian?.type||""):"",
      id:text(payload.custodian?.id,120),name:text(payload.custodian?.name,200),
    };
    const reason=text(payload.reason,500);
    const preserveStatus=[COMPANY_ASSET_STATUS.DISPOSED,COMPANY_ASSET_STATUS.LOST,COMPANY_ASSET_STATUS.MAINTENANCE].includes(current.status);
    const movedStatus=preserveStatus?current.status
      :[COMPANY_ASSET_LOCATION_TYPES.COMPANY,COMPANY_ASSET_LOCATION_TYPES.WAREHOUSE].includes(location.type)
        ?COMPANY_ASSET_STATUS.ACTIVE:COMPANY_ASSET_STATUS.IN_USE;
    let record={...current,location,custodian,status:movedStatus,version:versionOf(current)+1,updatedAt:now};
    record=appendHistory(record,{type:"ASSET_MOVED",actorId:command.actorId,actorName:command.actorName,now,before:{location:current.location,custodian:current.custodian},details:{location,custodian,reason},key:command.idempotencyKey});
    return {ok:true,data:{...data,companyAssets:assets.map(item=>item.id===assetId?record:item)},entityId:assetId};
  }

  if(command.type===PATRIMONY_COMMAND.ASSET_STATUS_CHANGED){
    if(current.status===COMPANY_ASSET_STATUS.DISPOSED)return fail("Patrimônio baixado é histórico e não pode ser reativado. Cadastre outro bem ou crie um estorno formal de baixa.");
    const status=String(payload.status||"");
    if(!STATUSES.has(status))return fail("Situação patrimonial inválida.");
    const reason=text(payload.reason,500);
    if([COMPANY_ASSET_STATUS.DISPOSED,COMPANY_ASSET_STATUS.LOST].includes(status)&&reason.length<5)return fail("Informe o motivo da baixa ou do extravio.");
    let record={...current,status,active:status!==COMPANY_ASSET_STATUS.DISPOSED,version:versionOf(current)+1,updatedAt:now};
    record=appendHistory(record,{type:"ASSET_STATUS_CHANGED",actorId:command.actorId,actorName:command.actorName,now,before:{status:current.status,active:current.active},details:{status,reason},key:command.idempotencyKey});
    return {ok:true,data:{...data,companyAssets:assets.map(item=>item.id===assetId?record:item)},entityId:assetId};
  }
  return null;
};

export const patrimonyCommandCompanyScope=()=>({obraId:"",scope:"company"});
