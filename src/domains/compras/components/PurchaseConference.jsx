import {useMemo,useState} from 'react';
import {Button} from '../../../components/ui/button.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import InvoiceConference from '../../../features/financeiro/InvoiceConference.jsx';
import FinancialMemorial from '../../../features/financeiro/FinancialMemorial.jsx';
import {obterLinkArquivoOneDrive} from '../../../api.js';
import {purchaseConference,purchaseMatchLabels} from '../purchase-conference.js';
import {useWorkspaceState} from '../../../features/workflow/workspace-session.jsx';
import {isFinancialDate} from '../../financeiro/dates.js';

const money=cents=>Number.isFinite(cents)?(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Valor não disponível';
const date=value=>isFinancialDate(value)?value.split('-').reverse().join('/'):value?`Conferir data: ${value}`:'Não informada';
export default function PurchaseConference({data,dossier,asOf,canReadTitles,onOpenInvoice}){
 const model=useMemo(()=>purchaseConference(data,dossier,{asOf,includeTitles:canReadTitles}),[data,dossier,asOf,canReadTitles]);
 const instance=JSON.stringify(dossier.orders.map(order=>String(order.id)).sort());
 const [orderId,setOrderId]=useWorkspaceState('purchase-conference','orderId','',instance);
 const [invoiceId,setInvoiceId]=useWorkspaceState('purchase-conference','invoiceId','',instance);
 const [title,setTitle]=useState(null);
 const current=model.orders.find(row=>String(row.order.id)===orderId)||model.orders[0];
 const invoices=current?model.invoices.filter(n=>String(n.pedidoId)===String(current.order.id)):[];
 const invoice=invoices.find(n=>String(n.id)===invoiceId)||invoices[0];
 const titles=current?model.titles.filter(t=>t.sourceType==='pedido'?String(t.sourceId)===String(current.order.id):invoices.some(n=>String(n.id)===String(t.sourceId))):[];
 return <section className="purchase-conference" aria-label="Conferência conectada da compra">
  <header><h3>Conferir pedido, recebimento e nota</h3><p>Recebido físico, faturado, pago e conciliado são situações distintas.</p></header>
  {!current?<p>Nenhum pedido disponível para conferência.</p>:<>
   <div className="purchase-conference__selectors">
    <Select label="Pedido para conferência" value={String(current.order.id)} onChange={e=>{setOrderId(e.target.value);setInvoiceId('');}} options={model.orders.map(({order})=>({value:order.id,label:`${order.numero||order.id} · ${order.status||'Situação não informada'}`}))}/>
    {invoices.length>0&&<Select label="Nota fiscal para conferência" value={String(invoice.id)} onChange={e=>setInvoiceId(e.target.value)} options={invoices.map(n=>({value:n.id,label:`NF ${n.numero||n.id} · ${n.status||'Situação não informada'}`}))}/>}
   </div>
   <dl className="purchase-conference__amounts">
    <div><dt>Pedido</dt><dd>{money(current.amountsKnown?current.match.orderedCents:undefined)}</dd></div>
    <div><dt>Recebido registrado · valor do pedido</dt><dd>{money(current.amountsKnown?current.match.receivedCents:undefined)}</dd></div>
    <div><dt>Faturado · notas ativas</dt><dd>{money(current.amountsKnown?current.match.invoicedCents:undefined)}</dd></div>
   </dl>
   {current.amountsKnown&&current.match.issues?.length>0&&<ul className="purchase-conference__differences" aria-label="Diferenças para revisar">{current.match.issues.map(issue=><li key={issue.code}>{purchaseMatchLabels[issue.code]||'Vínculo para revisar'} · diferença {money(issue.differenceCents)}</li>)}</ul>}
   {!current.amountsKnown&&<p role="status">Dados incompletos para a comparação monetária. Confira quantidades e preços na origem.</p>}
   <p>Valores recebidos usam os preços do pedido; a comparação monetária não comprova correspondência entre itens da nota. Alertas mantêm as regras atuais de aprovação e adiantamento.</p>
   <InvoiceConference key={invoice?.id||current.order.id} documents={invoice?.documentos||[]} driveId={data.config?.oneDriveFolder?.driveId} resolveFile={obterLinkArquivoOneDrive} emptyMessage="Nenhum original disponível nesta nota. Consulte a ficha fiscal para conferir ou anexar o documento.">
    <h4>{current.order.numero||current.order.id} · Recebimento por item</h4>
    <div className="purchase-conference__table" role="region" aria-label="Quantidades do pedido e recebimento" tabIndex={0}><table><thead><tr><th>Material</th><th>Pedido</th><th>Recebido</th><th>A receber</th></tr></thead><tbody>{(current.order.itens||[]).map((item,index)=>{
     const quantity=Number(item.qtd),received=Number(item.qtdRecebida??0),valid=Number.isFinite(quantity)&&Number.isFinite(received)&&quantity>=0&&received>=0,unit=item.unidadeCompra||item.unidadeRef||'Unidade não informada';
     return <tr key={item.id||index}><th scope="row">{(data.materiais||[]).find(m=>String(m.id)===String(item.materialId))?.descricao||item.descricaoRef||'Material não identificado'}</th><td>{valid?`${quantity} ${unit}`:'Quantidade inválida'}</td><td>{valid?`${received} ${unit}`:'Quantidade inválida'}</td><td>{valid?`${Math.max(0,quantity-received)} ${unit}`:'Não calculado'}</td></tr>;
    })}</tbody></table></div>
    <h4>{invoice?`NF ${invoice.numero||invoice.id}`:'Sem nota fiscal ativa vinculada'}</h4>
    {invoice&&<><p>Emissão: {date(invoice.emissao)} · Vencimento: {date(invoice.vencimento)}</p><p>Os itens fiscais abaixo são apresentados na unidade do documento, sem conversão ou associação por descrição.</p>
     <ul>{(invoice.itensNota||[]).map((item,index)=><li key={item.nItem||index}>{item.descricao||'Item fiscal'} · {item.qtd??'Quantidade não informada'} {item.unidade||'Unidade não informada'}</li>)}</ul>
     {!(invoice.itensNota||[]).length&&<p>Nota sem detalhamento de itens. A correspondência de quantidades permanece para revisão.</p>}
     {onOpenInvoice&&<Button onClick={()=>onOpenInvoice(invoice)}>Abrir ficha fiscal</Button>}
    </>}
    {canReadTitles&&<section aria-label="Títulos da compra"><h4>Títulos em aberto · posição em {date(asOf)}</h4><p>Saldo do motor financeiro, após liquidações reconhecidas. O recebimento físico não cria outra obrigação.</p>
     {titles.map(item=><div className="purchase-conference__title" key={item.id}><div><strong>{item.documentNumber||item.description}</strong><p>{item.dueDate?date(item.dueDate):'Sem vencimento válido'} · {money(item.amountCents)}</p></div><Button variant="outline" onClick={()=>setTitle(item)}>Consultar título</Button></div>)}
     {!titles.length&&<p>Sem saldo a pagar identificado nesta posição. Confira a situação fiscal e os pagamentos na origem.</p>}
    </section>}
   </InvoiceConference>
  </>}
  {title&&<FinancialMemorial detail={{title:'Título da compra',items:[title],context:`Posição em ${asOf} · saldo em aberto`}} onClose={()=>setTitle(null)}/>}
 </section>;
}
