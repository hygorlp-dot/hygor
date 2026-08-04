export const RENTAL_CHARGE_TYPE=Object.freeze({
  RENTAL:"rental",MOBILIZATION:"mobilization",DEMOBILIZATION:"demobilization",FREIGHT:"freight",
  OPERATOR:"operator",FUEL:"fuel",CLEANING:"cleaning",INSURANCE:"insurance",ACCESSORY:"accessory",
  OVERTIME:"overtime",LATE_FEE:"late_fee",DAMAGE:"damage",LOST_ITEM:"lost_item",ADJUSTMENT:"adjustment",
  DISCOUNT:"discount",REVERSAL:"reversal",
});
export const RENTAL_CHARGE_TYPES=Object.freeze(Object.values(RENTAL_CHARGE_TYPE));
const negativeTypes=new Set([RENTAL_CHARGE_TYPE.DISCOUNT,RENTAL_CHARGE_TYPE.REVERSAL]);
const text=value=>String(value||"").trim();
const integer=value=>Number.isSafeInteger(Number(value))?Number(value):NaN;

export const validateRentalChargeItem=(input={})=>{
  const type=text(input.type),quantityMilli=integer(input.quantityMilli),unitPriceCents=integer(input.unitPriceCents);
  const discountAmountCents=integer(input.discountAmountCents??0),taxAmountCents=integer(input.taxAmountCents??0);
  if(!RENTAL_CHARGE_TYPES.includes(type))return {ok:false,reason:"Tipo de linha de cobrança inválido."};
  if(!text(input.rentalId)||!text(input.workId))return {ok:false,reason:"Vincule a linha à locação e à obra."};
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(text(input.competence)))return {ok:false,reason:"Informe uma competência válida."};
  if(!text(input.description)||!text(input.unit))return {ok:false,reason:"Informe descrição e unidade da cobrança."};
  if(!Number.isSafeInteger(quantityMilli)||quantityMilli<=0||!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0)return {ok:false,reason:"Quantidade e preço unitário devem ser válidos."};
  const grossAmountCents=Math.round(quantityMilli*unitPriceCents/1000);
  if(!Number.isSafeInteger(discountAmountCents)||discountAmountCents<0||discountAmountCents>grossAmountCents)return {ok:false,reason:"O desconto da linha não pode superar o valor bruto."};
  if(!Number.isSafeInteger(taxAmountCents)||taxAmountCents<0)return {ok:false,reason:"O imposto da linha não pode ser negativo."};
  const unsignedNetCents=grossAmountCents-discountAmountCents+taxAmountCents;
  const direction=negativeTypes.has(type)?-1:1;
  return {ok:true,record:{rentalId:text(input.rentalId),workId:text(input.workId),type,
    description:text(input.description),quantityMilli,unit:text(input.unit),unitPriceCents,grossAmountCents,
    discountAmountCents,taxAmountCents,netAmountCents:direction*unsignedNetCents,competence:text(input.competence),
    source:text(input.source)||"manual",status:text(input.status)||"open"}};
};

export const rentalChargeSummary=(items=[],filters={})=>items.filter(item=>item.status!=="cancelled"
  &&(!filters.rentalId||String(item.rentalId)===String(filters.rentalId))&&(!filters.competence||item.competence===filters.competence))
  .reduce((sum,item)=>({grossAmountCents:sum.grossAmountCents+Number(item.grossAmountCents||0),
    discountAmountCents:sum.discountAmountCents+Number(item.discountAmountCents||0),
    taxAmountCents:sum.taxAmountCents+Number(item.taxAmountCents||0),netAmountCents:sum.netAmountCents+Number(item.netAmountCents||0)}),
  {grossAmountCents:0,discountAmountCents:0,taxAmountCents:0,netAmountCents:0});
