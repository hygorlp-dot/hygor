// Link de aceite do pedido pelo fornecedor (C2.5, segunda parte).
//
// O link leva um código assinado (HMAC-SHA256) com o id do pedido, a
// validade e a impressão digital do conteúdo do pedido (fornecedor, itens,
// quantidades e preços). Nada é guardado no banco: o servidor recalcula a
// assinatura a cada acesso. Se o pedido for alterado depois de o link sair,
// a impressão digital não bate e o link deixa de valer; a mesma coisa acontece
// quando ele vence. A chave vem de PEDIDO_ACEITE_SECRET ou, na falta dela, é
// derivada da chave de serviço do servidor (nunca chega ao navegador).
import crypto from "node:crypto";

export const VALIDADE_LINK_ACEITE_DIAS=15;
const VERSAO=1;
const TAMANHO_MAXIMO_TOKEN=600;

const b64url=buffer=>Buffer.from(buffer).toString("base64url");

export const chaveLinkAceite=(env=process.env)=>{
  const propria=String(env.PEDIDO_ACEITE_SECRET||"");
  if(propria.length>=32)return Buffer.from(propria);
  const servico=String(env.SUPABASE_SERVICE_ROLE_KEY||"");
  if(!servico)return null;
  return crypto.createHmac("sha256",servico).update("arcd:pedido-aceite:v1").digest();
};

export const impressaoPedido=order=>{
  const itens=(order?.itens||[])
    .map(item=>[String(item.id||""),String(item.materialId||""),Number(item.qtd||0),Number(item.precoUnit||0)])
    .sort((a,b)=>a[0].localeCompare(b[0]));
  return crypto.createHash("sha256")
    .update(JSON.stringify([String(order?.id||""),String(order?.fornecedorId||""),itens]))
    .digest("hex").slice(0,24);
};

const assinar=(key,corpo)=>crypto.createHmac("sha256",key).update(corpo).digest();

export const gerarTokenAceite=({key,order,now=Date.now(),validadeDias=VALIDADE_LINK_ACEITE_DIAS})=>{
  if(!key)throw new Error("Chave do link de aceite indisponível.");
  const expiraEm=Math.floor(now/1000)+validadeDias*86400;
  const corpo=b64url(JSON.stringify({v:VERSAO,o:String(order.id),e:expiraEm,f:impressaoPedido(order)}));
  return {token:`${corpo}.${b64url(assinar(key,corpo))}`,expiraEm:new Date(expiraEm*1000).toISOString()};
};

export const verificarTokenAceite=({key,token,now=Date.now()})=>{
  const texto=String(token||"");
  if(!key||!texto||texto.length>TAMANHO_MAXIMO_TOKEN)return {ok:false,motivo:"invalido"};
  const partes=texto.split(".");
  if(partes.length!==2||!/^[A-Za-z0-9_-]+$/.test(partes[0])||!/^[A-Za-z0-9_-]+$/.test(partes[1])){
    return {ok:false,motivo:"invalido"};
  }
  const esperado=assinar(key,partes[0]);
  const recebido=Buffer.from(partes[1],"base64url");
  if(recebido.length!==esperado.length||!crypto.timingSafeEqual(recebido,esperado))return {ok:false,motivo:"invalido"};
  let dados;
  try{dados=JSON.parse(Buffer.from(partes[0],"base64url").toString("utf8"));}catch{return {ok:false,motivo:"invalido"};}
  if(dados?.v!==VERSAO||!dados.o||!dados.f||!Number.isFinite(dados.e))return {ok:false,motivo:"invalido"};
  if(dados.e*1000<now)return {ok:false,motivo:"expirado"};
  return {ok:true,orderId:String(dados.o),impressao:String(dados.f),expiraEm:new Date(dados.e*1000).toISOString()};
};

// Estado do pedido para o link: só pedido enviado/parcial, igual ao que o
// link assinou e ainda sem aceite pode ser confirmado.
export const situacaoAceitePedido=(order,impressao)=>{
  if(!order||order.status==="cancelado"||order.deletedAt!=null||order.ativo===false)return "indisponivel";
  if(impressaoPedido(order)!==impressao)return "alterado";
  if(order.aceiteFornecedor?.nome)return "aceito";
  if(!["enviado","parcial"].includes(order.status))return "indisponivel";
  return "pendente";
};

// O que o fornecedor vê: o próprio pedido, sem dados internos (pagamentos,
// orçamento, notas, CNPJ do fornecedor, observações de auditoria).
export const visaoPublicaPedido=(data,order,{empresa="ARCD Construtech"}={})=>{
  const materiais=new Map((data?.materiais||[]).map(item=>[String(item.id),item]));
  const fornecedor=(data?.fornecedores||[]).find(item=>String(item.id)===String(order.fornecedorId));
  const obra=(data?.obras||[]).find(item=>String(item.id)===String(order.obraId));
  const itens=(order.itens||[]).map(item=>{
    const material=materiais.get(String(item.materialId));
    const qtd=Number(item.qtd||0),precoUnit=Number(item.precoUnit||0);
    return {
      descricao:material?.descricao||item.descricaoRef||"Material",
      unidade:String(item.unidadeCompra||material?.unidade||item.unidadeRef||"").toUpperCase(),
      qtd,precoUnit,total:Math.round(qtd*precoUnit*100)/100,
    };
  });
  return {
    empresa,numero:String(order.numero||""),data:String(order.data||""),previsao:String(order.previsao||""),
    fornecedor:String(fornecedor?.nome||""),obra:String(obra?.name||""),
    enderecoEntrega:String(obra?.address||""),
    itens,total:Math.round(itens.reduce((sum,item)=>sum+item.total,0)*100)/100,
    aceite:order.aceiteFornecedor?.nome
      ?{nome:order.aceiteFornecedor.nome,data:order.aceiteFornecedor.data,canal:order.aceiteFornecedor.canal}:null,
  };
};

// Mesmos perfis que enviam o pedido ao fornecedor.
export const PAPEIS_LINK_ACEITE=Object.freeze(["admin","compras"]);
export const podeGerarLinkAceite=role=>PAPEIS_LINK_ACEITE.includes(String(role||""));

// Pedido apto a receber link: o que a tela mostra e o servidor confere.
export const linkAceiteDisponivel=order=>situacaoAceitePedido(order,order?impressaoPedido(order):"")==="pendente";

// Passo comum das duas rotas públicas: código válido e pedido existente.
export const avaliarAcessoAceite=({key,token,data,now=Date.now()})=>{
  const verificado=verificarTokenAceite({key,token,now});
  if(!verificado.ok)return {status:404,falha:true,error:verificado.motivo==="expirado"
    ?"Este link de aceite venceu. Peça um novo ao setor de Compras."
    :"Link de aceite inválido."};
  const pedido=(data?.pedidos||[]).find(item=>String(item.id)===verificado.orderId);
  const situacao=situacaoAceitePedido(pedido,verificado.impressao);
  if(situacao==="indisponivel")return {status:404,falha:true,error:"Este pedido não está mais disponível para aceite."};
  return {status:200,verificado,pedido,situacao};
};

// Monta o comando de aceite a partir do que o fornecedor preencheu.
export const comandoAceitePorLink=({pedido,verificado,situacao,body={},now=new Date()})=>{
  if(situacao==="alterado")return {status:409,error:"O pedido foi alterado depois do envio deste link. Peça um novo ao setor de Compras."};
  if(situacao==="aceito")return {status:409,error:"Este pedido já foi aceito."};
  if(situacao!=="pendente")return {status:409,error:"Este pedido não está mais disponível para aceite."};
  const nome=String(body.nome||"").trim().slice(0,120);
  const previsao=String(body.previsao||"");
  const observacao=String(body.observacao||"").trim().slice(0,500);
  if(nome.length<3)return {status:400,error:"Informe o nome de quem confirma o pedido."};
  if(previsao&&!/^\d{4}-\d{2}-\d{2}$/.test(previsao))return {status:400,error:"A data de entrega é inválida."};
  const actor={id:`fornecedor:${pedido.fornecedorId}`,nome:`${nome} (fornecedor, pelo link)`};
  return {actor,command:{
    idempotencyKey:`supplier-accept-link-${pedido.id}-${verificado.impressao}`,
    expectedVersion:Number(pedido.version||0),
    actorId:actor.id,actorRole:"fornecedor",actorName:actor.nome,
    payload:{orderId:pedido.id,acceptedBy:nome,acceptedAt:now.toISOString().slice(0,10),
      channel:"link",confirmedForecast:previsao,note:observacao},
  }};
};
