import {describe,expect,it} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND as OP} from '../sync/operational-commands.js';
import {montarRecebimento} from './receipt.js';
import {purchaseWorkflow} from './workflow-advisories.js';
import {buildFinancialLedger,selectCashFlow,selectDRE} from '../financeiro/ledger.js';
import {classificarAutomacao} from '../conciliacao/automation.js';

const now='2026-10-31T15:00:00Z';
const base=()=>({usuarios:[{id:'buyer',role:'compras'}],obras:[{id:'work',hasCaixa:true}],fornecedores:[{id:'supplier',nome:'Fornecedor de teste'}],materiais:[{id:'cement',unidade:'KG'}],solicitacoesCompra:[{id:'request',obraId:'work',status:'enviada',aprovacaoInstanciaId:'approval'}],instanciasAprovacao:[{id:'approval',status:'em_andamento'}],pedidos:[],movEstoque:[],notasFiscais:[],caixaObra:[],transacoes:[]});
const order=()=>({id:'order',obraId:'work',fornecedorId:'supplier',numero:'PC-TESTE',data:'2026-10-31',previsao:'2026-11-02',status:'enviado',solicitacaoId:'request',itens:[{id:'line',materialId:'cement',qtd:10,qtdRecebida:0,precoUnit:20,unidadeRef:'KG',unidadeCompra:'SC',fatorConversao:50}]});
const cmd=(type,payload,expectedVersion=0,key=type)=>({type,payload,expectedVersion,idempotencyKey:`flow-local-${key}`,actorId:'buyer',actorName:'Operador de teste',actorRole:'compras',now});
function apply(data,command){const result=applyOperationalCommand(data,command);expect(result.ok,result.reason).toBe(true);return result;}
const create=(status='enviado')=>apply(base(),cmd(OP.PURCHASE_ORDER_SAVED,{order:{...order(),status}}));
let sequence=0;
function receive(state,quantity){const prepared=montarRecebimento(state.pedidos[0],{line:quantity},{quando:'2026-10-31',novoId:()=>`receipt-${++sequence}`,descricao:'Teste local'});expect(prepared.ok).toBe(true);return cmd(OP.PURCHASE_RECEIPT_RECORDED,{pedidoId:'order',receivedQuantities:prepared.receivedQuantities,stockEntries:prepared.stockEntries},state.pedidos[0].version,`receipt-${sequence}`);}
function saveInvoice(data){return apply(data,cmd(OP.INVOICE_SAVED,{invoice:{id:'invoice',obraId:'work',pedidoId:'order',numero:'100',tipo:'nfe',emissao:'2026-10-31',vencimento:'2026-11-10',valorBruto:200,retencoes:{},rateios:[],documentos:[]}},0));}
function pay(data,value,id='payment',type='nota'){const target=type==='nota'?data.notasFiscais[0]:data.pedidos[0];return apply(data,cmd(OP.PAYABLE_PAYMENT_RECORDED,{targetType:type,targetId:target.id,payment:{id,data:'2026-10-31',valor:value,origem:'empresa'}},target.version,id));}

describe('jornadas completas de suprimentos com avisos',()=>{
 it('recebe sem aprovação, sem nota e sem pagar; atualiza estoque uma única vez',()=>{
  const created=create();expect(created.summary.workflowWarnings[0].code).toBe('APPROVAL_PENDING');
  const operation=receive(created.data,6),received=apply(created.data,operation);
  expect(received.data.instanciasAprovacao[0].status).toBe('em_andamento');
  expect(received.data.movEstoque[0]).toMatchObject({qtd:300,qtdCompra:6,valorUnit:.4});
  expect(received.data.pedidos[0].pagamentos).toEqual([]);
  expect(received.summary.workflowWarnings.some(item=>item.code==='INVOICE_MISSING')).toBe(true);
  const replay=apply(received.data,operation);
  expect(replay.idempotent).toBe(true);expect(replay.data.movEstoque).toHaveLength(1);
  expect(replay.summary).toEqual(received.summary);
  const ledger=buildFinancialLedger(received.data);
  expect(selectCashFlow(ledger).cashOutCents).toBe(0);
  expect(selectDRE(ledger).costCents).toBe(0);
 });
 it('recebe acima do pedido em rascunho, com quantidade real e aviso auditado',()=>{
  const created=create('rascunho'),received=apply(created.data,receive(created.data,12));
  expect(received.data.pedidos[0]).toMatchObject({pedidoNaoEnviadoNoRecebimento:true,status:'parcial'});
  expect(received.data.movEstoque[0].qtd).toBe(600);
  expect(received.summary.workflowWarnings.some(item=>item.code==='RECEIPT_EXCEEDS_ORDER')).toBe(true);
 });
 it('registra nota e pagamento antes da entrega sem aprovar a conferência fiscal',()=>{
  const invoice=saveInvoice(create().data);
  const partial=pay(invoice.data,80,'partial');
  expect(partial.data.notasFiscais[0]).toMatchObject({status:'recebida',conferenciaFiscalPendente:true});
  const settled=pay(partial.data,120,'remaining');
  expect(settled.data.notasFiscais[0]).toMatchObject({status:'paga',conferenciaFiscalPendente:true});
  const ledger=buildFinancialLedger(settled.data);
  expect(selectCashFlow(ledger).cashOutCents).toBe(20000);
  expect(purchaseWorkflow(settled.data,settled.data.pedidos[0]).amounts.paidCents).toBe(20000);
  const received=apply(settled.data,receive(settled.data,10));
  const reviewed=apply(received.data,cmd(OP.INVOICE_APPROVED,{invoiceId:'invoice'},received.data.notasFiscais[0].version));
  expect(reviewed.data.notasFiscais[0]).toMatchObject({status:'paga',conferenciaFiscalPendente:false});
  expect(selectCashFlow(buildFinancialLedger(reviewed.data)).cashOutCents).toBe(20000);
  expect(reviewed.data.movEstoque).toHaveLength(1);
 });
 it('marca adiantamento automaticamente e conserva os avisos no reenvio',()=>{
  const created=create(),operation=cmd(OP.PAYABLE_PAYMENT_RECORDED,{targetType:'pedido',targetId:'order',payment:{id:'advance',data:'2026-10-31',valor:100,origem:'empresa'}},created.data.pedidos[0].version);
  const advanced=apply(created.data,operation);
  expect(advanced.data.pedidos[0].pagamentos[0]).toMatchObject({tipo:'adiantamento',motivoAdiantamento:''});
  const replay=apply(advanced.data,operation);
  expect(replay.summary).toEqual(advanced.summary);expect(replay.data.pedidos[0].pagamentos).toHaveLength(1);
  const invoiced=saveInvoice(advanced.data),payment=pay(invoiced.data,100,'another-real-payment');
  expect(payment.summary.workflowWarnings.some(item=>item.code==='ORDER_PAYMENTS_TO_REVIEW')).toBe(true);
 });
 it('mantém a automação em revisão quando falta conferência; o avanço manual permanece disponível',()=>{
  const invoice=saveInvoice(create().data);
  const result=classificarAutomacao({id:'bank',valor:-200,data:'2026-10-31',fitid:'unique'}, {identidadeProvavel:{id:'supplier'},melhorCandidata:{tipo:'nota',entidadeId:'invoice',podeRegistrarPagamento:true,bloqueios:[],alertas:[],evidenciaAutomatica:{valorExato:true,referenciaExata:true}},alternativas:[]},invoice.data);
  expect(result.automatica).toBe(false);expect(result.motivo).toMatch(/conferência fiscal/);
  expect(pay(invoice.data,200).ok).toBe(true);
 });
 it('salvar ou estornar pagamento não apaga a conferência fiscal pendente',()=>{
  const paid=pay(saveInvoice(create().data).data,80);
  const invoice=paid.data.notasFiscais[0];
  const saved=apply(paid.data,cmd(OP.INVOICE_SAVED,{invoice:{...invoice,conferenciaFiscalPendente:false}},invoice.version,'edit-after-payment'));
  expect(saved.data.notasFiscais[0].conferenciaFiscalPendente).toBe(true);
  const reversed=apply(saved.data,cmd(OP.PAYABLE_PAYMENT_REVERSED,{targetType:'nota',targetId:'invoice',paymentId:'payment',reason:'Teste de correção'},saved.data.notasFiscais[0].version,'reverse-payment'));
  expect(reversed.data.notasFiscais[0]).toMatchObject({status:'recebida',conferenciaFiscalPendente:true});
  expect(selectCashFlow(buildFinancialLedger(reversed.data)).cashOutCents).toBe(0);
 });
 it('pagamento de rascunho mantém o fato visível no caixa e avisa envio não conferido',()=>{
  const paid=pay(create('rascunho').data,100,'draft-payment','pedido');
  expect(paid.data.pedidos[0].pedidoNaoEnviadoNoPagamento).toBe(true);
  expect(selectCashFlow(buildFinancialLedger(paid.data)).cashOutCents).toBe(10000);
  expect(purchaseWorkflow(paid.data,paid.data.pedidos[0]).warnings.some(item=>item.code==='ORDER_NOT_SENT')).toBe(true);
 });
});
