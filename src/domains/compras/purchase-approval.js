// Aprovação de solicitações de compra, sempre decidida no servidor.
//
// Antes, a tela montava a instância de aprovação e o servidor gravava o que
// recebia: quem criava a solicitação podia enviá-la já "aprovada". Agora a
// instância nasce aqui, dentro do comando, a partir da política ativa (ou da
// política padrão abaixo), e o navegador só lê o resultado.
import { arcdApprovalEngine } from "../aprovacoes/arcd-engine.js";
import { referenceTotalOf } from "./unit-conversion.js";

// Alçada decidida pelo responsável em 22/10/2026: até R$ 5.000 o engenheiro
// da obra aprova; acima, o Administrador. Ajustável em configAprovacao.
export const LIMITE_APROVACAO_ENGENHEIRO=5000;
export const POLITICA_PADRAO_SOLICITACAO_ID="padrao-solicitacao-compra";

export const limiteAprovacaoEngenheiro=data=>{
  const configurado=Number(data?.configAprovacao?.limiteEngenheiroCompra);
  return Number.isFinite(configurado)&&configurado>=0?configurado:LIMITE_APROVACAO_ENGENHEIRO;
};

export const politicaPadraoSolicitacaoCompra=limite=>({
  id:POLITICA_PADRAO_SOLICITACAO_ID,versao:1,ativa:true,prioridade:-1,
  nome:`Padrão ARCD: até R$ ${limite.toLocaleString("pt-BR")} o engenheiro da obra; acima, o Administrador`,
  entidadeTipo:"solicitacaoCompra",condicoes:[],autoaprovacao:{modo:"proibida"},
  etapas:[
    {id:"engenheiro-obra",nome:"Engenheiro da obra",ordem:1,tipoAprovador:"responsavelObra",
      modoQuorum:"qualquer",semAprovadorAcao:"enviar_administrador",
      condicoes:[{campo:"valorTotal",operador:"menor_igual",valor:limite}]},
    {id:"administrador",nome:"Administrador",ordem:1,tipoAprovador:"administrador",
      modoQuorum:"qualquer",semAprovadorAcao:"enviar_administrador",
      condicoes:[{campo:"valorTotal",operador:"maior",valor:limite}]},
  ],
});

const politicaPropriaAtiva=data=>(data?.politicasAprovacao||[])
  .some(item=>item?.ativa&&item.entidadeTipo==="solicitacaoCompra");

export const valorEstimadoSolicitacao=request=>(request?.itens||[])
  .reduce((total,item)=>total+referenceTotalOf(item),0);

export const contextoAprovacaoSolicitacao=(request,solicitanteId)=>({
  valorTotal:valorEstimadoSolicitacao(request),obraId:String(request?.obraId||""),
  categoria:"material",solicitanteId:String(solicitanteId||""),urgencia:request?.prioridade||"normal",
});

// Inicia a aprovação da solicitação. Sem política própria da empresa, usa a
// padrão; com política própria, o motor escolhe entre elas como sempre fez.
export const iniciarAprovacaoSolicitacao=(data,request,actor,now)=>{
  const limite=limiteAprovacaoEngenheiro(data);
  const politicas=politicaPropriaAtiva(data)
    ?data.politicasAprovacao
    :[...(data.politicasAprovacao||[]),politicaPadraoSolicitacaoCompra(limite)];
  const contexto=contextoAprovacaoSolicitacao(request,request.solicitanteId||actor.id);
  const {data:next,resumo}=arcdApprovalEngine.iniciarInstancia({...data,politicasAprovacao:politicas},{
    entidadeTipo:"solicitacaoCompra",entidadeId:request.id,contexto,
    operador:{id:actor.id,nome:actor.nome},agora:now,
    comportamentoSemPolitica:data.configAprovacao?.comportamentoSemPolitica||"auto_aprovar",
  });
  const instancias=(next.instanciasAprovacao||[]).map(item=>item.id===resumo.instanciaId
    ?{...item,contexto,valorAprovado:contexto.valorTotal,limiteEngenheiro:limite}:item);
  // A política padrão vive só no snapshot da instância: não é gravada como
  // política da empresa, para não aparecer como algo que alguém configurou.
  return {
    data:{...next,politicasAprovacao:data.politicasAprovacao,instanciasAprovacao:instancias},
    instanciaId:resumo.instanciaId,status:resumo.status,
  };
};

export const instanciaDaSolicitacao=(data,request)=>request?.aprovacaoInstanciaId
  ?(data?.instanciasAprovacao||[]).find(item=>String(item?.id)===String(request.aprovacaoInstanciaId))
  :null;

// O Administrador aprovou alguma etapa desta instância (ou a política é
// própria da empresa, que define por conta própria quem aprova o quê).
const aprovadaAcimaDaAlcada=instancia=>{
  if(instancia?.status!=="aprovada")return false;
  if(instancia.policyId&&instancia.policyId!==POLITICA_PADRAO_SOLICITACAO_ID)return true;
  const etapas=instancia.snapshotPolitica?.etapas||[];
  return etapas.some((etapa,index)=>etapa.tipoAprovador==="administrador"
    &&instancia.resultadosEtapas?.[index]?.status==="concluida");
};

// Um pedido acima da alçada do engenheiro precisa de aprovação do
// Administrador: direto (o próprio admin lança) ou pela solicitação de origem.
export const pedidoDentroDaAlcada=(data,{total,request,actorRole})=>{
  if(actorRole==="admin")return true;
  if(total<=limiteAprovacaoEngenheiro(data)+0.005)return true;
  return aprovadaAcimaDaAlcada(instanciaDaSolicitacao(data,request));
};
