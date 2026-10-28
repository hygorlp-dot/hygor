import { describe, expect, test } from "vitest";
import { reconciliationCategories, normalizeCategorySearch } from "./categories.js";
import { suggestClassificationRule } from "./classification-rules.js";
import { classifyReceiptForDre } from "../dre/receipt-classification.js";

describe("catálogo único entre DRE e conciliação", () => {
  test("inclui despesas personalizadas da obra e mantém categorias da empresa separadas", () => {
    const data = { categoriasDesp:[{ v:"sondagem", l:"Sondagem do solo" }] };
    expect(reconciliationCategories(data, { direction:"saida", destination:"obra" })).toEqual(expect.arrayContaining([
      expect.objectContaining({ id:"sondagem", label:"Sondagem do solo", effect:"cost" }),
      expect.objectContaining({ id:"mao_obra" }), expect.objectContaining({ id:"outros" }),
    ]));
    expect(reconciliationCategories(data, { direction:"saida", destination:"empresa" }).some(item => item.id === "sondagem")).toBe(false);
    expect(reconciliationCategories(data, { direction:"entrada", destination:"obra" }).some(item => item.id === "mao_obra")).toBe(false);
    expect(normalizeCategorySearch("  MÃO de OBRA  ")).toBe("mao de obra");
  });

  test("não reconhece receita legada nem replica receita de medição já vinculada", () => {
    expect(classifyReceiptForDre({ categoria:"receita_servicos" })).toMatchObject({ recognizeRevenue:false, unallocated:true });
    expect(classifyReceiptForDre({ categoria:"receita_servicos", efeitoDRE:"receita", medicaoId:"m1" })).toMatchObject({ recognizeRevenue:false, unallocated:false });
    expect(classifyReceiptForDre({ categoria:"credito", efeitoDRE:"receita" }).recognizeRevenue).toBe(false);
    expect(classifyReceiptForDre({ categoria:"credito", efeitoDRE:"sem_efeito" })).toMatchObject({ recognizeRevenue:false, funding:true, unallocated:false });
  });
});

describe("regras de classificação por direção", () => {
  const rules = [
    { direction:"saida", padrao:"serviço", destino:"empresa", categoria:"terceiros", ativa:true },
    { direction:"entrada", padrao:"serviço", destino:"empresa", categoria:"receita_servicos", ativa:true },
  ];
  test("a mesma descrição em crédito e débito recebe a regra compatível", () => {
    expect(suggestClassificationRule({ valor:-100, descricao:"PIX SERVICO" }, rules).categoria).toBe("terceiros");
    expect(suggestClassificationRule({ valor:100, descricao:"PIX SERVICO" }, rules).categoria).toBe("receita_servicos");
  });
  test("regra legada de despesa não contamina uma entrada e aprendizado respeita direção", () => {
    const legacy = [{ padrao:"internet", destino:"empresa", categoria:"internet" }];
    expect(suggestClassificationRule({ valor:100, descricao:"Internet" }, legacy)).toBeNull();
    expect(suggestClassificationRule({ valor:-100, descricao:"Internet" }, legacy).categoria).toBe("internet");
    expect(suggestClassificationRule({ valor:100, descricao:"Internet" }, null, [{ ...legacy[0], confirmacoes:4 }])).toBeNull();
  });
});
