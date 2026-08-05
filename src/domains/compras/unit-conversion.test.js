import {
  conversionFactorOf,
  hasValidUnitConversion,
  purchaseUnitOf,
  referencePricePerPurchaseUnit,
  referenceQuantityOf,
  referenceTotalOf,
  steelDiameterMmOf,
  steelKgPerMeterOf,
  suggestedSteelConversion,
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

  test("converte aço em quilogramas para metro pela bitola",()=>{
    const item={descricaoRef:"ACO CA-50, 10,0 MM, VERGALHAO",unidadeRef:"KG"};
    expect(steelDiameterMmOf(item)).toBe(10);
    expect(steelKgPerMeterOf(item)).toBeCloseTo(0.617283,5);
    expect(suggestedSteelConversion(item,"M")).toMatchObject({purchaseUnit:"M",diameterMm:10});
    expect(suggestedSteelConversion(item,"M").factor).toBeCloseTo(0.617283,5);
  });

  test("converte aço em quilogramas para barras com comprimento configurável",()=>{
    const item={descricaoRef:"VERGALHAO ACO CA 50 12,5 MM",unidadeRef:"kg"};
    const standard=suggestedSteelConversion(item,"BR",12);
    expect(standard.kgPerMeter).toBeCloseTo(0.964506,5);
    expect(standard.factor).toBeCloseTo(11.574074,5);
    expect(suggestedSteelConversion(item,"BR",6).factor).toBeCloseTo(5.787037,5);
  });
});
