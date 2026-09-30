import { describe, expect, it, vi } from "vitest";
import { instalarCapturaGlobal } from "./global-error-capture.js";

const janelaFalsa = () => Object.assign(new EventTarget(), { location: { pathname: "/obras" } });
const erroDeJanela = erro => Object.assign(new Event("error"), { error: erro, message: erro?.message });
const promessaRejeitada = motivo => Object.assign(new Event("unhandledrejection"), { reason: motivo });

describe("instalarCapturaGlobal", () => {
  it("reporta erro fora da renderização e promessa sem catch, com código ARCD e origem", () => {
    const win = janelaFalsa(), enviar = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    instalarCapturaGlobal(win, { enviar });
    win.dispatchEvent(erroDeJanela(new TypeError("Cannot read properties of undefined (reading 'itens')")));
    win.dispatchEvent(promessaRejeitada(new Error("Falha ao gravar a medição")));
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][0]).toMatchObject({ pathname: "/obras", componentStack: "origem: janela" });
    expect(enviar.mock.calls[0][0].reference).toMatch(/^ARCD-/);
    expect(enviar.mock.calls[1][0]).toMatchObject({ message: "Falha ao gravar a medição", componentStack: "origem: promessa sem catch" });
  });

  it("ignora ruído do navegador e falha de chunk (já tratada pelo ErrorBoundary)", () => {
    const win = janelaFalsa(), enviar = vi.fn();
    instalarCapturaGlobal(win, { enviar });
    win.dispatchEvent(erroDeJanela(new Error("ResizeObserver loop completed with undelivered notifications.")));
    win.dispatchEvent(Object.assign(new Event("error"), { message: "Script error." }));
    win.dispatchEvent(promessaRejeitada(Object.assign(new Error("The user aborted a request."), { name: "AbortError" })));
    win.dispatchEvent(promessaRejeitada(new Error("Failed to fetch dynamically imported module: /assets/x.js")));
    expect(enviar).not.toHaveBeenCalled();
  });

  it("não inunda o servidor: repetido conta uma vez e há teto por página", () => {
    const win = janelaFalsa(), enviar = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    instalarCapturaGlobal(win, { enviar, limitePorPagina: 3 });
    for (let i = 0; i < 5; i++) win.dispatchEvent(erroDeJanela(new Error("mesmo erro")));
    for (let i = 0; i < 5; i++) win.dispatchEvent(erroDeJanela(new Error(`erro ${i}`)));
    expect(enviar).toHaveBeenCalledTimes(3);
  });

  it("pode ser desinstalado", () => {
    const win = janelaFalsa(), enviar = vi.fn();
    const desinstalar = instalarCapturaGlobal(win, { enviar });
    desinstalar();
    win.dispatchEvent(erroDeJanela(new Error("depois de desinstalar")));
    expect(enviar).not.toHaveBeenCalled();
  });
});
