// Decisão de aprovação como comando do servidor.
//
// Antes, a tela chamava o motor no navegador e gravava a coleção inteira de
// instâncias pelo salvamento genérico, que só o administrador pode usar:
// para qualquer outro aprovador elegível a decisão era recusada. Aqui o
// aprovador é sempre o usuário autenticado (nunca um id vindo do navegador)
// e o motor confere se ele está entre os elegíveis da etapa.
import { arcdApprovalEngine } from "./arcd-engine.js";
import { referenceTotalOf } from "../compras/unit-conversion.js";

export const APPROVAL_COMMAND=Object.freeze({
  APPROVAL_DECISION_RECORDED:"APROVACAO_DECIDIDA",
});
export const APPROVAL_COMMAND_TYPES=new Set(Object.values(APPROVAL_COMMAND));

const fail=reason=>({ok:false,reason});
const instanceById=(data,id)=>(data.instanciasAprovacao||[])
  .find(item=>item&&String(item.id)===String(id||""));

const entityOf=(data,instance)=>{
  if(instance?.entidadeTipo==="solicitacaoCompra"){
    return (data.solicitacoesCompra||[]).find(item=>String(item.id)===String(instance.entidadeId));
  }
  if(instance?.entidadeTipo==="pagamentoTerceiro"){
    return (data.pagsTerceiros||[]).find(item=>String(item.id)===String(instance.entidadeId));
  }
  return null;
};

// Mesmo contexto usado ao iniciar a instância: as próximas etapas avaliam
// suas condições (valor, obra, medição) sobre ele.
const contextOf=(data,instance)=>{
  if(instance.contexto)return instance.contexto;
  const entity=entityOf(data,instance)||{};
  if(instance.entidadeTipo==="solicitacaoCompra")return {
    valorTotal:(entity.itens||[]).reduce((total,item)=>total+referenceTotalOf(item),0),
    obraId:String(entity.obraId||""),categoria:"material",
    solicitanteId:String(entity.solicitanteId||instance.iniciadoPorId||""),urgencia:entity.prioridade||"normal",
  };
  return {
    valorTotal:Number(entity.amount||0),obraId:String(entity.obraId||""),
    possuiMedicao:entity.medicaoTercId?"sim":"nao",solicitanteId:String(instance.iniciadoPorId||""),
  };
};

export const approvalCommandObraId=(data={},command={})=>{
  const instance=instanceById(data,command.payload?.instanciaId);
  return String(entityOf(data,instance)?.obraId||"");
};

export const applyApprovalCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!APPROVAL_COMMAND_TYPES.has(command?.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para registrar a decisão.");
  const payload=command.payload||{};
  const decision=String(payload.decisao||"");
  if(!["aprovado","reprovado"].includes(decision))return fail("Decisão de aprovação inválida.");
  const justification=String(payload.justificativa||"").trim();
  if(decision==="reprovado"&&!justification)return fail("Informe o motivo da reprovação.");
  const instance=instanceById(data,payload.instanciaId);
  if(!instance)return fail("Instância de aprovação não encontrada.");
  const {data:next,resumo}=arcdApprovalEngine.registrarDecisao(data,{
    instanciaId:instance.id,etapaId:String(payload.etapaId||""),
    aprovadorId:String(command.actorId),aprovadorNome:String(command.actorName||"Usuário autenticado"),
    decisao:decision,justificativa:justification,contexto:contextOf(data,instance),agora:now,
  });
  if(!resumo.ok)return fail(resumo.motivo||"Não foi possível registrar a decisão.");
  return {ok:true,entityId:instance.id,status:resumo.status,data:next};
};
