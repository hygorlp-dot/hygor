import { describe,expect,it } from "vitest";
import { applyInvoiceCommand,INVOICE_COMMAND } from "./invoice-commands.js";

const base=()=>({
  obras:[{id:"o-1"},{id:"o-2"}],
  pedidos:[{
    id:"p-1",obraId:"o-1",status:"recebido",
    itens:[{id:"i-1",qtd:2,qtdRecebida:2,precoUnit:50}],
  }],
  notasFiscais:[],fechamentosFinanceiros:[],
});
const command=(type,payload,expectedVersion=0)=>({
  type,payload,expectedVersion,actorId:"u-1",actorName:"Financeiro",
});
const invoice=(overrides={})=>({
  id:"nf-1",tipo:"nfe",numero:"123",chave:"chave-123",
  obraId:"o-1",pedidoId:"p-1",emissao:"2026-07-28",vencimento:"2026-08-10",
  valorBruto:100,valorLiquido:1,
  retencoes:{iss:5,inss:0,irrf:0,pis:0,cofins:0,csll:0,outros:0},
  rateios:[],documentos:[],pagamentos:[],...overrides,
});

describe("comandos de notas fiscais",()=>{
  it("cria nota, calcula líquido no servidor e confere as três vias",()=>{
    const forged=invoice({
      pagamentos:[{id:"forged",status:"ativo",valor:100}],
      rateios:[{id:"r-1",obraId:"o-1",valor:100,percentual:5}],
    });
    const result=applyInvoiceCommand(base(),command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:forged},
    ));
    expect(result.ok).toBe(true);
    expect(result.data.notasFiscais[0]).toMatchObject({
      id:"nf-1",valorBruto:100,valorLiquido:95,status:"recebida",
      version:1,criadoPorId:"u-1",
    });
    expect(result.data.notasFiscais[0].threeWayMatch.status).toBe("conciliado");
    expect(result.data.notasFiscais[0].pagamentos).toEqual([]);
    expect(result.data.notasFiscais[0].rateios[0].percentual).toBe(100);
  });

  it("recusa pedido de outra obra, chave duplicada e rateio divergente",()=>{
    expect(applyInvoiceCommand(base(),command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({obraId:"o-2"})},
    )).reason).toMatch(/mesma obra/i);
    const duplicate={...base(),notasFiscais:[invoice({id:"nf-old",version:1})]};
    expect(applyInvoiceCommand(duplicate,command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice()},
    )).reason).toMatch(/chave de acesso/i);
    expect(applyInvoiceCommand(base(),command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({
        rateios:[{id:"r-1",obraId:"o-1",valor:80}],
      })},
    )).reason).toMatch(/soma dos rateios/i);
  });

  it("exige aceite explícito para aprovar divergência",()=>{
    const data={...base(),notasFiscais:[{
      ...invoice(),status:"recebida",version:1,
      divergencias:["Nota acima do recebido."],
    }]};
    expect(applyInvoiceCommand(data,command(
      INVOICE_COMMAND.INVOICE_APPROVED,{invoiceId:"nf-1"},1,
    )).reason).toMatch(/explicitamente/i);
    const approved=applyInvoiceCommand(data,command(
      INVOICE_COMMAND.INVOICE_APPROVED,{invoiceId:"nf-1",riskAccepted:true},1,
    ));
    expect(approved.data.notasFiscais[0]).toMatchObject({
      status:"aprovada",version:2,aprovadoPorId:"u-1",
    });
  });

  it("protege versão, período fechado e valores após pagamento",()=>{
    const current={...invoice(),status:"recebida",version:2,
      pagamentos:[{id:"pg-1",status:"ativo",valor:50}]};
    const data={...base(),notasFiscais:[current]};
    expect(applyInvoiceCommand(data,command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:{...current,valorBruto:120}},1,
    )).reason).toMatch(/alterada por outra pessoa/i);
    expect(applyInvoiceCommand(data,command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:{...current,valorBruto:120}},2,
    )).reason).toMatch(/pagamento ativo/i);
    const closed={...base(),fechamentosFinanceiros:[{
      status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31",
    }]};
    expect(applyInvoiceCommand(closed,command(
      INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice()},
    )).reason).toMatch(/período financeiro/i);
  });
});
