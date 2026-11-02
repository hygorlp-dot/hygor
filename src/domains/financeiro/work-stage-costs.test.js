import {it,expect} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {workStageCosts} from './work-stage-costs.js';
const data={obras:[{id:'o',name:'Obra'}],budgetBaselines:[{obraId:'o',tipo:'controle',ativo:true,budgetId:'b'}],orcamentos:[{id:'b',obraId:'o',etapas:[{id:'s',nome:'Estrutura'}],itens:[{id:'i',etapaId:'s',quantidade:1,precoUnit:1000}]}],pedidos:[{id:'p',obraId:'o',status:'enviado',data:'2026-10-01',itens:[{id:'item',orcNivel1Id:'s',qtd:8,precoUnit:100,qtdRecebida:3}]}],notasFiscais:[{id:'n',pedidoId:'p',obraId:'o',status:'aprovada',emissao:'2026-10-01',valorBruto:400,pagamentos:[{id:'pg',valor:200,data:'2026-10-05'}]}]};
it('reconhece custo pela competência mesmo com emissão posterior e mantém caixa pela data',()=>{
 const d={...data,notasFiscais:[{...data.notasFiscais[0],competencia:'2026-10',emissao:'2026-11-05',pagamentos:[{id:'future',valor:200,data:'2026-11-05'}]}]};
 const r=workStageCosts(d,buildFinancialLedger(d),'o','2026-10-30');
 expect(r.totals.incurred).toBe(40000);expect(r.totals.paid).toBe(0);
});
it('etapa inválida explícita não é substituída por inferência a partir do pedido',()=>{
 const d={...data,notasFiscais:[{...data.notasFiscais[0],etapaId:'removed-stage'}]};
 const r=workStageCosts(d,buildFinancialLedger(d),'o','2026-10-30');
 expect(r.rows.find(x=>x.id==='unassigned').incurred).toBe(40000);
});
it('separa contratado, recebido físico, custo e pagamento sem somá-los na previsão',()=>{
 const r=workStageCosts(data,buildFinancialLedger(data),'o','2026-10-30');
 expect(r.rows[0]).toMatchObject({budget:100000,committed:80000,received:30000,incurred:40000,paid:20000,remaining:60000,forecast:100000});
 expect(r.rows[0].entries.received[0].amountCents).toBe(30000);
});
it('mantém custos sem etapa visíveis e separa pagamento direto do cliente',()=>{
 const d={...data,pedidos:[],notasFiscais:[{...data.notasFiscais[0],pedidoId:'',pagamentos:[{id:'c',valor:200,data:'2026-10-05',origem:'cliente_direto'}]}]};
 const r=workStageCosts(d,buildFinancialLedger(d),'o','2026-10-30');
 expect(r.rows.find(x=>x.id==='unassigned')).toMatchObject({incurred:40000,paid:0,clientPaid:20000});
 expect(r.totals.incurred).toBe(40000);
});
it('sem orçamento não inventa etapas e pagamentos futuros não compõem pago',()=>{
 const d={...data,budgetBaselines:[],notasFiscais:[{...data.notasFiscais[0],pagamentos:[{id:'f',valor:200,data:'2026-12-01'}]}]};
 const r=workStageCosts(d,buildFinancialLedger(d),'o','2026-10-30');expect(r.budget).toBeNull();expect(r.totals.paid).toBe(0);expect(r.totals.incurred).toBe(40000);
});
it('rateia custo por etapa e mantém pagamento de nota multietapas sem inferência',()=>{
 const d={...data,orcamentos:[{...data.orcamentos[0],etapas:[{id:'s',nome:'Estrutura'},{id:'t',nome:'Pintura'}]}],notasFiscais:[{...data.notasFiscais[0],rateios:[{id:'r1',obraId:'o',etapaId:'s',valor:100},{id:'r2',obraId:'o',etapaId:'t',valor:300}]}]};
 const r=workStageCosts(d,buildFinancialLedger(d),'o','2026-10-30');
 expect(r.rows.find(x=>x.id==='s').incurred).toBe(10000);
 expect(r.rows.find(x=>x.id==='t').incurred).toBe(30000);
 expect(r.rows.find(x=>x.id==='unassigned').paid).toBe(20000);
 expect(r.totals.incurred).toBe(40000);
});
