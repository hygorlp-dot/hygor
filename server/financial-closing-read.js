const competence=(year,month)=>`${Number(year)}-${String(Number(month)+1).padStart(2,"0")}`;

export const closedCompanyDreEntries=data=>{
  const byCompetence=new Map();
  for(const closing of data?.fechamentosFinanceiros||[]){
    if(closing?.status!=="fechado")continue;
    const canonical=closing?.snapshot?.canonicalDre;
    if(!canonical?.payload)continue;
    const ym=String(closing.competencia||"");
    if(!/^\d{4}-\d{2}$/.test(ym))continue;
    const entry={
      competencia:ym,
      sourceId:String(canonical.sourceId||`${ym}:mes:company_dre`),
      payload:canonical.payload,
      canonicalRevision:String(canonical.canonicalRevision||""),
      sourceRevision:String(canonical.sourceRevision||""),
      projectionVersion:String(canonical.projectionVersion||""),
      closingId:String(closing.id||""),
      closedAt:String(closing.fechadoEm||""),
      closedById:String(closing.fechadoPorId||""),
    };
    const current=byCompetence.get(ym);
    if(!current||entry.closedAt>current.closedAt)byCompetence.set(ym,entry);
  }
  return [...byCompetence.values()]
    .sort((a,b)=>a.competencia.localeCompare(b.competencia));
};

export const closedCompanyDreFor=(data,year,month)=>{
  const ym=competence(year,month);
  return closedCompanyDreEntries(data).find(item=>item.competencia===ym)||null;
};

export const closedCompanyDreBySourceId=data=>
  new Map(closedCompanyDreEntries(data).map(item=>[item.sourceId,item]));

export const overlayClosedCompanyDreYear=(data,year,months=[])=>{
  const closed=new Map(closedCompanyDreEntries(data)
    .filter(item=>item.competencia.startsWith(`${Number(year)}-`))
    .map(item=>[Number(item.competencia.slice(5,7))-1,item]));
  return Array.from({length:12},(_,month)=>{
    const frozen=closed.get(month);
    return frozen?frozen.payload:(months?.[month]??null);
  });
};
