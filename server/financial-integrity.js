const cents=value=>Math.round(Number(value||0)*100);
const active=row=>String(row?.status||"active")==="active";

const finding=(code,severity,message,details={})=>({code,severity,message,details});

export const auditCanonicalFinancialIntegrity=({
  titles=[],
  settlements=[],
  banks=[],
  reconciliationLinks=[],
  legacyLinks=[],
  accountingPeriods=[],
}={})=>{
  const findings=[];
  const titleById=new Map((titles||[]).map(row=>[String(row.id),row]));
  const settlementById=new Map((settlements||[]).map(row=>[String(row.id),row]));
  const bankById=new Map((banks||[]).map(row=>[String(row.id),row]));

  for(const row of settlements||[]){
    const title=titleById.get(String(row.title_id||""));
    if(!title){
      findings.push(finding("orphan_settlement","error","Liquidação sem título canônico.",{settlementId:row.id,titleId:row.title_id||""}));
      continue;
    }
    if(active(row)&&cents(row.amount)<=0){
      findings.push(finding("invalid_settlement_amount","error","Liquidação ativa com valor não positivo.",{settlementId:row.id,amount:Number(row.amount||0)}));
    }
    if(row.bank_transaction_id){
      const bank=bankById.get(String(row.bank_transaction_id));
      if(!bank){
        findings.push(finding("orphan_settlement_bank","error","Liquidação aponta para transação bancária inexistente.",{settlementId:row.id,bankTransactionId:row.bank_transaction_id}));
      }else if(active(row)){
        const expected=title.direction==="payable"?"out":"in";
        if(String(bank.direction||"")!==expected){
          findings.push(finding("bank_direction_mismatch","error","Direção bancária incompatível com o título.",{
            settlementId:row.id,titleId:title.id,bankTransactionId:bank.id,titleDirection:title.direction,bankDirection:bank.direction,
          }));
        }
      }
    }
  }

  for(const title of titles||[]){
    if(["cancelled","reversed"].includes(String(title.status||"")))continue;
    const activeSettlements=(settlements||[]).filter(row=>active(row)&&String(row.title_id)===String(title.id));
    const settledCents=activeSettlements.reduce((sum,row)=>sum+cents(row.amount),0);
    const originalCents=cents(title.original_amount);
    if(settledCents>originalCents){
      findings.push(finding("title_over_settled","error","Liquidações ativas excedem o valor original do título.",{
        titleId:title.id,originalAmount:originalCents/100,settledAmount:settledCents/100,
      }));
    }
    if(String(title.status)==="settled"&&settledCents<originalCents){
      findings.push(finding("settled_title_underpaid","error","Título marcado como quitado possui saldo em aberto.",{
        titleId:title.id,originalAmount:originalCents/100,settledAmount:settledCents/100,
      }));
    }
    if(String(title.status)==="partial"&&(settledCents<=0||settledCents>=originalCents)){
      findings.push(finding("partial_title_inconsistent","warning","Título parcial possui liquidação incompatível com o status.",{
        titleId:title.id,originalAmount:originalCents/100,settledAmount:settledCents/100,
      }));
    }
  }

  for(const link of reconciliationLinks||[]){
    if(!active(link))continue;
    const settlement=settlementById.get(String(link.settlement_id||""));
    const bank=bankById.get(String(link.bank_transaction_id||""));
    if(!settlement){
      findings.push(finding("orphan_reconciliation_settlement","error","Vínculo de conciliação sem liquidação.",{linkId:link.id,settlementId:link.settlement_id||""}));
      continue;
    }
    if(!active(settlement)){
      findings.push(finding("active_link_reversed_settlement","error","Vínculo ativo aponta para liquidação estornada.",{linkId:link.id,settlementId:settlement.id}));
    }
    if(!bank){
      findings.push(finding("orphan_reconciliation_bank","error","Vínculo de conciliação sem transação bancária.",{linkId:link.id,bankTransactionId:link.bank_transaction_id||""}));
    }
    if(String(link.title_id||"")&&String(link.title_id)!==String(settlement.title_id||"")){
      findings.push(finding("reconciliation_title_mismatch","error","Vínculo de conciliação aponta para título diferente da liquidação.",{
        linkId:link.id,linkTitleId:link.title_id,settlementTitleId:settlement.title_id,
      }));
    }
    if(String(settlement.bank_transaction_id||"")&&String(link.bank_transaction_id||"")!==String(settlement.bank_transaction_id||"")){
      findings.push(finding("reconciliation_bank_mismatch","error","Vínculo de conciliação aponta para banco diferente da liquidação.",{
        linkId:link.id,linkBankTransactionId:link.bank_transaction_id,settlementBankTransactionId:settlement.bank_transaction_id,
      }));
    }
    if(cents(link.amount)>cents(settlement.amount)){
      findings.push(finding("reconciliation_exceeds_settlement","error","Vínculo conciliado excede o valor da liquidação.",{
        linkId:link.id,linkAmount:Number(link.amount||0),settlementAmount:Number(settlement.amount||0),
      }));
    }
  }

  for(const bank of banks||[]){
    const linkedCents=(reconciliationLinks||[])
      .filter(link=>active(link)&&String(link.bank_transaction_id)===String(bank.id))
      .reduce((sum,link)=>sum+cents(link.amount),0);
    const bankCents=cents(bank.amount);
    if(linkedCents>bankCents){
      findings.push(finding("bank_over_allocated","error","Conciliações ativas excedem o valor da transação bancária.",{
        bankTransactionId:bank.id,bankAmount:bankCents/100,allocatedAmount:linkedCents/100,
      }));
    }
  }

  const canonicalTitleIds=new Set((titles||[]).map(row=>String(row.id)));
  for(const link of legacyLinks||[]){
    if(String(link.canonical_type||"")!=="financial_title")continue;
    if(!canonicalTitleIds.has(String(link.canonical_id||""))){
      findings.push(finding("orphan_legacy_link","error","legacy_record_link aponta para título canônico inexistente.",{
        legacyType:link.legacy_type||"",legacyId:link.legacy_id||"",canonicalId:link.canonical_id||"",
      }));
    }
  }

  const closed=(accountingPeriods||[])
    .filter(row=>String(row.status)==="closed")
    .map(row=>({id:row.id,start:String(row.starts_on||"").slice(0,10),end:String(row.ends_on||"").slice(0,10)}))
    .filter(row=>row.start&&row.end)
    .sort((a,b)=>a.start.localeCompare(b.start));
  for(let index=1;index<closed.length;index+=1){
    const previous=closed[index-1],current=closed[index];
    if(current.start<=previous.end){
      findings.push(finding("overlapping_closed_periods","error","Existem períodos contábeis fechados sobrepostos.",{
        previousId:previous.id,currentId:current.id,previousStart:previous.start,previousEnd:previous.end,currentStart:current.start,currentEnd:current.end,
      }));
    }
  }

  const errors=findings.filter(item=>item.severity==="error");
  const warnings=findings.filter(item=>item.severity==="warning");
  return {
    ok:errors.length===0,
    findings,
    errors,
    warnings,
    counts:{errors:errors.length,warnings:warnings.length,total:findings.length},
  };
};
