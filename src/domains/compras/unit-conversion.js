const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeUnitCode = value =>
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
