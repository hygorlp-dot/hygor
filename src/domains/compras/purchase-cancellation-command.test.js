import { describe, expect, it } from "vitest";
import {
  applyPurchaseCancellationCommand,
  PURCHASE_CANCELLATION_COMMAND,
  purchaseCancellationCommandObraId,
} from "./purchase-cancellation-command.js";
import { calculateWorkCash } from "../financeiro/work-cash.js";

const now="2026-07-28T16:00:00.000Z";
const command=(patch={})=>({
  type:PURCHASE_CANCELLATION_COMMAND.PURCHASE_CANCELLED,
  idempotencyKey:"purchase-cancellation-0001",expectedVersion:2,
  actorId:"u-1",actorName:"Ana",
  payload:{orderId:"p-1",reason:"Pedido duplicado",...patch},
});
const data=()=>({
  pedidos:[{
    id:"p-1",numero:"PC-01",obraId:"o-1",data:"2026-07-20",status:"recebido",version:2,
    itens:[{id:"i-1",qtd:2,precoUnit:50,qtdRecebida:1,recebimentos:[{id:"r-1",qtd:1}]}],
    pagamentos:[{id:"pg-1",data:"2026-07-20",valor:50,origem:"caixa_obra",status:"ativo",version:1}],
  }],
  obras:[{id:"o-1",hasCaixa:true}],
  caixaObra:[
    {id:"a-1",obraId:"o-1",tipo:"aporte",valor:100,data:"2026-07-10",status:"ativo"},
    {id:"cx-1",obraId:"o-1",pedidoId:"p-1",pagamentoId:"pg-1",tipo:"despesa",valor:50,data:"2026-07-20",status:"ativo",version:1},
  ],
  movEstoque:[{id:"me-1",pedidoId:"p-1",obraId:"o-1",tipo:"entrada",status:"ativo",version:1}],
  notasFiscais:[{id:"n-1",numero:"10",pedidoId:"p-1",obraId:"o-1",pagamentos:[],version:1}],
  solicitacoesCompra:[{id:"s-1",pedidoId:"p-1",status:"pedido_gerado",version:1}],
  cotacoes:[{id:"c-1",pedidoId:"p-1",status:"decidida",version:1}],
  transacoes:[],fechamentosFinanceiros:[],
});

describe("cancelamento transacional de compra",()=>{
  it("cancela logicamente todos os efeitos e preserva os registros",()=>{
    const result=applyPurchaseCancellationCommand(data(),command(),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({
      status:"cancelado",version:3,motivoCancelamento:"Pedido duplicado",
    });
    expect(result.data.pedidos[0].pagamentos[0].status).toBe("estornado");
    expect(result.data.movEstoque[0].status).toBe("cancelado");
    expect(result.data.caixaObra.find(item=>item.id==="cx-1").status).toBe("estornado");
    expect(calculateWorkCash(result.data,"o-1").saldo).toBe(100);
    expect(result.data.notasFiscais[0].pedidoId).toBe("");
    expect(result.data.solicitacoesCompra[0]).toMatchObject({status:"enviada",pedidoId:""});
    expect(result.data.cotacoes[0]).toMatchObject({status:"aberta",pedidoId:""});
    expect(purchaseCancellationCommandObraId(result.data,command())).toBe("o-1");
  });

  it("preserva pagamento e caixa originados em nota fiscal",()=>{
    const initial=data();
    initial.notasFiscais[0].pagamentos=[{
      id:"pg-nf",data:"2026-07-21",valor:25,status:"ativo",origem:"caixa_obra",
    }];
    initial.pedidos[0].pagamentos.push({
      id:"pg-nf",notaFiscalId:"n-1",data:"2026-07-21",valor:25,status:"ativo",origem:"caixa_obra",
    });
    initial.caixaObra.push({
      id:"cx-nf",obraId:"o-1",pedidoId:"p-1",notaFiscalId:"n-1",pagamentoId:"pg-nf",
      tipo:"despesa",valor:25,data:"2026-07-21",status:"ativo",
    });
    const result=applyPurchaseCancellationCommand(initial,command(),now);
    expect(result.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos[0].status).toBe("ativo");
    expect(result.data.caixaObra.find(item=>item.id==="cx-nf").status).toBe("ativo");
  });

  it("bloqueia versão antiga, período fechado e pagamento conciliado",()=>{
    expect(applyPurchaseCancellationCommand(data(),command(),now).ok).toBe(true);
    expect(applyPurchaseCancellationCommand(data(),{...command(),expectedVersion:1},now).reason)
      .toMatch(/alterada/);
    const closed={...data(),fechamentosFinanceiros:[{
      id:"f-1",status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31",
    }]};
    expect(applyPurchaseCancellationCommand(closed,command(),now).reason).toMatch(/fechado/);
    const reconciled=data();
    reconciled.pedidos[0].pagamentos[0].transacaoId="t-1";
    reconciled.transacoes=[{id:"t-1",status:"conciliado"}];
    expect(applyPurchaseCancellationCommand(reconciled,command(),now).reason)
      .toMatch(/Desfaça a conciliação/);
  });

  it("permite cancelar um rascunho sem efeitos financeiros",()=>{
    const draft=data();
    draft.pedidos=[{
      id:"p-1",numero:"PC-R",obraId:"o-1",data:"2026-07-28",
      status:"rascunho",version:2,itens:[],pagamentos:[],
    }];
    draft.caixaObra=[];draft.movEstoque=[];draft.notasFiscais=[];
    const result=applyPurchaseCancellationCommand(draft,command(),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0].status).toBe("cancelado");
  });
});
