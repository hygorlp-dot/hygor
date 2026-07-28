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
  employees:[{id:"e-a",obra:"obra-a",name:"Equipe A",cpf:"111.111.111-11",conta:"0001",pixChave:"cpf@pix",salario:2400,valorHora:18},{id:"e-b",obra:"obra-b",name:"Equipe B",cpf:"222.222.222-22"}],
  attendance:{
    "e-a":{"2026-07-01":{status:"P",obraId:"obra-a"},"2026-07-02":{status:"P",obraId:"obra-b"}},
    "e-b":{"2026-07-01":{status:"P",obraId:"obra-b"}},
  },
  attendanceLocks:{
    "2026-07-27__obra-a":{id:"2026-07-27__obra-a",obraId:"obra-a",locked:true},
    "2026-07-27__obra-b":{id:"2026-07-27__obra-b",obraId:"obra-b",locked:true},
  },
  dailyCheckDate:"2026-07-27",
  pedidos:[{id:"p-a",obraId:"obra-a"},{id:"p-b",obraId:"obra-b"}],
  terceirizados:[{id:"t-a",obraId:"obra-a",name:"Prestador A"},{id:"t-b",obraId:"obra-b",name:"Prestador B"}],
  pagsTerceiros:[{id:"pg-a",obraId:"obra-a",tercId:"t-a",amount:100}],
};

describe("SEC-001 · projeção de leitura por obra",()=>{
  it("entrega somente obra, fatos e presença do escopo",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"engenheiro",obraId:"obra-a"});
    expect(projected.obras).toEqual([{id:"obra-a",name:"Obra A"}]);
    expect(projected.pedidos).toEqual([{id:"p-a",obraId:"obra-a"}]);
    expect(projected.attendance).toEqual({"e-a":{"2026-07-01":{status:"P",obraId:"obra-a"}}});
    expect(projected.attendanceLocks).toEqual({
      "2026-07-27__obra-a":{id:"2026-07-27__obra-a",obraId:"obra-a",locked:true},
    });
    expect(projected.dailyCheckDate).toBe("2026-07-27");
    expect(projected.employees).toEqual([{id:"e-a",obra:"obra-a",name:"Equipe A"}]);
    expect(projected.usuarios).toEqual([{id:"u-a",nome:"Operador A",obraId:"obra-a",email:"a@arcd.com",maxDesconto:0}]);
  });

  it("não entrega seções fora da permissão do papel",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"visualizador",obraId:"obra-a"});
    expect(projected).toEqual(expect.objectContaining({obras:[{id:"obra-a",name:"Obra A"}]}));
    expect(projected.pedidos).toBeUndefined();
    expect(projected.attendance).toBeUndefined();
  });

  it("mantém os dados pessoais apenas na projeção de RH",()=>{
    const projected=projectDataForUser(payload,{id:"rh",role:"rh",obraId:"obra-a"});
    expect(projected.employees).toMatchObject([{id:"e-a",cpf:"111.111.111-11",conta:"0001"}]);
    expect(projected.terceirizados).toEqual([{id:"t-a",obraId:"obra-a",name:"Prestador A"}]);
    expect(projected.pagsTerceiros).toBeUndefined();
  });

  it("não entrega PIX ou remuneração a quem não é do RH",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"financeiro",obraId:"obra-a"});
    expect(projected.employees).toEqual([{id:"e-a",obra:"obra-a",name:"Equipe A"}]);
  });

  it("projeta frota, manutenção e transferências relacionadas à obra atribuída",()=>{
    const equipmentPayload={
      ...payload,
      equipamentos:[
        {id:"eq-a",obraAtualId:"obra-a",nome:"Betoneira"},
        {id:"eq-b",obraAtualId:"obra-b",nome:"Guincho"},
      ],
      locacoesEquip:[{id:"loc-a",obraId:"obra-a"},{id:"loc-b",obraId:"obra-b"}],
      manutencoesEquip:[{id:"man-a",obraId:"obra-a"},{id:"man-b",obraId:"obra-b"}],
      transferenciasEquip:[
        {id:"tr-a",deObraId:"obra-b",paraObraId:"obra-a"},
        {id:"tr-b",deObraId:"obra-b",paraObraId:"obra-c"},
      ],
    };
    const projected=projectDataForUser(equipmentPayload,{id:"u-a",role:"engenheiro",obraId:"obra-a"});
    expect(projected.equipamentos.map(item=>item.id)).toEqual(["eq-a"]);
    expect(projected.locacoesEquip.map(item=>item.id)).toEqual(["loc-a"]);
    expect(projected.manutencoesEquip.map(item=>item.id)).toEqual(["man-a"]);
    expect(projected.transferenciasEquip.map(item=>item.id)).toEqual(["tr-a"]);
  });
});
