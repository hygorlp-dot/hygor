import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("fila offline durável (campo-offline) conectada a comandos operacionais", () => {
  it("só enfileira offline comandos elegíveis e apenas em falha de conectividade retryable", () => {
    const start = source.indexOf("const dispatchOperationalCommand=");
    const end = source.indexOf("const retomarOffline=async()=>{", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(implementation).toContain("OFFLINE_QUEUEABLE_COMMANDS[command?.type]");
    expect(implementation).toContain("[0,429,500,502,503,504].includes(Number(resposta?.status||0))");
    expect(implementation).toContain("campoOfflineStoreRef.current.enqueue");
    expect(implementation).toContain("offlineQueued:true");
  });

  it("mapeia só os dois tipos de escopo aprovado (avanço físico e APR), não qualidade nem ponto", () => {
    const start = source.indexOf("const OFFLINE_QUEUEABLE_COMMANDS=");
    const end = source.indexOf("};", start) + 2;
    const mapping = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(mapping).toContain("OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED");
    expect(mapping).toContain("OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED");
    expect(mapping).not.toContain("QUALITY_ITEM_INSPECTED");
    expect(mapping).not.toContain("PUNCH");
  });

  // Regressão: a primeira versão deste wiring marcava um comando reenfileirado
  // por falta de conexão (offlineQueued:true) como "sincronizada" no Dexie,
  // apagando silenciosamente a marca de pendência de um dado que nunca saiu
  // do dispositivo. O `continue` abaixo é a proteção contra isso.
  it("não marca como resolvido um comando que só foi reenfileirado (ainda offline)", () => {
    const start = source.indexOf("const retomarOffline=async()=>{");
    const end = source.indexOf("window.addEventListener(\"online\",retomarOffline);", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const continueIndex = implementation.indexOf("if(resultado?.offlineQueued)continue;");
    const resolveIndex = implementation.indexOf("store.resolve(");
    expect(continueIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(-1);
    expect(continueIndex).toBeLessThan(resolveIndex);
  });

  it("reenvia comandos pendentes reusando a mesma idempotencyKey (dedupe do servidor cobre o replay)", () => {
    const start = source.indexOf("const retomarOffline=async()=>{");
    const end = source.indexOf("window.addEventListener(\"online\",retomarOffline);", start);
    const implementation = source.slice(start, end);

    expect(implementation).toContain("dispatchOperationalCommand(()=>operacao.payload)");
    expect(implementation).toContain("idempotencyKey:operacao.idempotencyKey");
  });
});
