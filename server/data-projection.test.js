import { describe,expect,it } from "vitest";
import { projectDataForUser, publicUser } from "./data-projection.js";

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
  transacoes:[
    {id:"pix-a",data:"2026-07-01",valor:-1000,status:"pendente",descricao:"Pix enviado para Equipe A"},
    {id:"pix-b",data:"2026-07-01",valor:-900,status:"pendente",descricao:"Pix enviado para Fornecedor B"},
    {id:"entrada",data:"2026-07-01",valor:3000,status:"pendente",descricao:"Pix recebido do Cliente"},
  ],
  historicoConc:[
    {id:"h-a",transacaoId:"pix-a"},
    {id:"h-b",transacaoId:"pix-b"},
  ],
  reconciliationCommandLog:[
    {id:"c-a",transactionId:"pix-a"},
    {id:"c-b",transactionId:"pix-b"},
  ],
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
    expect(projected.transacoes.map(item=>item.id)).toEqual(["pix-a"]);
    expect(projected.historicoConc.map(item=>item.id)).toEqual(["h-a"]);
    expect(projected.reconciliationCommandLog.map(item=>item.id)).toEqual(["c-a"]);
  });

  it("não entrega PIX ou remuneração a quem não é do RH",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"financeiro",obraId:"obra-a"});
    expect(projected.employees).toEqual([{id:"e-a",obra:"obra-a",name:"Equipe A"}]);
  });

  it("preserva o apontamento histórico na obra antiga após transferência",()=>{
    const transferred={
      ...payload,
      employees:[{
        id:"e-a",name:"Equipe A",obra:"obra-b",
        obraHistory:[{date:"2026-07-15",fromObraId:"obra-a",toObraId:"obra-b"}],
      }],
      attendance:{
        "e-a":{
          "2026-07-10":{status:"P"},
          "2026-07-20":{status:"P"},
        },
      },
    };
    const oldObra=projectDataForUser(transferred,{id:"eng-a",role:"engenheiro",obraId:"obra-a"});
    const newObra=projectDataForUser(transferred,{id:"eng-b",role:"engenheiro",obraId:"obra-b"});
    expect(oldObra.employees).toHaveLength(1);
    expect(oldObra.attendance).toEqual({
      "e-a":{"2026-07-10":{status:"P",obraId:"obra-a",obraIdInferred:true}},
    });
    expect(newObra.attendance).toEqual({
      "e-a":{"2026-07-20":{status:"P",obraId:"obra-b",obraIdInferred:true}},
    });
  });

  it("não entrega ponto, bloqueios ou liberações ao engenheiro auditor",()=>{
    const projected=projectDataForUser(payload,{id:"u-a",role:"engenheiro_auditor",obraId:"obra-a"});
    expect(projected.attendance).toBeUndefined();
    expect(projected.attendanceLocks).toBeUndefined();
    expect(projected.unlockRequests).toBeUndefined();
    expect(projected.dailyCheckDate).toBeUndefined();
  });

  it("remove abas personalizadas de ponto do perfil auditor",()=>{
    expect(publicUser({
      id:"auditor",nome:"Auditor",role:"engenheiro_auditor",
      accessTabs:["home","ponto","ponto_geral","conferencia"],
    }).accessTabs).toEqual(["home","conferencia"]);
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
