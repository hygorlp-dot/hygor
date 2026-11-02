import {it,expect} from 'vitest';
import {invoiceBankContext} from './record-continuity';
import {buildDreCashManagement} from '../conciliacao/cash-allocations';
const admin={role:'admin'},invoice={id:'n',obraId:'a',numero:'123',status:'aprovada',emissao:'2026-10-01',valorBruto:100,valorLiquido:100,pagamentos:[{id:'pg',data:'2026-10-10',valor:30,origem:'empresa',transacaoId:'t'}]};
it('segue o fato de caixa por identidade, mesmo com conta diferente na nota',()=>{
 const result=invoiceBankContext({notasFiscais:[{...invoice,contaBancariaId:'old'}],transacoes:[{id:'t',contaBancariaId:'actual',status:'parcial',valor:-30}]},'n',admin);
 expect(result.transactionIds).toEqual(['t']);expect(result.accountId).toBe('actual');expect(result.hasPayments).toBe(true);
});
it('reconhece associação de caixa ativa e ignora associação estornada ou descrição parecida',()=>{
 const data={notasFiscais:[{...invoice,pagamentos:[{...invoice.pagamentos[0],transacaoId:''}]}],transacoes:[{id:'t',valor:-30,status:'parcial'},{id:'wrong',descricao:'NF 123',valor:-30,status:'pendente'}]};
 const event=buildDreCashManagement(data).entries[0];
 data.reconciliationLinks=[{kind:'existing_cash_allocation',status:'active',eventId:event.id,transactionId:'t',amountCents:1000},{kind:'existing_cash_allocation',status:'reversed',eventId:event.id,transactionId:'wrong',amountCents:1000}];
 expect(invoiceBankContext(data,'n',admin).transactionIds).toEqual(['t']);
});
it('não amplia perfil, obra ou documento cancelado para facilitar navegação',()=>{
 const data={notasFiscais:[invoice]};
 expect(invoiceBankContext(data,'n',{role:'engenheiro'})).toBeNull();expect(invoiceBankContext(data,'n',{role:'financeiro',obraId:'b'})).toBeNull();expect(invoiceBankContext({notasFiscais:[{...invoice,status:'cancelada'}]},'n',admin)).toBeNull();
});
it('pagamento direto do cliente ou em caixa físico não abre procura por saída bancária',()=>{
 for(const origem of ['cliente_direto','caixa_obra'])expect(invoiceBankContext({notasFiscais:[{...invoice,pagamentos:[{...invoice.pagamentos[0],origem}]}]},'n',admin)).toBeNull();
});
