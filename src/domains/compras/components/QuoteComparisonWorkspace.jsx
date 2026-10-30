import {Tabs,TabsContent,TabsList,TabsTrigger} from "../../../components/ui/tabs";
import {Button} from "../../../design-system/primitives/Button";
import {mapaDaCotacao} from "../quote-map";
import {purchaseUnitOf} from "../unit-conversion";
import {SUPPLIER_RESPONSE_LABELS,supplierResponseQueue} from "../quote-review";
import SupplierQuotePanel from "./SupplierQuotePanel";
import QuotePriceReference from "./QuotePriceReference";
import {CostComparison} from "./PurchaseFinalCost";
import "./quote-workspace.css";
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function QuoteComparisonWorkspace({quote,data,canManage,dispatchCommand,currentUser,onOpenOrder,documents,supplierRating}){
 const map=mapaDaCotacao(quote),responses=supplierResponseQueue([quote]),review=(quote.respostasFornecedor||[]).filter(r=>r.status==="pendente").length;
 const supplier=id=>(data.fornecedores||[]).find(f=>f.id===id)?.nome||"Fornecedor";
 const work=(data.obras||[]).find(w=>w.id===quote.obraId),request=(data.solicitacoesCompra||[]).find(s=>s.id===quote.solicitacaoId);
 return <section className="quote-workspace" aria-label={`Análise da cotação ${quote.numero||quote.id}`}><header><h3>{quote.numero||quote.id} · Comparação de propostas</h3><p>{work?.name||"Obra não informada"} · {map.linhas.length} item(ns) · Necessidade: {request?.necessidade||"não informada"} · {review} resposta(s) para revisar</p></header>
 <Tabs defaultValue={review?"suppliers":"comparison"}><TabsList aria-label="Análise da cotação" className="quote-workspace-tabs"><TabsTrigger value="comparison">Comparativo</TabsTrigger><TabsTrigger value="suppliers">Fornecedores{review?` (${review})`:""}</TabsTrigger><TabsTrigger value="history">Histórico de preços</TabsTrigger><TabsTrigger value="documents">Documentos</TabsTrigger></TabsList>
 <TabsContent value="comparison"><div className="quote-comparison-scroll" role="region" aria-label="Mapa de propostas por item" tabIndex={0}><table><thead><tr><th scope="col">Item / quantidade</th>{(quote.propostas||[]).map(p=><th key={p.id} scope="col">{supplier(p.fornecedorId)}<small>{p.prazoDias==null?"Prazo não informado":`${p.prazoDias} dia(s)`} · Nota {supplierRating?.(p.fornecedorId)||"sem histórico"}</small><small>{SUPPLIER_RESPONSE_LABELS[responses.find(r=>r.proposal.id===p.id)?.status]||"Proposta encerrada"}</small></th>)}</tr></thead><tbody>{map.linhas.map(l=><tr key={l.item.id}><th scope="row">{(data.materiais||[]).find(m=>m.id===l.item.materialId)?.descricao||l.item.descricaoRef||"Material"}<small>{l.qtd} {purchaseUnitOf(l.item)}{l.decisao?" · pedido gerado":""}</small></th>{(quote.propostas||[]).map(p=>{const offer=l.ofertas.find(o=>o.proposta.id===p.id),pending=(quote.respostasFornecedor||[]).some(r=>r.proposalId===p.id&&r.status==="pendente");return <td key={p.id}>{pending?"Aguardando revisão":offer?<><strong>{money(offer.precoUnit)}</strong><small>{money(offer.total)} no item</small></>:"Não ofertado"}</td>})}</tr>)}</tbody></table></div><p>O mapa mostra o preço por unidade de compra, incluindo rateio quando os adicionais estão documentados. Confira o custo final abaixo antes de decidir.</p><CostComparison quote={quote} supplierName={supplier}/></TabsContent>
 <TabsContent value="suppliers"><SupplierQuotePanel quote={quote} data={data} canManage={canManage} dispatchCommand={dispatchCommand} currentUser={currentUser}/></TabsContent>
 <TabsContent value="history"><QuotePriceReference data={data} quote={quote} workIds={work?[work.id]:[]} onOpen={onOpenOrder}/></TabsContent>
 <TabsContent value="documents">{documents||<p>Nenhum documento nesta cotação.</p>}<Button variant="secondary" onClick={()=>document.getElementById(`purchase-record-${quote.id}`)?.focus()}>Voltar à cotação</Button></TabsContent>
 </Tabs></section>;
}
