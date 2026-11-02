import {expect,it} from 'vitest';
import {documentReviewEligibility} from './document-review-queue.js';
const row={type:'nota_fiscal',period:'2026-11',entry:{date:'2026-11-10'},record:{obraId:'a',status:'recebida',emissao:'2026-11-10'}};
it('revalida perfil, obra, período e situação antes da conferência sequencial',()=>{
 expect(documentReviewEligibility(row,{}, {role:'admin'})).toBe('');
 expect(documentReviewEligibility(row,{}, {role:'obra'})).toMatch(/Perfil/);
 expect(documentReviewEligibility(row,{}, {role:'financeiro',obraId:'b'})).toMatch(/Obra/);
 expect(documentReviewEligibility({...row,record:{...row.record,status:'aprovada'}},{},{role:'admin'})).toMatch(/Fora da fila/);
 expect(documentReviewEligibility(row,{fechamentosFinanceiros:[{status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30'}]},{role:'admin'})).toBe('Período fechado');
});
