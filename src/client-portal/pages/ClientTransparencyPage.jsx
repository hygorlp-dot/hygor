import { useMemo, useState } from "react";
import "../styles/portal.css";

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
  const summary=data.projectCashSummary?.[0];
  const movements=data.projectCashMovements || [];
  return <div className="arcd-client-stack">
    {summary ? <section className="arcd-client-financial-grid" aria-label="Resumo do caixa da obra">
      <article><span>Aportes</span><strong>{currency(summary.totalContributions)}</strong><small>Recursos disponibilizados</small></article>
      <article><span>Despesas</span><strong>{currency(summary.totalExpenses)}</strong><small>Movimentações publicadas</small></article>
      <article><span>Saldo atual</span><strong>{currency(summary.balance)}</strong><small>Atualizado em {date(summary.asOf)}</small></article>
    </section> : <Empty>O resumo do caixa ainda não foi publicado.</Empty>}
    <section className="arcd-client-section"><h2>Movimentações</h2>{movements.length ? <div className="arcd-client-ledger">{movements.map(item=><article key={item.id}>
      <div><b>{item.description || item.category}</b><span>{date(item.date)} | {item.category || item.type}</span></div>
      <div><strong data-kind={String(item.type).toLowerCase().includes("aporte") ? "in" : "out"}>{String(item.type).toLowerCase().includes("aporte") ? "+" : "-"} {currency(item.amount)}</strong><span>Saldo {currency(item.balance)}</span></div>
    </article>)}</div> : <Empty>Nenhuma movimentação foi compartilhada.</Empty>}</section>
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
    {sections.length ? <><nav className="arcd-client-subnav" aria-label="Caixa e suprimentos">{sections.map(item=><button type="button" key={item.id} aria-pressed={selected===item.id} onClick={()=>setActive(item.id)}>{item.label}</button>)}</nav>
      {selected==="cash" ? <CashSection data={data}/> : selected==="purchases" ? <PurchaseSection data={data}/> : selected==="quotations" ? <QuotationSection data={data}/> : <InvoiceSection data={data}/>}</> : <section className="arcd-client-section"><Empty>Este acesso não possui permissão para consultar caixa ou suprimentos.</Empty></section>}
  </div>;
}
