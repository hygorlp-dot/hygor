import {it,expect} from 'vitest';
import {projectDataForUser} from './data-projection.js';
const user={id:'f',role:'financeiro',obraId:'a'};
const receipt=(key,id,actorId='f',type='NOTA_FISCAL_SALVA')=>({idempotencyKey:key,type,entityId:id,actorId,appliedAt:'2026-10-31T20:00:00Z',summary:{secret:'não retornar'}});
it('recupera somente recibos próprios de registros ainda visíveis, sem resumo',()=>{
 const data={obras:[{id:'a'},{id:'b'}],notasFiscais:[{id:'n',obraId:'a'},{id:'other-work',obraId:'b'}],operationalCommandReceipts:[receipt('mine','n'),receipt('other-user','n','someone'),receipt('other-work','other-work'),receipt('removed','missing'),receipt('other-type','n','f','NOTA_FISCAL_APROVADA')]};
 expect(projectDataForUser(data,user).operationalCommandReceipts).toEqual([{idempotencyKey:'mine',type:'NOTA_FISCAL_SALVA',entityId:'n',actorId:'f',appliedAt:'2026-10-31T20:00:00Z'}]);
});
it('não amplia acesso à recuperação quando a aba financeira foi retirada',()=>{
 expect(projectDataForUser({notasFiscais:[{id:'n',obraId:'a'}],operationalCommandReceipts:[receipt('mine','n')]},{...user,accessTabs:['home']}).operationalCommandReceipts).toBeUndefined();
});
it('correção de origem exige também acesso à aba da origem',()=>{
 const data={pedidos:[{id:'p',obraId:'a'}],operationalCommandReceipts:[receipt('p','p','f','ORIGEM_FECHAMENTO_CORRIGIDA')]};
 expect(projectDataForUser(data,{...user,accessTabs:['fin','cmp']}).operationalCommandReceipts).toHaveLength(1);
 expect(projectDataForUser(data,{...user,accessTabs:['fin']}).operationalCommandReceipts).toEqual([]);
});
