import {useMemo,useState} from 'react';
import {Button} from '../../../components/ui/button.jsx';
import {financialDateLabel} from '../../financeiro/dates.js';
import DocumentEvidence from '../../../features/financeiro/DocumentEvidence.jsx';
import {purchasePaymentTrace} from '../purchase-payment-trace.js';

const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const origins={empresa:'Conta da empresa',caixa_obra:'Caixa da obra',cliente_direto:'Pagamento direto pelo cliente'};
const statuses={liquidado:'Liquidado',parcial:'Parcial',vencido:'Vencido',aberto:'Em aberto'};
const bankStatuses={conciliado:'Conciliado',parcial:'Vínculo parcial',pendente:'A conciliar',ignorado:'Ignorado'};

export default function PurchasePaymentTrace({data,dossier,date,onOpenTitle,onOpenBank}){
 const {titles,payments}=useMemo(()=>purchasePaymentTrace(data,dossier,date),[data,dossier,date]);
 const [openProof,setOpenProof]=useState(null);
 return <>
  <h3>Pagamentos e conciliação</h3>
  <h4>Obrigações da compra</h4>
  {titles.length===0&&<p>Sem obrigação reconhecida para os documentos desta compra até {financialDateLabel(date)}.</p>}
  {titles.map(item=><article key={item.key}>
   <h4>{item.sourceType==='nota_fiscal'?'NF':'Pedido'} {item.source.numero||item.source.id} · {statuses[item.status]||'A conferir'}</h4>
   <p>Vencimento {financialDateLabel(item.dueDate||item.source.vencimento||item.source.dataVencimento,'não informado')}{item.source.aprovadoPor?` · Aprovação fiscal por ${item.source.aprovadoPor}`:''}</p>
   <dl className="grid grid-cols-2 gap-2">
    <div><dt>Valor da obrigação</dt><dd>{money(item.increaseCents)}</dd></div>
    <div><dt>Liquidado</dt><dd>{money(item.decreaseCents)}</dd></div>
    <div><dt>Saldo a pagar</dt><dd>{money(item.balanceCents)}</dd></div>
   </dl>
   {item.sourceType==='nota_fiscal'&&onOpenTitle&&<Button variant="outline" onClick={()=>onOpenTitle(item.source)}>Consultar em Pagamentos</Button>}
  </article>)}
  <h4>Baixas registradas</h4>
  {payments.length===0&&<p>Nenhum pagamento registrado no razão até {financialDateLabel(date)}.</p>}
  {payments.map(row=><article key={row.id}>
   <h4>Pedido {row.order.numero||row.order.id} · {money(row.amountCents)}</h4>
   <p>{financialDateLabel(row.date)} · {origins[row.origin]||'Origem do pagamento não informada'}</p>
   {row.invoices.length>0&&<p>Notas vinculadas · {row.invoices.map(note=>note.numero||note.id).join(', ')}</p>}
   {row.proofs.length>0?<Button variant="outline" aria-expanded={openProof===row.id} onClick={()=>setOpenProof(openProof===row.id?null:row.id)}>Comprovantes desta baixa</Button>:<p>Sem comprovante vinculado à baixa.</p>}
   {openProof===row.id&&<DocumentEvidence documents={row.proofs} title="Comprovantes da baixa" driveId={data.config?.oneDriveFolder?.driveId}/>}
   {row.bankLinks.map(transaction=><div key={transaction.id}>
    <p>Extrato · {financialDateLabel(transaction.data)} · {bankStatuses[transaction.status]||'A conferir'}</p>
    {onOpenBank&&<Button variant="outline" onClick={()=>onOpenBank(row,transaction)}>Abrir movimento na Conciliação</Button>}
   </div>)}
   {row.origin==='empresa'&&!row.bankLinks.length&&<p>Sem movimento bancário vinculado.</p>}
  </article>)}
 </>;
}
