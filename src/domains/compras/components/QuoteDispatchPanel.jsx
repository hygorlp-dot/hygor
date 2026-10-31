import {useRef,useState} from "react";
import {Button} from "../../../design-system/primitives/Button";
import {Input} from "../../../design-system/primitives/Input";
import {Select} from "../../../design-system/primitives/Select";
import {OPERATIONAL_COMMAND} from "../../sync/operational-commands";
import {QUOTE_DISPATCH_CHANNELS,quoteDispatchTracking} from "../quote-dispatch";
import {quoteResponseOpen,quoteResponseScope} from "../supplier-quote-response";
import {useQuoteClock} from "../use-quote-clock";
const localTime=v=>{const d=new Date(v||Date.now());return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19)};
const display=v=>new Date(v).toLocaleString("pt-BR");

export function QuoteDispatchHistory({quote,data}){
 const scope=quoteResponseScope(quote),entries=quote.enviosFornecedor||[];
 if(!entries.length)return null;
 return <details className="quote-dispatch-history"><summary>Histórico de envios ({entries.length})</summary>{[...entries].reverse().map(e=><article key={e.id}><h4>{(data.fornecedores||[]).find(f=>f.id===e.fornecedorId)?.nome||"Fornecedor"} · {e.status==="anulado"?"Registro anulado":"Envio registrado"}</h4><p>{display(e.sentAt)} · {QUOTE_DISPATCH_CHANNELS[e.channel]||e.channel} · {e.contact}</p><p>Prazo: {display(e.deadlineAt)} · Registrado por {e.recordedBy} em {display(e.recordedAt)}</p>{e.scope!==scope&&<p>Itens alterados desde o envio. Este prazo não acompanha a versão atual da cotação.</p>}{e.receivedAt&&<p>Retorno por outro canal registrado por {e.receivedBy} · {display(e.receivedAt)}</p>}{(e.history||[]).map((h,index)=><p key={index}>{({deadline:"Prazo retificado",cancel:"Registro anulado",returned:"Retorno registrado"}[h.change])} · {h.actorName} · {display(h.at)} · {h.reason}{h.deadlineAt?` · prazo anterior ${display(h.previousDeadline)} → ${display(h.deadlineAt)}`:""}</p>)}</article>)}</details>;
}

export default function QuoteDispatchPanel({quote,proposal,supplier,canManage,dispatchCommand,currentUser}){
 const now=useQuoteClock(),tracking=quoteDispatchTracking(quote,proposal,now),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),lock=useRef(false);
 const current=tracking.current,canEdit=canManage&&["admin","compras"].includes(currentUser?.role)&&quoteResponseOpen(quote);
 const open=change=>{setError("");setForm({change,version:Number(quote.version||0),dispatchId:change==="create"?`envio-${crypto.randomUUID()}`:current?.id||"",commandKey:`quote-dispatch-${crypto.randomUUID()}`,channel:"email",contact:supplier?.email||supplier?.telefone||supplier?.nome||"",sentAt:localTime(),deadlineAt:current?localTime(current.deadlineAt):"",receivedAt:localTime(),reason:""})};
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 const submit=async e=>{
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{
   if(!dispatchCommand)throw Error("O registro exige conexão com o servidor.");
   const create=form.change==="create",payload=create?{quoteId:quote.id,proposalId:proposal.id,dispatchId:form.dispatchId,confirmSent:true,channel:form.channel,contact:form.contact,sentAt:new Date(form.sentAt).toISOString(),deadlineAt:new Date(form.deadlineAt).toISOString()}:{quoteId:quote.id,dispatchId:form.dispatchId,change:form.change,reason:form.reason,...(form.change==="deadline"?{deadlineAt:new Date(form.deadlineAt).toISOString()}:{}),...(form.change==="returned"?{receivedAt:new Date(form.receivedAt).toISOString()}:{})};
   const command={type:create?OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED:OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_UPDATED,idempotencyKey:form.commandKey,expectedVersion:form.version,actorId:currentUser.id,actorRole:currentUser.role,actorName:currentUser.nome,payload};
   const result=await dispatchCommand(()=>command);if(!result?.ok)throw Error(result?.reason||"O servidor não confirmou o registro.");setForm(null);
  }catch(err){setError(err.message||"Confira os campos e tente novamente.")}finally{lock.current=false;setBusy(false)}
 };
 return <section className="quote-dispatch-panel" aria-label={`Envio e prazo de ${supplier?.nome||"Fornecedor"}`}><h4>Envio e prazo · {supplier?.nome||"Fornecedor"}</h4>
 {current?<><p>Enviado em {display(current.sentAt)} · {QUOTE_DISPATCH_CHANNELS[current.channel]} · {current.contact}</p><p>Prazo de resposta: <strong>{display(current.deadlineAt)}</strong>{tracking.receivedAt?` · Retorno recebido em ${display(tracking.receivedAt)}${tracking.late?" (após o prazo)":""}`:tracking.overdue?" · Prazo de resposta vencido":" · Aguardando retorno"}</p></>:<p>Nenhum envio registrado para os itens e fornecedor atuais.</p>}
 <p>Registre apenas o envio já realizado por você. Gerar um link não registra envio. O prazo não renova a validade do link e nenhuma mensagem será disparada.</p>
 {canEdit&&!form&&<div className="supplier-quote-actions"><Button variant="secondary" onClick={()=>open("create")}>Registrar envio realizado · {supplier?.nome||"Fornecedor"}</Button>{current&&<><Button variant="secondary" disabled={!!tracking.receivedAt} onClick={()=>open("deadline")}>Retificar prazo</Button><Button variant="secondary" disabled={!!tracking.receivedAt} onClick={()=>open("returned")}>Registrar retorno por outro canal</Button><Button variant="ghost" onClick={()=>open("cancel")}>Anular registro de envio</Button></>}</div>}
 {error&&<p role="alert">{error}</p>}
 {form&&canEdit&&<form onSubmit={submit}><fieldset disabled={busy}><legend>{({create:"Registrar envio já realizado",deadline:"Retificar prazo de resposta",returned:"Registrar retorno fora do portal",cancel:"Anular registro de envio"}[form.change])}</legend>
 {form.change==="create"&&<><Input label="Data e hora do envio realizado" type="datetime-local" step="1" required value={form.sentAt} onChange={e=>set("sentAt",e.target.value)}/><Select label="Canal do envio" value={form.channel} onChange={e=>set("channel",e.target.value)} options={Object.entries(QUOTE_DISPATCH_CHANNELS).map(([value,label])=>({value,label}))}/><Input label="Destinatário do envio" required minLength={3} maxLength={200} value={form.contact} onChange={e=>set("contact",e.target.value)}/></>}
 {["create","deadline"].includes(form.change)&&<Input label="Prazo de resposta" type="datetime-local" step="1" required value={form.deadlineAt} onChange={e=>set("deadlineAt",e.target.value)}/>}
 {form.change==="returned"&&<><p>Este registro encerra a espera pelo retorno; os preços continuam exigindo conferência no mapa e a compra mantém suas alçadas.</p><Input label="Data e hora do retorno recebido" type="datetime-local" step="1" required value={form.receivedAt} onChange={e=>set("receivedAt",e.target.value)}/></>}
 {form.change!=="create"&&<Input label="Justificativa do registro" required minLength={3} maxLength={500} value={form.reason} onChange={e=>set("reason",e.target.value)}/>}
 <div className="supplier-quote-actions"><Button type="submit" disabled={busy}>{busy?"Confirmando…":"Confirmar registro"}</Button><Button variant="secondary" onClick={()=>setForm(null)}>Cancelar preenchimento</Button></div></fieldset></form>}
 </section>;
}
