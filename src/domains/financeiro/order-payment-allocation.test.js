import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {it,expect} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND} from '../sync/operational-commands.js';
import {buildFinancialLedger,selectAccountsPayable,selectCashFlow} from './ledger.js';
import {buildProcurementFinancialFacts} from '../../../server/procurement-financial-facts.js';
import {availableOrderPayments} from './order-payment-links.js';
const fixture=()=>({obras:[{id:'a'},{id:'b'}],pedidos:[{id:'p',obraId:'a',status:'enviado',version:1,data:'2026-11-01',itens:[{qtd:10,precoUnit:100}],pagamentos:[{id:'advance',valor:300,data:'2026-11-01',origem:'empresa',status:'ativo'}]}],notasFiscais:[{id:'n',numero:'N1',pedidoId:'p',obraId:'a',status:'aprovada',version:1,emissao:'2026-11-01',valorBruto:200},{id:'n2',numero:'N2',pedidoId:'p',obraId:'a',status:'aprovada',version:1,emissao:'2026-11-01',valorBruto:400}]});
const command=(patch={})=>({type:OPERATIONAL_COMMAND.ORDER_PAYMENT_ALLOCATED,idempotencyKey:'allocation-test-0001',actorId:'u',actorRole:'financeiro',expectedVersion:1,now:'2026-11-02T12:00:00Z',payload:{targetType:'nota',targetId:'n',paymentId:'advance',orderVersion:1,allocationId:'allocation-1',valor:100,data:'2026-11-02',...patch}});
it('aloca parcialmente em duas notas sem duplicar caixa, preservando saldo e data do pagamento original',()=>{
 const data=fixture(),first=applyOperationalCommand(data,command());expect(first.ok).toBe(true);
 const ledger=buildFinancialLedger(first.data);expect(selectCashFlow(ledger).cashOutCents).toBe(30000);expect(selectAccountsPayable(ledger,{asOfDate:'2026-11-02'}).balanceCents).toBe(50000);expect(selectAccountsPayable(ledger,{asOfDate:'2026-11-01'}).balanceCents).toBe(50000);
 const cash=ledger.events.find(e=>e.effect==='cash_out'&&e.unallocated);expect(cash.amountCents).toBe(20000);expect(cash.date).toBe('2026-11-01');
 expect(applyOperationalCommand(first.data,command()).idempotent).toBe(true);
 const second=applyOperationalCommand(first.data,{...command({targetId:'n2',valor:200,orderVersion:2,allocationId:'allocation-2'}),idempotencyKey:'allocation-test-0002'});expect(second.ok).toBe(true);expect(selectCashFlow(buildFinancialLedger(second.data)).cashOutCents).toBe(30000);expect(availableOrderPayments(second.data,second.data.notasFiscais[0])).toHaveLength(0);
});
it('rejeita saldo excessivo, versão concorrente, obra diferente, rateio entre obras e período fechado',()=>{
 expect(applyOperationalCommand(fixture(),command({valor:301})).ok).toBe(false);
 expect(applyOperationalCommand(fixture(),command({orderVersion:0})).ok).toBe(false);
 const foreign=fixture();foreign.notasFiscais[0].obraId='b';expect(applyOperationalCommand(foreign,command()).ok).toBe(false);
 const split=fixture();split.notasFiscais[0].rateios=[{obraId:'a',valor:100},{obraId:'b',valor:100}];expect(applyOperationalCommand(split,command()).ok).toBe(false);
 const closed=fixture();closed.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30'}];expect(applyOperationalCommand(closed,command()).ok).toBe(false);
});
it('desfaz somente a alocação e bloqueia estorno do pagamento original enquanto alocado',()=>{
 const first=applyOperationalCommand(fixture(),command());
 const reverse={type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED,idempotencyKey:'reverse-allocation-0001',actorId:'u',expectedVersion:2,payload:{targetType:'pedido',targetId:'p',paymentId:'advance',reason:'Revisão'}};
 expect(applyOperationalCommand(first.data,reverse).ok).toBe(false);
 const undone=applyOperationalCommand(first.data,{...reverse,idempotencyKey:'reverse-allocation-0002',payload:{...reverse.payload,targetType:'nota',targetId:'n',paymentId:'allocation-1'}});expect(undone.ok).toBe(true);expect(selectCashFlow(buildFinancialLedger(undone.data)).cashOutCents).toBe(30000);expect(availableOrderPayments(undone.data,undone.data.notasFiscais[0])[0].availableCents).toBe(30000);
});

it('não deixa o comando de pagamento comum forjar uma alocação',()=>{const result=applyOperationalCommand(fixture(),{type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED,idempotencyKey:'new-payment-test-0001',actorId:'u',expectedVersion:1,payload:{targetType:'nota',targetId:'n',payment:{id:'new',valor:10,data:'2026-11-02',origem:'empresa',pedidoPagamentoId:'advance'}}});expect(result.ok).toBe(true);expect(result.data.notasFiscais[0].pagamentos[0].pedidoPagamentoId).toBe('');});

it('preserva parcelas iguais vinculadas ao mesmo banco também na projeção financeira',()=>{
 const data=fixture();data.pedidos[0].pagamentos[0].transacaoId='bank';data.transacoes=[{id:'bank',valor:-300,data:'2026-11-01',status:'conciliado'}];
 const first=applyOperationalCommand(data,command({valor:150}));expect(first.ok).toBe(true);
 const ledger=buildFinancialLedger(first.data);expect(selectCashFlow(ledger).cashOutCents).toBe(30000);
 const facts=buildProcurementFinancialFacts(first.data),order=facts.find(f=>f.legacyType==='pedido'),note=facts.find(f=>f.legacyId==='n');
 expect(order.settlements).toMatchObject([{amount:150,date:'2026-11-01'}]);expect(note.settlements).toMatchObject([{amount:150,date:'2026-11-01'}]);expect(note.titleAmount-note.settlements.reduce((s,p)=>s+p.amount,0)).toBe(50);
 expect(facts.flatMap(f=>f.settlements).reduce((s,p)=>s+p.amount,0)).toBe(300);
});

it('resolve o acesso pela nota real e rejeita obra divergente mesmo com tipo forjado',()=>{const data=fixture(),cmd=command({targetType:'pedido'});expect(validateOperationalCommandScope({data,user:{id:'u',role:'financeiro',obraId:'a'},command:cmd})).toMatchObject({ok:true,obraId:'a'});expect(validateOperationalCommandScope({data,user:{id:'u',role:'financeiro',obraId:'b'},command:cmd})).toMatchObject({ok:false});});

it('desfaz vínculo conciliado sem alterar o banco e respeita fechamento da competência da nota',()=>{
 const data=fixture();data.pedidos[0].pagamentos[0].transacaoId='bank';data.transacoes=[{id:'bank',valor:-300,status:'conciliado'}];data.notasFiscais[0].emissao='2026-11-02';const first=applyOperationalCommand(data,command());
 const reverse={type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED,idempotencyKey:'undo-linked-allocation',actorId:'u',expectedVersion:2,payload:{targetType:'nota',targetId:'n',paymentId:'allocation-1',reason:'Corrigir vínculo'}};
 const undone=applyOperationalCommand(first.data,reverse);expect(undone.ok).toBe(true);expect(undone.data.transacoes).toEqual(data.transacoes);expect(selectCashFlow(buildFinancialLedger(undone.data)).cashOutCents).toBe(30000);
 const closed={...first.data,fechamentosFinanceiros:[{status:'fechado',dataInicio:'2026-11-02',dataFim:'2026-11-02'}]};expect(applyOperationalCommand(closed,reverse).ok).toBe(false);
});
it('preserva origem herdada do pedido em pagamento antigo do cliente',()=>{const data=fixture();delete data.pedidos[0].pagamentos[0].origem;data.pedidos[0].origemPagamento='cliente_direto';const result=applyOperationalCommand(data,command());expect(result.ok).toBe(true);expect(selectCashFlow(buildFinancialLedger(result.data)).cashOutCents).toBe(0);});
