// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = path.resolve(process.cwd(), "apps/ponto-obra");

describe("fluxo facial direto via react-native-fast-tflite", () => {
  it("fixa exatamente react-native-fast-tflite 3.0.1", () => {
    const pkg = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8"));
    expect(pkg.dependencies["react-native-fast-tflite"]).toBe("3.0.1");
  });

  it("não executa autenticação complementar por rajada ou virada na batida", () => {
    const tela = readFileSync(path.join(APP, "src/telas/TelaPonto.js"), "utf8");
    expect(tela).toContain("const fotoFrente = await foto()");
    expect(tela).toContain("const frente = await analisarFoto(modelos, fotoFrente)");
    expect(tela).toContain("const id = identificar(frente.vetor, compativeis)");
    expect(tela).not.toContain("avaliarProvaDeVida");
    expect(tela).not.toContain("FASE.VIRAR");
    expect(tela).not.toContain("CAPTURAS_IDENTIFICACAO");
    expect(tela).not.toContain("fotoVirada");
  });

  it("mantém o reconhecimento local carregado diretamente pelo fast-tflite", () => {
    const nativo = readFileSync(path.join(APP, "src/servicos/rosto-nativo.js"), "utf8");
    expect(nativo).toContain('from "react-native-fast-tflite"');
    expect(nativo).toContain("loadTensorflowModel");
    expect(nativo).not.toContain("react-native-offline-face-auth");
  });
});
