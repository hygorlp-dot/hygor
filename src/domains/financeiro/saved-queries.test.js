import {expect,it} from 'vitest';
import {queryStorageKey,sanitizeQuery,restoreQuery,readQueries} from './saved-queries.js';
it('isola usuário, empresa e restrição de obra; não persiste sem identidade',()=>{
 const key=queryStorageKey({id:'u'},{cnpj:'123'});
 expect(key).not.toBe(queryStorageKey({id:'v'},{cnpj:'123'}));
 expect(key).not.toBe(queryStorageKey({id:'u'},{cnpj:'456'}));
 expect(key).not.toBe(queryStorageKey({id:'u',obraId:'a'},{cnpj:'123'}));
 expect(queryStorageKey({id:'u'},{})).toBeNull();
});
it('persiste só filtros e limita entrada, sem anexos, seleção ou rascunho',()=>{
 expect(sanitizeQuery({query:'cimento',filter:'missing',obraId:'a',competence:'2026-11',documents:[{url:'secret'}],selected:'n',draft:{}})).toEqual({query:'cimento',filter:'missing',obraId:'a',competence:'2026-11'});
 expect(readQueries({getItem:()=>'{broken'},'key')).toEqual([]);
 expect(readQueries({getItem:()=>JSON.stringify([{id:'a',name:'Minha consulta',value:{query:'teste',draft:{secret:true}}}])},'key')[0].value).not.toHaveProperty('draft');
});
it('referência obsoleta conserva o recorte atual e explica a correção',()=>{
 const restored=restoreQuery({obraId:'removed',filter:'old',competence:'2026-99'},{works:[{id:'a'}],currentWork:'a'});
 expect(restored.value).toMatchObject({obraId:'a',filter:'all',competence:''});expect(restored.message).toMatch(/obra salva.*filtro salvo.*mês salvo/i);
 expect(restoreQuery({obraId:'all'},{works:[{id:'a'}],restrictedWork:'a'}).value.obraId).toBe('a');
});
it('recorte atual também obsoleto volta para todas as obras, sem restaurar obra removida',()=>{
 expect(restoreQuery({obraId:'removed'},{works:[{id:'a'}],currentWork:'also-removed'}).value.obraId).toBe('all');
 expect(restoreQuery({obraId:'a'},{works:[{id:'a',deletedAt:'2026-10-01'}],currentWork:'all'}).message).toMatch(/não está disponível/);
});
