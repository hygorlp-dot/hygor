// @vitest-environment node
import {expect,it} from "vitest";
import {validateFinancialWritePath} from "../server/financial-write-policy";
import {dadosDaObraIsolados as isolar,recomporDadosDaObra as recompor} from "./domains/obras/work-data-snapshot.js";
const base={obras:[{id:"a"},{id:"b"}],employees:[],terceirizados:[],attendance:{},payments:[{id:"pa",obraId:"a"},{id:"pb",obraId:"b"}],transacoes:[{id:"ta",obraId:"a"},{id:"tb",obraId:"b"}],orcamentos:[{id:"oa",obraId:"a",itens:[{descricao:"Antiga"}]},{id:"ob",obraId:"b"}]};
it("editar composição não reordena nem envia as coleções financeiras intactas",()=>{
  const scoped=structuredClone(isolar(base,"a"));scoped.orcamentos[0].itens[0].descricao="Nova";
  const next=recompor(base,scoped,"a");
  expect(next.payments).toBe(base.payments);expect(next.transacoes).toBe(base.transacoes);
  const sections=Object.fromEntries(Object.entries(next).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(base[k])));
  expect(Object.keys(sections)).toEqual(["orcamentos"]);
  expect(validateFinancialWritePath({engineEnforced:true,sections})).toEqual({ok:true});
  expect(next.orcamentos.find(o=>o.id==="ob")).toEqual(base.orcamentos[1]);
});
it("uma alteração financeira real continua bloqueada pelo FIN-003",()=>{
  const scoped=structuredClone(isolar(base,"a"));scoped.payments[0].valor=100;
  const next=recompor(base,scoped,"a");
  expect(validateFinancialWritePath({engineEnforced:true,sections:{payments:next.payments}}).ok).toBe(false);
});
it("inclui o funcionário com ponto na obra e preserva a seção de ponto na recomposição",()=>{
  const empresa={
    ...base,
    employees:[{id:"func",obra:"b"}],
    attendance:{func:{"2026-11-17":{status:"P",obraId:"a"}}},
  };
  const recorte=isolar(empresa,"a");
  expect(recorte.employees).toEqual(empresa.employees);
  expect(recorte.attendance).toEqual(empresa.attendance);
  expect(recompor(empresa,{...recorte,attendance:{}}, "a").attendance).toBe(empresa.attendance);
});
