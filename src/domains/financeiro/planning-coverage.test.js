import {expect,it} from 'vitest';
import {planningRequestCoverage} from './planning-coverage.js';
const request=()=>({id:'r',obraId:'a',itens:[{id:'ri',materialId:'m',descricaoRef:'Cimento',quantidade:10,unidadeCompra:'SC',unidadeRef:'KG',fatorConversao:50}]});
const order=(id='o',qtd=6)=>({id,numero:id,obraId:'a',solicitacaoId:'r',status:'enviado',previsao:'2026-11-12',itens:[{id:`${id}i`,solicitacaoItemId:'ri',materialId:'m',qtd,unidadeCompra:'SC',unidadeRef:'KG',fatorConversao:50}]});
it('comprova cobertura parcial e completa somando pedidos distintos, sem alterar a necessidade ou o caixa',()=>{
 const r=request(),orders=[order()],before=JSON.stringify([r,orders]);
 const report=planningRequestCoverage(r,orders,'2026-11-10');expect(report.rows[0]).toMatchObject({status:'partial',committed:6,uncovered:4,commitments:[expect.objectContaining({late:true})]});expect(report.complete).toBe(false);expect(JSON.stringify([r,orders])).toBe(before);
 expect(planningRequestCoverage(r,[order(),order('two',4)]).rows[0]).toMatchObject({status:'covered',uncovered:0,committed:10});
});
it('converte somente com referência e fator explícitos, sem transformar unidade ausente em UN',()=>{
 const o=order();Object.assign(o.itens[0],{qtd:200,unidadeCompra:'KG',unidadeRef:'KG',fatorConversao:1});expect(planningRequestCoverage(request(),[o]).rows[0]).toMatchObject({committed:4,uncovered:6});
 delete o.itens[0].unidadeRef;o.itens[0].unidadeCompra='CX';delete o.itens[0].fatorConversao;expect(planningRequestCoverage(request(),[o]).rows[0]).toMatchObject({status:'review',committed:0});
 delete o.itens[0].unidadeCompra;expect(planningRequestCoverage(request(),[o]).rows[0].committed).toBe(0);
});
it('não desconta itens sem vínculo, de outra obra, cancelados, rascunhos ou com material divergente',()=>{
 const noLink=order();delete noLink.itens[0].solicitacaoItemId;
 const wrong=order('wrong');wrong.itens[0].materialId='other';
 const report=planningRequestCoverage(request(),[noLink,wrong,{...order('otherwork'),obraId:'b'},{...order('cancel'),status:'cancelado'},{...order('draft'),status:'rascunho'}]);
 expect(report.rows[0]).toMatchObject({status:'review',committed:0,uncovered:10});expect(report.unmatched).toHaveLength(1);
});
it('identidades repetidas ou ausentes e quantidades inválidas exigem revisão em vez de cobertura',()=>{
 const r=request(),o=order();o.itens.push({...o.itens[0]});expect(planningRequestCoverage(r,[o]).rows[0]).toMatchObject({status:'review',committed:0});
 expect(planningRequestCoverage(request(),[order(),order()]).rows[0]).toMatchObject({status:'review',committed:0});
 r.itens.push({...r.itens[0]});expect(planningRequestCoverage(r,[order()]).rows.every(row=>row.status==='review'&&row.committed===0)).toBe(true);
 const missing=request();delete missing.itens[0].id;missing.itens[0].quantidade=Infinity;expect(planningRequestCoverage(missing,[order()]).rows[0].quantity).toBeNull();
});
it('não cria necessidade negativa ou nova compra quando há excedente',()=>{
 expect(planningRequestCoverage(request(),[order('over',12)]).rows[0]).toMatchObject({status:'covered',uncovered:0,excess:2});
 expect(planningRequestCoverage({...request(),itens:[]},[order()])).toMatchObject({complete:false,requiresReview:true});
});
