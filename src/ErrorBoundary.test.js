import { describe, expect, it } from "vitest";
import { dynamicImportRecoveryKey, isDynamicImportFailure } from "./ErrorBoundary";

describe("recuperação após troca de versão", () => {
  it("reconhece falha de chunk dinâmico do navegador", () => {
    const error=new TypeError("Failed to fetch dynamically imported module: https://pontosarcd.vercel.app/assets/EquipmentBillingReports-old.js");
    expect(isDynamicImportFailure(error)).toBe(true);
    expect(dynamicImportRecoveryKey(error)).toContain("EquipmentBillingReports-old.js");
  });

  it("não trata erros normais da aplicação como falha de versão", () => {
    expect(isDynamicImportFailure(new Error("Pedido inválido"))).toBe(false);
  });
});
