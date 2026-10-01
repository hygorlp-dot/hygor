// @vitest-environment node
//
// Travas no código-fonte do app para regressões que só apareceriam no
// aparelho (o código nativo não roda no Node).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../..");
const ler = rel => readFileSync(path.join(RAIZ, rel), "utf8");
const arquivosDoApp = () => {
  const lista = ["App.js"];
  const andar = dir => {
    for (const nome of readdirSync(path.join(RAIZ, dir))) {
      const rel = path.join(dir, nome);
      if (statSync(path.join(RAIZ, rel)).isDirectory()) andar(rel);
      else if (/\.(js|ts|tsx)$/.test(nome) && !/\.test\.js$|\.test-helper\.js$/.test(nome)) lista.push(rel);
    }
  };
  andar("src"); andar("modules/relogio-confiavel/src");
  return lista;
};

describe("código-fonte do app", () => {
  it("os DOIS modelos TFLite carregam pela cópia file:// do expo-asset (correção 107ca0f)", () => {
    const fonte = ler("src/servicos/rosto-nativo.js");
    expect(fonte).toContain("loadTensorflowModel({ url: asset.localUri }, [])");
    expect(fonte).toMatch(/carregarConferido\(MODELOS\.detector\)/);
    expect(fonte).toMatch(/carregarConferido\(MODELOS\.identidade\)/);
    // require() direto no TFLite vira "assets_modelos_..." no APK e quebra.
    expect(fonte).not.toMatch(/loadTensorflowModel\(\s*(MODELOS|require|modulo)/);
  });

  it("nenhum console.* no app: vetor facial, foto, PIN, token, CPF e chave nunca vão para log", () => {
    const comLog = arquivosDoApp().filter(f => /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(ler(f)));
    expect(comLog).toEqual([]);
  });

  it("transação do banco na conexão que tem a chave do SQLCipher (não a do expo-sqlite)", () => {
    expect(ler("src/dados/armazem-sqlite.js")).toContain("serializarBanco(await SQLite.openDatabaseAsync(NOME_BANCO))");
    expect(ler("src/dados/armazem-sqlite-nucleo.js")).toContain('"BEGIN IMMEDIATE"');
  });

  it("foto vai para a pasta de documentos com move() aguardado", () => {
    expect(ler("src/servicos/rosto-nativo.js")).toMatch(/await escolhida\.arquivo\.move\(destino\)/);
  });

  it("parâmetros faciais só em calibracao.js (sem números soltos nas telas)", () => {
    const tela = ler("src/telas/TelaPonto.js");
    expect(tela).not.toMatch(/GIRO_FRENTE|GIRO_VIRADO|MESMA_PESSOA_VIRADA/);
    expect(tela).toMatch(/P\.giroMaximoDeFrente/);
  });

  it("REP-P: o aparelho não gera NSR e o guia não volta a instruir NSR por aparelho", () => {
    const terminal = ler("src/logica/terminal.js");
    expect(terminal).not.toMatch(/\bnsr\s*:/);
    expect(terminal).toMatch(/localSequence:/);
    const guia = ler("AGENTS.md");
    expect(guia).not.toMatch(/NSR sequencial por aparelho/i);
    expect(guia).toMatch(/NSR fiscal\*\* é atribuído \*\*só pela ARP/);
  });

  it("configuração Android: sem backup do banco, SQLCipher ligado, sem sobreposição de tela", () => {
    const app = JSON.parse(ler("app.json")).expo;
    expect(app.android.allowBackup).toBe(false);
    expect(app.android.blockedPermissions).toContain("android.permission.SYSTEM_ALERT_WINDOW");
    // Brilho só da janela do app: nada de alterar configuração do sistema.
    expect(app.android.blockedPermissions).toContain("android.permission.WRITE_SETTINGS");
    expect(app.plugins.flat()).not.toContain("expo-brightness");
    expect(app.plugins).toContainEqual(["expo-sqlite", { useSQLCipher: true }]);
  });
});
