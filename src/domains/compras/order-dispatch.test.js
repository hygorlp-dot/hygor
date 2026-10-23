import { describe,expect,it } from "vitest";
import { applyPurchaseOrderCommand,PURCHASE_ORDER_COMMAND } from "./purchase-order-commands.js";
import { documentoPedidoHtml,linkEmailPedido,mensagemPedidoFornecedor } from "./order-dispatch.js";
import { authorizeOperationalCommand,OPERATIONAL_COMMAND_ROLES } from "../../../api/data.js";

const now="2026-07-28T12:00:00.000Z";
const base=status=>({obras:[{id:"o-1"}],pedidos:[{id:"p-1",numero:"PC-0007",obraId:"o-1",fornecedorId:"f-1",
  status,version:3,previsao:"2026-08-05",itens:[{id:"i-1",materialId:"m-1",qtd:2,precoUnit:10}]}]});
const command=(type,payload,expectedVersion=3)=>({type,payload,expectedVersion,actorId:"u-1",actorName:"Ana Compras",
  idempotencyKey:`k-${type}-0001`});
const itens=[{descricao:"Cimento <CP II>",qtd:10,unidade:"SC",precoUnit:35}];

describe("envio do pedido ao fornecedor (C2.5)",()=>{
  it("monta mensagem, e-mail e documento imprimível com o total",()=>{
    const texto=mensagemPedidoFornecedor({empresa:"ARCD",numero:"PC-0007",fornecedorNome:"Casa dos Materiais",obraNome:"Alameda",itens,previsao:"2026-08-05"});
    expect(texto).toContain("pedido de compra PC-0007");
    expect(texto).toContain("Entrega prevista: 05/08/2026");
    expect(texto).toMatch(/Total: R\$\s?350,00/);
    expect(texto).toContain("confirme o aceite");
    expect(linkEmailPedido("compras@forn.com","Pedido PC-0007",texto)).toMatch(/^mailto:compras%40forn\.com\?subject=Pedido%20PC-0007&body=/);
    const html=documentoPedidoHtml({empresa:"ARCD",numero:"PC-0007",data:"2026-07-28",fornecedorNome:"Casa",itens});
    expect(html).toContain("Cimento &lt;CP II&gt;");
    expect(html).not.toContain("<CP II>");
    expect(html).toContain("Aceite do fornecedor");
  });

  it("registra cada envio com canal e autor, sem mudar o status",()=>{
    const result=applyPurchaseOrderCommand(base("enviado"),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,{orderId:"p-1",channel:"whatsapp",destination:"81999990000"},
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({status:"enviado",version:4});
    expect(result.data.pedidos[0].envios[0]).toMatchObject({canal:"whatsapp",enviadoPor:"Ana Compras",enviadoEm:now});
    expect(applyPurchaseOrderCommand(base("enviado"),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,{orderId:"p-1",channel:"fax"},
    ),now).reason).toMatch(/canal/);
    expect(applyPurchaseOrderCommand(base("rascunho"),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,{orderId:"p-1",channel:"email"},
    ),now).reason).toMatch(/rascunho/);
    expect(applyPurchaseOrderCommand(base("cancelado"),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,{orderId:"p-1",channel:"email"},
    ),now).reason).toMatch(/cancelado/);
    expect(applyPurchaseOrderCommand(base("enviado"),command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,{orderId:"p-1",channel:"email"},2,
    ),now).reason).toMatch(/outra pessoa/);
  });

  it("registra o aceite uma vez, com nome, data e canal, e adota o prazo confirmado",()=>{
    const accept=(data,payload)=>applyPurchaseOrderCommand(data,command(
      PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SUPPLIER_ACCEPTED,{orderId:"p-1",...payload},data.pedidos[0].version,
    ),now);
    expect(accept(base("enviado"),{acceptedBy:"",acceptedAt:"2026-07-28",channel:"whatsapp"}).reason).toMatch(/nome/);
    expect(accept(base("enviado"),{acceptedBy:"João",acceptedAt:"2026-07-29",channel:"whatsapp"}).reason).toMatch(/até hoje/);
    expect(accept(base("enviado"),{acceptedBy:"João",acceptedAt:"2026-07-28",channel:"pombo"}).reason).toMatch(/canal/);
    const ok=accept(base("enviado"),{acceptedBy:"João Vendas",acceptedAt:"2026-07-28",channel:"whatsapp",confirmedForecast:"2026-08-08"});
    expect(ok.ok).toBe(true);
    expect(ok.data.pedidos[0]).toMatchObject({previsao:"2026-08-08",previsaoAnterior:"2026-08-05",version:4});
    expect(ok.data.pedidos[0].aceiteFornecedor).toMatchObject({nome:"João Vendas",data:"2026-07-28",canal:"whatsapp",registradoPor:"Ana Compras"});
    expect(accept(ok.data,{acceptedBy:"Outro",acceptedAt:"2026-07-28",channel:"email"}).reason).toMatch(/já foi registrado/);
  });

  it("só Administrador e Compras enviam ou registram aceite",()=>{
    for(const type of [PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SUPPLIER_ACCEPTED]){
      expect(OPERATIONAL_COMMAND_ROLES[type]).toEqual(["admin","compras"]);
      expect(authorizeOperationalCommand(type,"engenheiro")).toMatchObject({ok:false,status:403});
      expect(authorizeOperationalCommand(type,"compras")).toMatchObject({ok:true});
    }
  });
});
