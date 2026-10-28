import { describe,expect,it } from "vitest";
import {
  applyPurchaseRequestCommand,
  PURCHASE_REQUEST_COMMAND,
  purchaseRequestCommandObraId,
} from "./purchase-request-commands.js";
import { authorizeOperationalCommand } from "../../../api/data.js";
import { applyOperationalCommand } from "../sync/operational-commands.js";

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
    // A instância vem do servidor; a "aprovada" enviada pelo navegador é ignorada.
    const request=result.data.solicitacoesCompra.find(item=>item.id==="sol-2");
    expect(result.data.instanciasAprovacao).toHaveLength(1);
    expect(result.data.instanciasAprovacao[0]).toMatchObject({entidadeTipo:"solicitacaoCompra",entidadeId:"sol-2"});
    expect(result.data.instanciasAprovacao[0].id).not.toBe("apr-1");
    expect(request.aprovacaoInstanciaId).toBe(result.data.instanciasAprovacao[0].id);
  });

  it("grava a solicitação nova como enviada, o status que a aba, o KPI e os botões reconhecem",()=>{
    const created=applyPurchaseRequestCommand(base(),command(),"2026-08-05T12:00:00.000Z");
    const request=created.data.solicitacoesCompra.find(item=>item.id==="sol-2");
    expect(request.status).toBe("enviada");
    // O servidor decide o status inicial: o que o navegador manda não vale.
    const forged=applyPurchaseRequestCommand(base(),command({payload:{request:{...command().payload.request,status:"pedido_gerado"}}}),"2026-08-05T12:00:00.000Z");
    expect(forged.data.solicitacoesCompra.find(item=>item.id==="sol-2").status).toBe("enviada");
    // Editar preserva o status que a solicitação já tinha (ex.: em_analise).
    const analysing={...created.data,solicitacoesCompra:created.data.solicitacoesCompra.map(item=>item.id==="sol-2"?{...item,status:"em_analise"}:item)};
    const edited=applyPurchaseRequestCommand(analysing,command({expectedVersion:1,idempotencyKey:"solicitacao-unique-002",payload:{request:{...command().payload.request,observacao:"ajuste"}}}),"2026-08-05T13:00:00.000Z");
    expect(edited.data.solicitacoesCompra.find(item=>item.id==="sol-2").status).toBe("em_analise");
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

  it("recusa editar uma solicitação que já gerou pedido",()=>{
    const data=base();
    data.solicitacoesCompra[0]={...data.solicitacoesCompra[0],status:"pedido_gerado",pedidoId:"pedido-1"};
    const edit=applyPurchaseRequestCommand(data,command({
      payload:{request:{...command().payload.request,id:"sol-antiga",numero:"SC-0001"}},expectedVersion:2,
    }));
    expect(edit.ok).toBe(false);
    expect(edit.reason).toContain("Ajuste o pedido");
  });

  it("solicitação nova sem número é numerada pelo servidor (C2.1)",()=>{
    const data=base();
    data.solicitacoesCompra.push({id:"sol-x",numero:"SC-0007",obraId:"obra-1",version:1,itens:[]});
    const result=applyPurchaseRequestCommand(data,command({payload:{request:{...command().payload.request,numero:""}}}));
    expect(result.ok).toBe(true);
    expect(result.data.solicitacoesCompra.find(item=>item.id==="sol-2").numero).toBe("SC-0008");
  });

  describe("alçada da aprovação (decidida em 22/10/2026)",()=>{
    const usuarios=[
      {id:"eng-1",nome:"Eng. Ana",role:"engenheiro"},
      {id:"adm-1",nome:"Admin",role:"admin"},
      {id:"cmp-1",nome:"Compras",role:"compras"},
    ];
    const withPeople=()=>({...base(),usuarios,obras:[{id:"obra-1",name:"Obra 1",engineerId:"eng-1"}]});
    const priced=preco=>({payload:{request:{...command().payload.request,
      itens:[{...command().payload.request.itens[0],precoRef:preco}]}}});
    const eligible=result=>result.data.instanciasAprovacao[0].resultadosEtapas
      .filter(etapa=>etapa.status==="em_andamento").flatMap(etapa=>etapa.aprovadoresElegiveis.map(user=>user.id));

    it("até R$ 5.000 aprova o engenheiro da obra",()=>{
      const result=applyPurchaseRequestCommand(withPeople(),{...command(priced(250)),actorId:"cmp-1"});
      expect(result.data.instanciasAprovacao[0].status).toBe("em_andamento");
      expect(eligible(result)).toEqual(["eng-1"]);
    });

    it("acima de R$ 5.000 vai para o Administrador",()=>{
      const result=applyPurchaseRequestCommand(withPeople(),{...command(priced(260)),actorId:"cmp-1"});
      expect(result.data.instanciasAprovacao[0].valorAprovado).toBe(5200);
      expect(eligible(result)).toEqual(["adm-1"]);
    });

    it("o engenheiro não aprova a própria solicitação",()=>{
      const result=applyPurchaseRequestCommand(withPeople(),{...command(priced(10)),actorId:"eng-1"});
      expect(eligible(result)).toEqual(["adm-1"]);
    });

    it("mudar os itens depois reinicia a aprovação; editar só a observação não",()=>{
      const created=applyPurchaseRequestCommand(withPeople(),{...command(priced(10)),actorId:"cmp-1"});
      const first=created.data.instanciasAprovacao[0].id;
      const request=created.data.solicitacoesCompra.find(item=>item.id==="sol-2");
      const notes=applyPurchaseRequestCommand(created.data,{...command({payload:{request:{...request,observacao:"Entregar cedo"}}}),
        actorId:"cmp-1",expectedVersion:1});
      expect(notes.data.instanciasAprovacao).toHaveLength(1);
      const more=applyPurchaseRequestCommand(notes.data,{...command({payload:{request:{...request,
        itens:[{...request.itens[0],quantidade:40}]}}}),actorId:"cmp-1",expectedVersion:2});
      expect(more.data.instanciasAprovacao).toHaveLength(2);
      expect(more.data.instanciasAprovacao.find(item=>item.id===first)).toMatchObject({status:"substituida"});
      expect(more.data.solicitacoesCompra.find(item=>item.id==="sol-2").aprovacaoInstanciaId).not.toBe(first);
    });

    it("cancelar a solicitação encerra a aprovação que estava pendente (C10)",()=>{
      const created=applyPurchaseRequestCommand(withPeople(),{...command(priced(10)),actorId:"cmp-1"});
      expect(created.data.instanciasAprovacao[0].status).toBe("em_andamento");
      const cancelled=applyPurchaseRequestCommand(created.data,cancelCommand({
        payload:{requestId:"sol-2",reason:"Duplicada"},expectedVersion:1}));
      expect(cancelled.ok).toBe(true);
      expect(cancelled.data.instanciasAprovacao).toHaveLength(1);
      expect(cancelled.data.instanciasAprovacao[0]).toMatchObject({
        status:"cancelada",motivoCancelamento:"Duplicada",canceladaPorId:"user-1"});
      expect(cancelled.data.instanciasAprovacao[0].concluidoEm).toBeTruthy();
    });

    it("cancelar não mexe em aprovação já concluída",()=>{
      const data=withPeople();
      data.solicitacoesCompra[0]={...data.solicitacoesCompra[0],aprovacaoInstanciaId:"apr-ok"};
      data.instanciasAprovacao=[{id:"apr-ok",status:"aprovada",concluidoEm:"2026-08-01T00:00:00.000Z"}];
      const cancelled=applyPurchaseRequestCommand(data,cancelCommand());
      expect(cancelled.data.instanciasAprovacao[0]).toMatchObject({status:"aprovada"});
    });

    it("política própria da empresa substitui a padrão",()=>{
      const data={...withPeople(),politicasAprovacao:[{id:"pol-1",nome:"Sem etapas",ativa:true,
        entidadeTipo:"solicitacaoCompra",versao:1,condicoes:[],etapas:[]}]};
      const result=applyPurchaseRequestCommand(data,{...command(priced(10000)),actorId:"cmp-1"});
      expect(result.data.instanciasAprovacao[0]).toMatchObject({policyId:"pol-1",status:"aprovada"});
      expect(result.data.politicasAprovacao).toHaveLength(1);
    });
  });
});

describe("ações da solicitação por comando (antes eram update() direto)",()=>{
  const open=(patch={})=>({...base(),fornecedores:[{id:"f-1",nome:"Depósito Central"}],
    solicitacoesCompra:[{id:"sol-a",numero:"SC-0001",obraId:"obra-1",status:"enviada",version:2,itens:[],...patch}]});
  const analysis=(overrides={})=>({type:PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_ANALYSIS_STARTED,
    idempotencyKey:"solicitacao-analise-001",expectedVersion:2,actorId:"u-compras",actorName:"Compras",
    payload:{requestId:"sol-a"},...overrides});
  const contact=(overrides={})=>({type:PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SUPPLIER_CONTACTED,
    idempotencyKey:"solicitacao-contato-001",actorId:"u-compras",actorName:"Compras",
    payload:{requestId:"sol-a",supplierId:"f-1"},...overrides});

  it("marcar em análise: enviada vira em_analise com autor, data e versão nova",()=>{
    const result=applyPurchaseRequestCommand(open(),analysis(),"2026-10-27T15:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.solicitacoesCompra[0]).toMatchObject({status:"em_analise",version:3,
      analisadoPor:"Compras",analisadoPorId:"u-compras",analisadoEm:"2026-10-27T15:00:00.000Z"});
  });

  it("só uma solicitação enviada entra em análise; versão desatualizada e inexistente são recusadas",()=>{
    expect(applyPurchaseRequestCommand(open({status:"em_analise"}),analysis()).reason).toMatch(/já está em análise/);
    expect(applyPurchaseRequestCommand(open({status:"cancelada"}),analysis()).reason).toMatch(/Só uma solicitação enviada/);
    expect(applyPurchaseRequestCommand(open({status:"pedido_gerado"}),analysis()).reason).toMatch(/Só uma solicitação enviada/);
    expect(applyPurchaseRequestCommand(open(),analysis({expectedVersion:1})).reason).toMatch(/alterada por outra pessoa/);
    expect(applyPurchaseRequestCommand(open(),analysis({payload:{requestId:"nao-existe"}})).reason).toMatch(/não encontrada/);
  });

  it("registrar contato: cria a linha com o nome do cadastro e, ao repetir, só atualiza o horário",()=>{
    const first=applyPurchaseRequestCommand(open(),contact(),"2026-10-27T15:00:00.000Z");
    expect(first.ok).toBe(true);
    expect(first.data.solicitacoesCompra[0].contatos).toEqual([
      {fornecedorId:"f-1",fornecedorNome:"Depósito Central",enviadoEm:"2026-10-27T15:00:00.000Z"}]);
    const again=applyPurchaseRequestCommand(first.data,contact({idempotencyKey:"solicitacao-contato-002"}),"2026-10-27T16:30:00.000Z");
    expect(again.data.solicitacoesCompra[0].contatos).toHaveLength(1);
    expect(again.data.solicitacoesCompra[0].contatos[0].enviadoEm).toBe("2026-10-27T16:30:00.000Z");
    // fornecedor fora do cadastro usa o nome enviado
    const avulso=applyPurchaseRequestCommand(open(),contact({payload:{requestId:"sol-a",supplierId:"f-9",supplierName:"Avulso"}}));
    expect(avulso.data.solicitacoesCompra[0].contatos[0].fornecedorNome).toBe("Avulso");
  });

  it("não registra contato em solicitação cancelada ou que já virou pedido, nem sem fornecedor",()=>{
    expect(applyPurchaseRequestCommand(open({status:"cancelada"}),contact()).reason).toMatch(/não está mais aberta/);
    expect(applyPurchaseRequestCommand(open({status:"pedido_gerado",pedidoId:"p-1"}),contact()).reason).toMatch(/não está mais aberta/);
    expect(applyPurchaseRequestCommand(open(),contact({payload:{requestId:"sol-a",supplierId:""}})).reason).toMatch(/Informe o fornecedor/);
  });

  it("o escopo por obra é o da solicitação nos dois comandos",()=>{
    expect(purchaseRequestCommandObraId(open(),analysis())).toBe("obra-1");
    expect(purchaseRequestCommandObraId(open(),contact())).toBe("obra-1");
  });

  it("o servidor confere o papel: análise para quem gere compras; contato também para engenharia; o resto leva 403",()=>{
    const A=PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_ANALYSIS_STARTED,C=PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_SUPPLIER_CONTACTED;
    for(const role of ["admin","compras","financeiro"])expect(authorizeOperationalCommand(A,role).ok,`análise ${role}`).toBe(true);
    for(const role of ["engenheiro","rh","mestre"])expect(authorizeOperationalCommand(A,role),`análise ${role}`).toMatchObject({ok:false,status:403});
    for(const role of ["admin","compras","engenheiro","engenheiro_auditor"])expect(authorizeOperationalCommand(C,role).ok,`contato ${role}`).toBe(true);
    for(const role of ["rh","financeiro","mestre"])expect(authorizeOperationalCommand(C,role),`contato ${role}`).toMatchObject({ok:false,status:403});
  });

  it("passa pelo redutor compartilhado do navegador e do servidor",()=>{
    const result=applyOperationalCommand(open(),{...analysis(),actorRole:"compras",now:"2026-10-27T15:00:00.000Z"});
    expect(result.ok).toBe(true);
    expect(result.data.solicitacoesCompra[0].status).toBe("em_analise");
  });
});
