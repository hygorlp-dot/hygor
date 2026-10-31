import {expect,it} from "vitest";
import {mutateQuoteDispatch,quoteDispatchTracking} from "./quote-dispatch";
import {quoteResponseScope} from "./supplier-quote-response";
import {supplierResponseQueue} from "./quote-review";
import {applyOperationalCommand,OPERATIONAL_COMMAND} from "../sync/operational-commands";
import {validateOperationalCommandScope} from "../../../server/operational-command-policy";
import {buildFinancialLedger} from "../financeiro/ledger";
import {issueQuoteLink,quoteLinkAccess,quoteLinkKey,verifyQuoteLink} from "../../../server/supplier-quote-link";
const now="2026-10-30T12:00:00.000Z",sentAt="2026-10-28T12:00:00.000Z",deadlineAt="2026-10-29T12:00:00.000Z";
const fixture=()=>({obras:[{id:"o"}],materiais:[{id:"m",descricao:"Material",unidade:"UN"}],fornecedores:[{id:"f",nome:"Fornecedor",ativo:true},{id:"f2",nome:"Outro",ativo:true}],cotacoes:[{id:"q",numero:"COT-QA",obraId:"o",status:"aberta",version:1,data:"2026-10-20",itens:[{id:"i",materialId:"m",qtd:2,unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1}],propostas:[{id:"p",fornecedorId:"f",precos:{i:10}},{id:"p2",fornecedorId:"f2",precos:{i:11}}]}],pedidos:[],notasFiscais:[],transacoes:[]});
const command=(patch={})=>({type:OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED,actorId:"u",actorName:"Compras QA",actorRole:"compras",expectedVersion:1,idempotencyKey:"dispatch-command-0001",payload:{quoteId:"q",proposalId:"p",dispatchId:"dispatch-1",confirmSent:true,channel:"email",contact:"contato@qa.test",sentAt,deadlineAt},...patch});
const record=(d=fixture(),c=command())=>mutateQuoteDispatch(d,c,now);
const change=(d,payload,version=d.cotacoes[0].version)=>mutateQuoteDispatch(d,command({expectedVersion:version,payload:{quoteId:"q",dispatchId:"dispatch-1",reason:"Retificação conferida",...payload}}),now,true);
it("registra o envio declarado com autor, versão e escopo, sem produzir financeiro",()=>{
 const d=fixture(),before=buildFinancialLedger(d),r=record(d);expect(r.ok).toBe(true);expect(r.data.cotacoes[0]).toMatchObject({version:2,enviosFornecedor:[{recordedById:"u",recordedAt:now,sentAt,deadlineAt,channel:"email",contact:"contato@qa.test"}]});expect(d.cotacoes[0].enviosFornecedor).toBeUndefined();expect(buildFinancialLedger(r.data)).toEqual(before);
});
it.each(["engenheiro","financeiro","rh",undefined])("perfil %s não registra envio",role=>{expect(record(fixture(),command({actorRole:role})).ok).toBe(false)});
it("exige confirmação explícita, versão atual e fornecedor ativo",()=>{
 expect(record(fixture(),command({expectedVersion:0})).ok).toBe(false);expect(record(fixture(),command({payload:{...command().payload,confirmSent:false}})).ok).toBe(false);
 const d=fixture();d.fornecedores[0].ativo=false;expect(record(d).ok).toBe(false);d.cotacoes[0].status="decidida";expect(record(d).ok).toBe(false);
});
it.each([{sentAt:"2026-02-30T12:00:00.000Z"},{sentAt:"2026-11-01T12:00:00.000Z"},{deadlineAt:sentAt},{deadlineAt:"inválido"},{channel:"sms"},{contact:""}])("valida datas, prazo e contato: %j",patch=>{expect(record(fixture(),command({payload:{...command().payload,...patch}})).ok).toBe(false)});
it("recusa duplicata mesmo com outro comando e mantém idempotência do pipeline",()=>{
 const d=fixture(),r=applyOperationalCommand(d,command(),now),repeat=applyOperationalCommand(r.data,command(),now);expect(repeat.idempotent).toBe(true);expect(repeat.data.cotacoes[0].enviosFornecedor).toHaveLength(1);
 expect(record(r.data,command({expectedVersion:2,payload:{...command().payload,dispatchId:"dispatch-2"}})).ok).toBe(false);
});
it("retificação preserva o envio original e registra prazo anterior e justificativa",()=>{
 const d=record().data,r=change(d,{change:"deadline",deadlineAt:"2026-10-31T12:00:00.000Z"});expect(r.ok).toBe(true);const entry=r.data.cotacoes[0].enviosFornecedor[0];expect(entry.sentAt).toBe(sentAt);expect(entry.history[0]).toMatchObject({previousDeadline:deadlineAt,actorId:"u",reason:"Retificação conferida"});expect(change(d,{change:"deadline",deadlineAt,reason:""}).ok).toBe(false);expect(change(d,{change:"cancel"},1).ok).toBe(false);
});
it("calcula vencimento e cancela sem apagar a auditoria",()=>{
 const d=record().data,q=d.cotacoes[0];expect(quoteDispatchTracking(q,q.propostas[0],now).overdue).toBe(true);
 const r=change(d,{change:"cancel"});expect(r.data.cotacoes[0].enviosFornecedor[0]).toMatchObject({status:"anulado",history:[{change:"cancel"}]});expect(quoteDispatchTracking(r.data.cotacoes[0],q.propostas[0],now).current).toBeNull();
});
it("o retorno real pelo portal encerra a espera e impede prorrogação retroativa",()=>{
 const d=record().data,q=d.cotacoes[0];q.respostasFornecedor=[{id:"response",proposalId:"p",fornecedorId:"f",scope:quoteResponseScope(q),recebidaEm:now,status:"pendente"}];
 expect(quoteDispatchTracking(q,q.propostas[0],now)).toMatchObject({awaiting:false,overdue:false,late:true,receivedAt:now});expect(supplierResponseQueue([q],now)[0].status).toBe("pendente");expect(change(d,{change:"deadline",deadlineAt:"2026-11-01T12:00:00.000Z"}).ok).toBe(false);
});
it("retorno por outro canal não altera preços nem aprova compra",()=>{
 const d=record().data,r=change(d,{change:"returned",receivedAt:now});expect(r.ok).toBe(true);expect(r.data.cotacoes[0].propostas).toEqual(d.cotacoes[0].propostas);expect(supplierResponseQueue(r.data.cotacoes,now)[0]).toMatchObject({status:"retorno_manual",tracking:{overdue:false}});expect(change(r.data,{change:"returned",receivedAt:now}).ok).toBe(false);
});
it("preserva o primeiro retorno ao receber a confirmação pelo portal posteriormente",()=>{
 const d=change(record().data,{change:"returned",receivedAt:"2026-10-29T10:00:00.000Z"}).data,q=d.cotacoes[0];q.respostasFornecedor=[{proposalId:"p",fornecedorId:"f",scope:quoteResponseScope(q),recebidaEm:now,status:"pendente"}];expect(quoteDispatchTracking(q,q.propostas[0],now)).toMatchObject({receivedAt:"2026-10-29T10:00:00.000Z",late:false,manualReturn:false});
});
it("itens/fornecedor alterados invalidam o acompanhamento anterior",()=>{
 const d=record().data,q=d.cotacoes[0];q.itens[0].qtd=3;expect(quoteDispatchTracking(q,q.propostas[0],now).current).toBeNull();expect(change(d,{change:"cancel"}).ok).toBe(false);q.propostas[0].fornecedorId="f2";expect(quoteDispatchTracking(q,q.propostas[0],now).history).toEqual([]);
});
it("registrar envio não invalida o link e não muda sua expiração",()=>{
 const d=fixture(),key=quoteLinkKey({PEDIDO_ACEITE_SECRET:"secret".repeat(8)}),link=issueQuoteLink({key,quote:d.cotacoes[0],proposalId:"p",company:"qa",now:Date.parse(sentAt)}),claims=verifyQuoteLink({key,token:link.token,company:"qa",now:Date.parse(now)});
 expect(quoteLinkAccess(record(d).data,claims)).not.toBeNull();expect(link.expiraEm).toBe("2026-11-04T12:00:00.000Z");
});
it("envios são preservados ao salvar a cotação e não podem ser forjados por esse caminho",()=>{
 const d=record().data,quote={...d.cotacoes[0],enviosFornecedor:[{id:"forjado"}]};const r=applyOperationalCommand(d,command({type:OPERATIONAL_COMMAND.QUOTATION_SAVED,expectedVersion:2,idempotencyKey:"quote-save-0001",payload:{quote}}),now);expect(r.ok,r.reason).toBe(true);expect(r.data.cotacoes[0].enviosFornecedor).toEqual(d.cotacoes[0].enviosFornecedor);
});
it.each([OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED,OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_UPDATED])("escopo de %s vem da cotação autoritativa",type=>{
 const d=fixture(),c=command({type,payload:{...command().payload,obraId:"forjada"}});expect(validateOperationalCommandScope({user:{role:"compras",obraId:"o"},data:d,command:c})).toMatchObject({ok:true,obraId:"o"});expect(validateOperationalCommandScope({user:{role:"compras",obraId:"other"},data:d,command:c}).ok).toBe(false);
});
