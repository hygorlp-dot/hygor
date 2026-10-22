import { describe, expect, it } from "vitest";
import { APPROVAL_COMMAND, applyApprovalCommand, approvalCommandObraId } from "./approval-commands.js";
import { applyPurchaseRequestCommand, PURCHASE_REQUEST_COMMAND } from "../compras/purchase-request-commands.js";

const now="2026-10-22T15:00:00.000Z";
const usuarios=[
  {id:"eng-1",nome:"Eng. Ana",role:"engenheiro"},
  {id:"adm-1",nome:"Admin",role:"admin"},
  {id:"cmp-1",nome:"Compras",role:"compras"},
];
const requestWith=price=>{
  const data={obras:[{id:"obra-1",engineerId:"eng-1"}],usuarios,materiais:[],solicitacoesCompra:[],instanciasAprovacao:[]};
  return applyPurchaseRequestCommand(data,{
    type:PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SAVED,idempotencyKey:"sol-approval-0001",
    expectedVersion:0,actorId:"cmp-1",actorName:"Compras",
    payload:{
      request:{id:"sol-1",numero:"SC-0001",obraId:"obra-1",necessidade:"2026-11-01",prioridade:"normal",
        itens:[{id:"i-1",materialId:"mat-1",descricaoRef:"CIMENTO",unidadeRef:"SC",unidadeCompra:"SC",
          fatorConversao:1,quantidade:10,precoRef:price}]},
      catalogMaterials:[{id:"mat-1",descricao:"CIMENTO",unidade:"SC",solicitacaoOrigemId:"sol-1"}],
    },
  },now).data;
};
const decide=(data,actorId,decisao,patch={})=>{
  const instance=data.instanciasAprovacao[0];
  const etapa=instance.resultadosEtapas.find(item=>item.status==="em_andamento");
  return applyApprovalCommand(data,{
    type:APPROVAL_COMMAND.APPROVAL_DECISION_RECORDED,idempotencyKey:`decide-${actorId}`,
    actorId,actorName:actorId,
    payload:{instanciaId:instance.id,etapaId:etapa?.etapaId,decisao,justificativa:"",...patch},
  },now);
};

describe("decisão de aprovação no servidor",()=>{
  it("o engenheiro da obra aprova a solicitação dentro da alçada",()=>{
    const result=decide(requestWith(100),"eng-1","aprovado");
    expect(result.ok).toBe(true);
    expect(result.data.instanciasAprovacao[0].status).toBe("aprovada");
    expect(result.data.decisoesAprovacao[0]).toMatchObject({aprovadorId:"eng-1",decisao:"aprovado"});
  });

  it("quem não é elegível não decide, mesmo informando outro aprovador",()=>{
    const data=requestWith(100);
    const result=decide(data,"cmp-1","aprovado",{aprovadorId:"eng-1"});
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/não está entre os aprovadores elegíveis/);
    // Acima da alçada, nem o engenheiro decide: só o Administrador.
    expect(decide(requestWith(1000),"eng-1","aprovado").ok).toBe(false);
    expect(decide(requestWith(1000),"adm-1","aprovado").data.instanciasAprovacao[0].status).toBe("aprovada");
  });

  it("reprovar exige motivo e encerra a instância",()=>{
    expect(decide(requestWith(100),"eng-1","reprovado").reason).toMatch(/motivo/);
    const result=decide(requestWith(100),"eng-1","reprovado",{justificativa:"Quantidade acima do orçado"});
    expect(result.data.instanciasAprovacao[0].status).toBe("reprovada");
    expect(decide(result.data,"eng-1","aprovado").ok).toBe(false);
  });

  it("decisão inválida e instância inexistente são recusadas; escopo segue a obra da solicitação",()=>{
    const data=requestWith(100);
    expect(decide(data,"eng-1","talvez").reason).toMatch(/inválida/);
    expect(applyApprovalCommand(data,{type:APPROVAL_COMMAND.APPROVAL_DECISION_RECORDED,actorId:"eng-1",
      payload:{instanciaId:"nao-existe",decisao:"aprovado"}},now).reason).toMatch(/não encontrada/);
    expect(approvalCommandObraId(data,{payload:{instanciaId:data.instanciasAprovacao[0].id}})).toBe("obra-1");
  });
});
