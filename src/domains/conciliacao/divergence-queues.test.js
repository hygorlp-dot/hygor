import {it,expect} from 'vitest';
import {reconciliationDivergences} from './divergence-queues.js';
it('classifica múltiplas divergências e preserva situações confirmadas',()=>{expect(reconciliationDivergences({status:'conciliado',valor:10},{})).toEqual([]);expect(reconciliationDivergences({status:'pendente',valor:10},{melhorCandidata:{saldoCentavos:900,alertas:['Titular divergente','Possível duplicidade']}})).toEqual(['duplicate','amount','counterparty']);});
it('distingue ausência de candidato de valor zero e vínculo parcial',()=>{expect(reconciliationDivergences({status:'pendente',valor:10},{})).toEqual(['missing']);expect(reconciliationDivergences({status:'parcial',valor:10},{melhorCandidata:{}})).toEqual(['partial']);});
