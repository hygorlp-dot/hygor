import { describe, expect, it } from "vitest";
import { isServerRejection, rejectedSections } from "./rejected-save.js";

describe("gravação recusada pelo servidor", () => {
  it("só recusa de regra/permissão desfaz a edição; rede, sessão e 5xx não", () => {
    expect(isServerRejection({ result:{ status:403 } })).toBe(true);
    expect(isServerRejection({ result:{ status:422 } })).toBe(true);
    expect(isServerRejection({ result:{ status:403 }, offline:true })).toBe(false);
    [0, 401, 408, 429, 500, 503].forEach(status =>
      expect(isServerRejection({ result:{ status } })).toBe(false));
    expect(isServerRejection({ result:{ reason:"Sessão encerrada." } })).toBe(false);
  });

  it("lista as seções que serão desfeitas", () => {
    const confirmed = { obras:[{ id:"o1" }], pedidos:[], config:{ a:1 } };
    const rejected = { obras:[{ id:"o1" }], pedidos:[{ id:"p1" }], config:{ a:2 }, novo:[] };
    expect(rejectedSections(confirmed, rejected)).toEqual(["config", "novo", "pedidos"]);
    expect(rejectedSections(confirmed, confirmed)).toEqual([]);
  });
});
