import { active, toCents } from "./ledger.js";
import { analyzePurchaseThreeWayMatch, isDateInClosedPeriod } from "./workflows.js";

export const INVOICE_COMMAND=Object.freeze({
  INVOICE_SAVED:"NOTA_FISCAL_SALVA",
  INVOICE_APPROVED:"NOTA_FISCAL_APROVADA",
});

export const INVOICE_COMMAND_TYPES=new Set(Object.values(INVOICE_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const actorOf=command=>({
  id:String(command.actorId||""),
  nome:String(command.actorName||"").trim()||"Usuário autenticado",
});
const invoiceById=(data,id)=>(data.notasFiscais||[])
  .find(item=>String(item.id)===String(id));
const projectExists=(data,id)=>(data.obras||[])
  .some(item=>String(item.id)===String(id));
const validDate=value=>!value||/^\d{4}-\d{2}-\d{2}$/.test(String(value));
const sameVersion=(item,expected)=>
  expected!=null&&versionOf(item)===Number(expected);
const retentionKeys=["iss","inss","irrf","pis","cofins","csll","outros"];
const inactiveStatus=status=>
  ["cancelada","cancelado","estornada","estornado","rejeitada","rejeitado"]
    .includes(String(status||"").toLowerCase());
const invoicePayments=invoice=>(invoice?.pagamentos||[])
  .filter(item=>active(item));

const normalizeRetentions=(raw,grossCents)=>{
  const retencoes={};
  let totalCents=0;
  for(const key of retentionKeys){
    const value=Number(raw?.[key]||0),cents=toCents(value);
    if(!Number.isFinite(value)||cents<0)return {error:"As retenções da nota precisam ser valores positivos."};
    retencoes[key]=cents/100;
    totalCents+=cents;
  }
  if(totalCents>grossCents)return {error:"As retenções não podem superar o valor bruto da nota."};
  return {retencoes,totalCents};
};

const normalizeAllocations=(raw,obraId,grossCents)=>{
  const source=Array.isArray(raw)&&raw.length?raw:[{
    id:`rateio-${obraId}`,obraId,etapaId:"",percentual:100,valor:grossCents/100,
  }];
  const rateios=[];
  let totalCents=0;
  for(const item of source){
    const target=String(item?.obraId||"");
    const value=Number(item?.valor);
    const valueCents=toCents(item?.valor);
    if(!target||!Number.isFinite(value)||valueCents<0){
      return {error:"O rateio da nota contém obra ou valor inválido."};
    }
    totalCents+=valueCents;
    rateios.push({
      ...item,id:String(item.id||`rateio-${target}-${rateios.length+1}`),
      obraId:target,etapaId:String(item.etapaId||""),
      percentual:grossCents?valueCents/grossCents*100:0,valor:valueCents/100,
    });
  }
  if(Math.abs(totalCents-grossCents)>1)return {
    error:"A soma dos rateios precisa conferir com o valor bruto da nota.",
  };
  return {rateios};
};

const normalizeInvoice=(data,raw,current)=>{
  const id=String(raw.id||"");
  const obraId=String(raw.obraId||"");
  const numero=String(raw.numero||"").trim();
  const emissao=String(raw.emissao||"");
  const vencimento=String(raw.vencimento||"");
  const grossValue=Number(raw.valorBruto);
  const grossCents=toCents(grossValue);
  if(!id)return {error:"Nota fiscal sem identificação única."};
  if(!obraId||!projectExists(data,obraId))return {error:"Selecione uma obra existente para a nota."};
  if(!numero)return {error:"Informe o número da nota fiscal."};
  if(!validDate(emissao)||!emissao)return {error:"Informe uma data de emissão válida."};
  if(!validDate(vencimento))return {error:"Informe uma data de vencimento válida."};
  if(!Number.isFinite(grossValue)||grossCents<=0){
    return {error:"Informe um valor bruto positivo para a nota."};
  }
  if(isDateInClosedPeriod(data,emissao))return {error:"O período financeiro desta nota está fechado."};
  const pedidoId=String(raw.pedidoId||"");
  const pedido=pedidoId?(data.pedidos||[]).find(item=>String(item.id)===pedidoId):null;
  if(pedidoId&&!pedido)return {error:"O pedido relacionado não foi encontrado."};
  if(pedido&&String(pedido.obraId)!==obraId)return {error:"A nota e o pedido precisam pertencer à mesma obra."};
  const duplicate=(data.notasFiscais||[]).find(item=>
    String(item.id)!==id&&!inactiveStatus(item.status)&&String(raw.chave||"")
    &&String(item.chave||"")===String(raw.chave));
  if(duplicate)return {error:"Já existe uma nota ativa com esta chave de acesso."};
  const retentions=normalizeRetentions(raw.retencoes,grossCents);
  if(retentions.error)return retentions;
  const allocations=normalizeAllocations(raw.rateios,obraId,grossCents);
  if(allocations.error)return allocations;
  if(allocations.rateios.some(item=>!projectExists(data,item.obraId))){
    return {error:"Um dos rateios aponta para uma obra inexistente."};
  }
  const liquidCents=grossCents-retentions.totalCents;
  const protectedChanged=current&&invoicePayments(current).length&&[
    [current.obraId,obraId],[current.pedidoId||"",pedidoId],
    [toCents(current.valorBruto),grossCents],
    [toCents(current.valorLiquido),liquidCents],
  ].some(([before,after])=>String(before)!==String(after));
  if(protectedChanged)return {
    error:"A nota possui pagamento ativo. Estorne o pagamento antes de alterar obra, pedido ou valores.",
  };
  return {
    invoice:{
      ...current,...raw,id,obraId,pedidoId,numero,emissao,vencimento,
      valorBruto:grossCents/100,valorLiquido:liquidCents/100,
      retencoes:retentions.retencoes,rateios:allocations.rateios,
      pagamentos:(current?.pagamentos||[]).map(item=>({...item})),
      documentos:(raw.documentos||current?.documentos||[]).map(item=>({...item})),
    },
  };
};

const saveInvoice=(data,command,now)=>{
  const raw=command.payload?.invoice||{};
  const current=invoiceById(data,raw.id);
  if(current&&!sameVersion(current,command.expectedVersion)){
    return fail("A nota fiscal foi alterada por outra pessoa. Atualize a tela.");
  }
  if(!current&&command.expectedVersion!==0)return fail("A criação da nota exige versão inicial zero.");
  const normalized=normalizeInvoice(data,raw,current);
  if(normalized.error)return fail(normalized.error);
  const actor=actorOf(command);
  const candidate={
    ...normalized.invoice,
    status:current?.status||"recebida",
    version:current?versionOf(current)+1:1,
    criadoEm:current?.criadoEm||now,criadoPorId:current?.criadoPorId||actor.id,
    criadoPor:current?.criadoPor||actor.nome,
    atualizadoEm:now,updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
    analiseIA:normalized.invoice.analiseIA?{
      ...normalized.invoice.analiseIA,
      revisadoPorId:actor.id,revisadoPor:actor.nome,revisadoEm:now,
    }:null,
  };
  const base=(data.notasFiscais||[]).filter(item=>String(item.id)!==candidate.id);
  const projection={...data,notasFiscais:[...base,candidate]};
  const match=candidate.pedidoId
    ?analyzePurchaseThreeWayMatch(projection,candidate.pedidoId):null;
  const labels={
    RECEIPT_EXCEEDS_ORDER:"Recebimento físico acima do pedido.",
    INVOICE_EXCEEDS_ORDER:"Notas fiscais acima do valor contratado no pedido.",
    INVOICE_EXCEEDS_PHYSICAL_RECEIPT:"Valor fiscal acima do material fisicamente recebido.",
  };
  const divergencias=(match?.issues||[]).map(issue=>
    `${labels[issue.code]||issue.code} Diferença: R$ ${(Math.abs(issue.differenceCents||0)/100).toFixed(2)}.`);
  const saved={
    ...candidate,divergencias,
    threeWayMatch:match?{
      status:match.status,orderedCents:match.orderedCents,
      receivedCents:match.receivedCents,invoicedCents:match.invoicedCents,
      checkedAt:now,
    }:null,
  };
  return {
    ok:true,entityId:saved.id,
    summary:{divergenceCount:divergencias.length},
    data:{...data,notasFiscais:current
      ?(data.notasFiscais||[]).map(item=>item.id===saved.id?saved:item)
      :[...(data.notasFiscais||[]),saved]},
  };
};

const approveInvoice=(data,command,now)=>{
  const payload=command.payload||{};
  const invoice=invoiceById(data,payload.invoiceId);
  if(!invoice||inactiveStatus(invoice.status))return fail("Nota fiscal não encontrada ou inativa.");
  if(!sameVersion(invoice,command.expectedVersion)){
    return fail("A nota fiscal foi alterada por outra pessoa. Atualize a tela.");
  }
  if(invoice.status==="aprovada"||invoice.status==="paga")return fail("A nota fiscal já foi aprovada.");
  if(isDateInClosedPeriod(data,invoice.emissao))return fail("O período financeiro desta nota está fechado.");
  if((invoice.divergencias||[]).length&&payload.riskAccepted!==true){
    return fail("Confirme explicitamente a aprovação da nota com divergências.");
  }
  const actor=actorOf(command);
  const approved={
    ...invoice,status:"aprovada",aprovadoPorId:actor.id,aprovadoPor:actor.nome,
    aprovadoEm:now,atualizadoEm:now,updatedAt:now,
    updatedById:actor.id,updatedBy:actor.nome,version:versionOf(invoice)+1,
  };
  return {
    ok:true,entityId:approved.id,
    data:{...data,notasFiscais:(data.notasFiscais||[])
      .map(item=>item.id===approved.id?approved:item)},
  };
};

export const invoiceCommandObraId=(data={},command={})=>{
  if(command.type===INVOICE_COMMAND.INVOICE_SAVED){
    const raw=command.payload?.invoice||{};
    return String(invoiceById(data,raw.id)?.obraId||raw.obraId||"");
  }
  return String(invoiceById(data,command.payload?.invoiceId)?.obraId||"");
};

export const applyInvoiceCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!INVOICE_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para alterar notas fiscais.");
  return command.type===INVOICE_COMMAND.INVOICE_SAVED
    ?saveInvoice(data,command,now):approveInvoice(data,command,now);
};
