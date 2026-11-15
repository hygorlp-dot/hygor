import {it,expect} from 'vitest';
import {applyInvoiceCommand,INVOICE_COMMAND} from './invoice-commands.js';
import {validateProjectForm} from '../obras/project-validation.js';
it.each(['2026-02-31','2026-13-01','2026-04-31','2025-02-29'])('recusa data civil inexistente %s no cadastro fiscal',emissao=>{
 expect(applyInvoiceCommand({obras:[{id:'a'}]},{type:INVOICE_COMMAND.INVOICE_SAVED,actorId:'u',expectedVersion:0,payload:{invoice:{id:'nf',obraId:'a',numero:'1',emissao,valorBruto:10}}}).ok).toBe(false);
});
it('não confunde ano bissexto com data inválida',()=>{
 expect(applyInvoiceCommand({obras:[{id:'a'}]},{type:INVOICE_COMMAND.INVOICE_SAVED,actorId:'u',expectedVersion:0,payload:{invoice:{id:'nf',obraId:'a',numero:'1',emissao:'2024-02-29',valorBruto:10}}}).ok).toBe(true);
});
it('confere início, fim e entrada da obra também no servidor',()=>{
 const errors=validateProjectForm({name:'QA',contractStart:'2026-02-31',contractEnd:'2026-13-40',entradaDate:'2026-02-30',entrada:10,contractValue:20},{requireComplete:false});
 expect(errors.contractStart).toMatch(/válida/);expect(errors.contractEnd).toMatch(/válida/);expect(errors.entradaDate).toMatch(/válida/);
});
