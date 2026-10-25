// @vitest-environment node
import { expect, it } from "vitest";
import { conferirTrocaDeAparelho } from "./recuperacao.js";
it("impede arquivar fila, foto pendente ou foto recusada durante novo pareamento", async () => {
  for (const campo of ["pendentes", "fotos", "fotosComProblema"]) {
    const contagem = { pendentes: 0, fotos: 0, fotosComProblema: 0, [campo]: 1 };
    await expect(conferirTrocaDeAparelho({ contagem: async () => contagem })).rejects.toThrow("tratamento");
  }
});
it("só libera quando as três categorias são conhecidas e estão vazias", async () => {
  await expect(conferirTrocaDeAparelho(null)).rejects.toThrow();
  await expect(conferirTrocaDeAparelho({ contagem: async () => ({}) })).rejects.toThrow();
  await expect(conferirTrocaDeAparelho({ contagem: async () => { throw new Error("disco"); } })).rejects.toThrow("disco");
  await expect(conferirTrocaDeAparelho({ contagem: async () => ({ pendentes: 0, fotos: 0, fotosComProblema: 0 }) })).resolves.toBeUndefined();
});
