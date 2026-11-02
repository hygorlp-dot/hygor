import {it,expect} from 'vitest';
import {previewImportedAccount} from './account-cash-preview.js';
import {buildFinancialLedger} from './ledger.js';
const statement=(id,extra={})=>({id,banco:'Banco Intermedium S/A',conta:'000009896',contaBancariaId:'',status:'ativo',...extra});
it('projeta os vínculos numa cópia, mantendo fatos, estados e campos desconhecidos',()=>{
 const data={extratos:[statement('a',{status:'arquivado'}),statement('b')],transacoes:[{id:'t1',extratoId:'a',valor:10,data:'2026-07-01',status:'conciliado',rateios:[{obraId:'obra',valor:10}]},{id:'t2',extratoId:'b',valor:-5,data:'2026-07-02',status:'ignorado'}],notasFiscais:[{id:'nf',status:'aprovada',valorBruto:10}]};
 const before=structuredClone(data),preview=previewImportedAccount(data);
 expect(data).toEqual(before);expect(preview.account).toMatchObject({conta:'000009896',agencia:'',titular:'',tipo:'',ativa:null,saldoInicial:null,dataReferenciaSaldo:null});
 expect(preview.movements).toHaveLength(2);expect(preview.reconciled).toHaveLength(1);expect(preview.ignored).toHaveLength(1);expect(preview.statements[0].status).toBe('arquivado');
 expect(preview.data.notasFiscais).toBe(data.notasFiscais);expect(data.transacoes[0].contaBancariaId).toBeUndefined();
 expect(preview.movements[0].rateios).toEqual(data.transacoes[0].rateios);expect(buildFinancialLedger(preview.data).events).toEqual(buildFinancialLedger(data).events);
});
it('recusa identidade ambígua ou vínculos preenchidos sem substituí-los',()=>{
 expect(previewImportedAccount({extratos:[statement('a'),statement('b',{conta:'11119896'})]}).error).toBeTruthy();
 expect(previewImportedAccount({extratos:[statement('a')],transacoes:[{id:'x',extratoId:'a',contaBancariaId:'existing'}]}).error).toContain('preservar');
 expect(previewImportedAccount({extratos:[{id:'x',banco:'Outro banco',conta:'9896'}]}).error).toBeTruthy();
});
it('deixa dados bancários de contrapartes fora da identificação e não deduplica fatos',()=>{
 const data={extratos:[statement('a')],transacoes:[{id:'t1',extratoId:'a',data:'2026-01-01',valor:10,descricao:'PIX',contraparteConta:'555'},{id:'t2',extratoId:'a',data:'2026-01-01',valor:10,descricao:'PIX'}]};
 const preview=previewImportedAccount(data);expect(preview.account.conta).toBe('000009896');expect(preview.repeatedGroups).toHaveLength(1);expect(preview.movements).toHaveLength(2);
});
