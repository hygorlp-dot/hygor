import {useState} from "react";
import {Button} from "../../../design-system/primitives/Button";
import {Input} from "../../../design-system/primitives/Input";
import {gerarLinkRespostaCotacao} from "../../../api";
import {OPERATIONAL_COMMAND} from "../../sync/operational-commands";
import {responseItems,quoteResponseOpen} from "../supplier-quote-response";
import "./supplier-quote.css";
import QuoteDispatchPanel,{QuoteDispatchHistory} from "./QuoteDispatchPanel";
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function SupplierQuotePanel({quote,data,canManage,dispatchCommand,currentUser}){
 const [links,setLinks]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[reasons,setReasons]=useState({});
 const supplier=id=>(data.fornecedores||[]).find(f=>f.id===id)?.nome||"Fornecedor";
 const generate=async p=>{setBusy(true);setError("");try{const r=await gerarLinkRespostaCotacao(quote.id,p.id);if(!r.ok)throw Error(r.error||"Não foi possível gerar o link.");setLinks(old=>({...old,[p.id]:{url:`${window.location.origin}/responder-cotacao#${r.token}`,expires:r.expiraEm}}));}catch(e){setError(e.message)}finally{setBusy(false)}};
 const review=async(r,decision)=>{setBusy(true);setError("");try{if(!dispatchCommand)throw Error("A revisão exige conexão com o servidor.");const result=await dispatchCommand(()=>({type:OPERATIONAL_COMMAND.QUOTE_SUPPLIER_RESPONSE_REVIEWED,idempotencyKey:`supplier-review-${crypto.randomUUID()}`,expectedVersion:Number(quote.version||0),actorId:currentUser.id,actorRole:currentUser.role,actorName:currentUser.nome,payload:{quoteId:quote.id,responseId:r.id,decision,reason:reasons[r.id]||""}}));if(!result?.ok)throw Error(result?.reason||"A revisão não foi confirmada.");}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <section className="supplier-quote-panel" aria-label="Respostas de fornecedores"><h3>Portal de resposta dos fornecedores</h3><p>Links individuais válidos por sete dias. O fornecedor não vê propostas concorrentes. Aceitar a resposta apenas atualiza o mapa; a aprovação da compra continua nas alçadas existentes.</p>
 {error&&<p role="alert">{error}</p>}
 {(quote.propostas||[]).map(p=><QuoteDispatchPanel key={p.id} quote={quote} proposal={p} supplier={(data.fornecedores||[]).find(f=>f.id===p.fornecedorId)} canManage={canManage} dispatchCommand={dispatchCommand} currentUser={currentUser}/>)}
 <QuoteDispatchHistory quote={quote} data={data}/>
 {canManage&&quoteResponseOpen(quote)&&(quote.propostas||[]).map(p=><div key={p.id}><Button variant="secondary" disabled={busy} onClick={()=>generate(p)}>Gerar link de cotação · {supplier(p.fornecedorId)}</Button>{links[p.id]&&<><Input label={`Link para ${supplier(p.fornecedorId)}`} readOnly value={links[p.id].url}/><p>Validade: {new Date(links[p.id].expires).toLocaleString("pt-BR")}. Copie e envie ao fornecedor pelo canal escolhido.</p></>}</div>)}
 {!(quote.respostasFornecedor||[]).length&&<p>Nenhuma resposta recebida pelo portal.</p>}
 {(quote.respostasFornecedor||[]).map(r=><article key={r.id}><h4>{supplier(r.fornecedorId)} · {r.status==="pendente"?"Aguardando revisão":r.status}</h4><p>{r.nome} · {new Date(r.recebidaEm).toLocaleString("pt-BR")} · entrega em {r.offer.prazoDias} dia(s)</p><ul>{(r.itens||responseItems(quote)).map(i=><li key={i.id}>{i.descricaoRef||(data.materiais||[]).find(m=>m.id===i.materialId)?.descricao||"Material"} · {money(r.offer.precos[i.id])} / {i.unidadeCompra||i.unidadeRef||"unidade"}</li>)}</ul><p>Frete: {money(r.offer.custoFinal.frete)} · Desconto: {money(r.offer.custoFinal.desconto)} · Impostos adicionais: {money(r.offer.custoFinal.impostos)} · Despesas: {money(r.offer.custoFinal.despesas)}</p><p>Total ofertado: <strong>{money(r.total)}</strong></p><p>Pagamento: {r.offer.condicoesPagamento}</p>{r.offer.obs&&<p>{r.offer.obs}</p>}{r.offer.documentos.map(d=><p key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.nome}</a></p>)}
 {r.status==="pendente"&&canManage&&<><Input label={`Motivo da revisão · ${supplier(r.fornecedorId)}`} value={reasons[r.id]||""} onChange={e=>setReasons(old=>({...old,[r.id]:e.target.value}))}/><div className="supplier-quote-actions"><Button disabled={busy||!(reasons[r.id]?.trim().length>=3)} onClick={()=>review(r,"aceita")}>Aceitar resposta no mapa</Button><Button variant="secondary" disabled={busy||!(reasons[r.id]?.trim().length>=3)} onClick={()=>review(r,"rejeitada")}>Rejeitar resposta</Button></div></>}
 {r.revisadaEm&&<p>Revisão: {r.revisadaPor||r.revisadaPorId} · {r.motivo}</p>}</article>)}
 </section>;
}
