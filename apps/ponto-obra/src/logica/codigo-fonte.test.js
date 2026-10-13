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

  it("PIN do responsável só em memória: nunca persistido e descartado ao sair do modo encarregado", () => {
    const semComentario = f => ler(f).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    // O PIN só sai da closure de pin.js pelo corpo do cadastro facial.
    expect(arquivosDoApp().filter(f => /pinParaServidor\s*\(|pinResponsavel/.test(semComentario(f))).map(f => f.replace(/\\/g, "/")))
      .toEqual(["src/logica/pin.js"]);
    // Quem lida com a sessão não toca em disco (SecureStore, SQLite, arquivos).
    for (const f of ["src/logica/pin.js", "src/telas/TelaEncarregado.js"]) {
      expect(semComentario(f)).not.toMatch(/SecureStore|AsyncStorage|expo-sqlite|expo-file-system|armazem/);
    }
    const tela = ler("src/telas/TelaEncarregado.js");
    expect(tela).toContain("aoEntrar(abrirSessaoResponsavel(ok, pin))");
    expect(tela).toContain("corpoCadastroBiometria(responsavel, {");
    // Sair (botão e inatividade) e desmontar descartam o PIN.
    expect(tela).toContain("const sair = useCallback(() => { sessao.current?.descartar(); fechar(); }, [fechar]);");
    expect(tela).toContain("useEffect(() => () => sessao.current?.descartar(), []);");
    expect(tela).toMatch(/INATIVIDADE_MS\) sair\(\)/);
    expect(tela).toContain('titulo="Sair do modo encarregado" onPress={sair}');
    expect(tela).toContain("aoEntrar={entrar} fechar={sair}");
  });

  it("transação do banco na conexão que tem a chave do SQLCipher (não a do expo-sqlite)", () => {
    expect(ler("src/dados/armazem-sqlite.js")).toContain("serializarBanco(await SQLite.openDatabaseAsync(NOME_BANCO))");
    expect(ler("src/dados/armazem-sqlite-nucleo.js")).toContain('"BEGIN IMMEDIATE"');
  });

  it("foto vai para a pasta de documentos com move() aguardado", () => {
    expect(ler("src/servicos/rosto-nativo.js")).toMatch(/await escolhida\.arquivo\.move\(destino\)/);
  });

  it("batida no App.js trata a foto pelo fotoSemBloquear (testado): câmera/foto nunca impedem a batida", () => {
    const app = ler("App.js");
    expect(app).toContain("await fotoSemBloquear(foto, prepararFotoDaBatida)");
    expect(app.match(/prepararFotoDaBatida\(/g) || []).toHaveLength(0);   // nenhuma chamada direta fora do helper
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

  it("captura da câmera com PRAZO e só depois de onCameraReady (revisão Impeccable P0: quiosque travava)", () => {
    const ponto = ler("src/telas/TelaPonto.js"), encarregado = ler("src/telas/TelaEncarregado.js");
    expect(ponto).toContain("onCameraReady");
    for (const fonte of [ponto, encarregado]) {
      const capturas = fonte.split("takePictureAsync(").length - 1;
      const comPrazo = fonte.split("comPrazo(camera.current.takePictureAsync(").length - 1;
      expect(capturas).toBeGreaterThan(0);
      expect(comPrazo).toBe(capturas);
    }
    expect(ponto).toContain("if (emCurso.current) return;");   // toque duplo não inicia duas batidas
    // Câmera que volta (depois do comprovante, da permissão, do cadastro) é NOVA:
    // "pronta" zera quando ela sai da tela, e o prazo de 10 s só conta com ela montada.
    expect(ponto).toMatch(/useEffect\(\(\) => \{ if \(!cameraMontada\) \{ setCameraPronta\(false\);/);
    expect(ponto).toContain("if (!cameraMontada || cameraPronta || erroCamera) return undefined;");
  });

  it("homologação nunca usa host de produção nem em execução (segunda trava, além do build)", () => {
    expect(ler("src/servicos/conexao.js")).toContain("if (AMBIENTE === \"homologacao\" && ehHostDeProducao(new URL(EXTRA.apiUrl).host)) return null;");
  });

  it("desempenho só observa: relógio monotônico, anotação sem await e sem derrubar a batida", () => {
    const ponto = ler("src/telas/TelaPonto.js"), nativo = ler("src/servicos/rosto-nativo.js"), app = ler("App.js");
    // performance.now (monotônico); sem ele, NaN - nunca Date.now, que muda com ajuste de hora.
    expect(nativo).toMatch(/agoraMonotonicoMs = \(\) => \(typeof globalThis\.performance\?\.now === "function" \? globalThis\.performance\.now\(\) : NaN\)/);
    expect(ponto).toContain("criarCronometro(agoraMonotonicoMs)");
    expect(ponto).toContain("try { anotarDesempenho({ tempos: cronometro.tempos, ...resultado }); } catch");
    expect(ponto).not.toMatch(/await anotarDesempenho/);
    expect(app).toContain("ref.current.armazem?.gravarEstado(CHAVE_DESEMPENHO, ref.current.desempenho).catch(() => {});");
  });
});
