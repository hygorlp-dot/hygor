export const isValidIsoDate=value=>{
  const text=String(value||"");
  const match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  if(year<1900||year>2200||month<1||month>12||day<1)return false;
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
};

export const isoPeriodsOverlap=(oneStart,oneEnd,twoStart,twoEnd)=>
  isValidIsoDate(oneStart)&&isValidIsoDate(twoStart)
  &&String(oneStart)<=String(twoEnd||"9999-12-31")
  &&String(twoStart)<=String(oneEnd||"9999-12-31");
