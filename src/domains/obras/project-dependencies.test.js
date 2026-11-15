import {it,expect} from 'vitest';
import {applyProjectCommand,PROJECT_COMMAND} from './project-commands.js';
const remove=data=>applyProjectCommand(data,{type:PROJECT_COMMAND.PROJECT_DELETED,actorId:'admin',expectedVersion:0,payload:{projectId:'b'}});
const base=()=>({obras:[{id:'a'},{id:'b'}]});
it.each(['orcamentos','planos','budgetBaselines','terceirizados','licencas','movEstoque','rentalChargeItems','workFileCabinets'])('preserva obra referenciada por %s',key=>{
 const data={...base(),[key]:[{id:'child',obraId:'b'}]},before=structuredClone(data);
 expect(remove(data).ok).toBe(false);expect(data).toEqual(before);
});
it('confere lotação atual, anterior e todo o histórico independentemente',()=>{
 for(const row of [{obra:'a',lastObra:'b'},{obraId:'a',obra:'b'},{obra:'a',obraHistory:[{fromObraId:'b',toObraId:'a'}]}]){
  expect(remove({...base(),employees:[{id:'e',...row}]}).ok).toBe(false);
 }
});
it('protege rateios e ponto aninhado sem comparar nomes ou valores',()=>{
 expect(remove({...base(),notasFiscais:[{id:'nf',obraId:'a',rateios:[{obraId:'b',valor:10}]}]}).ok).toBe(false);
 expect(remove({...base(),attendance:{e:{'2026-11-01':{obraId:'b'}}}}).ok).toBe(false);
});
it('permite exclusão vazia, sem usar recibos idempotentes como fatos operacionais',()=>{
 expect(remove({...base(),operationalCommandReceipts:[{obraId:'b'}],changeLog:[{obraId:'b'}]}).ok).toBe(true);
 expect(remove({...base(),employees:[{id:'e',obra:'a',name:'b'}]}).ok).toBe(true);
});
