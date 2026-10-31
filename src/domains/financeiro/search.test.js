import {it,expect} from 'vitest';
import {financialSearchText} from './search.js';
it('usa o mesmo recorte textual com acentos, espaços e números',()=>{
 expect(financialSearchText('  MEDIÇÃO   Fundação 12 ')).toBe('medicao fundacao 12');
 expect(financialSearchText(null)).toBe('');expect(financialSearchText(12)).toBe('12');
});
