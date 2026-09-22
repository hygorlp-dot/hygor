import { expect, it } from 'vitest';
import { structuralImportTargets, validateImportTargets, remapImportSources, mergeImportSummaries } from './structural-import-targets';
import { aplicarQuantitativosEstruturais } from './structural-import';
import { aplicarCriterioEstrutural } from './structural-quantity-policy';
import { syncStructuralQuantities } from './structural-auto-sync';

const memory = () => ({
  pavimentosAdicionais: [{ id:'pav_copy', nome:'Nova cobertura', origem:'pavimento1', temLaje:true }],
  cobertura:{pilar:{concretoM3:8}}, pav_copy:{pilar:{concretoM3:0}},
  vinculosEstruturais:{'pav_copy-pilares.concreto':'c'},
  destinosImportacao:{cobertura:'pav_copy'},
});

it('recorda destino explícito, sem usar o pavimento copiado como origem do PDF',()=>{
  expect(structuralImportTargets(memory())).toMatchObject({cobertura:'pav_copy',pavimento1:'pavimento1'});
  expect(structuralImportTargets({...memory(),destinosImportacao:{cobertura:'removido'}}).cobertura).toBe('cobertura');
  expect(()=>validateImportTargets(memory(),{cobertura:'pav_copy',terreo:'pav_copy'})).toThrow('diferente');
  expect(()=>validateImportTargets(memory(),{cobertura:'removido'})).toThrow('removido');
});

it('aplica resumo e origem no destino, preserva outro pavimento e atualiza item vinculado',()=>{
  const before={id:'b',itens:[{id:'c',descricao:'Concretagem de pilares',unidade:'M3',quantidade:0}],memoriaCalculo:memory()};
  const targets=structuralImportTargets(before.memoriaCalculo);
  const sources=remapImportSources({'cobertura-pilares.concreto':{arquivo:'Estrutural.pdf',paginas:[11]},fundacao:{paginas:[1]}},targets);
  expect(sources['pav_copy-pilares.concreto'].paginas).toEqual([11]);
  expect(sources.fundacao.paginas).toEqual([1]);
  const next=aplicarCriterioEstrutural({...before.memoriaCalculo,origensEstruturais:sources,
    resumosProjeto:mergeImportSummaries({terreo:{pilar:{concretoM3:1}}},{cobertura:{pilar:{concretoM3:2.25,formaM2:44.53}}},targets)});
  const result=syncStructuralQuantities(before,{...before,memoriaCalculo:next});
  expect(result.budget.itens[0].quantidade).toBe(2.25);
  expect(next.cobertura.pilar.concretoM3).toBe(8);
  expect(next.terreo.pilar.concretoM3).toBe(1);
  expect(next.pav_copy.pilar.formaM2).toBe(44.53);
  expect(next.vinculosEstruturais).toEqual(before.memoriaCalculo.vinculosEstruturais);
  expect(syncStructuralQuantities(result.budget,result.budget).changes).toEqual([]);
});

it('direciona quantitativos ao pavimento criado e reimporta sem somar',()=>{
  const original=memory(), groups=[{pavimento:'Cobertura',concretoVigasM3:5.06,formaVigasM2:62.57,volumeLajesM3:0}];
  const next=aplicarQuantitativosEstruturais(original,groups);
  expect(next.pav_copy.viga).toMatchObject({concretoM3:5.06,formaM2:62.57});
  expect(next.cobertura).toEqual(original.cobertura);
  expect(aplicarQuantitativosEstruturais(next,groups)).toEqual(next);
  expect(original.pav_copy.viga).toBeUndefined();
});
