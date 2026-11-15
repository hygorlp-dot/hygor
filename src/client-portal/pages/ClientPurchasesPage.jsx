import {useState} from "react";
import {ChevronDown} from "lucide-react";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import {portalDate,portalMoney} from "../format.js";
export function ClientPurchasesPage({data}){
  const [query,setQuery]=useState(""),[limit,setLimit]=useState(20);
  const orders=(data.purchaseOrders||[]).filter(order=>`${order.number} ${order.supplierName}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const invoices=data.invoices||[];
  const standaloneInvoices=invoices.filter(invoice=>!invoice.orderId||!(data.purchaseOrders||[]).some(order=>order.id===invoice.orderId));
  const renderInvoice=invoice=><article key={invoice.id} className="arcd-client-record"><h4>Nota fiscal {invoice.number} · {invoice.supplierName}</h4><p>{portalDate(invoice.issuedAt)} · {portalMoney(invoice.grossAmount)}</p>{invoice.documents?.length?<ul>{invoice.documents.map(document=><li key={document.id}>{document.url?<a className="arcd-client-link" href={document.url} target="_blank" rel="noreferrer">{document.title||"Abrir nota fiscal"}</a>:<span>Anexo cadastrado sem endereço disponível</span>}</li>)}</ul>:<p className="arcd-client-muted">Nenhum anexo liberado para este acesso. Solicite à equipe o documento original.</p>}</article>;
  return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Compras e notas fiscais" description="Consulte pedidos, itens, entregas e as notas vinculadas pela equipe."/>
    <Input label="Pesquisar compra ou fornecedor" type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(20);}}/>
    {orders.length?orders.slice(0,limit).map(order=><details key={order.id} className="arcd-client-disclosure"><summary><div><strong>{order.number} · {order.supplierName}</strong><span>{portalDate(order.date)} · {String(order.status||"").replaceAll("_"," ")}</span></div><strong>{portalMoney(order.total)}</strong><span className="arcd-client-disclosure__action"><span className="arcd-client-disclosure__show">Ver itens e notas</span><span className="arcd-client-disclosure__hide">Recolher compra</span><ChevronDown aria-hidden="true"/></span></summary><div className="arcd-client-disclosure__body"><ul>{order.items?.map((item,index)=><li key={index}>{item.description} · {item.quantity} {String(item.unit).toUpperCase()==="SC"?"sacos (SC)":item.unit} · {portalMoney(item.unitPrice)} por unidade · recebido: {item.receivedQuantity}</li>)}</ul><h3>Notas fiscais da compra</h3>{invoices.some(invoice=>invoice.orderId===order.id)?invoices.filter(invoice=>invoice.orderId===order.id).map(renderInvoice):<p>Nenhuma nota fiscal vinculada e liberada para este pedido.</p>}</div></details>):<EmptyState title="Nenhuma compra neste recorte" description="Revise a busca ou aguarde a liberação pela equipe."/>}
    {orders.length>limit&&<Button variant="secondary" onClick={()=>setLimit(value=>value+20)}>Mostrar mais compras</Button>}
    {standaloneInvoices.length>0&&<section className="arcd-client-stack"><h3>Notas sem pedido vinculado</h3>{standaloneInvoices.map(renderInvoice)}</section>}
    <p className="arcd-client-muted">A ausência de anexo não confirma ausência de compra. Pedidos e notas não são somados como custos; consulte Gastos por categoria para o custo reconhecido.</p>
  </section>;
}
