import {it,expect} from 'vitest';
import {mergeRecordEdits,formatInvoiceEditor,sameRecordValue} from './record-recovery';
it('ordem de propriedades em referências não cria conflito nem outra tentativa',()=>{
 expect(sameRecordValue({documentos:[{url:'https://example.test',nome:'Original'}]},{documentos:[{nome:'Original',url:'https://example.test'}]})).toBe(true);
});
it('prepara notas legadas sem campos opcionais para a revisão sem quebrar o editor',()=>{
 const formatted=formatInvoiceEditor({id:'n',valorBruto:100,version:1});expect(formatted.valorBruto).toBe('100');expect(formatted.documentos).toEqual([]);expect(formatted.retencoes).toMatchObject({iss:0,inss:0});expect(formatted.rateios).toEqual([]);
});
it('preserva edição local e alterações de outra pessoa em campos distintos',()=>{
 expect(mergeRecordEdits({categoria:'',descricao:'antes',version:0},{categoria:'material',descricao:'antes',version:0},{categoria:'',descricao:'atual',version:1},['categoria','descricao'])).toEqual({merged:{categoria:'material',descricao:'atual',version:1},conflicts:[]});
});
it('exige escolha no mesmo campo e não sobrescreve pagamentos do servidor',()=>{
 const base={categoria:'antes'},mine={categoria:'minha',pagamentos:[]},current={categoria:'atual',pagamentos:[{id:'novo'}],version:2};
 expect(mergeRecordEdits(base,mine,current,['categoria']).conflicts).toEqual(['categoria']);
 const result=mergeRecordEdits(base,mine,current,['categoria'],{categoria:'current'});expect(result.conflicts).toEqual([]);expect(result.merged).toEqual(current);
});
