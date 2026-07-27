import { describe,expect,it } from "vitest";
import { mergeScopedAttendance } from "./scoped-attendance-merge.js";

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
});
