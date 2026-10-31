import {useState} from "react";
import {Button} from "../../../design-system/primitives/Button";
import {Select} from "../../../design-system/primitives/Select";
import {supplierResponseQueue,SUPPLIER_RESPONSE_LABELS} from "../quote-review";
import {useQuoteClock} from "../use-quote-clock";
import "./quote-workspace.css";
export default function SupplierResponseQueue({quotes,data,onOpen}){
 const now=useQuoteClock(),rows=supplierResponseQueue(quotes,now),[filter,setFilter]=useState("action");
 const shown=rows.filter(r=>filter==="all"||filter==="action"&&["pendente","aguardando","nao_enviado","retorno_manual"].includes(r.status)||filter==="overdue"&&r.status==="aguardando"&&r.tracking.overdue||r.status===filter);
 const count=status=>rows.filter(r=>r.status===status).length;
 const actionable=rows.filter(r=>["pendente","aguardando","nao_enviado","retorno_manual"].includes(r.status)).length;
 return <section className="supplier-response-queue" aria-label="Fila de fornecedores"><details open={actionable>0}><summary><h3>Retornos dos fornecedores</h3><span>{count("pendente")} para revisar · {count("aguardando")} aguardando retorno · {count("nao_enviado")} sem envio registrado · {rows.filter(r=>r.status==="aguardando"&&r.tracking.overdue).length} com prazo vencido</span></summary><div className="supplier-response-queue__content">
 <Select label="Situação do retorno" value={filter} onChange={e=>setFilter(e.target.value)} options={[{value:"action",label:"Pendências de retorno e revisão"},{value:"pendente",label:"Aguardando revisão"},{value:"aguardando",label:"Aguardando retorno"},{value:"overdue",label:"Prazo de resposta vencido"},{value:"nao_enviado",label:"Envio não registrado"},{value:"retorno_manual",label:"Retorno por outro canal"},{value:"all",label:"Todos os fornecedores"}]}/>
 {!shown.length?<p>Nenhuma pendência neste recorte. As propostas cadastradas podem ser consultadas em “Todos os fornecedores”.</p>:<ul>{shown.map(r=><li key={r.id}><div><strong>{(data.fornecedores||[]).find(f=>f.id===r.proposal.fornecedorId)?.nome||"Fornecedor"}</strong><p>{r.quote.numero||r.quote.id} · {(data.obras||[]).find(o=>o.id===r.quote.obraId)?.name||"Obra"} · {SUPPLIER_RESPONSE_LABELS[r.status]||r.status}</p><small>{r.receivedAt?`Resposta recebida em ${new Date(r.receivedAt).toLocaleString("pt-BR")}`:"Sem resposta registrada pelo portal"}</small>{r.tracking.current&&<small>Enviado em {new Date(r.tracking.current.sentAt).toLocaleString("pt-BR")} · Prazo {new Date(r.tracking.current.deadlineAt).toLocaleString("pt-BR")}{r.status==="aguardando"&&r.tracking.overdue?" · Prazo de resposta vencido":""}{r.tracking.late?" · Retorno após o prazo":""}</small>}</div><Button variant="secondary" onClick={()=>onOpen(r.quote.id)}>Abrir cotação {r.quote.numero||r.quote.id}</Button></li>)}</ul>}
 </div></details></section>;
}
