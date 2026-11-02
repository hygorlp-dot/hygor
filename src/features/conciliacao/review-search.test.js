import { expect, it } from "vitest";
import { emptyReviewFilters, filterReviewEntries } from "./review-search.js";
const data={obras:[{id:"a",name:"Obra Oásis"}]};
const entries=[{id:"one",description:"Conta",counterparty:"Fornecedor A",obraId:"a",date:"2026-10-20",remainingCents:6010,allocatedCents:3990},{id:"two",description:"Conta",counterparty:"Fornecedor B",obraId:"b",date:"",remainingCents:6009,allocatedCents:0}];
it("combina obra pelo nome, pessoa, data, centavos e situação parcial",()=>{
  expect(filterReviewEntries(entries,data,"oasis conta",{...emptyReviewFilters,work:"a",party:"Fornecedor A",start:"2026-10-20",end:"2026-10-20",min:"60.10",max:"60.10",status:"partial"}).map(e=>e.id)).toEqual(["one"]);
});
it("não restringe datas inicialmente e exclui sem data apenas com período ativo",()=>{
  expect(filterReviewEntries(entries,data,"",emptyReviewFilters)).toHaveLength(2);
  expect(filterReviewEntries(entries,data,"",{...emptyReviewFilters,end:"2026-10-21"}).map(e=>e.id)).toEqual(["one"]);
});
