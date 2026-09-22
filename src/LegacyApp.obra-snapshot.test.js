// @vitest-environment node
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {validateFinancialWritePath} from "../server/financial-write-policy";
const source=readFileSync(new URL("./LegacyApp.jsx",import.meta.url),"utf8");
const trecho=source.slice(source.indexOf("const CHAVES_ISOLADAS_OBRA="),source.indexOf("function ObraDetalhe("));
const {isolar,recompor}=new Function("resolveEmployeeAttendanceObraId",`${trecho};return {isolar:dadosDaObraIsolados,recompor:recomporDadosDaObra};`)(()=>"");
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
