import { useMemo, useState } from "react";
import "../styles/portal.css";
import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import {Input} from "../../design-system/primitives/Input.jsx";
import {Select} from "../../design-system/primitives/Select.jsx";
import {FilterBar} from "../../design-system/patterns/FilterBar.jsx";
import {DataTable} from "../../design-system/data/DataTable.jsx";
import {portalCategory} from "../format.js";
import {WorkspaceFilters} from "../../design-system/patterns/WorkspaceNavigation.jsx";

const currency = value => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value || 0));
const date = value => {
  if (!value) return "Não informada";
  const parsed=new Date(`${String(value).slice(0,10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(parsed);
};
const statusLabel = value => String(value || "Publicado").replaceAll("_"," ");

function Empty({ children }) {
  return <p className="arcd-client-muted">{children}</p>;
}

function CashSection({ data }) {
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[kind,setKind]=useState("all"),[query,setQuery]=useState("");
  const summary=data.projectCashSummary?.[0];
  const movements=data.projectCashMovements || [];
  const incoming=item=>String(item.type).toLowerCase()==="aporte";
  const invalidPeriod=Boolean(from&&to&&from>to);
  const filtered=movements.filter(item=>!invalidPeriod&&(!from||item.date>=from)&&(!to||item.date<=to)&&(kind==="all"||(kind==="in")===incoming(item))&&`${item.description} ${portalCategory(item.category)} ${item.invoiceNumber||""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const entries=filtered.filter(incoming).reduce((sum,item)=>sum+item.amount,0),expenses=filtered.filter(item=>!incoming(item)).reduce((sum,item)=>sum+item.amount,0);
  const hasFilters=Boolean(from||to||kind!=="all"||query);
  const columns=[
    {key:"date",header:"Data",render:item=>date(item.date)},
    {key:"description",header:"Lançamento",render:item=><div className="arcd-client-stack"><strong>{item.description||"Movimento da obra"}</strong><span className="arcd-client-muted">{portalCategory(item.category)}</span></div>},
    {key:"amount",header:"Tipo e valor",render:item=><div className="arcd-client-stack"><span>{incoming(item)?"Entrada":"Saída"}</span><strong className="arcd-client-amount" data-kind={incoming(item)?"in":"out"}>{incoming(item)?"+":"−"} {currency(item.amount)}</strong></div>},
    {key:"balance",header:"Saldo após o movimento",render:item=>currency(item.balance)},
    {key:"invoiceNumber",header:"Nota fiscal",render:item=>incoming(item)?"—":item.invoiceLinkAmbiguous?<span>Mais de uma nota no pedido. Peça à equipe para conferir o vínculo deste pagamento.</span>:item.invoiceDocuments?.length?<div className="arcd-client-stack">{item.invoiceDocuments.map(document=><Button key={document.id} asChild variant="link"><a href={document.url} target="_blank" rel="noreferrer">Abrir nota fiscal {item.invoiceNumber}{item.invoiceDocuments.length>1?` · ${document.title}`:""}</a></Button>)}</div>:<span className="arcd-client-muted">{item.invoiceNumber?`Nota fiscal ${item.invoiceNumber} · anexo não liberado para este acesso.`:"Sem nota vinculada neste lançamento."}</span>},
  ].map(column=>({...column,hideable:false,sortable:column.key==="date"}));
  return <div className="arcd-client-stack">
    {summary ? <section className="arcd-client-section arcd-client-cash-overview" aria-label="Resumo do caixa da obra">
      <div className="arcd-client-cash-balance"><div><h3>Saldo atual</h3><p className="arcd-client-muted">Atualizado em {date(summary.asOf)}</p></div><strong>{currency(summary.balance)}</strong></div>
      <dl className="arcd-client-cash-totals"><div><dt>Entradas</dt><dd className="arcd-client-amount" data-kind="in">{currency(summary.totalContributions)}</dd></div><div><dt>Saídas</dt><dd className="arcd-client-amount" data-kind="out">{currency(summary.totalExpenses)}</dd></div></dl>
    </section> : <Empty>O resumo do caixa ainda não foi publicado.</Empty>}
    <section className="arcd-client-section"><h2>Extrato da obra</h2>
      <FilterBar label="Filtros do extrato da obra"><Select label="Tipo de movimentação" value={kind} onChange={event=>setKind(event.target.value)} options={[{value:"all",label:"Entradas e saídas"},{value:"in",label:"Somente entradas"},{value:"out",label:"Somente saídas"}]}/><WorkspaceFilters activeCount={[from,to,query].filter(Boolean).length}><Input label="Data inicial do extrato" type="date" value={from} onChange={event=>setFrom(event.target.value)}/><Input label="Data final do extrato" type="date" value={to} onChange={event=>setTo(event.target.value)} error={invalidPeriod?"A data final deve ser igual ou posterior à data inicial.":undefined}/><Input label="Buscar no extrato" type="search" value={query} onChange={event=>setQuery(event.target.value)}/></WorkspaceFilters>{hasFilters&&<Button variant="secondary" onClick={()=>{setFrom("");setTo("");setKind("all");setQuery("");}}>Limpar filtros do extrato</Button>}</FilterBar>
      {!invalidPeriod&&<p>Movimentos exibidos: {filtered.length}{hasFilters&&<> · Entradas: {currency(entries)} · Saídas: {currency(expenses)}</>}</p>}
      {hasFilters&&<p className="arcd-client-muted">Saldos originais: os filtros alteram somente os movimentos exibidos.</p>}
      <DataTable key={`${from}:${to}:${kind}:${query}`} data={filtered} columns={columns} mobileConfig={{title:"description",subtitle:item=>`${date(item.date)} · ${portalCategory(item.category)}`,primaryFields:["amount","balance","invoiceNumber"]}} emptyMessage={invalidPeriod?"Revise as datas para consultar o extrato.":"Nenhum movimento neste recorte. Ajuste ou limpe os filtros."}/>
      <p className="arcd-client-muted">O saldo de cada linha é a posição original após aquele movimento. Os filtros não recalculam esse saldo nem o Saldo atual. Este é o caixa da obra, separado da conta bancária da empresa.</p>
    </section>
  </div>;
}

function PurchaseSection({ data }) {
  const orders=data.purchaseOrders || [];
  return <section className="arcd-client-section"><h2>Pedidos de compra</h2>{orders.length ? <div className="arcd-client-stack">{orders.map(order=><details className="arcd-client-disclosure" key={order.id}>
    <summary><div><b>{order.number || "Pedido"}</b><span>{order.supplierName} | {statusLabel(order.status)}</span></div><strong>{currency(order.total)}</strong></summary>
    <div className="arcd-client-disclosure__body"><p>Pedido em {date(order.date)}. Entrega prevista para {date(order.expectedAt)}.</p>{order.items?.length ? <div className="arcd-client-compact-list">{order.items.map((item,index)=><div key={`${order.id}-${index}`}><span><b>{item.description}</b><small>{item.quantity} {item.unit} | recebido {item.receivedQuantity} {item.unit}</small></span><strong>{currency(item.quantity * item.unitPrice)}</strong></div>)}</div> : <Empty>Itens não publicados.</Empty>}</div>
  </details>)}</div> : <Empty>Nenhum pedido foi compartilhado.</Empty>}</section>;
}

function QuotationSection({ data }) {
  const quotations=data.quotations || [];
  return <section className="arcd-client-section"><h2>Cotações</h2>{quotations.length ? <div className="arcd-client-stack">{quotations.map(quotation=><details className="arcd-client-disclosure" key={quotation.id}>
    <summary><div><b>{quotation.material || "Cotação"}</b><span>{quotation.quantity} {quotation.unit} | {statusLabel(quotation.status)}</span></div><strong>{quotation.proposals?.length || 0} proposta(s)</strong></summary>
    <div className="arcd-client-disclosure__body"><div className="arcd-client-compact-list">{(quotation.proposals || []).map((proposal,index)=><div data-selected={proposal.selected} key={`${quotation.id}-${index}`}><span><b>{proposal.supplierName}</b><small>Prazo {proposal.leadTimeDays || 0} dia(s){proposal.selected ? " | proposta selecionada" : ""}</small></span><strong>{currency(proposal.total)}</strong></div>)}</div></div>
  </details>)}</div> : <Empty>Nenhuma cotação foi compartilhada.</Empty>}</section>;
}

function InvoiceSection({ data }) {
  const invoices=data.invoices || [];
  return <section className="arcd-client-section"><h2>Notas fiscais</h2>{invoices.length ? <div className="arcd-client-stack">{invoices.map(invoice=><article className="arcd-client-record" key={invoice.id}>
    <div className="arcd-client-record__heading"><div><p className="arcd-client-record__eyebrow">{invoice.type || "NF"} {invoice.number}</p><h3>{invoice.supplierName || "Fornecedor"}</h3></div><b>{currency(invoice.netAmount || invoice.grossAmount)}</b></div>
    <p>{invoice.description || invoice.category || "Documento fiscal da obra"}</p><p>Emissão: {date(invoice.issuedAt)} | vencimento: {date(invoice.dueDate)} | {statusLabel(invoice.status)}</p>
  </article>)}</div> : <Empty>Nenhuma nota fiscal foi compartilhada.</Empty>}</section>;
}

export function ClientTransparencyPage({ data = {}, permissions = {} }) {
  const sections=useMemo(()=>[
    permissions.viewProjectCash && {id:"cash",label:"Caixa da obra"},
    permissions.viewProcurement && {id:"purchases",label:"Compras"},
    permissions.viewProcurement && {id:"quotations",label:"Cotações"},
    permissions.viewProcurement && {id:"invoices",label:"Notas fiscais"},
  ].filter(Boolean),[permissions]);
  const [active,setActive]=useState(()=>sections[0]?.id || "");
  const selected=sections.some(item=>item.id===active) ? active : sections[0]?.id;
  return <div className="arcd-client-page">
    <header className="arcd-client-page__header"><p>Transparência da obra</p><h2>Caixa e suprimentos</h2><span>Consulte somente as informações liberadas pela administração da obra.</span></header>
    {sections.length ? <><nav className="arcd-client-subnav" aria-label="Caixa e suprimentos">{sections.map(item=><Button variant={selected===item.id?"secondary":"ghost"} key={item.id} aria-pressed={selected===item.id} onClick={()=>setActive(item.id)}>{item.label}</Button>)}</nav>
      {selected==="cash" ? <CashSection data={data}/> : selected==="purchases" ? <PurchaseSection data={data}/> : selected==="quotations" ? <QuotationSection data={data}/> : <InvoiceSection data={data}/>}</> : <section className="arcd-client-section"><Empty>Este acesso não possui permissão para consultar caixa ou suprimentos.</Empty></section>}
  </div>;
}

export function ClientCashPage({data}){
 return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Caixa da obra" description="Entradas, saídas e notas fiscais da obra."/><CashSection data={data}/></section>;
}
