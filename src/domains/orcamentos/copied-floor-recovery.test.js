import { expect,it } from 'vitest';
import { copiedFloorRecoveries,recoverCopiedFloor } from './copied-floor-recovery';
import { syncStructuralQuantities } from './structural-auto-sync';
import { memoryFloors } from './budget-floors';
const base=()=>({id:'b',etapas:[{id:'s',nome:'(SUPRAESTRUTURA) COBERTURA'}],itens:[{id:'c',etapaId:'s',descricao:'Concretagem de pilares',unidade:'M3',quantidade:0}],memoriaCalculo:{cobertura:{pilar:{concretoM3:2.25,formaM2:44.53}},pav_copy:{pilar:{concretoM3:0}},pavimentosAdicionais:[{id:'pav_copy',nome:'(SUPRAESTRUTURA) COBERTURA',origem:'pavimento1',etapaId:'s',nivelM:3.15}],vinculosEstruturais:{'pav_copy-pilares.concreto':'c'}}});
it('unifica cobertura importada e etapa copiada, liberando o destino correto sem perder dados',()=>{
 const b=base();expect(copiedFloorRecoveries(b)).toHaveLength(1);
 const next=syncStructuralQuantities(b,recoverCopiedFloor(b,'pav_copy')).budget;
 expect(next.itens[0].quantidade).toBe(2.25);
 expect(next.memoriaCalculo.vinculosEstruturais).toEqual({'cobertura-pilares.concreto':'c'});
 expect(memoryFloors(next.memoriaCalculo).filter(f=>/cobertura/i.test(f.nome))).toHaveLength(1);
 expect(next.memoriaCalculo.cadastroPavimentos.cobertura).toMatchObject({etapaId:'s',nivelM:3.15});
 expect(next.memoriaCalculo.destinosImportacao.cobertura).toBe('cobertura');
 expect(copiedFloorRecoveries(next)).toEqual([]);expect(b.memoriaCalculo.pav_copy).toBeDefined();
});
it('não unifica pavimentos medidos separadamente, importados ou com vínculos conflitantes',()=>{
 const measured=base();measured.memoriaCalculo.pav_copy.pilar.concretoM3=1;
 expect(copiedFloorRecoveries(measured)).toEqual([]);
 const imported=base();imported.memoriaCalculo.origensEstruturais={'pav_copy-pilares':{arquivo:'outro.pdf'}};
 expect(copiedFloorRecoveries(imported)).toEqual([]);
 const conflict=base();conflict.memoriaCalculo.vinculosEstruturais['cobertura-pilares.concreto']='different';
 expect(copiedFloorRecoveries(conflict)).toEqual([]);
});
