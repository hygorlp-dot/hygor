import { describe,expect,it } from "vitest";
import { mergeScopedAttendance, mergeScopedAttendanceLocks } from "./scoped-attendance-merge.js";

describe("salvamento de ponto restrito por obra",()=>{
  it("aplica a edição da obra e preserva integralmente os apontamentos das demais",()=>{
    const current={
      e1:{
        "2026-07-26":{status:"P",obraId:"o1"},
        "2026-07-27":{status:"P",obraId:"o2"},
      },
      e2:{"2026-07-27":{status:"F",obraId:"o2"}},
    };
    const incoming={e1:{"2026-07-26":{status:"M",obraId:"o1"}}};
    const merged=mergeScopedAttendance({
      current,incoming,user:{role:"engenheiro",obraId:"o1"},
      employees:[{id:"e1",obra:"o1"},{id:"e2",obra:"o2"}],
    });
    expect(merged).toEqual({
      e1:{
        "2026-07-26":{status:"M",obraId:"o1"},
        "2026-07-27":{status:"P",obraId:"o2"},
      },
      e2:{"2026-07-27":{status:"F",obraId:"o2"}},
    });
  });

  it("mantém o comportamento integral para perfil sem restrição de obra",()=>{
    const incoming={e1:{"2026-07-27":{status:"P",obraId:"o1"}}};
    expect(mergeScopedAttendance({current:{e2:{}},incoming,user:{role:"engenheiro"},employees:[]})).toBe(incoming);
  });

  it("preserva bloqueios de outras obras ao salvar o recorte do engenheiro",()=>{
    const current={
      "2026-07-27__o1":{id:"2026-07-27__o1",obraId:"o1",locked:false},
      "2026-07-27__o2":{id:"2026-07-27__o2",obraId:"o2",locked:true},
    };
    const incoming={"2026-07-27__o1":{id:"2026-07-27__o1",obraId:"o1",locked:true}};
    expect(mergeScopedAttendanceLocks({current,incoming,user:{role:"engenheiro",obraId:"o1"}})).toEqual({
      "2026-07-27__o1":{id:"2026-07-27__o1",obraId:"o1",locked:true},
      "2026-07-27__o2":{id:"2026-07-27__o2",obraId:"o2",locked:true},
    });
  });

  it("preserva os pontos de Isabela e Michelly em salvamentos sequenciais",()=>{
    const employees=[
      {id:"func-isabela",obra:"obra-isabela"},
      {id:"func-michelly",obra:"obra-michelly"},
    ];
    const initial={
      "func-isabela":{"2026-07-27":{status:"F",obraId:"obra-isabela"}},
      "func-michelly":{"2026-07-27":{status:"F",obraId:"obra-michelly"}},
    };
    const afterIsabela=mergeScopedAttendance({
      current:initial,
      incoming:{"func-isabela":{"2026-07-27":{status:"P",obraId:"obra-isabela"}}},
      user:{id:"e424f0e1jltb",name:"Maria Isabela",role:"engenheiro",obraId:"obra-isabela"},
      employees,
    });
    const afterMichelly=mergeScopedAttendance({
      current:afterIsabela,
      incoming:{"func-michelly":{"2026-07-27":{status:"M",obraId:"obra-michelly"}}},
      user:{id:"icszx5ulw28l",name:"Michelly Silva",role:"engenheiro",obraId:"obra-michelly"},
      employees,
    });

    expect(afterMichelly).toEqual({
      "func-isabela":{"2026-07-27":{status:"P",obraId:"obra-isabela"}},
      "func-michelly":{"2026-07-27":{status:"M",obraId:"obra-michelly"}},
    });
  });
});
