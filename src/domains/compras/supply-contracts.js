// Contratos de fornecimento (C2.4): preço acordado por insumo, fornecedor e
// período, com quantidade contratada. Pedido feito pelo contrato dispensa
// cotação e consome o saldo. O saldo nunca é gravado: é sempre o contratado
// menos o que os pedidos vivos (enviados; rascunho e cancelado não contam) já
// pediram por aquele item do contrato. Cancelar o pedido devolve o saldo sem
// passo extra, e o rascunho só consome o saldo quando é enviado.
import { pedidoVivo } from "./purchase-position.js";
import { hasValidUnitConversion, purchaseUnitOf } from "./unit-conversion.js";

export const SUPPLY_CONTRACT_COMMAND=Object.freeze({
  SUPPLY_CONTRACT_SAVED:"CONTRATO_FORNECIMENTO_SALVO",
  SUPPLY_CONTRACT_CLOSED:"CONTRATO_FORNECIMENTO_ENCERRADO",
});
export const SUPPLY_CONTRACT_COMMAND_TYPES=new Set(Object.values(SUPPLY_CONTRACT_COMMAND));
export const PAPEIS_CONTRATO_FORNECIMENTO=Object.freeze(["admin","compras"]);

const EPS=1e-6;
const DATA=/^\d{4}-\d{2}-\d{2}$/;
const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const actorOf=command=>({id:String(command.actorId||""),nome:String(command.actorName||"").trim()||"Usuário autenticado"});

export const contratoPorId=(data,id)=>(data?.contratosFornecimento||[]).find(item=>String(item.id)===String(id||""));

export const consumoItemContrato=(data,contratoId,itemId,{excetoPedidoId=""}={})=>(data?.pedidos||[])
  .filter(pedido=>pedidoVivo(pedido)&&String(pedido.id)!==String(excetoPedidoId))
  .flatMap(pedido=>pedido.itens||[])
  .filter(item=>String(item.contratoId||"")===String(contratoId)&&String(item.contratoItemId||"")===String(itemId))
  .reduce((sum,item)=>sum+Number(item.qtd||0),0);

export const saldoItemContrato=(data,contrato,itemId,opcoes={})=>{
  const item=(contrato?.itens||[]).find(x=>String(x.id)===String(itemId));
  if(!item)return 0;
  return Math.max(0,Number(item.qtdContratada||0)-consumoItemContrato(data,contrato.id,itemId,opcoes));
};

export const contratoVigente=(contrato,dataReferencia)=>contrato?.status==="ativo"
  &&(!dataReferencia||(String(contrato.vigenciaInicio||"")<=dataReferencia&&dataReferencia<=String(contrato.vigenciaFim||"")));

// Contratos que um pedido pode usar: mesmo fornecedor, obra do contrato vazia
// (vale para todas) ou igual à do pedido, e data do pedido dentro da vigência.
export const contratosDisponiveis=(data,{fornecedorId,obraId,dataPedido})=>(data?.contratosFornecimento||[])
  .filter(contrato=>String(contrato.fornecedorId)===String(fornecedorId||"")
    &&(!contrato.obraId||String(contrato.obraId)===String(obraId||""))
    &&contratoVigente(contrato,dataPedido));

export const resumoContrato=(data,contrato)=>{
  const itens=(contrato.itens||[]).map(item=>{
    const consumido=consumoItemContrato(data,contrato.id,item.id);
    const contratado=Number(item.qtdContratada||0);
    return {...item,consumido,saldo:Math.max(0,contratado-consumido),
      percentual:contratado?Math.min(100,(consumido/contratado)*100):0};
  });
  return {itens,valorContratado:itens.reduce((s,i)=>s+Number(i.qtdContratada||0)*Number(i.precoUnit||0),0),
    valorConsumido:itens.reduce((s,i)=>s+i.consumido*Number(i.precoUnit||0),0)};
};

// Conferência dos itens do pedido que dizem vir de um contrato. Item já
// existente que não aumentou quantidade nem preço não é reavaliado (o
// contrato pode ter vencido depois do pedido).
export const validarItensDeContrato=(data,order,current)=>{
  const anteriores=new Map((current?.itens||[]).map(item=>[String(item.id),item]));
  const pedidoNoContrato=new Map();
  for(const item of order.itens||[]){
    if(!item.contratoId)continue;
    const anterior=anteriores.get(String(item.id));
    if(anterior&&String(anterior.contratoId||"")===String(item.contratoId)
      &&String(anterior.contratoItemId||"")===String(item.contratoItemId||"")
      &&Number(item.qtd)<=Number(anterior.qtd||0)+EPS&&Number(item.precoUnit)<=Number(anterior.precoUnit||0)+EPS)continue;
    const contrato=contratoPorId(data,item.contratoId);
    if(!contrato)return "O contrato de fornecimento do item não existe.";
    if(contrato.status!=="ativo")return `O contrato ${contrato.numero} está encerrado.`;
    if(String(contrato.fornecedorId)!==String(order.fornecedorId))return `O contrato ${contrato.numero} é de outro fornecedor.`;
    if(contrato.obraId&&String(contrato.obraId)!==String(order.obraId))return `O contrato ${contrato.numero} é de outra obra.`;
    if(!contratoVigente(contrato,order.data))return `A data do pedido está fora da vigência do contrato ${contrato.numero}.`;
    const itemContrato=(contrato.itens||[]).find(x=>String(x.id)===String(item.contratoItemId||""));
    if(!itemContrato||String(itemContrato.materialId)!==String(item.materialId)){
      return `O insumo do item não pertence ao contrato ${contrato.numero}.`;
    }
    if(purchaseUnitOf(item)!==purchaseUnitOf(itemContrato))return `A unidade do item difere da unidade do contrato ${contrato.numero}.`;
    if(Number(item.precoUnit)>Number(itemContrato.precoUnit)+EPS)return `O preço passa do acordado no contrato ${contrato.numero}.`;
    const chave=`${contrato.id}|${itemContrato.id}`;
    pedidoNoContrato.set(chave,(pedidoNoContrato.get(chave)||0)+Number(item.qtd||0));
    const saldo=saldoItemContrato(data,contrato,itemContrato.id,{excetoPedidoId:order.id});
    if(pedidoNoContrato.get(chave)>saldo+EPS){
      return `A quantidade passa do saldo do contrato ${contrato.numero} (${saldo.toLocaleString("pt-BR")} ${purchaseUnitOf(itemContrato)}).`;
    }
  }
  return "";
};

// Pedido que tem todos os itens em contrato não precisa de cotação.
export const pedidoPorContrato=pedido=>(pedido?.itens||[]).length>0&&(pedido.itens||[]).every(item=>item.contratoId);

export const proximoNumeroContrato=contratos=>{
  const maior=(contratos||[]).reduce((max,item)=>{
    const n=Number(String(item?.numero||"").match(/^CF-(\d+)$/)?.[1]||0);
    return Math.max(max,n);
  },0);
  return `CF-${String(maior+1).padStart(4,"0")}`;
};

const normalizarContrato=(data,raw,current)=>{
  const id=String(raw.id||"");
  if(!id)return {error:"Contrato sem identificação única."};
  const fornecedorId=String(raw.fornecedorId||"");
  if(!(data.fornecedores||[]).some(item=>String(item.id)===fornecedorId))return {error:"Selecione um fornecedor existente."};
  const obraId=String(raw.obraId||"");
  if(obraId&&!(data.obras||[]).some(item=>String(item.id)===obraId))return {error:"A obra do contrato não existe."};
  const inicio=String(raw.vigenciaInicio||""),fim=String(raw.vigenciaFim||"");
  if(!DATA.test(inicio)||!DATA.test(fim)||fim<inicio)return {error:"Informe a vigência do contrato (início e fim)."};
  if(!Array.isArray(raw.itens)||!raw.itens.length||raw.itens.length>200)return {error:"O contrato precisa ter entre 1 e 200 insumos."};
  const ids=new Set(),materiais=new Set(),itens=[];
  for(const item of raw.itens){
    const itemId=String(item?.id||""),materialId=String(item?.materialId||"");
    if(!itemId||ids.has(itemId))return {error:"O contrato tem insumo sem identificação ou repetido."};
    if(!(data.materiais||[]).some(m=>String(m.id)===materialId))return {error:"Selecione um insumo existente em cada linha do contrato."};
    if(materiais.has(materialId))return {error:"Cada insumo aparece uma vez só no contrato."};
    const precoUnit=Number(item.precoUnit),qtdContratada=Number(item.qtdContratada);
    if(!(precoUnit>0)||!(qtdContratada>0))return {error:"Informe preço e quantidade contratada de cada insumo."};
    if(!hasValidUnitConversion(item))return {error:"A conversão de unidade de um insumo do contrato é inválida."};
    ids.add(itemId);materiais.add(materialId);
    itens.push({id:itemId,materialId,precoUnit,qtdContratada,
      unidadeRef:String(item.unidadeRef||"").trim()||"UN",unidadeCompra:purchaseUnitOf(item),
      fatorConversao:Number(item.fatorConversao||1)});
  }
  if(current){
    for(const anterior of current.itens||[]){
      const consumido=consumoItemContrato(data,current.id,anterior.id);
      if(consumido<=EPS)continue;
      const novo=itens.find(item=>item.id===String(anterior.id));
      if(!novo||novo.materialId!==String(anterior.materialId)){
        return {error:"Um insumo já usado em pedido não pode sair do contrato nem trocar de material."};
      }
      if(novo.qtdContratada+EPS<consumido)return {error:"A quantidade contratada não pode ficar abaixo do já pedido."};
    }
  }
  return {contrato:{id,fornecedorId,obraId,vigenciaInicio:inicio,vigenciaFim:fim,itens,
    observacao:String(raw.observacao||"").trim().slice(0,500)}};
};

const salvarContrato=(data,command,now)=>{
  const raw=command.payload?.contract||{};
  const current=contratoPorId(data,raw.id);
  if(current&&versionOf(current)!==Number(command.expectedVersion))return fail("O contrato foi alterado por outra pessoa. Atualize a tela.");
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação do contrato exige versão inicial zero.");
  if(current&&current.status!=="ativo")return fail("Contrato encerrado não pode ser alterado.");
  const normalized=normalizarContrato(data,raw,current);
  if(normalized.error)return fail(normalized.error);
  const actor=actorOf(command);
  const numero=current?.numero||String(raw.numero||"").trim()||proximoNumeroContrato(data.contratosFornecimento);
  if((data.contratosFornecimento||[]).some(item=>String(item.id)!==normalized.contrato.id
    &&String(item.numero||"").toLowerCase()===numero.toLowerCase()))return fail("Já existe um contrato com este número.");
  const saved={
    ...normalized.contrato,numero,status:"ativo",
    version:current?versionOf(current)+1:1,
    criadoEm:current?.criadoEm||now,criadoPorId:current?.criadoPorId||actor.id,criadoPor:current?.criadoPor||actor.nome,
    updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
  };
  return {ok:true,entityId:saved.id,data:{...data,contratosFornecimento:current
    ?(data.contratosFornecimento||[]).map(item=>item.id===saved.id?saved:item)
    :[...(data.contratosFornecimento||[]),saved]}};
};

const encerrarContrato=(data,command,now)=>{
  const contrato=contratoPorId(data,command.payload?.contractId);
  if(!contrato)return fail("Contrato não encontrado.");
  if(versionOf(contrato)!==Number(command.expectedVersion))return fail("O contrato foi alterado por outra pessoa. Atualize a tela.");
  if(contrato.status!=="ativo")return fail("O contrato já está encerrado.");
  const motivo=String(command.payload?.reason||"").trim();
  if(!motivo)return fail("Informe o motivo do encerramento.");
  const actor=actorOf(command);
  const encerrado={...contrato,status:"encerrado",motivoEncerramento:motivo.slice(0,500),
    encerradoEm:now,encerradoPorId:actor.id,encerradoPor:actor.nome,
    version:versionOf(contrato)+1,updatedAt:now,updatedById:actor.id,updatedBy:actor.nome};
  return {ok:true,entityId:contrato.id,data:{...data,
    contratosFornecimento:(data.contratosFornecimento||[]).map(item=>item.id===contrato.id?encerrado:item)}};
};

export const supplyContractCommandObraId=()=>"";

export const applySupplyContractCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!SUPPLY_CONTRACT_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para alterar contratos.");
  if(command.type===SUPPLY_CONTRACT_COMMAND.SUPPLY_CONTRACT_SAVED)return salvarContrato(data,command,now);
  return encerrarContrato(data,command,now);
};
