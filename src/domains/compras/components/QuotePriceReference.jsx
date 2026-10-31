import {Button} from "../../../design-system/primitives/Button";
import {quotePriceReferences} from "../quote-review";
const money=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:4});
export default function QuotePriceReference({data,quote,workIds,onOpen}){
 const references=quotePriceReferences(data,quote,workIds);
 const supplier=id=>(data.fornecedores||[]).find(f=>f.id===id)?.nome||"Fornecedor";
 return <section className="quote-price-reference" aria-label="Histórico na cotação"><h3>Histórico para decidir</h3><p>Último custo final documentado nos recebimentos da mesma obra, até {quote.data||"a data atual"}. Preços convertidos para a mesma unidade. A compra desta cotação fica fora da referência.</p>
 {references.map(r=><article key={r.item.id}><h4>{r.description}</h4>{!r.last?<p>Sem recebimento comparável com custo final e conversão documentados.</p>:<><p>Último custo final: <strong>{money(r.last.price)} / {r.referenceUnit}</strong> · {r.last.date} · {supplier(r.last.supplierId)}</p><Button variant="secondary" onClick={()=>onOpen(r.last.orderId)}>Abrir compra de referência {r.last.orderNumber}</Button><ul>{r.offers.map(o=><li key={o.proposalId}>{supplier(o.supplierId)} · {o.price==null?"Custo final a conferir":`${money(o.price)} / ${r.referenceUnit}`}{o.change!=null?` · ${o.change>0?"+":""}${o.change.toFixed(1)}% sobre a referência`:""}</li>)}</ul></>}</article>)}
 </section>;
}
