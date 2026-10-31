import {it,expect} from 'vitest';
import {purchaseConference} from './purchase-conference.js';
const order={id:'p',obraId:'a',status:'enviado',itens:[{id:'line',materialId:'cement',qtd:10,qtdRecebida:4,precoUnit:20}]};
const invoice={id:'n',obraId:'a',pedidoId:'p',status:'aprovada',emissao:'2026-10-01',vencimento:'2026-10-31',valorBruto:160,valorLiquido:160,pagamentos:[{id:'pg',valor:60,data:'2026-10-02'}]};
it('separa valor pedido, recebido e faturado e usa saldo residual canônico',()=>{
 const dossier={orders:[order],invoices:[invoice]};
 const result=purchaseConference({pedidos:[order],notasFiscais:[invoice]},dossier,{asOf:'2026-10-31',includeTitles:true});
 expect(result.orders[0].match).toMatchObject({orderedCents:20000,receivedCents:8000,invoicedCents:16000});
 expect(result.orders[0].match.issues.some(issue=>issue.code==='INVOICE_EXCEEDS_PHYSICAL_RECEIPT')).toBe(true);
 expect(result.titles.reduce((sum,title)=>sum+title.amountCents,0)).toBe(10000);
});
it('não associa nota por fornecedor ou descrição e exclui cancelamentos e obra diferente',()=>{
 const other={...invoice,id:'other',obraId:'b'},cancelled={...invoice,id:'cancelled',status:'cancelada'};
 const result=purchaseConference({pedidos:[order],notasFiscais:[other,cancelled]},{orders:[order],invoices:[other,cancelled]},{asOf:'2026-10-31'});
 expect(result.orders[0].match.invoicedCents).toBe(0);
 expect(result.invoices).toEqual([]);
 expect(result.titles).toEqual([]);
});
it('mantém notas parciais explícitas e não certifica valores quando faltam dados do pedido',()=>{
 const second={...invoice,id:'second',valorBruto:40,valorLiquido:40,pagamentos:[]};
 const result=purchaseConference({pedidos:[order],notasFiscais:[invoice,second]},{orders:[order],invoices:[invoice,second]});
 expect(result.invoices).toHaveLength(2);expect(result.orders[0].match.invoicedCents).toBe(20000);
 expect(result.orders[0].amountsKnown).toBe(true);
 const unknown={...order,itens:[{...order.itens[0],precoUnit:undefined}]};
 expect(purchaseConference({pedidos:[unknown]},{orders:[unknown],invoices:[]}).orders[0].amountsKnown).toBe(false);
});
