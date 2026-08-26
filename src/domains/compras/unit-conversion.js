const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUnitCode = value =>
  String(value || "UN").trim().toUpperCase() || "UN";

export const purchaseUnitOf = item =>
  normalizeUnitCode(item?.unidadeCompra || item?.unidadeRef);

export const conversionFactorOf = item => {
  const referenceUnit = normalizeUnitCode(item?.unidadeRef);
  const purchaseUnit = purchaseUnitOf(item);
  if(referenceUnit === purchaseUnit) return 1;
  const factor = number(item?.fatorConversao);
  return factor > 0 ? factor : 0;
};

export const referenceQuantityOf = (item, quantity = item?.quantidade ?? item?.qtd) =>
  number(quantity) * conversionFactorOf(item);

export const referencePricePerPurchaseUnit = item =>
  number(item?.precoRef) * conversionFactorOf(item);

export const referenceTotalOf = (item, quantity = item?.quantidade ?? item?.qtd) =>
  number(quantity) * referencePricePerPurchaseUnit(item);

export const hasValidUnitConversion = item =>
  conversionFactorOf(item) > 0;

export const steelDiameterMmOf = item => {
  const description=String(item?.descricaoRef||item?.descricao||"").toUpperCase();
  if(!/(?:A[ÇC]O|VERGALH|CA\s*-?\s*(?:25|50|60))/.test(description))return 0;
  const match=description.match(/(\d{1,2}(?:[.,]\d+)?)\s*MM\b/);
  return match?number(match[1].replace(",",".")):0;
};

export const steelKgPerMeterOf = item => {
  if(normalizeUnitCode(item?.unidadeRef)!=="KG")return 0;
  const description=String(item?.descricaoRef||item?.descricao||"").toUpperCase();
  const informed=description.match(/(\d+(?:[.,]\d+)?)\s*KG\s*\/\s*M\b/);
  if(informed)return number(informed[1].replace(",","."));
  const diameter=steelDiameterMmOf(item);
  return diameter>0?(diameter*diameter)/162:0;
};

export const suggestedSteelConversion = (item,purchaseUnit=item?.unidadeCompra,barLength=12) => {
  const unit=normalizeUnitCode(purchaseUnit);
  const kgPerMeter=steelKgPerMeterOf(item);
  if(!(kgPerMeter>0)||!["M","BR"].includes(unit))return null;
  const length=unit==="BR"?Math.max(0,number(barLength)||12):1;
  return {
    diameterMm:steelDiameterMmOf(item),kgPerMeter,barLength:length,
    factor:kgPerMeter*length,purchaseUnit:unit,
  };
};
