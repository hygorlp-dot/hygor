import { expect,it } from 'vitest';
import { mergeStructuralImportSources,quantitativeSourcePages,extractStructuralSources,structuralMeasureOrigin,trackManualStructuralChanges } from './structural-provenance';
it('registra arquivo e página real do quadro-resumo',()=>{
  const text='Capa\f1º Pavimento\nElemento\nFôrmas\nPilares\n46.91\n-\n2.400\n310\nTotal';
  const sources=extractStructuralSources(text,'Estrutural.pdf');
  expect(sources['pavimento1-pilares.concreto']).toMatchObject({arquivo:'Estrutural.pdf',paginas:[2],criterio:'Quadro-resumo do pavimento'});
});
it('separa dado ausente, zero informado, valor calculado e cópia',()=>{
  const row={key:'concreto',value:0};
  expect(structuralMeasureOrigin({},'terreo-pilares',{...row,missing:true}).status).toBe('Dado ausente');
  expect(structuralMeasureOrigin({},'terreo-pilares',row).status).toBe('Zero informado');
  expect(structuralMeasureOrigin({},'terreo-vigas',{key:'magro',value:1}).status).toBe('Valor calculado');
  const copy={memoriaCalculo:{pavimentosAdicionais:[{id:'pav_copy',nome:'Segundo',origem:'pavimento1'}]}};
  expect(structuralMeasureOrigin(copy,'pav_copy-pilares',row).detail).toContain('não extraído');
});
it('não inventa arquivo para medida legada e marca edição manual',()=>{
  expect(structuralMeasureOrigin({},'terreo-pilares',{key:'concreto',value:2}).detail).toContain('Origem não registrada');
  const before={memoriaCalculo:{terreo:{pilar:{concretoM3:2}}}};
  const after={memoriaCalculo:{terreo:{pilar:{concretoM3:3}}}};
  expect(trackManualStructuralChanges(before,after).memoriaCalculo.origensEstruturais['terreo-pilares.concreto'].tipo).toBe('manual');
});
it('reimportação substitui ajustes manuais só dos elementos presentes e preserva quadro-resumo',()=>{
  const previous={'terreo-vigas.aco-10':{tipo:'manual'},'cobertura-vigas.aco-10':{tipo:'manual'},'terreo-vigas.concreto':{tipo:'extraido',criterio:'Quadro-resumo'}};
  const next=mergeStructuralImportSources(previous,{'terreo-vigas':{tipo:'extraido',arquivo:'Novo.pdf'}});
  expect(next['terreo-vigas.aco-10']).toBeUndefined();
  expect(next['cobertura-vigas.aco-10'].tipo).toBe('manual');
  expect(next['terreo-vigas.concreto'].criterio).toBe('Quadro-resumo');
});
it('registra páginas de uma tabela que continua na página seguinte',()=>{
  expect(quantitativeSourcePages('Capa\fGrupo de Pisos Número 1: Térreo\nNúmero Pisos Iguais\nDados\fContinuação','Térreo')).toEqual([2,3]);
});
