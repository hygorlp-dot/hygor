import {expect,it} from "vitest";
import {remunerationModeOnDate} from "./remuneration-mode.js";
it("preserva diária histórica e resolve mudanças de modalidade por vigência",()=>{
  expect(remunerationModeOnDate({dailyRate:150},"2026-09-20")).toBe("daily");
  const employee={remunerationMode:"daily",remunerationHistory:[{date:"2026-01-01",mode:"daily"},{date:"2026-09-01",mode:"clt"},{date:"2026-10-01",mode:"daily"}]};
  expect(remunerationModeOnDate(employee,"2026-08-31")).toBe("daily");
  expect(remunerationModeOnDate(employee,"2026-09-20")).toBe("clt");
  expect(remunerationModeOnDate(employee,"2026-10-05")).toBe("daily");
});

it("resolve MEI por vigência e normaliza valores desconhecidos para diária",()=>{
  const employee={remunerationMode:"mei",remunerationHistory:[{date:"2026-01-01",mode:"daily"},{date:"2026-11-01",mode:"mei"}]};
  expect(remunerationModeOnDate(employee,"2026-10-31")).toBe("daily");
  expect(remunerationModeOnDate(employee,"2026-11-03")).toBe("mei");
  expect(remunerationModeOnDate({remunerationMode:"mei",startDate:"2026-02-01"},"2026-02-10")).toBe("mei");
  expect(remunerationModeOnDate({remunerationMode:"fixo",startDate:"2026-02-01"},"2026-02-10")).toBe("daily");
});
