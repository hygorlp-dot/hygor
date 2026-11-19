import {Button} from '../../components/ui/button.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {contar} from '../../design-system/copy.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {active,toCents} from '../../domains/financeiro/ledger.js';

const currency=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fiscalStatus={recebida:'Recebida',conferencia:'Em conferência',aprovada:'Aprovada',paga:'Paga',rejeitada:'Rejeitada'};
const matchStatus={conciliado:'Pedido, recebimento e notas conferem',aguardando_recebimento_e_nf:'Sem recebimento físico registrado',aguardando_nf:'Aguardando notas',nf_acima_recebimento:'Notas acima do recebido',parcial:'Conferência parcial'};
const money=value=>currency(toCents(value));
const quantity=value=>Number(value||0).toLocaleString('pt-BR');
const matchIssues={
 RECEIPT_EXCEEDS_ORDER:'Recebimento acima do pedido',
 INVOICE_EXCEEDS_ORDER:'Notas acima do pedido',
 INVOICE_EXCEEDS_PHYSICAL_RECEIPT:'Notas acima do recebimento físico',
};

export default function DocumentTrace({row,data,onBank,onExpenseEvidence,onException}){
 const {record,order,match,transaction,exception}=row;
 if(row.type==='nota_fiscal'){
  const receipts=(order?.itens||[]).flatMap(item=>(item.recebimentos||[]).filter(active).map(receipt=>({item,receipt})));
  const retentions=Object.entries(record.retencoes||{}).filter(([,value])=>Number(value)>0);
  const payments=(record.pagamentos||[]).filter(active);
  return <TaskDisclosure summary="Pedido, recebimento, rateio e pagamentos" defaultOpen>
   <dl className="document-evidence__metadata">
    <div><dt>Pedido</dt><dd>{order?.numero||order?.id||(record.pedidoId?'Pedido vinculado indisponível':'Sem pedido vinculado')}</dd></div>
    <div><dt>Recebimento físico</dt><dd>{match?`${currency(match.receivedCents)} · ${matchStatus[match.status]||'Confira a compra'}`:'Sem recebimento de pedido para conferir'}</dd></div>
    <div><dt>Aprovação fiscal</dt><dd>{record.conferenciaFiscalPendente?'Conferência fiscal pendente':fiscalStatus[record.status]||'Aguardando conferência'}{record.aprovadoPor?` · ${record.aprovadoPor}`:''}{record.aprovadoEm?` · ${financialDateLabel(String(record.aprovadoEm).slice(0,10))}`:''}</dd></div>
    <div><dt>Rateio da nota</dt><dd>{record.rateios?.length?`${currency(row.allocationTotal)} de ${currency(row.gross)}`:'Sem rateio detalhado'}</dd></div>
    <div><dt>Retenções</dt><dd>{retentions.length?retentions.map(([name,value])=>`${name.toUpperCase()} ${money(value)}`).join(' · '):'Sem retenções informadas'}</dd></div>
    <div><dt>Pagamentos registrados</dt><dd>{contar(payments.length,'pagamento','pagamentos')} · {currency(payments.reduce((sum,payment)=>sum+toCents(payment.valor),0))}</dd></div>
   </dl>
   {row.allocationMismatch&&<p>Confira se os valores e as obras do rateio correspondem ao valor bruto.</p>}
   {match?.issues.map(issue=><p key={issue.code}>{matchIssues[issue.code]} · {currency(issue.differenceCents)}</p>)}
   {receipts.length>0&&<TaskDisclosure summary={contar(receipts.length,'recebimento detalhado','recebimentos detalhados')}>
    <ul>{receipts.map(({item,receipt},i)=><li key={`${item.id}:${receipt.id||i}`}>{financialDateLabel(receipt.data)} · {item.descricao||item.nome||item.materialId||item.id} · {quantity(receipt.qtd)} {item.unidade||item.unidadeRef||''}</li>)}</ul>
   </TaskDisclosure>}
   {record.rateios?.length>0&&<ul aria-label="Obras do rateio">{record.rateios.map((share,i)=><li key={share.id||i}>{(data.obras||[]).find(work=>String(work.id)===String(share.obraId))?.name||'Obra indisponível'} · {money(share.valor)}</li>)}</ul>}
  </TaskDisclosure>;
 }
 if(!transaction&&!row.issues.includes('bankEvidence')&&!exception&&!onExpenseEvidence)return null;
 return <section aria-label="Origem da despesa" className="financial-record-flow">
  {transaction&&<p><strong>Movimento bancário:</strong> {transaction.descricao} · {financialDateLabel(transaction.data)} · {money(Math.abs(transaction.valor))}</p>}
  {exception&&<p><strong>Exceção documental registrada no fechamento</strong>{exception.approvedBy?` por ${exception.approvedBy}`:''}. {exception.reason}</p>}
  {row.issues.includes('bankEvidence')&&<p>Vincule o comprovante desta despesa. Se ele estiver indisponível, confira a exceção documental no fechamento da competência.</p>}
  <div className="financial-record-flow__actions">
   {onExpenseEvidence&&<Button variant="outline" onClick={()=>onExpenseEvidence(row)}>Vincular evidência à despesa</Button>}
   {onBank&&transaction&&<Button variant="outline" onClick={()=>onBank(row)}>Revisar movimento na Conciliação</Button>}
   {onException&&row.issues.includes('bankEvidence')&&<Button variant="outline" onClick={()=>onException(row.period)}>Conferir no fechamento</Button>}
  </div>
 </section>;
}
