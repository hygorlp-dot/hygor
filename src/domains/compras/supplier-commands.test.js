import {describe,expect,it} from "vitest";
import {applySupplierCommand,SUPPLIER_COMMAND} from "./supplier-commands.js";

const command=(supplier,expectedVersion=0)=>({type:SUPPLIER_COMMAND.SUPPLIER_SAVED,actorId:"u-1",actorName:"Compras",expectedVersion,payload:{supplier}});

describe("comando transacional de fornecedor",()=>{
  it("cria e versiona sem substituir fornecedores existentes",()=>{
    const data={fornecedores:[{id:"f-1",nome:"Existente",version:2}]};
    const result=applySupplierCommand(data,command({id:"f-2",nome:" Novo fornecedor ",categorias:["ferramentas"]}),"2026-08-06T12:00:00.000Z");
    expect(result.ok).toBe(true);expect(result.data.fornecedores).toHaveLength(2);
    expect(result.data.fornecedores[1]).toMatchObject({id:"f-2",nome:"Novo fornecedor",version:1,updatedById:"u-1"});
  });
  it("protege concorrência e CNPJ duplicado",()=>{
    const data={fornecedores:[{id:"f-1",nome:"A",cnpj:"12.345.678/0001-90",version:2}]};
    expect(applySupplierCommand(data,command({id:"f-1",nome:"B"},1)).ok).toBe(false);
    expect(applySupplierCommand(data,command({id:"f-2",nome:"B",cnpj:"12345678000190"})).reason).toMatch(/CNPJ/);
  });
});
