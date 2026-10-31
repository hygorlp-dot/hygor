import {expect,it} from 'vitest';
import {invoiceImportConflicts} from './invoice-import-preview.js';
const invoice={id:'stored',chave:'key',numero:'123',serie:'1',documentoFornecedor:'12.345.678/0001-90',status:'recebida'};
it('chave ativa já cadastrada impede uma segunda importação, mas permite editar a própria nota',()=>{
 expect(invoiceImportConflicts({notasFiscais:[invoice]},invoice).duplicate.id).toBe('stored');
 expect(invoiceImportConflicts({notasFiscais:[invoice]},invoice,'stored').duplicate).toBeUndefined();
 expect(invoiceImportConflicts({notasFiscais:[{...invoice,status:'rejeitada'}]},invoice).duplicate).toBeUndefined();
});
it('fornecedor, série e número similares são sinalizados para revisão sem fundir notas',()=>{
 const data={notasFiscais:[invoice]};
 const result=invoiceImportConflicts(data,{...invoice,chave:'other',documentoFornecedor:'12345678000190'});
 expect(result.duplicate).toBeUndefined();expect(result.similar).toHaveLength(1);expect(data.notasFiscais).toHaveLength(1);
});
