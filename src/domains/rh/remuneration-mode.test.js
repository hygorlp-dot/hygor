import {expect,it} from "vitest";
import {remunerationModeOnDate} from "./remuneration-mode.js";
it("preserva diária histórica e resolve mudanças de modalidade por vigência",()=>{
  expect(remunerationModeOnDate({dailyRate:150},"2026-09-20")).toBe("daily");
  const employee={remunerationMode:"daily",remunerationHistory:[{date:"2026-01-01",mode:"daily"},{date:"2026-09-01",mode:"clt"},{date:"2026-10-01",mode:"daily"}]};
  expect(remunerationModeOnDate(employee,"2026-08-31")).toBe("daily");
  expect(remunerationModeOnDate(employee,"2026-09-20")).toBe("clt");
  expect(remunerationModeOnDate(employee,"2026-10-05")).toBe("daily");
});
