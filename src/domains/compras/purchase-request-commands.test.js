import { describe,expect,it } from "vitest";
import {
  applyPurchaseRequestCommand,
  PURCHASE_REQUEST_COMMAND,
  purchaseRequestCommandObraId,
} from "./purchase-request-commands.js";

const base=()=>({
  obras:[{id:"obra-1",name:"Obra 1"}],
  materiais:[{id:"mat-existente",descricao:"CIMENTO",unidade:"SC",ativo:true}],
  solicitacoesCompra:[{id:"sol-antiga",numero:"SC-0001",obraId:"obra-1",version:2,itens:[]}],
  instanciasAprovacao:[],
});

const command=(overrides={})=>{
  const baseCommand={
    type:PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SAVED,
    idempotencyKey:"solicitacao-unique-001",expectedVersion:0,
    actorId:"user-1",actorName:"Engenheira",
    payload:{
    request:{id:"sol-2",numero:"SC-0002",obraId:"obra-1",necessidade:"2026-08-10",
      prioridade:"normal",itens:[{id:"item-1",materialId:"mat-novo",descricaoRef:"AÇO CA-50",
        unidadeRef:"KG",unidadeCompra:"KG",fatorConversao:1,quantidade:20}]},
    catalogMaterials:[{id:"mat-novo",descricao:"AÇO CA-50",unidade:"KG",precoMedio:8,
      solicitacaoOrigemId:"sol-2"}],
    approvalInstance:{id:"apr-1",entidadeId:"sol-2",status:"aprovada"},
    },
  };
  return {...baseCommand,...overrides,payload:{...baseCommand.payload,...(overrides.payload||{})}};
};

describe("comando transacional de solicitação de compra",()=>{
  it("persiste solicitação, insumo e aprovação juntos sem apagar registros existentes",()=>{
    const result=applyPurchaseRequestCommand(base(),command(),"2026-08-05T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.solicitacoesCompra).toHaveLength(2);
    expect(result.data.materiais).toHaveLength(2);
    expect(result.data.solicitacoesCompra.find(item=>item.id==="sol-2")?.itens[0].materialId).toBe("mat-novo");
    expect(result.data.solicitacoesCompra.find(item=>item.id==="sol-2")?.version).toBe(1);
    expect(result.data.instanciasAprovacao).toEqual([expect.objectContaining({id:"apr-1"})]);
  });

  it("recusa item cujo insumo não será persistido",()=>{
    const result=applyPurchaseRequestCommand(base(),command({payload:{catalogMaterials:[]}}));
    expect(result).toEqual({ok:false,reason:"Todos os itens precisam estar vinculados a insumos persistidos no catálogo."});
  });

  it("não sobrescreve insumo compartilhado pelo catálogo",()=>{
    const result=applyPurchaseRequestCommand(base(),command({payload:{
      request:{...command().payload.request,itens:[{...command().payload.request.itens[0],materialId:"mat-existente"}]},
      catalogMaterials:[{id:"mat-existente",descricao:"ALTERADO",unidade:"SC"}],
    }}));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("não pode ser sobrescrito");
  });

  it("protege edição concorrente por versão",()=>{
    const data=base();
    data.solicitacoesCompra.push({...command().payload.request,version:3});
    const result=applyPurchaseRequestCommand(data,command({expectedVersion:2}));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("alterada por outra pessoa");
  });

  it("resolve o escopo pela obra da solicitação",()=>{
    expect(purchaseRequestCommandObraId(base(),command())).toBe("obra-1");
  });
});

const cancelCommand=(overrides={})=>({
  type:PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_CANCELLED,
  idempotencyKey:"solicitacao-cancel-001",expectedVersion:2,
  actorId:"user-1",actorName:"Engenheira",
  payload:{requestId:"sol-antiga",reason:"Pedido duplicado"},
  ...overrides,
});

describe("cancelamento de solicitação de compra (soft-delete)",()=>{
  it("marca status:cancelada sem remover o registro do array",()=>{
    const result=applyPurchaseRequestCommand(base(),cancelCommand());
    expect(result.ok).toBe(true);
    expect(result.data.solicitacoesCompra).toHaveLength(1);
    const cancelled=result.data.solicitacoesCompra[0];
    expect(cancelled).toMatchObject({
      id:"sol-antiga",status:"cancelada",version:3,
      motivoCancelamento:"Pedido duplicado",canceladoPorId:"user-1",
    });
  });

  it("recusa cancelar de novo uma solicitação já cancelada",()=>{
    const data=base();
    const first=applyPurchaseRequestCommand(data,cancelCommand());
    const second=applyPurchaseRequestCommand(first.data,cancelCommand({expectedVersion:3}));
    expect(second.ok).toBe(false);
    expect(second.reason).toContain("já foi cancelada");
  });

  it("recusa cancelar uma solicitação que já gerou um pedido de compra",()=>{
    const data=base();
    data.solicitacoesCompra[0]={...data.solicitacoesCompra[0],status:"pedido_gerado",pedidoId:"pedido-1"};
    const result=applyPurchaseRequestCommand(data,cancelCommand());
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("já gerou um pedido de compra");
  });

  it("protege cancelamento concorrente por versão",()=>{
    const result=applyPurchaseRequestCommand(base(),cancelCommand({expectedVersion:99}));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("alterada por outra pessoa");
  });

  it("recusa cancelar uma solicitação inexistente",()=>{
    const result=applyPurchaseRequestCommand(base(),cancelCommand({payload:{requestId:"nao-existe"}}));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Solicitação não encontrada.");
  });

  it("recusa editar (SOLICITACAO_COMPRA_SALVA) uma solicitação já cancelada",()=>{
    const cancelled=applyPurchaseRequestCommand(base(),cancelCommand());
    const edit=applyPurchaseRequestCommand(cancelled.data,command({
      payload:{request:{...command().payload.request,id:"sol-antiga"}},expectedVersion:3,
    }));
    expect(edit.ok).toBe(false);
    expect(edit.reason).toContain("não pode mais ser editada");
  });

  it("resolve o escopo pela obra da solicitação também no cancelamento",()=>{
    expect(purchaseRequestCommandObraId(base(),cancelCommand())).toBe("obra-1");
  });
});
