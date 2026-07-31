import { describe,expect,it } from "vitest";
import { findAggregateConflicts,findSectionConflicts } from "./three-way-conflicts.js";

describe("DATA-003 · conflitos por agregado",()=>{
  it("permite alterações em registros diferentes da mesma coleção",()=>{
    const base=[{id:"a",valor:1},{id:"b",valor:1}],requested=[{id:"a",valor:2},{id:"b",valor:1}],current=[{id:"a",valor:1},{id:"b",valor:2}];
    expect(findAggregateConflicts(base,requested,current,"pedidos")).toEqual([]);
  });
  it("bloqueia duas mudanças concorrentes no mesmo fato",()=>{
    const base=[{id:"a",valor:1}],requested=[{id:"a",valor:2}],current=[{id:"a",valor:3}];
    expect(findAggregateConflicts(base,requested,current,"pedidos")).toEqual([{section:"pedidos",id:"a"}]);
  });
  it("identifica o conflito dentro da seção correta",()=>{
    expect(findSectionConflicts({pedidos:[{id:"p",status:"aberto"}]},{pedidos:[{id:"p",status:"aprovado"}]},{pedidos:[{id:"p",status:"cancelado"}]},["pedidos"])).toEqual([{section:"pedidos",id:"p"}]);
  });
});
