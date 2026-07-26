import { describe,expect,it } from "vitest";
import { projectDataForUser } from "./data-projection.js";

const payload={
  usuarios:[
    {id:"u-a",nome:"Operador A",obraId:"obra-a",email:"a@arcd.com",pin:"hash-a",authUserId:"auth-a"},
    {id:"u-b",nome:"Operador B",obraId:"obra-b",email:"b@arcd.com",pin:"hash-b",authUserId:"auth-b"},
  ],
  obras:[
    {id:"obra-a",name:"Obra A",oneDriveDriveId:"drive-a",oneDriveFolderId:"folder-a",portalCliente:{token:"segredo"}},
    {id:"obra-b",name:"Obra B",oneDriveDriveId:"drive-b"},
  ],
  employees:[{id:"e-a",obra:"obra-a",name:"Equipe A"},{id:"e-b",obra:"obra-b",name:"Equipe B"}],
  attendance:{
    "e-a":{"2026-07-01":{status:"P",obraId:"obra-a"},"2026-07-02":{status:"P",obraId:"obra-b"}},
    "e-b":{"2026-07-01":{status:"P",obraId:"obra-b"}},
  },
  pedidos:[{id:"p-a",obraId:"obra-a"},{id:"p-b",obraId:"obra-b"}],
};

describe("SEC-001 · projeção de leitura por obra",()=>{
  it("entrega somente obra, fatos e presença do escopo",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"engenheiro",obraId:"obra-a"});
    expect(projected.obras).toEqual([{id:"obra-a",name:"Obra A"}]);
    expect(projected.pedidos).toEqual([{id:"p-a",obraId:"obra-a"}]);
    expect(projected.attendance).toEqual({"e-a":{"2026-07-01":{status:"P",obraId:"obra-a"}}});
    expect(projected.usuarios).toEqual([{id:"u-a",nome:"Operador A",obraId:"obra-a",email:"a@arcd.com",maxDesconto:0}]);
  });

  it("não entrega seções fora da permissão do papel",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"visualizador",obraId:"obra-a"});
    expect(projected).toEqual(expect.objectContaining({obras:[{id:"obra-a",name:"Obra A"}]}));
    expect(projected.pedidos).toBeUndefined();
    expect(projected.attendance).toBeUndefined();
  });
});
