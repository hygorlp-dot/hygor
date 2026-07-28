import {describe,expect,it} from "vitest";
import {compactProfiles} from "./data-codec.js";

describe("índice compacto de autenticação",()=>{
  it("mantém somente os campos necessários para autenticar e aplicar o escopo",()=>{
    const result=compactProfiles({usuarios:[{
      id:"u1",nome:"Isabela",role:"engenheiro",email:"isabela@arcd.test",
      authUserId:"auth-1",pin:"hash-seguro",obraId:"obra-a",active:true,
      salario:9000,cpf:"não-indexar",
    }]});
    expect(result.usuarios).toEqual([{
      id:"u1",nome:"Isabela",role:"engenheiro",email:"isabela@arcd.test",
      authUserId:"auth-1",pin:"hash-seguro",obraId:"obra-a",active:true,
    }]);
    expect(result.usuarios[0]).not.toHaveProperty("salario");
    expect(result.usuarios[0]).not.toHaveProperty("cpf");
  });
});
