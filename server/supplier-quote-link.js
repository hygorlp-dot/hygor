import crypto from "node:crypto";
import {chaveLinkAceite} from "./supplier-acceptance-link.js";
import {quoteResponseOpen,quoteResponseScope,responseItems} from "../src/domains/compras/supplier-quote-response.js";
const sign=(key,text)=>crypto.createHmac("sha256",key).update(text).digest();
export const quoteLinkKey=(env=process.env)=>{const root=chaveLinkAceite(env);return root?sign(root,"marcell:supplier-quote:v1"):null;};
const fingerprint=q=>crypto.createHash("sha256").update(quoteResponseScope(q)).digest("hex");
export function issueQuoteLink({key,quote,proposalId,company,now=Date.now()}){
 if(!key||!quoteResponseOpen(quote)||!quote.propostas?.some(p=>p.id===proposalId))throw Error("Cotação indisponível para gerar link.");
 const expires=now+7*86400000,body=Buffer.from(JSON.stringify({v:1,q:quote.id,p:proposalId,s:quote.propostas.find(p=>p.id===proposalId).fornecedorId,c:company,h:fingerprint(quote),e:expires,n:crypto.randomUUID()})).toString("base64url");
 return {token:`${body}.${sign(key,body).toString("base64url")}`,expiraEm:new Date(expires).toISOString()};
}
export function verifyQuoteLink({key,token,company,now=Date.now()}){
 try{if(!key||typeof token!=="string"||token.length>1400)return null;const [body,sig,...rest]=token.split(".");if(rest.length||!body||!sig||!/^[-_a-zA-Z0-9]+$/.test(body+sig))return null;
 const expected=sign(key,body),received=Buffer.from(sig,"base64url");if(received.length!==expected.length||!crypto.timingSafeEqual(received,expected))return null;
 const claims=JSON.parse(Buffer.from(body,"base64url"));return claims.v===1&&claims.c===company&&Number.isFinite(claims.e)&&claims.e>now&&claims.q&&claims.p&&claims.n?claims:null;
 }catch{return null;}
}
export function quoteLinkAccess(data,claims){
 const quote=(data.cotacoes||[]).find(q=>q.id===claims?.q),proposal=quote?.propostas?.find(p=>p.id===claims?.p);
 if(!quoteResponseOpen(quote)||!proposal||proposal.fornecedorId!==claims.s||fingerprint(quote)!==claims.h)return null;
 const supplier=(data.fornecedores||[]).find(f=>f.id===proposal.fornecedorId);
 if(!supplier||supplier.ativo===false)return null;
 return {quote,proposal,scope:quoteResponseScope(quote),responseId:`supplier-quote-${claims.n}`};
}
export function publicQuoteView(data,access){
 const {quote,proposal,responseId}=access;
 return {numero:quote.numero||quote.id,fornecedor:(data.fornecedores||[]).find(f=>f.id===proposal.fornecedorId)?.nome||"Fornecedor",enviada:Boolean(quote.respostasFornecedor?.some(r=>r.id===responseId)),statusResposta:quote.respostasFornecedor?.find(r=>r.id===responseId)?.status||"",
 itens:responseItems(quote).map(i=>({id:i.id,qtd:i.qtd,unidade:i.unidadeCompra||i.unidadeRef||"",descricao:i.descricaoRef||(data.materiais||[]).find(m=>m.id===i.materialId)?.descricao||"Material"}))};
}
