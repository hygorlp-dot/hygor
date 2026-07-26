import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";

describe("escopo servidor de comandos operacionais",()=>{
  const data={
    medicoesObra:[{id:"m-a",obraId:"obra-a"}],rdos:[{id:"r-a",obraId:"obra-a"}],pedidos:[{id:"p-a",obraId:"obra-a"}],
  };
  const user={id:"u-1",role:"engenheiro",obraId:"obra-a"};
  it("aceita somente a obra atribuída em criação e cancelamento de medição",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,payload:{measurement:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,payload:{measurement:{obraId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED,payload:{measurementId:"m-a"}}})).toMatchObject({ok:true});
  });
  it("não deixa usar identificador de outra obra para RDO ou recebimento",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,payload:{reportId:"r-a"}}})).toMatchObject({ok:true});
    expect(validateOperationalCommandScope({user,data:{...data,pedidos:[{id:"p-b",obraId:"obra-b"}]},command:{type:OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,payload:{pedidoId:"p-b"}}})).toMatchObject({ok:false});
  });
});
