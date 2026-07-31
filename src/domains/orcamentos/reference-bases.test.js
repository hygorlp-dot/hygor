import { describe, expect, it } from "vitest";
import { consolidateReferenceBases, referenceBaseKey } from "./reference-bases";

describe("bases oficiais do orçamento", () => {
  it("distingue SINAPI desonerada e não desonerada", () => {
    expect(referenceBaseKey({ fonte:"sinapi", dataBase:"2026-06", uf:"pe" }))
      .toBe("SINAPI|2026-06|PE|DESONERADA");
    expect(referenceBaseKey({ fonte:"SINAPI", dataBase:"2026-06", uf:"PE", desonerado:false }))
      .toBe("SINAPI|2026-06|PE|NAO_DESONERADA");
  });

  it("consolida duplicatas escolhendo a base pronta e mais completa", () => {
    const result = consolidateReferenceBases([
      { id:"a", fonte:"SINAPI", dataBase:"2026-06", uf:"PE", status:"processing", total:200 },
      { id:"b", fonte:"SINAPI", dataBase:"2026-06", uf:"PE", status:"ready", total:100 },
      { id:"c", fonte:"SINAPI", dataBase:"2026-06", uf:"PE", status:"ready", total:300 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id:"c", duplicadas:2, idsEquivalentes:["c", "b", "a"] });
  });

  it("não mistura ORSE de competências diferentes", () => {
    expect(consolidateReferenceBases([
      { id:"a", fonte:"ORSE", dataBase:"2026-05" },
      { id:"b", fonte:"ORSE", dataBase:"2026-06" },
    ])).toHaveLength(2);
  });
});

