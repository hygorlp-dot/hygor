import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarPollingAdaptativo } from "./polling.js";

const criarDocumento = (oculto = false) => {
  const ouvintes = new Set();
  return {
    hidden: oculto,
    addEventListener: (_tipo, fn) => ouvintes.add(fn),
    removeEventListener: (_tipo, fn) => ouvintes.delete(fn),
    mudarPara(novoOculto) { this.hidden = novoOculto; ouvintes.forEach(fn => fn()); },
    ouvintes,
  };
};

describe("polling adaptativo", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("consulta na hora e repete no ritmo curto com a aba visível", async () => {
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento: criarDocumento(false) });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(tarefa).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(8000);
    expect(tarefa).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(tarefa).toHaveBeenCalledTimes(3);
    p.parar();
  });

  it("com a aba oculta usa o intervalo longo", async () => {
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento: criarDocumento(true) });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(59000);
    expect(tarefa).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(tarefa).toHaveBeenCalledTimes(2);
    p.parar();
  });

  it("ao voltar a ficar visível consulta na hora e retoma o ritmo curto", async () => {
    const documento = criarDocumento(true);
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(tarefa).toHaveBeenCalledTimes(1);
    documento.mudarPara(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(tarefa).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(tarefa).toHaveBeenCalledTimes(3);
    p.parar();
  });

  it("ocultar a aba não dispara consulta extra", async () => {
    const documento = criarDocumento(false);
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    documento.mudarPara(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tarefa).toHaveBeenCalledTimes(1);
    p.parar();
  });

  it("uma consulta lenta nunca se sobrepõe à seguinte", async () => {
    let emAndamento = 0, maximo = 0;
    const tarefa = vi.fn(async () => {
      emAndamento++; maximo = Math.max(maximo, emAndamento);
      await new Promise(r => setTimeout(r, 20000));
      emAndamento--;
    });
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento: criarDocumento(false) });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(60000);
    expect(maximo).toBe(1);
    p.parar();
  });

  it("uma falha na consulta não encerra o polling", async () => {
    const tarefa = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue(undefined);
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento: criarDocumento(false) });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(8000);
    expect(tarefa).toHaveBeenCalledTimes(2);
    p.parar();
  });

  it("parar cancela o agendamento e remove o ouvinte de visibilidade", async () => {
    const documento = criarDocumento(false);
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento });
    p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(documento.ouvintes.size).toBe(1);
    p.parar();
    expect(documento.ouvintes.size).toBe(0);
    await vi.advanceTimersByTimeAsync(120000);
    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it("iniciar duas vezes não duplica a consulta", async () => {
    const tarefa = vi.fn(async () => {});
    const p = criarPollingAdaptativo({ tarefa, visivelMs: 8000, ocultoMs: 60000, documento: criarDocumento(false) });
    p.iniciar(); p.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(tarefa).toHaveBeenCalledTimes(1);
    p.parar();
  });
});
