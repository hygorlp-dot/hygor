import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { avaliarDoctor, tamanhoDiretorio, executarFerramenta } from "./release-tools.mjs";

describe("evidências do release check", () => {
  it("não aprova falha de lançamento, interrupção ou saída desconhecida", () => {
    for (const result of [{ status: null, error: new Error("ENOENT") }, { status: null, signal: "SIGTERM" }, { status: 1, stderr: "Unable to download" }]) {
      expect(avaliarDoctor(result).ok).toBe(false);
      expect(avaliarDoctor(result, { offline: true }).ok).toBe(false);
    }
  });
  it("só permite checks de rede explicitamente não verificados em execução offline não CI", () => {
    const result = { status: 1, stdout: "✖ Check Expo config against schema\n✖ Check React Native Directory" };
    expect(avaliarDoctor(result).ok).toBe(false);
    expect(avaliarDoctor(result, { offline: true }).naoVerificado).toHaveLength(2);
    expect(avaliarDoctor(result, { offline: true, ci: true }).ok).toBe(false);
    expect(avaliarDoctor({ ...result, stdout: result.stdout + "\n✖ Check native modules" }, { offline: true }).ok).toBe(false);
  });
  it("mede bundle com diretórios e espaços sem depender de du", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ponto release "));
    try {
      mkdirSync(path.join(dir, "assets"));
      writeFileSync(path.join(dir, "metadata.json"), "123");
      writeFileSync(path.join(dir, "assets", "model.tflite"), Buffer.alloc(17));
      expect(tamanhoDiretorio(dir)).toBe(20);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("executa Node sem depender do nome do executável no PATH", () => {
    const result = executarFerramenta("node", ["-e", "process.stdout.write('ok')"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ok");
  });
});
