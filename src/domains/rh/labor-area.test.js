import {expect,it} from "vitest";
import {laborArea,matchesLaborArea} from "./labor-area.js";
it("agrupa central e administração local sem alterar lotações",()=>{
 for(const employee of [{role:"Engenheira civil",obra:"a"},{role:"Mestre de obras",obra:"b"},{workArea:"administrativo"}]){const original=JSON.stringify(employee);expect(laborArea(employee)).toBe("central");expect(matchesLaborArea(employee,"obras")).toBe(false);expect(JSON.stringify(employee)).toBe(original);}
 expect(laborArea({role:"Servente",obra:"a"})).toBe("obras");expect(matchesLaborArea({role:"Mestre"},"all")).toBe(true);
});
