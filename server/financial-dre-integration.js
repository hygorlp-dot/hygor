import { createHash } from "node:crypto";
import { buildFinancialLedger, toCents } from "../src/domains/financeiro/ledger.js";
import { buildDreCashManagement } from "../src/domains/conciliacao/cash-allocations.js";

export const validateNativeDreCommand = (command={}) => {
  const payload=command.payload||{};
  const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||""));
  if((command.type==="REGISTER_SETTLEMENT"&&(!uuid(payload.titleId)||(Object.hasOwn(payload,"bankTransactionId")&&!uuid(payload.bankTransactionId))))||(command.type==="REVERSE_SETTLEMENT"&&!uuid(payload.settlementId)))return "Identificador financeiro inválido.";
  if(["CREATE_FINANCIAL_TITLE","REGISTER_SETTLEMENT"].includes(command.type)){
    const amount=Number(payload.amount),cents=Math.round(amount*100);
    if(!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents<=0||Math.abs(amount*100-cents)>0.000001)return "Informe um valor positivo com até duas casas decimais.";
  }
  if(command.type==="CREATE_FINANCIAL_TITLE"){
    if(Object.hasOwn(payload,"legacyId")||Object.hasOwn(payload,"legacyType"))return "Identificadores de projeção operacional são reservados ao servidor.";
    if(!["cost","revenue","funding","loan","transfer"].includes(payload.financialKind))return "Informe financialKind: cost, revenue, funding, loan ou transfer. A natureza determina o tratamento no DRE.";
    if(!["payable","receivable"].includes(payload.direction)||(payload.financialKind==="cost"&&payload.direction!=="payable")||(payload.financialKind==="revenue"&&payload.direction!=="receivable"))return "A direção do título é incompatível com a natureza do DRE.";
  }
  return "";
};

const all = async (db, company, table, columns) => {
  const result=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await db.from(table).select(columns).eq("company_id",company).order("id").range(offset,offset+999);
    if(error)throw error;
    result.push(...(data||[]));
    if((data||[]).length<1000)return result;
  }
};

export const canonicalDreEvents = ({titles=[],settlements=[],banks=[]}={}) => {
  const events=[],issues=[];
  const nativeTitles=titles.filter(title=>!title.metadata?.legacyId);
  const bankIds=new Map(banks.map(bank=>[bank.id,bank.metadata?.legacyId||bank.id]));
  for(const title of nativeTitles){
    if(["cancelled","reversed"].includes(title.status))continue;
    const kind=title.metadata?.financialKind;
    const date=String(title.competence||title.due_date||"").slice(0,10);
    const base={sourceType:"canonical_title",sourceId:title.id,obraId:title.obra_id||"",date,
      competence:date.slice(0,7),category:title.metadata?.dreCategory||"outros",
      description:title.metadata?.description||title.metadata?.descricao||title.origin_type,
      metadata:{native:true,financialKind:kind||"unclassified"}};
    if(["cost","revenue"].includes(kind))events.push({...base,id:`canonical_title:${title.id}:${kind}`,effect:kind,amountCents:toCents(title.original_amount)});
    else if(!["funding","loan","transfer"].includes(kind))issues.push({code:"NATIVE_TITLE_WITHOUT_DRE_CLASSIFICATION",sourceId:title.id,obraId:base.obraId,description:"Título da API sem natureza financeira confirmada. Não foi presumido como receita ou custo."});
    for(const settlement of settlements.filter(item=>item.title_id===title.id&&item.status==="active")){
      const effect=title.direction==="payable"?"cash_out":"cash_in";
      events.push({...base,id:`canonical_settlement:${settlement.id}:${effect}`,effect,
        sourceType:"canonical_settlement",sourceId:settlement.id,sourceSubId:settlement.id,
        settlesSourceType:"canonical_title",settlesSourceId:title.id,
        date:String(settlement.settlement_date).slice(0,10),amountCents:toCents(settlement.amount),
        transactionId:settlement.bank_transaction_id?(bankIds.get(settlement.bank_transaction_id)||settlement.bank_transaction_id):"",
      });
    }
  }
  const revision=createHash("sha256").update(JSON.stringify({events,issues})).digest("hex");
  return {events,issues,revision};
};

export const loadCanonicalDre = async (db,company) => {
  const [titles,settlements,banks,links]=await Promise.all([
    all(db,company,"financial_titles","id,origin_type,obra_id,direction,competence,due_date,original_amount,status,metadata"),
    all(db,company,"settlements","id,title_id,bank_transaction_id,amount,settlement_date,status"),
    all(db,company,"bank_transactions","id,amount,status,metadata"),
    all(db,company,"reconciliation_links","id,bank_transaction_id,amount,status"),
  ]);
  return {...canonicalDreEvents({titles,settlements,banks}),banks,links};
};

export const buildIntegratedDreManagement = (data,canonical) => {
  const ledger=buildFinancialLedger(data,{supplementalEvents:canonical.events});
  const report=buildDreCashManagement(data,{events:ledger.events});
  const byLegacyId=new Map(canonical.banks.map(bank=>[bank.metadata?.legacyId,bank]));
  const banks=report.banks.map(bank=>{
      const native=byLegacyId.get(bank.id);
      const nativeCents=canonical.links.filter(link=>link.bank_transaction_id===native?.id&&link.status==="active").reduce((sum,link)=>sum+toCents(link.amount),0);
      const allocatedCents=Math.max(bank.allocatedCents,bank.amountCents-bank.remainingCents)+nativeCents;
      // O vínculo integral legado já está refletido no status do snapshot.
      const used=bank.status==="conciliado"&&!bank.allocatedCents?Math.max(nativeCents,bank.amountCents):allocatedCents;
      const remainingCents=Math.max(0,bank.amountCents-used);
      const status=nativeCents>0?(remainingCents?"parcial":"conciliado"):bank.status;
      return {...bank,status,allocatedCents:used,remainingCents,canonicalSettlementLinked:nativeCents>0};
    });
  return {...report,issues:[...ledger.issues,...canonical.issues],canonicalRevision:canonical.revision,banks,
    pendingCents:banks.filter(bank=>bank.status!=="ignorado").reduce((sum,bank)=>sum+bank.remainingCents,0)};
};
