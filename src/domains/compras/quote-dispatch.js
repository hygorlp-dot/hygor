import {quoteResponseOpen,quoteResponseScope} from "./supplier-quote-response.js";
export const QUOTE_DISPATCH_CHANNELS={email:"E-mail",whatsapp:"WhatsApp",telefone:"Telefone",presencial:"Presencial",outro:"Outro canal"};
const fail=reason=>({ok:false,reason});
const timestamp=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const actor=command=>({id:command.actorId,nome:String(command.actorName||"Operador").trim().slice(0,120)});
const replace=(data,q,updated)=>({ok:true,entityId:q.id,data:{...data,cotacoes:data.cotacoes.map(c=>c.id===q.id?updated:c)}});

export function mutateQuoteDispatch(data,command,now,update=false){
 if(!command.actorId||!["admin","compras"].includes(command.actorRole))return fail("Somente Compras ou Administração registram envios de cotação.");
 const p=command.payload||{},q=(data.cotacoes||[]).find(c=>c.id===p.quoteId);
 if(!quoteResponseOpen(q))return fail("A cotação foi alterada ou encerrada e não aceita registros de envio.");
 if(command.expectedVersion==null||Number(q.version||0)!==Number(command.expectedVersion))return fail("A cotação mudou. Atualize antes de registrar o envio ou alterar o prazo.");
 const entries=q.enviosFornecedor||[],who=actor(command);
 const changed={...q,version:Number(q.version||0)+1,updatedAt:now,updatedById:who.id,updatedBy:who.nome};
 if(!update){
  const proposal=(q.propostas||[]).find(o=>o.id===p.proposalId),supplier=(data.fornecedores||[]).find(f=>f.id===proposal?.fornecedorId);
  if(!proposal||!supplier||supplier.ativo===false)return fail("Fornecedor indisponível nesta cotação.");
  if(p.confirmSent!==true)return fail("Confirme que o envio já foi realizado pelo canal escolhido.");
  if(!/^[\w-]{1,100}$/.test(p.dispatchId||"")||entries.some(e=>e.id===p.dispatchId))return fail("Registro de envio sem identificação única.");
  if(entries.length>=200)return fail("Limite de registros de envio atingido nesta cotação.");
  if(typeof p.channel!=="string"||!Object.hasOwn(QUOTE_DISPATCH_CHANNELS,p.channel)||typeof p.contact!=="string"||p.contact.trim().length<3||p.contact.length>200)return fail("Informe o canal e o destinatário do envio realizado.");
  if(!timestamp(p.sentAt)||Date.parse(p.sentAt)>Date.parse(now))return fail("Informe uma data/hora válida de envio, sem data futura.");
  if(!timestamp(p.deadlineAt)||Date.parse(p.deadlineAt)<=Date.parse(p.sentAt))return fail("O prazo de resposta deve ser posterior ao envio.");
  const scope=quoteResponseScope(q),contact=String(p.contact).trim();
  if(entries.some(e=>e.status!=="anulado"&&e.proposalId===proposal.id&&e.fornecedorId===supplier.id&&e.scope===scope&&e.sentAt===p.sentAt&&e.channel===p.channel&&e.contact===contact))return fail("Este envio já foi registrado. Para retificar o prazo, use o registro existente.");
  const entry={id:p.dispatchId,proposalId:proposal.id,fornecedorId:supplier.id,scope,status:"registrado",channel:p.channel,contact,sentAt:p.sentAt,deadlineAt:p.deadlineAt,recordedAt:now,recordedById:who.id,recordedBy:who.nome,history:[]};
  return replace(data,q,{...changed,enviosFornecedor:[...entries,entry]});
 }
 const entry=entries.find(e=>e.id===p.dispatchId),proposal=(q.propostas||[]).find(o=>o.id===entry?.proposalId&&o.fornecedorId===entry?.fornecedorId);
 if(!entry||entry.status==="anulado"||!proposal||entry.scope!==quoteResponseScope(q))return fail("Registro indisponível ou itens/fornecedor alterados. Atualize a cotação.");
 const reason=typeof p.reason==="string"?p.reason.trim():"";
 if(reason.length<3||reason.length>500)return fail("Informe uma justificativa entre 3 e 500 caracteres.");
 if((entry.history||[]).length>=50)return fail("Limite de retificações atingido para este envio.");
 const portalReturn=(q.respostasFornecedor||[]).some(r=>r.proposalId===entry.proposalId&&r.fornecedorId===entry.fornecedorId&&r.scope===entry.scope&&Date.parse(r.recebidaEm)>=Date.parse(entry.sentAt));
 let patch={};
 if(p.change==="deadline"){
  if(entry.receivedAt||portalReturn)return fail("Este envio já tem retorno registrado; o prazo não pode ser retificado.");
  if(!timestamp(p.deadlineAt)||Date.parse(p.deadlineAt)<=Date.parse(entry.sentAt))return fail("O prazo de resposta deve ser posterior ao envio.");
  if(p.deadlineAt===entry.deadlineAt)return fail("Informe um prazo diferente do atual.");
  patch={deadlineAt:p.deadlineAt};
 }else if(p.change==="returned"){
  if(entry.receivedAt||portalReturn)return fail("O retorno deste envio já foi registrado.");
  if(!timestamp(p.receivedAt)||Date.parse(p.receivedAt)<Date.parse(entry.sentAt)||Date.parse(p.receivedAt)>Date.parse(now))return fail("O retorno deve ocorrer entre o envio e a data atual.");
  patch={receivedAt:p.receivedAt,receivedById:who.id,receivedBy:who.nome};
 }else if(p.change==="cancel")patch={status:"anulado"};
 else return fail("Alteração de envio inválida.");
 const event={change:p.change,reason,at:now,actorId:who.id,actorName:who.nome,previousDeadline:entry.deadlineAt,...(patch.deadlineAt?{deadlineAt:patch.deadlineAt}:{}),...(patch.receivedAt?{receivedAt:patch.receivedAt}:{})};
 return replace(data,q,{...changed,enviosFornecedor:entries.map(e=>e.id===entry.id?{...e,...patch,history:[...(e.history||[]),event]}:e)});
}

export function quoteDispatchTracking(quote,proposal,now=new Date().toISOString()){
 const scope=quoteResponseScope(quote),history=(quote.enviosFornecedor||[]).filter(e=>e.proposalId===proposal.id&&e.fornecedorId===proposal.fornecedorId);
 const current=history.filter(e=>e.status!=="anulado"&&e.scope===scope).reverse().sort((a,b)=>String(b.sentAt).localeCompare(String(a.sentAt))||String(b.recordedAt).localeCompare(String(a.recordedAt)))[0]||null;
 if(!current)return {history,current:null,awaiting:false,overdue:false,receivedAt:null};
 const response=(quote.respostasFornecedor||[]).filter(r=>r.proposalId===proposal.id&&r.fornecedorId===proposal.fornecedorId&&r.scope===scope&&Date.parse(r.recebidaEm)>=Date.parse(current.sentAt)).sort((a,b)=>String(a.recebidaEm).localeCompare(String(b.recebidaEm)))[0];
 const receivedAt=[response?.recebidaEm,current.receivedAt].filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]||null;
 const awaiting=!receivedAt,overdue=awaiting&&Date.parse(current.deadlineAt)<Date.parse(now);
 return {history,current,receivedAt,manualReturn:!response&&Boolean(current.receivedAt),awaiting,overdue,late:!!receivedAt&&Date.parse(receivedAt)>Date.parse(current.deadlineAt)};
}
