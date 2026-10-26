// Orçado × comprometido × realizado por etapa (C3.2).
//
// Por etapa de 1º nível do orçamento de controle da obra:
//   orçado       = soma do custo dos itens do orçamento (sem BDI)
//   comprometido = pedidos enviados, parciais ou recebidos (não rascunho,
//                  não cancelado)
//   recebido     = o que já chegou desses pedidos (realizado físico)
//   previsto     = pedidos ainda em rascunho (não somam no comprometido)
// Item sem preço é valorado pelo custo médio do insumo (C1.5).
// Alerta: 90% do orçado = atenção; acima de 100% = estourou.
import { getActiveBudgetBaseline } from "../orcamentos/calculations.js";
import { referenceQuantityOf } from "./unit-conversion.js";

export const LIMITE_ATENCAO_ORCAMENTO=90;
const COMPROMETIDO=new Set(["enviado","parcial","recebido"]);

// Etapas-raiz do orçamento: o vínculo de compras é sempre no 1º nível.
export const niveisUmOrcamento=orc=>{
  if(!orc)return [];
  const etapas=orc.etapas||[],porId=new Map(etapas.map(e=>[e.id,e]));
  const raiz=id=>{let e=porId.get(id),n=0;while(e?.parentId&&n++<30)e=porId.get(e.parentId)||e;return e;};
  const valores=new Map();
  (orc.itens||[]).filter(i=>i.tipo!=="titulo").forEach(i=>{const r=raiz(i.etapaId);if(r)valores.set(r.id,(valores.get(r.id)||0)+Number(i.quantidade||0)*Number(i.precoUnit||0));});
  return etapas.filter(e=>!e.parentId).map(e=>({id:e.id,descricao:e.nome||"Etapa sem nome",orcado:valores.get(e.id)||0,ordem:Number(e.ordem||0)}))
    .sort((a,b)=>a.ordem-b.ordem||a.descricao.localeCompare(b.descricao));
};

export const alertaOrcamento=(valor,orcado)=>{
  if(valor<=0.005)return "ok";
  if(orcado<=0.005||valor>orcado+0.01)return "estourou";
  return (valor/orcado)*100>=LIMITE_ATENCAO_ORCAMENTO?"atencao":"ok";
};

const precoDoItem=(item,materiais)=>{
  const preco=Number(item.precoUnit||0);
  if(preco>0)return {preco,porReferencia:false};
  const medio=Number(materiais.get(String(item.materialId))?.precoMedio||0);
  return {preco:medio,porReferencia:medio>0};
};
const valorDoItem=(item,materiais,quantidade)=>{
  const {preco,porReferencia}=precoDoItem(item,materiais);
  return porReferencia?referenceQuantityOf(item,quantidade)*preco:Number(quantidade||0)*preco;
};

// `pedidoSimulado` substitui (ou acrescenta) um pedido, para avaliar o
// impacto de um pedido em edição antes de salvar.
export const calcOrcadoComprado=(data,obraId,{pedidoSimulado=null}={})=>{
  const baseline=getActiveBudgetBaseline(data,obraId,"controle");
  const orc=baseline.budget;
  // `motivo` explica a ausência: sem baseline de controle aprovada, baseline
  // ambígua (mais de uma ativa) ou baseline apontando para versão inexistente.
  // `temOrcamento` distingue "nunca criou orçamento" de "falta aprovar".
  if(!orc)return {orc:null,linhas:[],semApropriacao:0,motivo:baseline.case||"baseline_ausente",
    temOrcamento:(data.orcamentos||[]).some(o=>o.obraId===obraId)};
  const etapas=orc.etapas||[],etapaPorId=new Map(etapas.map(e=>[e.id,e]));
  const itemPorId=new Map((orc.itens||[]).filter(i=>i.tipo!=="titulo").map(i=>[i.id,i]));
  const raizDaEtapa=id=>{let e=etapaPorId.get(id),n=0;while(e?.parentId&&n++<30)e=etapaPorId.get(e.parentId)||e;return e;};
  const raizVinculo=i=>etapaPorId.get(i.orcNivel1Id)?.parentId?raizDaEtapa(i.orcNivel1Id):(etapaPorId.get(i.orcNivel1Id)||raizDaEtapa(itemPorId.get(i.orcItemId)?.etapaId));
  const materiais=new Map((data.materiais||[]).map(m=>[String(m.id),m]));
  const pedidos=(data.pedidos||[]).filter(p=>!pedidoSimulado||String(p.id)!==String(pedidoSimulado.id));
  if(pedidoSimulado)pedidos.push(pedidoSimulado);

  const soma={comprometido:{},recebido:{},previsto:{}};
  let semApropriacao=0;
  pedidos.filter(p=>p.obraId===obraId&&p.status!=="cancelado").forEach(p=>(p.itens||[]).forEach(i=>{
    const valor=valorDoItem(i,materiais,i.qtd);
    const raiz=raizVinculo(i);
    if(!raiz){if(COMPROMETIDO.has(p.status))semApropriacao+=valor;return;}
    const destino=COMPROMETIDO.has(p.status)?soma.comprometido:soma.previsto;
    destino[raiz.id]=(destino[raiz.id]||0)+valor;
    if(COMPROMETIDO.has(p.status))soma.recebido[raiz.id]=(soma.recebido[raiz.id]||0)+valorDoItem(i,materiais,i.qtdRecebida);
  }));

  const linhas=niveisUmOrcamento(orc).map(nivel=>{
    const orcado=nivel.orcado,comprometido=soma.comprometido[nivel.id]||0;
    const alerta=alertaOrcamento(comprometido,orcado);
    return {
      it:{id:nivel.id,descricao:nivel.descricao,codigo:""},etapa:"1º nível do orçamento",
      orcado,comprometido,comprado:comprometido,
      recebido:soma.recebido[nivel.id]||0,previsto:soma.previsto[nivel.id]||0,
      saldo:orcado-comprometido,
      pct:orcado?(comprometido/orcado)*100:(comprometido>0?999:0),
      alerta,estourou:alerta==="estourou",
    };
  }).filter(l=>l.orcado>0||l.comprometido>0||l.previsto>0)
    .sort((a,b)=>b.comprometido-a.comprometido);
  return {orc,linhas,semApropriacao,motivo:null,temOrcamento:true};
};

// Etapas que o pedido em edição leva a 90% ou além do orçado. O pedido é
// tratado como comprometido (é o que acontece ao enviá-lo).
export const alertasOrcamentoDoPedido=(data,pedido)=>{
  if(!pedido?.obraId)return [];
  const antes=calcOrcadoComprado(data,pedido.obraId,{pedidoSimulado:{...pedido,itens:[]}});
  if(!antes.orc)return [];
  const depois=calcOrcadoComprado(data,pedido.obraId,{pedidoSimulado:{...pedido,status:"enviado"}});
  const anteriores=new Map(antes.linhas.map(l=>[l.it.id,l]));
  return depois.linhas
    .filter(l=>l.alerta!=="ok"&&l.comprometido>(anteriores.get(l.it.id)?.comprometido||0)+0.005)
    .map(l=>({etapaId:l.it.id,descricao:l.it.descricao,orcado:l.orcado,
      antes:anteriores.get(l.it.id)?.comprometido||0,depois:l.comprometido,pct:l.pct,alerta:l.alerta}));
};
