import { validatePurchaseRequest } from "./purchase-request-workflow.js";
import { hasValidUnitConversion } from "./unit-conversion.js";
import { proximoNumeroSolicitacao } from "./calculations.js";
import { iniciarAprovacaoSolicitacao } from "./purchase-approval.js";

export const PURCHASE_REQUEST_COMMAND=Object.freeze({
  PURCHASE_REQUEST_SAVED:"SOLICITACAO_COMPRA_SALVA",
  PURCHASE_REQUEST_CANCELLED:"SOLICITACAO_COMPRA_CANCELADA",
  PURCHASE_REQUEST_ANALYSIS_STARTED:"SOLICITACAO_COMPRA_EM_ANALISE",
  PURCHASE_REQUEST_SUPPLIER_CONTACTED:"SOLICITACAO_COMPRA_CONTATO_REGISTRADO",
});

export const PURCHASE_REQUEST_COMMAND_TYPES=new Set(Object.values(PURCHASE_REQUEST_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const requestById=(data,id)=>(data.solicitacoesCompra||[]).find(item=>String(item.id)===String(id));

const normalizeCatalogMaterials=(data,requestId,rawMaterials=[])=>{
  if(!Array.isArray(rawMaterials)||rawMaterials.length>500){
    return {error:"A lista de insumos da solicitação é inválida."};
  }
  const catalog=new Map((data.materiais||[]).map(item=>[String(item.id),item]));
  const changed=[];
  for(const raw of rawMaterials){
    const id=String(raw?.id||""),description=String(raw?.descricao||"").trim();
    if(!id||!description)return {error:"A solicitação contém um insumo sem identificação ou descrição."};
    const current=catalog.get(id);
    if(current&&String(current.solicitacaoOrigemId||"")!==String(requestId)){
      return {error:"Um insumo compartilhado do catálogo não pode ser sobrescrito pela solicitação."};
    }
    const price=Number(raw.precoMedio||0);
    if(!Number.isFinite(price)||price<0)return {error:"O preço de referência do insumo é inválido."};
    const material={...current,...raw,id,descricao:description,
      unidade:String(raw.unidade||current?.unidade||"UN").trim()||"UN",
      precoMedio:price,ativo:raw.ativo!==false,solicitacaoOrigemId:requestId};
    catalog.set(id,material);changed.push(material);
  }
  return {materials:[...catalog.values()],changed};
};

const approvalRelevant=request=>JSON.stringify((request?.itens||[]).map(item=>[
  String(item.materialId||""),Number(item.quantidade||0),Number(item.precoRef||0),
  String(item.unidadeCompra||""),Number(item.fatorConversao||1),
]));
const itemsChanged=(before,after)=>approvalRelevant(before)!==approvalRelevant(after);

const saveRequest=(data,command,now)=>{
  const payload=command.payload||{},sent=payload.request||{};
  // Número da solicitação nova vem do servidor (o comando roda com a linha
  // travada): dois usuários criando ao mesmo tempo nunca repetem o número.
  const existing=requestById(data,sent.id);
  const raw=!existing&&!String(sent.numero||"").trim()
    ?{...sent,numero:proximoNumeroSolicitacao(data.solicitacoesCompra)}:sent;
  const id=String(raw.id||""),obraId=String(raw.obraId||"");
  const current=requestById(data,id);
  if(!id)return fail("Solicitação sem identificação única.");
  if(current?.status==="cancelada")return fail("Esta solicitação foi cancelada e não pode mais ser editada.");
  // Depois que Compras gera o pedido, mudar a solicitação faria ela divergir
  // do que foi comprado. O ajuste passa a ser feito no pedido.
  if(current?.pedidoId||current?.status==="pedido_gerado"){
    return fail("Esta solicitação já gerou um pedido de compra. Ajuste o pedido em vez da solicitação.");
  }
  if(!(data.obras||[]).some(item=>String(item.id)===obraId))return fail("Selecione uma obra existente para a solicitação.");
  if(current&&versionOf(current)!==Number(command.expectedVersion)){
    return fail("A solicitação foi alterada por outra pessoa. Atualize a tela e tente novamente.");
  }
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação da solicitação exige versão inicial zero.");
  const validation=validatePurchaseRequest(raw);
  if(!validation.valid)return fail("Revise os campos e materiais da solicitação antes de formalizar.");
  if((raw.itens||[]).some(item=>!item?.id||!hasValidUnitConversion(item))){
    return fail("A solicitação contém item sem identificação ou conversão de unidade válida.");
  }
  if((data.solicitacoesCompra||[]).some(item=>String(item.id)!==id&&String(item.numero||"")===String(raw.numero||""))){
    return fail("Já existe uma solicitação com este número.");
  }
  const catalogResult=normalizeCatalogMaterials(data,id,payload.catalogMaterials||[]);
  if(catalogResult.error)return fail(catalogResult.error);
  const validMaterialIds=new Set(catalogResult.materials.map(item=>String(item.id)));
  if((raw.itens||[]).some(item=>!validMaterialIds.has(String(item.materialId||"")))){
    return fail("Todos os itens precisam estar vinculados a insumos persistidos no catálogo.");
  }
  const actorName=String(command.actorName||"").trim()||"Usuário autenticado";
  // O status inicial é decidido aqui, nunca pelo navegador. Tem de ser
  // "enviada": é o único valor que a aba Solicitações, o KPI do mapa, o SLA
  // e os botões Cotar/Gerar pedido reconhecem (achado S1 do pathfinder).
  const saved={...current,...raw,id,obraId,status:current?.status||"enviada",
    version:versionOf(current)+1,atualizadoEm:now,updatedAt:now,
    atualizadoPor:actorName,updatedBy:actorName,updatedById:String(command.actorId||""),
    ...(!current?{criadoEm:raw.criadoEm||now,criadoPor:raw.criadoPor||actorName,
      criadoPorId:raw.criadoPorId||String(command.actorId||"")}:{})};
  // A aprovação nasce no servidor; `payload.approvalInstance`, que o
  // navegador mandava pronto (e podia mandar "aprovada"), é ignorado.
  const actor={id:String(command.actorId||""),nome:actorName};
  let withApproval={...data,materiais:catalogResult.materials};
  let approvalId=current?.aprovacaoInstanciaId||"";
  if(!current||itemsChanged(current,saved)){
    const started=iniciarAprovacaoSolicitacao(withApproval,{...saved,solicitanteId:saved.solicitanteId||actor.id},actor,now);
    // Itens mudaram depois de aprovados ou em análise: vale a nova aprovação.
    withApproval={...started.data,instanciasAprovacao:(started.data.instanciasAprovacao||[]).map(item=>
      approvalId&&String(item.id)===String(approvalId)&&item.status!=="substituida"
        ?{...item,status:"substituida",concluidoEm:now,substituidaPor:started.instanciaId}:item)};
    approvalId=started.instanciaId;
  }
  const finalRequest={...saved,aprovacaoInstanciaId:approvalId};
  const next={...withApproval,
    solicitacoesCompra:current
      ?(data.solicitacoesCompra||[]).map(item=>String(item.id)===id?finalRequest:item)
      :[...(data.solicitacoesCompra||[]),finalRequest]};
  return {ok:true,entityId:id,data:next};
};

// Cancelamento é sempre soft-delete (status:"cancelada") - mesmo padrão de
// EQUIPMENT_RENTAL_CANCELLED (src/domains/equipamentos/commands.js): o
// registro nunca é removido do array, só marcado. Não existia nenhum
// comando de cancelamento/exclusão de solicitação de compra até esta
// mudança (24/08/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md) - o único
// jeito de "remover" uma solicitação de teste era um utilitário
// administrativo estreito que removia a linha de verdade do array, sem
// nenhuma auditoria de negócio.
const cancelRequest=(data,command,now)=>{
  const payload=command.payload||{};
  const id=String(payload.requestId||"");
  const current=requestById(data,id);
  if(!id||!current)return fail("Solicitação não encontrada.");
  if(current.status==="cancelada")return fail("Esta solicitação já foi cancelada.");
  // Achado ao mapear o próximo elo da cadeia (cotações/pedidos, 24/08/2026):
  // saveOrder (purchase-order-commands.js) marca a solicitação como
  // status:"pedido_gerado"+pedidoId ao gerar um pedido real a partir dela.
  // Cancelar a solicitação nesse ponto criaria inconsistência (uma
  // solicitação "cancelada" com um pedido ativo ainda apontando para ela) -
  // o cancelamento correto nesse caso é do PEDIDO
  // (PURCHASE_CANCELLED/COMPRA_CANCELADA, purchase-cancellation-command.js),
  // que já reverte a solicitação para status:"enviada" e limpa pedidoId.
  if(current.pedidoId)return fail("Esta solicitação já gerou um pedido de compra - cancele o pedido em vez da solicitação.");
  if(versionOf(current)!==Number(command.expectedVersion)){
    return fail("A solicitação foi alterada por outra pessoa. Atualize a tela e tente novamente.");
  }
  const reason=String(payload.reason||"").trim();
  const actorName=String(command.actorName||"").trim()||"Usuário autenticado";
  const saved={...current,status:"cancelada",version:versionOf(current)+1,
    atualizadoEm:now,updatedAt:now,atualizadoPor:actorName,updatedBy:actorName,
    updatedById:String(command.actorId||""),
    canceladoEm:now,canceladoPor:actorName,canceladoPorId:String(command.actorId||""),
    motivoCancelamento:reason};
  // A aprovação pendente da solicitação cancelada sai da fila de quem aprova.
  // A instância é mantida (com motivo e data) para a auditoria.
  const approvalId=String(current.aprovacaoInstanciaId||"");
  const instanciasAprovacao=(data.instanciasAprovacao||[]).map(item=>
    approvalId&&String(item.id)===approvalId&&item.status==="em_andamento"
      ?{...item,status:"cancelada",concluidoEm:now,canceladaPorId:String(command.actorId||""),
        motivoCancelamento:reason||"Solicitação cancelada"}:item);
  const next={...data,instanciasAprovacao,solicitacoesCompra:(data.solicitacoesCompra||[])
    .map(item=>String(item.id)===id?saved:item)};
  return {ok:true,entityId:id,data:next};
};

// Compras assume a solicitação: enviada -> em_analise. Antes era um update()
// direto, sem controle de versão nem checagem de papel no servidor.
const startAnalysis=(data,command,now)=>{
  const id=String(command.payload?.requestId||"");
  const current=requestById(data,id);
  if(!id||!current)return fail("Solicitação não encontrada.");
  if(current.status!=="enviada"){
    return fail(current.status==="em_analise"?"Esta solicitação já está em análise.":"Só uma solicitação enviada pode ser marcada em análise.");
  }
  if(versionOf(current)!==Number(command.expectedVersion)){
    return fail("A solicitação foi alterada por outra pessoa. Atualize a tela e tente novamente.");
  }
  const actorName=String(command.actorName||"").trim()||"Usuário autenticado";
  const saved={...current,status:"em_analise",version:versionOf(current)+1,
    analisadoEm:now,analisadoPor:actorName,analisadoPorId:String(command.actorId||""),
    atualizadoEm:now,updatedAt:now,atualizadoPor:actorName,updatedBy:actorName,updatedById:String(command.actorId||"")};
  return {ok:true,entityId:id,data:{...data,solicitacoesCompra:(data.solicitacoesCompra||[])
    .map(item=>String(item.id)===id?saved:item)}};
};

// Registra que o pedido de orçamento foi enviado a um fornecedor (link do
// WhatsApp). Upsert por fornecedor: clicar de novo só atualiza o horário. Não
// exige a versão (é um registro de log idempotente, e o clique acontece
// depois de a tela já ter aberto outras coisas), mas só vale para solicitação
// ainda em aberto.
const registerSupplierContact=(data,command,now)=>{
  const id=String(command.payload?.requestId||""),supplierId=String(command.payload?.supplierId||"");
  const current=requestById(data,id);
  if(!id||!current)return fail("Solicitação não encontrada.");
  if(!supplierId)return fail("Informe o fornecedor contatado.");
  if(["cancelada","pedido_gerado"].includes(current.status)||current.pedidoId){
    return fail("Esta solicitação não está mais aberta para cotação.");
  }
  const supplier=(data.fornecedores||[]).find(item=>String(item.id)===supplierId);
  const supplierName=String(supplier?.nome||command.payload?.supplierName||"").trim();
  const contacts=Array.isArray(current.contatos)?current.contatos:[];
  const exists=contacts.some(item=>String(item.fornecedorId)===supplierId);
  const nextContacts=exists
    ?contacts.map(item=>String(item.fornecedorId)===supplierId?{...item,enviadoEm:now}:item)
    :[...contacts,{fornecedorId:supplierId,fornecedorNome:supplierName,enviadoEm:now}];
  const saved={...current,contatos:nextContacts,version:versionOf(current)+1,updatedAt:now};
  return {ok:true,entityId:id,data:{...data,solicitacoesCompra:(data.solicitacoesCompra||[])
    .map(item=>String(item.id)===id?saved:item)}};
};

export const purchaseRequestCommandObraId=(data={},command={})=>{
  if(!PURCHASE_REQUEST_COMMAND_TYPES.has(command?.type))return "";
  const requestId=command.payload?.request?.id||command.payload?.requestId;
  const request=command.payload?.request||{};
  return String(requestById(data,requestId)?.obraId||request.obraId||"");
};

export const applyPurchaseRequestCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PURCHASE_REQUEST_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para salvar a solicitação.");
  if(command.type===PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_CANCELLED)return cancelRequest(data,command,now);
  if(command.type===PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_ANALYSIS_STARTED)return startAnalysis(data,command,now);
  if(command.type===PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SUPPLIER_CONTACTED)return registerSupplierContact(data,command,now);
  return saveRequest(data,command,now);
};
