import { isValidIsoDate } from "./date.js";

const RENTAL_BILLING_RULE=Object.freeze({
  BEST_COMBINATION:"best_combination",CALENDAR_DAY:"calendar_day",BUSINESS_DAY:"business_day",
  MINIMUM_DAILY:"minimum_daily",TARIFF_WEEK:"tariff_week",TARIFF_FORTNIGHT:"tariff_fortnight",
  THIRTY_DAY_MONTH:"thirty_day_month",CIVIL_MONTH:"civil_month",ANNIVERSARY_CYCLE:"anniversary_cycle",
});
const RENTAL_BILLING_RULES=Object.freeze(Object.values(RENTAL_BILLING_RULE));
export const normalizeBillingRule=value=>String(value||"")==="menor_combinacao"?RENTAL_BILLING_RULE.BEST_COMBINATION
  :RENTAL_BILLING_RULES.includes(String(value||""))?String(value):RENTAL_BILLING_RULE.BEST_COMBINATION;
const cents=value=>Number.isSafeInteger(Number(value))?Math.max(0,Number(value)):0;
const daysBetween=(start,end)=>Math.floor((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000)+1;
const businessDays=(start,end)=>{let total=0,cursor=new Date(`${start}T00:00:00Z`),limit=new Date(`${end}T00:00:00Z`);while(cursor<=limit){const day=cursor.getUTCDay();if(day!==0&&day!==6)total++;cursor.setUTCDate(cursor.getUTCDate()+1);}return total;};
const integerBest=(rates,days)=>{const packs=[[30,cents(rates.month)],[15,cents(rates.fortnight)],[7,cents(rates.week)],[1,cents(rates.day)]].filter(([,price])=>price>0);if(!packs.length)return 0;const dp=new Array(days+1).fill(Number.MAX_SAFE_INTEGER);dp[0]=0;for(let i=1;i<=days;i++)for(const [size,price] of packs)dp[i]=Math.min(dp[i],price+dp[Math.max(0,i-size)]);return dp[days];};

export const calculateRentalBillingCycle=input=>{
  const startDate=String(input?.startDate||""),endDate=String(input?.endDate||"");
  if(!isValidIsoDate(startDate)||!isValidIsoDate(endDate)||endDate<startDate)return {ok:false,reason:"Informe um período válido para a cobrança."};
  const rule=normalizeBillingRule(input.rule),rates=input.ratesCents||{},calendarDays=daysBetween(startDate,endDate);
  let units=calendarDays,baseCents=0,unit="dia";
  if(rule===RENTAL_BILLING_RULE.BEST_COMBINATION)baseCents=integerBest(rates,calendarDays);
  else if(rule===RENTAL_BILLING_RULE.CALENDAR_DAY)baseCents=calendarDays*cents(rates.day);
  else if(rule===RENTAL_BILLING_RULE.BUSINESS_DAY){units=businessDays(startDate,endDate);baseCents=units*cents(rates.day);unit="dia útil";}
  else if(rule===RENTAL_BILLING_RULE.MINIMUM_DAILY){units=Math.max(calendarDays,Math.max(1,Number(input.minimumDays||1)));baseCents=units*cents(rates.day);}
  else if(rule===RENTAL_BILLING_RULE.TARIFF_WEEK){units=Math.ceil(calendarDays/7);baseCents=units*cents(rates.week);unit="semana";}
  else if(rule===RENTAL_BILLING_RULE.TARIFF_FORTNIGHT){units=Math.ceil(calendarDays/15);baseCents=units*cents(rates.fortnight);unit="quinzena";}
  else if(rule===RENTAL_BILLING_RULE.THIRTY_DAY_MONTH){const months=Math.floor(calendarDays/30),remaining=calendarDays%30;units=months;baseCents=months*cents(rates.month)+remaining*cents(rates.day);unit="mês de 30 dias";}
  else if(rule===RENTAL_BILLING_RULE.CIVIL_MONTH){units=(Number(endDate.slice(0,4))-Number(startDate.slice(0,4)))*12+Number(endDate.slice(5,7))-Number(startDate.slice(5,7))+1;baseCents=units*cents(rates.month);unit="mês civil";}
  else {units=0;const cursor=new Date(`${startDate}T00:00:00Z`),limit=new Date(`${endDate}T00:00:00Z`);while(cursor<=limit){units++;cursor.setUTCMonth(cursor.getUTCMonth()+1);}baseCents=units*cents(rates.month);unit="ciclo por aniversário";}
  const quantityMilli=Math.max(1,Number(input.quantityMilli||1000));
  const contractedCents=Math.round(baseCents*quantityMilli/1000),minimumContractCents=cents(input.minimumContractCents);
  const overtimeMilli=Math.max(0,Number(input.usedHoursMilli||0)-Math.max(0,Number(input.includedHoursMilli||0)));
  const overtimeCents=Math.round(overtimeMilli*cents(input.overtimeRateCents)/1000);
  return {ok:true,rule,calendarDays,units,unit,baseCents,contractedCents,
    minimumAdjustmentCents:Math.max(0,minimumContractCents-contractedCents),overtimeMilli,overtimeCents,
    totalCents:Math.max(contractedCents,minimumContractCents)+overtimeCents};
};
