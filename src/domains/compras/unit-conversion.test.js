import {
  conversionFactorOf,
  hasValidUnitConversion,
  purchaseUnitOf,
  referencePricePerPurchaseUnit,
  referenceQuantityOf,
  referenceTotalOf,
} from "./unit-conversion";

describe("conversão de unidades de Compras", () => {
  test("converte sacos de cimento para quilogramas da referência", () => {
    const item={
      unidadeRef:"KG",
      unidadeCompra:"SC",
      fatorConversao:20,
      quantidade:10,
      precoRef:0.88,
    };
    expect(purchaseUnitOf(item)).toBe("SC");
    expect(conversionFactorOf(item)).toBe(20);
    expect(referenceQuantityOf(item)).toBe(200);
    expect(referencePricePerPurchaseUnit(item)).toBeCloseTo(17.6);
    expect(referenceTotalOf(item)).toBeCloseTo(176);
    expect(hasValidUnitConversion(item)).toBe(true);
  });

  test("mantém compatibilidade com itens antigos na mesma unidade", () => {
    const item={unidadeRef:"kg",quantidade:5,precoRef:2};
    expect(purchaseUnitOf(item)).toBe("KG");
    expect(conversionFactorOf(item)).toBe(1);
    expect(referenceQuantityOf(item)).toBe(5);
    expect(referenceTotalOf(item)).toBe(10);
  });

  test("rejeita conversão entre unidades diferentes sem fator positivo", () => {
    expect(hasValidUnitConversion({
      unidadeRef:"KG",
      unidadeCompra:"SC",
      fatorConversao:0,
    })).toBe(false);
  });
});
