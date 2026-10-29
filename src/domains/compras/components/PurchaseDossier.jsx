import { useMemo, useRef, useState } from "react";
import { Modal, fmt, fmtDate } from "../../../LegacyApp";
import { Button } from "../../../design-system/primitives/Button";
import { totalPedido } from "../calculations";
import { fichaDaCompra, urlDocumentoCompra } from "../purchase-dossier";
import { CostComparison } from "./PurchaseFinalCost";

export function PurchaseDossier({data,selection,onClose}){
  const f=useMemo(()=>fichaDaCompra(data,selection),[data,selection]),[selected,setSelected]=useState(null);
  const dossierRef=useRef(null);
  const goTo=key=>{const section=dossierRef.current?.querySelector(`[data-section="${key}"]`);section?.scrollIntoView({block:"start"});section?.focus({preventScroll:true});};
  const name=id=>(data.fornecedores||[]).find(p=>String(p.id)===String(id))?.nome||"Fornecedor não informado";
  const material=id=>(data.materiais||[]).find(p=>String(p.id)===String(id))?.descricao||"Material";
  const url=selected?urlDocumentoCompra(selected):"";
  const drive=url.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\//);
  const preview=drive?`https://drive.google.com/file/d/${drive[1]}/preview`:/\.pdf(?:[?#]|$)/i.test(url)||/\.pdf$/i.test(selected?.nome||"")?url:"";
  return <Modal title="Ficha completa da compra conjunta" wide onClose={onClose}>
    <div className="purchase-dossier" ref={dossierRef}>
      <nav className="purchase-dossier-nav" aria-label="Seções da compra">{[["origin","Origem"],["cost","Custos"],["orders",`Pedidos (${f.orders.length})`],["invoices",`Notas fiscais (${f.invoices.length})`],["payments","Pagamentos"],["documents",`Anexos (${f.documents.length})`]].filter(([key])=>key!=="cost"||f.quote).map(([key,label])=><Button key={key} variant="ghost" onClick={()=>goTo(key)}>{label}</Button>)}</nav>
      <p>Pedidos agrupados pela cotação de origem. Aprovações seguem as alçadas da empresa.</p>
      <section data-section="origin" tabIndex={-1}><h3>Origem e aprovação</h3>
        <p>Solicitação: {f.request?.numero||f.request?.id||"Sem solicitação vinculada"} · Cotação: {f.quote?.numero||f.quote?.id||"Sem cotação vinculada"}</p>
        <p>Aprovação: {f.approval?.status||"Sem instância vinculada"} · Solicitante: {f.request?.solicitanteNome||f.request?.solicitadoPor||f.request?.criadoPor||"Não informado"}</p>
        {f.request?.observacao&&<p>{f.request.observacao}</p>}
        {f.request?.necessidade&&<p>Necessidade: {fmtDate(f.request.necessidade)} · Prioridade: {f.request.prioridade||"normal"}</p>}
        {f.decisions.map(d=><p key={d.id}>{fmtDate(d.data?.slice(0,10))} · {d.aprovadorNome} · {d.decisao}{d.justificativa?` · ${d.justificativa}`:""}</p>)}
        {f.quote?.decididoEm&&<p>Decisão: {fmtDate(f.quote.decididoEm.slice(0,10))} · {f.quote.decididoPorNome||"Autor não informado"}</p>}
      </section>
      {f.quote&&<div data-section="cost" tabIndex={-1}><CostComparison quote={f.quote} supplierName={name}/></div>}
      <section data-section="orders" tabIndex={-1}><h3>Pedidos e recebimentos · {f.orders.length}</h3>
        {!f.orders.length&&<p>A cotação ainda não gerou pedidos.</p>}
        {f.orders.map(p=><article key={p.id}><h4>{p.numero} · {name(p.fornecedorId)} · {p.status}</h4>
          <p>{fmt(totalPedido(p))} · Emissão {fmtDate(p.data)} · Entrega {p.previsao?fmtDate(p.previsao):"não informada"}</p>
          <p>Pagamento: {p.condicoesPagamento||"Condições não informadas"}</p>
          {p.custoFinal&&<p>O valor dos itens já inclui o rateio de frete, desconto e despesas da proposta.</p>}
          <ul>{(p.itens||[]).map(i=><li key={i.id}>{material(i.materialId)} · comprado {i.qtd} · recebido {i.qtdRecebida||0} · unitário {fmt(i.precoUnit)}
            {(i.recebimentos||[]).map((r,index)=><span key={r.id||index}> · {fmtDate(r.data)}: {r.qtd??r.quantidade??"recebimento registrado"}{r.responsavel?` · ${r.responsavel}`:""}</span>)}</li>)}</ul>
          {p.aceiteFornecedor&&<p>Aceite: {p.aceiteFornecedor.nome} · {fmtDate(p.aceiteFornecedor.data)} · {p.aceiteFornecedor.canal}</p>}
          {(p.ajustes||[]).map((a,index)=><p key={a.id||index}>Ajuste: {a.usuario||"Operador"} · {a.motivo} · {fmtDate(a.criadoEm?.slice(0,10))}</p>)}
          {p.obs&&<p>{p.obs}</p>}
        </article>)}
      </section>
      <section data-section="invoices" tabIndex={-1}><h3>Notas fiscais · {f.invoices.length}</h3>
        {!f.invoices.length&&<p>Nenhuma nota fiscal vinculada aos pedidos desta compra.</p>}
        {f.invoices.map(n=><article key={n.id}><h4>NF {n.numero} · {n.status}</h4><p>Emissão {fmtDate(n.emissao)} · Vencimento {fmtDate(n.vencimento)} · {fmt(n.valorBruto)} · Pedido {f.orders.find(p=>p.id===n.pedidoId)?.numero}</p>{(n.chave||n.chaveAcesso)&&<p className="purchase-document-key">Chave: {n.chave||n.chaveAcesso}</p>}<p>Valor líquido: {fmt(n.valorLiquido??n.valorBruto)} · Fornecedor: {name(n.fornecedorId)}</p>
          {(n.itensNota||[]).length>0&&<ul>{n.itensNota.map((item,index)=><li key={item.nItem||index}>{item.descricao} · {item.qtd} {item.unidade} · {fmt(item.valorTotal)}</li>)}</ul>}
          {(n.rateios||[]).map((r,index)=><p key={r.id||index}>Rateio: {(data.obras||[]).find(o=>o.id===r.obraId)?.name||r.obraId} · {fmt(r.valor)}</p>)}
          {n.obs&&<p>{n.obs}</p>}</article>)}
      </section>
      <section data-section="payments" tabIndex={-1}><h3>Pagamentos e conciliação</h3>
        {!f.payments.length&&<p>Nenhum pagamento registrado.</p>}
        {f.payments.map((p,index)=><p key={`${p.origem}-${p.id||index}`}>{p.origem} · {fmtDate(p.data)} · {fmt(p.valor)} · {p.status||"Registrado"}</p>)}
        {f.transactions.map(t=><p key={t.id}>Extrato: {fmtDate(t.data)} · {fmt(t.valor)} · {t.status}</p>)}
        {!f.transactions.length&&<p>Sem vínculo bancário identificado nesta ficha.</p>}
      </section>
      <section data-section="documents" tabIndex={-1}><h3>Notas e demais anexos · {f.documents.length}</h3>
        {!f.documents.length&&<p>Nenhum arquivo anexado aos registros desta compra.</p>}
        {f.documents.map((d,index)=><div className="purchase-document-row" key={`${d.origem}-${d.id||index}`}><span>{d.origem} · {d.legenda||d.nome||"Documento"}</span>{urlDocumentoCompra(d)?<><Button variant="secondary" onClick={()=>setSelected(d)}>Visualizar</Button><a href={urlDocumentoCompra(d)} target="_blank" rel="noreferrer">Abrir arquivo ↗</a></>:<span>Arquivo sem endereço válido</span>}</div>)}
      </section>
      {selected&&<section aria-label="Visualização do anexo"><h3>{selected.legenda||selected.nome||"Documento"}</h3>{preview?<iframe title="Visualização do documento da compra" src={preview} className="purchase-document-preview"/>:<p>Use “Abrir arquivo” para visualizar este formato no serviço de origem.</p>}<a href={url} target="_blank" rel="noreferrer">Abrir arquivo em outra aba ↗</a><Button variant="ghost" onClick={()=>setSelected(null)}>Fechar visualização</Button></section>}
    </div>
  </Modal>;
}
