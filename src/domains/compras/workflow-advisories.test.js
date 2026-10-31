import {expect,it} from 'vitest';
import {purchaseWorkflow} from './workflow-advisories.js';
const order={id:'p',obraId:'a',status:'enviado',solicitacaoId:'s',itens:[{id:'i',qtd:10,qtdRecebida:6,precoUnit:10}],pagamentos:[{id:'pay',valor:100}]};
it('orienta o avanço com pendências, responsáveis e solução sem bloquear',()=>{
 const model=purchaseWorkflow({solicitacoesCompra:[{id:'s',obraId:'a',aprovacaoInstanciaId:'apr'}],instanciasAprovacao:[{id:'apr',status:'em_andamento'}]},order);
 expect(model.stages.map(item=>item.id)).toEqual(['compra','recebimento','documento','pagamento','estoque']);
 expect(model.warnings.map(item=>item.code)).toEqual(expect.arrayContaining(['APPROVAL_PENDING','DELIVERY_PENDING','INVOICE_MISSING','PAYMENT_AHEAD_OF_CONFERENCE','STOCK_ENTRY_NOT_FOUND']));
 for(const item of model.warnings){expect(item.blocking).toBe(false);expect(item.owner).toBeTruthy();expect(item.resolution).toBeTruthy();}
});
it('deduplica pagamentos espelhados e não usa documentos de outra obra',()=>{
 const data={notasFiscais:[{id:'n',obraId:'a',pedidoId:'p',status:'recebida',valorBruto:100,pagamentos:[{id:'pay',valor:100}]},{id:'other',obraId:'b',pedidoId:'p',status:'aprovada',valorBruto:999}]};
 expect(purchaseWorkflow(data,order).amounts).toMatchObject({paidCents:10000,invoicedCents:10000});
});
it('remove avisos atuais após regularizar e mantém as etapas independentes',()=>{
 const complete={...order,itens:[{...order.itens[0],qtdRecebida:10}]};
 const data={notasFiscais:[{id:'n',obraId:'a',pedidoId:'p',status:'aprovada',valorBruto:100}],movEstoque:[{id:'e',obraId:'a',pedidoId:'p',tipo:'entrada'}]};
 expect(purchaseWorkflow(data,complete).warnings).toEqual([]);
});
