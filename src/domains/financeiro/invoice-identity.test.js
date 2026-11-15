import {it,expect} from 'vitest';
import {applyInvoiceCommand,INVOICE_COMMAND} from './invoice-commands.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';
const invoice=(patch={})=>({id:'one',obraId:'a',tipo:'nfse',numero:'123',serie:'1',fornecedorId:'f',emissao:'2026-11-01',valorBruto:1000,...patch});
const save=(data,row)=>applyInvoiceCommand(data,{type:INVOICE_COMMAND.INVOICE_SAVED,actorId:'u',expectedVersion:0,payload:{invoice:row}});
const initial=()=>({obras:[{id:'a'},{id:'b'}],notasFiscais:[],fornecedores:[{id:'f',cnpj:'12.345.678/0001-99'},{id:'same',cnpj:'12345678000199'},{id:'other',cnpj:'98765432000100'}]});
it('recusa o mesmo documento sem chave e não altera custo nem obra',()=>{
 const first=save(initial(),invoice());expect(first.ok).toBe(true);
 const repeated=save(first.data,invoice({id:'two',obraId:'b',numero:'000123',serie:'001',fornecedorId:'same'}));
 expect(repeated).toMatchObject({ok:false,reason:expect.stringMatching(/já existe uma nota ativa/i)});
 expect(selectDRE(buildFinancialLedger(first.data),{competence:'2026-11'}).costCents).toBe(100000);
});
it.each([{fornecedorId:'other'},{serie:'2'},{numero:'124'},{emissao:'2027-11-01'},{tipo:'nfe'}])('aceita identidade documental distinta: %j',patch=>{
 const first=save(initial(),invoice());expect(save(first.data,invoice({id:'two',...patch})).ok).toBe(true);
});
it('não usa nome ou valor para unir documentos sem identidade de emissor',()=>{
 const row=invoice({fornecedorId:'',fornecedorNome:'Mesmo nome'}),first=save(initial(),row);
 expect(save(first.data,{...row,id:'two'}).ok).toBe(true);
});
