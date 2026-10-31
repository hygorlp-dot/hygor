import { describe, expect, it, vi } from "vitest";
import { dynamicImportRecoveryKey, isDynamicImportFailure, recoverDynamicImport } from "./ErrorBoundary";

const cssError = () => new Error("Unable to preload CSS for https://pontosarcd.vercel.app/assets/conferencia-batidas-BJTRqjMZ.css");
const recoveryWindow = () => {
  const values = new Map();
  return {
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    location: { href: "https://pontosarcd.vercel.app/?obra=123#ponto", replace: vi.fn() },
  };
};

describe("recuperação após troca de versão", () => {
  it("reconhece falha de chunk dinâmico do navegador", () => {
    const error=new TypeError("Failed to fetch dynamically imported module: https://pontosarcd.vercel.app/assets/EquipmentBillingReports-old.js");
    expect(isDynamicImportFailure(error)).toBe(true);
    expect(dynamicImportRecoveryKey(error)).toContain("EquipmentBillingReports-old.js");
  });

  it("não trata erros normais da aplicação como falha de versão", () => {
    expect(isDynamicImportFailure(new Error("Pedido inválido"))).toBe(false);
  });

  it("reconhece a falha de CSS apresentada no diagnóstico ARCD", () => {
    expect(isDynamicImportFailure(cssError())).toBe(true);
    expect(dynamicImportRecoveryKey(cssError())).toContain("conferencia-batidas-BJTRqjMZ.css");
  });

  it("recupera o CSS uma vez, preservando a rota, e impede recargas repetidas", () => {
    const win = recoveryWindow();
    expect(recoverDynamicImport(cssError(), win)).toBe(true);
    const url = new URL(win.location.replace.mock.calls[0][0]);
    expect(url.searchParams.get("obra")).toBe("123");
    expect(url.hash).toBe("#ponto");
    expect(url.searchParams.has("_arcd_refresh")).toBe(true);
    expect(recoverDynamicImport(cssError(), win)).toBe(false);
    expect(win.location.replace).toHaveBeenCalledTimes(1);
  });

  it("mantém a saída manual se o navegador bloquear o armazenamento", () => {
    const win = recoveryWindow();
    Object.defineProperty(win, "sessionStorage", { get: () => { throw new Error("SecurityError"); } });
    expect(() => recoverDynamicImport(cssError(), win)).not.toThrow();
    expect(win.location.replace).not.toHaveBeenCalled();
  });

  it("não recarrega para erro de negócio", () => {
    const win = recoveryWindow();
    expect(recoverDynamicImport(new Error("Falha ao gravar a medição"), win)).toBe(false);
    expect(win.location.replace).not.toHaveBeenCalled();
  });
});
