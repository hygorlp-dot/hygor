import {it,expect} from 'vitest';
import {purchasePriceBasisKey,purchaseHistoryByBasis} from './price-comparison.js';
it('a guarda separa preços de embalagens e fatores distintos, ignorando base desconhecida',()=>{
 const common={materialId:'m',unidadeRef:'KG',unidadeCompra:'SC',fatorConversao:50,qtdRecebida:1,precoUnit:100};
 const orders=[{id:'p',data:'2026-11-17',itens:[common,{...common,unidadeCompra:'BR',fatorConversao:10,precoUnit:30},{...common,fatorConversao:25,precoUnit:60},{...common,unidadeRef:'',precoUnit:1}]}];
 const groups=purchaseHistoryByBasis(orders);
 expect(groups.size).toBe(3);expect(groups.get(purchasePriceBasisKey(common)).map(r=>r.preco)).toEqual([100]);
 expect(purchasePriceBasisKey({...common,unidadeRef:''})).toBe('');
 expect(groups.get(purchasePriceBasisKey({...common,fatorConversao:25})).map(r=>r.preco)).toEqual([60]);
});
