import {expect,it} from 'vitest';
import {planningCashTimeline} from './planning-cash-timeline.js';
const fixture=()=>({planos:[{id:'p',obraId:'a',tarefas:[{id:'t',etapaId:'s',nome:'Estrutura',inicio:'2026-11-10'},{id:'u',etapaId:'u',nome:'Cobertura',inicio:'2026-02-30'}]}],solicitacoesCompra:[{id:'r',obraId:'a',status:'enviada',planningOrigin:{planId:'p',stageId:'s'},itens:[{id:'request-line',quantidade:10,unidadeCompra:'KG'}]},{id:'other',obraId:'b',planningOrigin:{planId:'p',stageId:'s'}}],pedidos:[{id:'o',solicitacaoId:'r',obraId:'a',status:'enviado',previsao:'2026-11-12',itens:[{id:'order-line',solicitacaoItemId:'request-line',qtd:10,unidadeCompra:'KG',fatorConversao:1}]},{id:'cancel',solicitacaoId:'r',obraId:'a',status:'cancelado'},{id:'unknown',obraId:'a',status:'enviado'}]});
it('separa compra comprometida de necessidade adicional sem descontar estoque compartilhado',()=>{
 const data=fixture();data.solicitacoesCompra[0].itens=[{id:'i',materialId:'m',quantidade:10,unidadeCompra:'KG'}];data.pedidos[0].itens=[{id:'oi',materialId:'m',solicitacaoItemId:'i',qtd:10,unidadeCompra:'KG'}];const before=JSON.stringify(data);const report=planningCashTimeline(data,{obraId:'a',today:'2026-11-01',days:30});
 expect(report.rows[0]).toMatchObject({requests:[expect.objectContaining({id:'r'})],orders:[expect.objectContaining({id:'o'})],uncommitted:[]});
 expect(report.unlinkedOrders.map(o=>o.id)).toEqual(['unknown']);expect(report.undated).toBe(1);expect(JSON.stringify(data)).toBe(before);
});
it('reagendamento só muda a comparação das etapas, nunca pedidos ou títulos',()=>{
 const data=fixture(),before=JSON.stringify(data),title={id:'title',obraId:'a',forecastDate:'2026-11-05',amountCents:1000};
 const report=planningCashTimeline(data,{obraId:'a',today:'2026-11-01',days:30,shift:30,forecastRows:[{items:[title,{obraId:'b',amountCents:999}]}]});
 expect(report.originalCount).toBe(1);expect(report.simulatedCount).toBe(0);expect(report.rows.find(r=>r.id==='s').simulated).toBe('2026-12-10');expect(report.titles).toEqual([title]);expect(JSON.stringify(data)).toBe(before);
});
it('não associa pedido por descrição; explicita falta de vínculo, quantidade ou unidade',()=>{
 const data=fixture();data.pedidos[0].solicitacaoId='unrelated';data.solicitacoesCompra[0].itens[0].quantidade='';
 const report=planningCashTimeline(data,{obraId:'a',today:'2026-11-01'});
 expect(report.rows[0].uncommitted.map(r=>r.id)).toEqual(['r']);expect(report.rows[0].invalidQuantities).toBe(1);expect(report.unlinkedOrders).toHaveLength(2);
});
it('só relaciona obrigações à etapa por identidade do pedido e obra',()=>{
 const linked={id:'n1',obraId:'a',record:{pedidoId:'o'}},unlinked={id:'n2',obraId:'a',description:'Estrutura',record:{pedidoId:'cancel'}};
 const report=planningCashTimeline(fixture(),{obraId:'a',today:'2026-11-01',forecastRows:[{items:[linked,unlinked,{id:'other',obraId:'b',record:{pedidoId:'o'}}]}]});
 expect(report.rows[0].titles).toEqual([linked]);expect(report.unlinkedTitles).toEqual([unlinked]);
});
it('separa solicitações de orçamento anterior sem atribuí-las à etapa atual',()=>{
 const data=fixture();data.planos[0].budgetId='current';data.solicitacoesCompra[0].planningOrigin.budgetId='previous';
 const report=planningCashTimeline(data,{obraId:'a',today:'2026-11-01'});
 expect(report.rows[0].requests).toEqual([]);expect(report.unknownRequests.map(r=>r.id)).toEqual(['r']);
});
it('identificadores ausentes não constituem vínculo entre solicitações, pedidos e títulos',()=>{
 const data=fixture();delete data.solicitacoesCompra[0].id;delete data.pedidos[0].solicitacaoId;delete data.pedidos[0].id;
 const report=planningCashTimeline(data,{obraId:'a',today:'2026-11-01',forecastRows:[{items:[{id:'n',obraId:'a',record:{}}]}]});
 expect(report.rows[0].requests).toEqual([]);expect(report.rows[0].orders).toEqual([]);expect(report.rows[0].titles).toEqual([]);expect(report.unlinkedTitles).toHaveLength(1);
});
