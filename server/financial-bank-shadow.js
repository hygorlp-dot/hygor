const cents=value=>Math.round(Number(value||0)*100);
const date=value=>String(value||"").slice(0,10);
const text=value=>String(value??"").trim();

export const compareLegacyBankTransactions=(legacyRows=[],canonicalRows=[])=>{
  const issues=[];
  const canonicalByLegacyId=new Map();
  for(const row of canonicalRows||[]){
    const legacyId=text(row?.metadata?.legacyId);
    if(!legacyId)continue;
    canonicalByLegacyId.set(legacyId,row);
  }

  const incomingIds=new Set();
  for(const legacy of legacyRows||[]){
    const legacyId=text(legacy?.legacyId);
    if(!legacyId){
      issues.push({code:"legacy_bank_without_id",legacyId:""});
      continue;
    }
    incomingIds.add(legacyId);
    const canonical=canonicalByLegacyId.get(legacyId);
    if(!canonical){
      issues.push({code:"legacy_bank_missing_canonical",legacyId});
      continue;
    }

    const expected={
      date:date(legacy?.date),
      direction:text(legacy?.direction),
      amountCents:cents(legacy?.amount),
      description:text(legacy?.description),
      obraId:text(legacy?.obraId),
    };
    const actual={
      date:date(canonical?.booking_date),
      direction:text(canonical?.direction),
      amountCents:cents(canonical?.amount),
      description:text(canonical?.raw_description),
      obraId:text(canonical?.metadata?.obraId),
    };
    const fields=Object.keys(expected).filter(key=>expected[key]!==actual[key]);
    if(fields.length){
      issues.push({
        code:"legacy_bank_stale",
        legacyId,
        fields,
        expected,
        actual,
      });
    }
  }

  for(const [legacyId,canonical] of canonicalByLegacyId){
    if(incomingIds.has(legacyId))continue;
    issues.push({
      code:"canonical_legacy_bank_not_in_snapshot",
      legacyId,
      actual:{
        date:date(canonical?.booking_date),
        direction:text(canonical?.direction),
        amountCents:cents(canonical?.amount),
        description:text(canonical?.raw_description),
        obraId:text(canonical?.metadata?.obraId),
      },
    });
  }

  return issues;
};
