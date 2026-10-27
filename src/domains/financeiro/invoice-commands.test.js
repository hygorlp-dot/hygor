import { describe,expect,it } from "vitest";
import { applyInvoiceCommand,INVOICE_COMMAND } from "./invoice-commands.js";
import { buildFinancialLedger,selectDRE } from "./ledger.js";

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
  it("a nota sem fornecedor herda o do pedido, sem sobrescrever o que já existe",()=>{
    const data={...base(),pedidos:[{...base().pedidos[0],fornecedorId:"f-9"}]};
    const inherited=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({fornecedorId:""})}));
    expect(inherited.ok).toBe(true);
    expect(inherited.data.notasFiscais[0].fornecedorId).toBe("f-9");
    const kept=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({id:"nf-2",chave:"chave-2",fornecedorId:"f-1"})}));
    expect(kept.data.notasFiscais[0].fornecedorId).toBe("f-1");
    const semPedido=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({id:"nf-3",chave:"chave-3",pedidoId:"",fornecedorId:""})}));
    expect(semPedido.data.notasFiscais[0].fornecedorId).toBe("");
  });

  it("herdar o fornecedor do pedido não muda nenhum valor, id ou competência do razão",()=>{
    const data={...base(),fornecedores:[{id:"f-9",nome:"Cimentos SA"}],pedidos:[{...base().pedidos[0],fornecedorId:"f-9"}]};
    const eventos=nota=>buildFinancialLedger({...data,notasFiscais:[nota]}).events
      .map(({counterparty,...resto})=>resto);
    const heranca=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({fornecedorId:""})})).data.notasFiscais[0];
    const explicito=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice({fornecedorId:"f-9"})})).data.notasFiscais[0];
    expect(eventos(heranca).length).toBeGreaterThan(0);
    expect(eventos(heranca)).toEqual(eventos(explicito));
  });

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

  describe("rejeição da nota fiscal (D-A)",()=>{
    const saved=(extra={})=>{
      const created=applyInvoiceCommand(base(),command(INVOICE_COMMAND.INVOICE_SAVED,{invoice:invoice(extra)}));
      expect(created.ok).toBe(true);
      return created.data;
    };
    const reject=(data,payload={invoiceId:"nf-1",reason:"Valor não confere com o pedido"},version=1)=>
      applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_REJECTED,payload,version));

    it("a nota salva já é custo; rejeitada, sai do DRE e da conta a pagar sem ser apagada",()=>{
      const data=saved();
      const dreAntes=selectDRE(buildFinancialLedger(data),{obraId:"o-1",competence:"2026-07"});
      expect(dreAntes.costs).toBeGreaterThan(0);
      const result=reject(data);
      expect(result.ok).toBe(true);
      const nota=result.data.notasFiscais[0];
      expect(nota).toMatchObject({
        status:"rejeitada",statusAnterior:"recebida",motivoRejeicao:"Valor não confere com o pedido",
        rejeitadoPorId:"u-1",pedidoId:"p-1",version:2,
      });
      expect(nota.rejeitadoEm).toBeTruthy();
      const ledger=buildFinancialLedger(result.data);
      expect(selectDRE(ledger,{obraId:"o-1",competence:"2026-07"}).costs).toBe(0);
      expect(ledger.events.filter(event=>event.effect==="payable_increase")).toHaveLength(0);
    });

    it("exige motivo, versão atual e nota ainda ativa",()=>{
      const data=saved();
      expect(reject(data,{invoiceId:"nf-1",reason:"  "}).reason).toMatch(/motivo/i);
      expect(reject(data,{invoiceId:"nf-1",reason:"x"},9).reason).toMatch(/alterada por outra pessoa/i);
      expect(reject(data,{invoiceId:"nao-existe",reason:"x"}).reason).toMatch(/não encontrada/i);
      const feita=reject(data).data;
      expect(reject(feita,{invoiceId:"nf-1",reason:"x"},2).reason).toMatch(/já foi rejeitada/i);
    });

    it("recusa rejeitar nota com pagamento ativo e em período fechado",()=>{
      const data=saved();
      const comPagamento={...data,notasFiscais:[{...data.notasFiscais[0],pagamentos:[{id:"pg-1",status:"ativo",valor:50}]}]};
      expect(reject(comPagamento).reason).toMatch(/pagamento ativo/i);
      const fechado={...data,fechamentosFinanceiros:[{status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31"}]};
      expect(reject(fechado).reason).toMatch(/período financeiro/i);
    });

    it("não vale mais a conferência de três vias: a nota rejeitada deixa de contar no pedido",()=>{
      const data=saved();
      const rejeitada=reject(data).data;
      const outra=applyInvoiceCommand(rejeitada,command(INVOICE_COMMAND.INVOICE_SAVED,
        {invoice:invoice({id:"nf-2",chave:"chave-2",numero:"124"})}));
      expect(outra.ok).toBe(true);
      expect(outra.data.notasFiscais.find(nota=>nota.id==="nf-2").threeWayMatch.status).toBe("conciliado");
    });

    it("aprovar com divergência registra quem aceitou o risco e quais divergências eram",()=>{
      const data=saved({valorBruto:300});
      const nota=data.notasFiscais[0];
      expect(nota.divergencias.length).toBeGreaterThan(0);
      const approved=applyInvoiceCommand(data,command(INVOICE_COMMAND.INVOICE_APPROVED,{invoiceId:"nf-1",riskAccepted:true},1));
      expect(approved.data.notasFiscais[0]).toMatchObject({
        status:"aprovada",riscoAceito:true,riscoAceitoPorId:"u-1",divergenciasAceitas:nota.divergencias,
      });
    });
  });
});
