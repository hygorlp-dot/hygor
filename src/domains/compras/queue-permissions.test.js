import {it,expect} from 'vitest';
import {canActOnPurchaseQueue} from './permissions.js';
const row={type:'order',stage:'recebimentos',obraId:'a'};
it('mantém recebimento de engenharia, mas não oferece edição de pedido nem operação a leitor',()=>{
 expect(canActOnPurchaseQueue({role:'engenheiro'},row)).toBe(true);
 expect(canActOnPurchaseQueue({role:'engenheiro'},{...row,stage:'pedidos'})).toBe(false);
 expect(canActOnPurchaseQueue({role:'visualizador',accessTabs:['cmp']},row)).toBe(false);
});
it('restringe usuário desativado, obra e acesso personalizado',()=>{
 for(const user of [{role:'compras',active:false},{role:'compras',obraId:'b'},{role:'compras',accessTabs:['home']}])expect(canActOnPurchaseQueue(user,row)).toBe(false);
 expect(canActOnPurchaseQueue({role:'compras',obraId:'a'},row)).toBe(true);
});
