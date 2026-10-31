import {it,expect} from 'vitest';
import {financeNextAction} from './next-action.js';
const user={role:'financeiro'};
const item={sourceType:'nota_fiscal',sourceId:'n',obraId:'a'};
const data={notasFiscais:[{id:'n',obraId:'a',status:'aprovada'}]};
it('usa a origem atual, sem depender da descrição ou do valor',()=>{
 expect(financeNextAction(data,{...item,description:'qualquer texto'},user)).toMatchObject({kind:'invoice',id:'n',label:'Conferir documento'});
 expect(financeNextAction(data,{...item,sourceId:'outro'},user)).toBeNull();
 expect(financeNextAction({...data,notasFiscais:[{...data.notasFiscais[0],status:'cancelada'}]},item,user)).toBeNull();
});
it('respeita obra fixa e acessos personalizados, inclusive no atalho de compras',()=>{
 expect(financeNextAction(data,item,{...user,obraId:'b'})).toBeNull();
 expect(financeNextAction(data,{...item,obraId:'b'},user)).toBeNull();
 expect(financeNextAction(data,item,{role:'engenheiro',accessTabs:['fin']})).toBeNull();
 expect(financeNextAction(data,item,{...user,accessTabs:['cmp']})).toBeNull();
 expect(financeNextAction({pedidos:[{id:'p',obraId:'a'}]},{sourceType:'pedido',sourceId:'p',obraId:'a'},{...user,accessTabs:['fin']})).toBeNull();
});
it('mantém somente a consulta quando não existe destino comprovado',()=>{
 expect(financeNextAction(data,{...item,sourceType:'titulo_folha'},user)).toBeNull();
 expect(financeNextAction(data,{...item,sourceType:'nota_fiscal',sourceId:''},user)).toBeNull();
});
