import { describe, expect, test } from "vitest";
import { projectDataForUser } from "../server/data-projection.js";

const payload={
  obras:[{id:"o1",name:"Obra 1",oneDriveUrl:"https://privado"},{id:"o2",name:"Obra 2"}],
  usuarios:[{id:"u1",nome:"Eng.",role:"engenheiro",obraId:"o1",pin:"hash",authUserId:"auth",email:"e@x.com"},{id:"u2",nome:"Outro",role:"engenheiro",obraId:"o2",pin:"outro"}],
  pagamentosFolha:[{id:"f1",obraId:"o1",valor:100}],payments:[{id:"p1",obraId:"o1",amount:500}],
  conferencias:[{id:"c1",obraId:"o1"},{id:"c2",obraId:"o2"}],employees:[{id:"e1",obra:"o1",cpf:"1"},{id:"e2",obra:"o2",cpf:"2"}],
  attendance:{e1:{"2026-01-01":{}},e2:{"2026-01-01":{}}},transacoes:[{id:"t1",obraId:"o1"}],
};

describe("SEC-001 · projeção de leitura",()=>{
  test("engenheiro recebe somente sua obra e nunca hashes ou setor financeiro",()=>{
    const result=projectDataForUser(payload,payload.usuarios[0]);
    expect(result.obras).toEqual([{id:"o1",name:"Obra 1"}]);
    expect(result.conferencias).toEqual([{id:"c1",obraId:"o1"}]);
    expect(result.pagamentosFolha).toBeUndefined();
    expect(result.transacoes).toBeUndefined();
    expect(result.usuarios[0]).not.toHaveProperty("pin");
    expect(result.usuarios[0]).not.toHaveProperty("authUserId");
    expect(Object.keys(result.attendance)).toEqual(["e1"]);
  });
  test("financeiro limitado a uma obra não recebe o restante",()=>{
    const result=projectDataForUser(payload,{id:"fin",role:"financeiro",obraId:"o1"});
    expect(result.payments).toEqual([{id:"p1",obraId:"o1",amount:500}]);
    expect(result.obras).toHaveLength(1);
    expect(result.obras[0].id).toBe("o1");
  });
});
