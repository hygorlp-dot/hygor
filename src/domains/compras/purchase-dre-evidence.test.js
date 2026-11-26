import {expect,it} from 'vitest';
import {purchaseDreEvidence} from './purchase-dre-evidence.js';

it('mostra compromisso, custo por competência e caixa sem duplicar a alocação do adiantamento',()=>{
 const advance={id:'pg',data:'2026-09-20',valor:100,origem:'empresa'};
 const order={id:'p',numero:'PC-01',obraId:'a',status:'enviado',data:'2026-09-01',itens:[{qtd:4,precoUnit:100}],pagamentos:[advance]};
 const note={id:'n',numero:'NF-01',obraId:'a',pedidoId:'p',emissao:'2026-09-10',competencia:'2026-10',
  categoria:'material',status:'aprovada',valorBruto:250,rateios:[{id:'r1',obraId:'a',valor:200},{id:'r2',obraId:'b',valor:50}],
  pagamentos:[{...advance,id:'alocacao',valor:60,pedidoPagamentoId:'pg'},{id:'cliente',data:'2026-11-10',valor:40,origem:'cliente_direto'}]};
 const other={...note,id:'outra',pedidoId:'outro',pagamentos:[]};
 const data={obras:[{id:'a',name:'A'},{id:'b',name:'B'}],pedidos:[order],notasFiscais:[note,other]};
 const before=structuredClone(data);
 const dossier={orders:[order],invoices:[note]};
 const result=purchaseDreEvidence(data,dossier);
 expect(result).toMatchObject({committedCents:40000,openCommitmentCents:15000,costCents:25000,paidCents:10000,clientPaidCents:4000});
 expect(result.costs.map(group=>[group.obraId,group.competence,group.amountCents,group.invoiceIds])).toEqual([
  ['a','2026-10',20000,['n']],['b','2026-10',5000,['n']],
 ]);
 expect(result.costs[0].items[0]).toMatchObject({sourceId:'n',sourceSubId:'r1',category:'material'});
 expect(purchaseDreEvidence(data,dossier,'a')).toMatchObject({costCents:20000,costs:[{obraId:'a'}]});
 expect(data).toEqual(before);
});
