import {expect,it} from 'vitest';
import {purchasePaymentTrace} from './purchase-payment-trace.js';

it('mostra a baixa uma vez, conserva a alocação parcial e abre só o vínculo bancário registrado',()=>{
 const date='2026-11-14';
 const advance={id:'advance',data:date,valor:100,origem:'empresa',transacaoId:'bank-a',
  comprovantes:[{id:'proof',url:'https://example.test/comprovante.pdf'}]};
 const order={id:'p',numero:'PC-01',obraId:'a',status:'enviado',data:'2026-11-10',itens:[{qtd:1,precoUnit:250}],
  pagamentos:[advance]};
 const invoice={id:'nf',numero:'NF-01',obraId:'a',pedidoId:'p',status:'aprovada',emissao:date,vencimento:'2026-11-30',valorBruto:250,
  pagamentos:[{...advance,id:'allocation',valor:60,pedidoPagamentoId:advance.id},{id:'client',valor:20,data:date,origem:'cliente_direto'},
   {id:'cash',valor:10,data:date,origem:'caixa_obra'},{id:'future',valor:160,data:'2026-12-01',origem:'empresa'}]};
 const data={pedidos:[order],notasFiscais:[invoice],transacoes:[{id:'bank-a',status:'conciliado',valor:-100,data:date},
  {id:'other',status:'conciliado',valor:-100,data:date}]};
 const before=structuredClone(data);
 const trace=purchasePaymentTrace(data,{orders:[order],invoices:[invoice]},'2026-11-20');
 expect(trace.titles).toMatchObject([{sourceId:'nf',increaseCents:25000,decreaseCents:9000,balanceCents:16000,status:'parcial'}]);
 expect(trace.payments).toHaveLength(3);
 expect(Object.fromEntries(trace.payments.map(row=>[row.origin,row.amountCents]))).toEqual({empresa:10000,cliente_direto:2000,caixa_obra:1000});
 expect(trace.payments.find(row=>row.origin==='empresa')).toMatchObject({invoices:[{id:'nf'}],proofs:[{id:'proof'}],bankLinks:[{id:'bank-a'}]});
 expect(trace.payments.filter(row=>row.origin!=='empresa').every(row=>row.bankLinks.length===0)).toBe(true);
 expect(data).toEqual(before);
});
