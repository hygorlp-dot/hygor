import {it,expect} from 'vitest';
import {bankFreshness} from './bank-freshness.js';
it('isola a conta, preserva o histórico arquivado e rejeita datas inválidas',()=>{
 const data={transacoes:[{id:'a',contaBancariaId:'bank',extratoId:'s',data:'2026-08-15'},{id:'invalid',contaBancariaId:'bank',data:'2026-02-30'},{id:'deleted',contaBancariaId:'bank',data:'2026-10-30',deletedAt:'x'},{id:'other',contaBancariaId:'other',data:'2026-10-31'}],extratos:[{id:'s',status:'arquivado',importadoEm:'2026-08-17T12:00:00Z'},{id:'other',contaBancariaId:'other',importadoEm:'2026-10-31T12:00:00Z'}]};
 const before=structuredClone(data);expect(bankFreshness(data,'bank','2026-10-31')).toMatchObject({latestMovement:'2026-08-15',latestImport:'2026-08-17T12:00:00Z',referenceAfterLatest:true,statementCount:1});expect(data).toEqual(before);
 expect(bankFreshness(data,'bank','2026-08-10').referenceAfterLatest).toBe(false);
});
it('distingue ausência de dados e não usa o fim do extrato como prova de cobertura',()=>{
 expect(bankFreshness({extratos:[{id:'s',contaBancariaId:'bank',dataFim:'2026-10-31',importadoEm:'2026-02-30T10:00:00Z'}]},'bank','2026-10-31')).toMatchObject({latestMovement:null,latestImport:null,referenceAfterLatest:false});
});
