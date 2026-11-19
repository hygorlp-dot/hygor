import { expect, it } from "vitest";
import { accountReviewSummary, reconciliationHistoryDetails } from "./review-context.js";
it("resume saldos parciais por conta e exclui extratos arquivados", () => {
  const rows = accountReviewSummary({ contasBancarias:[{id:"a",nome:"Conta A"}], extratos:[{id:"old",status:"arquivado"},{id:"new",contaBancariaId:"a",importadoEm:"2026-10-28T12:00:00Z"}], transacoes:[
    {id:"1",contaBancariaId:"a",status:"parcial",valor:-100,saldoNaoVinculado:20},
    {id:"2",contaBancariaId:"a",status:"pendente",valor:-50,extratoId:"old"},
    {id:"3",status:"pendente",valor:30},
  ] });
  expect(rows[0]).toMatchObject({pending:1,pendingValue:20,lastImport:"2026-10-28T12:00:00Z"});
  expect(rows[1]).toMatchObject({id:"unassigned",pending:1,pendingValue:30});
});

it('formata referências estruturadas do histórico sem alterar o registro',()=>{
  const links=[{tipo:'caixaObra',id:'caixa',entidadeId:'origem'},{tipo:'payments',id:'recebimento'}];
  expect(reconciliationHistoryDetails(links)).toBe('Caixa da obra · Registro caixa · Origem origem | Recebimento · Registro recebimento');
  expect(links[0]).toEqual({tipo:'caixaObra',id:'caixa',entidadeId:'origem'});
  expect(reconciliationHistoryDetails({conciliacaoId:'vinculo'})).toBe('Conciliação vinculo');
  expect(reconciliationHistoryDetails('Original preservado')).toBe('Original preservado');
  expect(reconciliationHistoryDetails(null)).toBe('');
});
