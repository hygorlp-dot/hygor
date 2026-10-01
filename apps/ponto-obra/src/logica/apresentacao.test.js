// @vitest-environment node
//
// Comportamento das telas (o que aparece em cada estado), sem renderizar:
// texto, tom, ícone e ações. Nada de pixel.
import { describe, expect, it } from "vitest";
import {
  FASE, PASSO_CADASTRO, batidasDoDia, casasDoCodigo, falaDeConfirmacao, saudacao, emAndamento, falhaNaTela, guiaDaFase, instrucaoDaFase, linhasDoComprovante,
  passoDoCadastro, rotuloDaCaptura, secoesDoEncarregado, statusDoAparelho, telaSemCamera,
} from "./apresentacao.js";
import { montarDiagnostico, secoesDoDiagnostico, ORDEM_SECOES_DIAGNOSTICO } from "./diagnostico.js";
import { estadoPermissaoCamera, mensagemDeErro, mensagemParaTrabalhador } from "./falhas.js";

const TONS_DE_ESTADO = ["sucesso", "atencao", "erro"];

describe("tela de ponto - estado normal", () => {
  it("online, sem fila: 'Sincronizado' com ícone e tom de sucesso", () => {
    const s = statusDoAparelho({ online: true, pendentes: 0 }, { horaConfiavel: true });
    expect(s).toMatchObject({ tom: "sucesso", icone: "ok", texto: "Sincronizado", detalhe: "" });
    expect(s.rotuloAcessivel).toBe("Situação: Sincronizado");
  });

  it("status sempre tem ícone e texto (nunca só cor)", () => {
    const casos = [
      [{ online: true }, {}], [{ online: false, pendentes: 2 }, {}], [{ online: true, pendentes: 3 }, {}],
      [{ online: true, aviso: "recusado" }, {}], [{ online: true }, { horaConfiavel: false }],
    ];
    for (const [sit, hora] of casos) {
      const s = statusDoAparelho(sit, hora);
      expect(s.icone).toBeTruthy();
      expect(s.texto.length).toBeGreaterThan(3);
      expect(s.rotuloAcessivel).toContain(s.texto);
    }
  });

  it("hora sem referência válida aparece como atenção (a fila fica no modo Encarregado)", () => {
    expect(statusDoAparelho({ online: true, pendentes: 1 }, { horaConfiavel: false }))
      .toMatchObject({ tom: "atencao", texto: "Hora não verificada", detalhe: "" });
  });

  it("problema de envio com internet: atenção curta; o detalhe fica no modo Encarregado", () => {
    const s = statusDoAparelho({ online: true, pendentes: 4, aviso: "A obra deste aparelho ainda não está ligada a um estabelecimento no ARCD..." });
    expect(s).toMatchObject({ tom: "atencao", texto: "Envio pendente", detalhe: "4 pendentes" });
    expect(s.texto.length).toBeLessThan(20);
  });

  it("parado, a instrução é olhar para a câmera e a guia é neutra", () => {
    expect(instrucaoDaFase(FASE.PRONTO)).toBe("Olhe para a câmera");
    expect(guiaDaFase(FASE.PRONTO)).toBe("neutro");
    expect(emAndamento(FASE.PRONTO)).toBe(false);
  });
});

describe("tela de ponto - offline", () => {
  it("offline não é erro: tom neutro, e mostra quantas batidas aguardam envio", () => {
    const s = statusDoAparelho({ online: false, pendentes: 2 });
    expect(s).toMatchObject({ tom: "neutro", icone: "offline", texto: "Offline", detalhe: "2 pendentes" });
    expect(TONS_DE_ESTADO.filter(t => t !== "atencao")).not.toContain(s.tom);
  });

  it("comprovante offline tranquiliza: será enviado quando houver conexão", () => {
    const l = linhasDoComprovante({ nome: "João", localSequence: 3, hash: "a".repeat(64), horaConfiavel: true }, { online: false });
    expect(l.envio).toMatchObject({ tom: "neutro", texto: "Será enviado quando houver conexão." });
  });
});

describe("tela de ponto - analisando", () => {
  it("as fases seguem o roteiro: olhar → continuar → virar (com o nome) → confirmado", () => {
    expect(instrucaoDaFase(FASE.OLHAR)).toBe("Olhe para a câmera");
    expect(instrucaoDaFase(FASE.ANALISAR)).toBe("Continue olhando");
    expect(instrucaoDaFase(FASE.VIRAR, "João Silva")).toBe("João, vire um pouco o rosto");
    expect(instrucaoDaFase(FASE.VIRAR, "")).toBe("Vire um pouco o rosto");
    expect(instrucaoDaFase(FASE.CONFIRMADO, "João Silva")).toBe("Identidade confirmada");
    expect(instrucaoDaFase(FASE.REGISTRANDO)).toBe("Registrando ponto");
  });

  it("guia facial: neutra → ouro com rosto encontrado → verde confirmado", () => {
    expect([FASE.OLHAR, FASE.ANALISAR].map(guiaDaFase)).toEqual(["neutro", "neutro"]);
    expect(guiaDaFase(FASE.VIRAR)).toBe("detectado");
    expect(guiaDaFase(FASE.CONFIRMADO)).toBe("confirmado");
    expect(Object.values(FASE).filter(f => f !== FASE.PRONTO).every(emAndamento)).toBe(true);
  });

  it("nenhuma instrução ao trabalhador fala de modelo, TFLite ou termos técnicos", () => {
    const textos = Object.values(FASE).map(f => instrucaoDaFase(f, "Ana"));
    expect(textos.join(" ")).not.toMatch(/tflite|modelo|blazeface|mobilefacenet|vetor|similaridade/i);
  });
});

describe("tela de ponto - falha de reconhecimento", () => {
  it("rosto não confirmado é incerteza normal: tom neutro, nunca vermelho, com caminho do encarregado", () => {
    const f = falhaNaTela({ mensagem: "Olhe de frente e tente novamente.", podeEncarregado: true });
    expect(f).toMatchObject({ tom: "neutro", titulo: "Não consegui confirmar seu rosto", podeEncarregado: true });
    expect(f.tom).not.toBe("erro");
  });

  it("falha real (batida não gravada, câmera, modelos) usa o tom de erro e diz o que aconteceu", () => {
    expect(falhaNaTela({ tipo: "erro", contexto: "batida", mensagem: mensagemParaTrabalhador("batida") }))
      .toMatchObject({ tom: "erro", titulo: "O ponto não foi registrado" });
    expect(falhaNaTela({ tipo: "erro", contexto: "camera" }).titulo).toBe("A câmera não respondeu");
    expect(falhaNaTela({ tipo: "erro", contexto: "modelos" }).titulo).toBe("Reconhecimento indisponível");
  });

  it("cadastro desatualizado é atenção, não erro", () => {
    expect(falhaNaTela({ tipo: "atencao", contexto: "cadastro" })).toMatchObject({ tom: "atencao", titulo: "Cadastro desatualizado" });
  });

  it("o trabalhador recebe a mensagem sem o detalhe técnico; o Diagnóstico guarda o detalhe", () => {
    const java = "com.mrousavy.tflite.TfliteException: Failed to load\n at com.foo.Bar";
    expect(mensagemParaTrabalhador("modelos")).not.toMatch(/detalhe|tflite|exception/i);
    expect(mensagemParaTrabalhador("modelos")).toContain("encarregado");
    expect(mensagemDeErro("modelos", new Error(java))).toContain("detalhe");
  });
});

describe("tela de ponto - câmera negada", () => {
  it("pedido ainda possível: botão para permitir; o encarregado continua como alternativa", () => {
    const t = telaSemCamera(estadoPermissaoCamera({ granted: false, canAskAgain: true }));
    expect(t).toMatchObject({ acao: "pedir_permissao", rotuloAcao: "Permitir câmera", alternativa: "Registrar com encarregado" });
  });

  it("negada de vez: leva às configurações do app", () => {
    const t = telaSemCamera(estadoPermissaoCamera({ granted: false, canAskAgain: false }));
    expect(t).toMatchObject({ acao: "abrir_configuracoes", rotuloAcao: "Abrir configurações" });
    expect(t.texto).toContain("Permissões");
  });
});

describe("tela de ponto - sucesso (comprovante)", () => {
  const c = { nome: "João Silva", cpfMascarado: "***.456.789-**", marcadoEm: "2026-10-01T10:42:15.000Z", localSequence: 18, hash: "f".repeat(64), horaConfiavel: true, avisoFoto: "" };

  it("mostra o que o trabalhador precisa ver: título, nome, obra, registro local e envio", () => {
    const l = linhasDoComprovante(c, { obra: { nome: "Terras Alpha" }, online: true });
    expect(l).toMatchObject({ titulo: "Ponto registrado", nome: "João Silva", obra: "Terras Alpha", registro: "Registro local nº 18" });
    expect(l.envio).toMatchObject({ icone: "sincronizando", texto: "Enviando ao ARCD" });
    expect(l.avisos).toEqual([]);
  });

  it("mantém CPF mascarado e código do registro (Portaria) e nunca mostra um NSR inventado", () => {
    const l = linhasDoComprovante(c, { online: true });
    expect(l.detalhes.find(d => d.rotulo === "CPF").valor).toBe("***.456.789-**");
    expect(l.detalhes.find(d => d.rotulo === "Código do registro").valor).toBe("f".repeat(16));
    const nsr = l.detalhes.find(d => d.rotulo === "NSR").valor;
    expect(nsr).not.toMatch(/\d/);
    expect(nsr).toContain("ARCD");
  });

  it("hora não confiável e foto não guardada viram avisos visíveis", () => {
    const l = linhasDoComprovante({ ...c, horaConfiavel: false, avisoFoto: "A câmera não tirou a foto. A batida foi registrada sem foto." });
    expect(l.avisos).toHaveLength(2);
    expect(l.avisos[0]).toContain("será conferida");
  });
});

describe("modo Encarregado", () => {
  it("menu em três seções (cadastros, registros, sistema), sem botões soltos", () => {
    const secoes = secoesDoEncarregado({ resumo: { totalFuncionarios: 10, comRosto: 3 }, situacao: { online: true, pendentes: 2 } });
    expect(secoes.map(s => s.titulo)).toEqual(["Cadastros", "Registros", "Sistema"]);
    const linhas = secoes.flatMap(s => s.linhas);
    expect(linhas.map(l => l.id)).toEqual(["cadastro", "manual", "terceiro", "sincronizacao", "diagnostico", "voz", "fixar"]);
    expect(linhas.find(l => l.id === "cadastro").valor).toBe("3 de 10");
    expect(linhas.find(l => l.id === "sincronizacao").valor).toBe("2 pendentes");
    expect(linhas.every(l => l.rotulo.length > 3)).toBe(true);
  });

  it("sincronização sinaliza atenção quando há aviso ou foto com problema; offline aparece por escrito", () => {
    const sinc = s => secoesDoEncarregado({ situacao: s }).at(-1).linhas[0];
    expect(sinc({ online: true, aviso: "x" }).tom).toBe("atencao");
    expect(sinc({ online: true, fotosComProblema: 1 }).tom).toBe("atencao");
    expect(sinc({ online: false })).toMatchObject({ valor: "Offline", tom: null });
    expect(sinc({ online: true })).toMatchObject({ valor: "Em dia", tom: null });
  });

  it("cadastro facial é guiado: pessoa → apresentação → termo → fotos → concluído", () => {
    const p = { id: "e1", nome: "João" };
    expect(passoDoCadastro({})).toBe(PASSO_CADASTRO.PESSOA);
    expect(passoDoCadastro({ pessoa: p })).toBe(PASSO_CADASTRO.INTRO);
    expect(passoDoCadastro({ pessoa: p, introVista: true })).toBe(PASSO_CADASTRO.TERMO);
    expect(passoDoCadastro({ pessoa: p, introVista: true, aceitoEm: "2026-10-01T10:00:00Z" })).toBe(PASSO_CADASTRO.CAPTURA);
    expect(passoDoCadastro({ pessoa: p, introVista: true, aceitoEm: "x", concluido: true })).toBe(PASSO_CADASTRO.CONCLUIDO);
    // Sem o aceite do termo não há captura.
    expect(passoDoCadastro({ pessoa: p, introVista: true, aceitoEm: null })).not.toBe(PASSO_CADASTRO.CAPTURA);
    expect([0, 1, 2, 3].map(n => rotuloDaCaptura(n, 3))).toEqual(["1 de 3", "2 de 3", "3 de 3", "3 de 3"]);
  });
});

describe("pareamento", () => {
  it("8 casas, só dígitos, com a próxima casa marcada como ativa", () => {
    expect(casasDoCodigo("")).toHaveLength(8);
    expect(casasDoCodigo("")[0]).toEqual({ digito: "", ativa: true });
    const c = casasDoCodigo("14a82");
    expect(c.map(x => x.digito).join("")).toBe("1482");
    expect(c.findIndex(x => x.ativa)).toBe(4);
    expect(casasDoCodigo("1482974112").map(x => x.digito).join("")).toBe("14829741");
    expect(casasDoCodigo("14829741").some(x => x.ativa)).toBe(false);
  });
});

describe("diagnóstico em seções", () => {
  const itens = montarDiagnostico({
    app: { versao: "1.0.0", build: "18", commit: "5f69bde" }, aparelho: { marca: "Samsung", modelo: "A15", android: "15" },
    sessao: { nome: "Portaria", obra: { nome: "Terras Alpha" } }, contagem: { pendentes: 0, fotos: 0, fotosComProblema: 2 },
    modelos: { estado: "ok" }, hora: { horaConfiavel: true }, gps: { estado: "ok" }, fiscal: { ultimaSequenciaLocal: 18 },
    ultimaSincronizacao: { em: 0, ok: true, cadeiaDivergente: true },
  });

  it("todo item da lista fechada aparece numa seção, na ordem; nada some", () => {
    const secoes = secoesDoDiagnostico(itens);
    expect(secoes.flatMap(s => s.itens).length).toBe(itens.length);
    expect(secoes.map(s => s.titulo)).toEqual(ORDEM_SECOES_DIAGNOSTICO.filter(t => secoes.some(s => s.titulo === t)));
    expect(secoes.find(s => s.titulo === "Outros")).toBeUndefined();
  });

  it("aplicativo primeiro; valores técnicos em mono; problemas marcados para ícone + texto", () => {
    const secoes = secoesDoDiagnostico(itens);
    expect(secoes[0]).toMatchObject({ titulo: "Aplicativo" });
    const todos = Object.fromEntries(secoes.flatMap(s => s.itens).map(i => [i.rotulo, i]));
    expect(todos.Commit.mono).toBe(true);
    expect(todos["Cadeia local"].atencao).toBe(true);
    expect(todos["Fotos com problema"].atencao).toBe(true);
    expect(todos["Reconhecimento facial"].atencao).toBe(false);
  });

  it("item novo sem seção cai em 'Outros' em vez de sumir", () => {
    expect(secoesDoDiagnostico([{ rotulo: "Campo novo", valor: "x" }])).toEqual([{ titulo: "Outros", itens: [{ rotulo: "Campo novo", valor: "x", mono: false, atencao: false }] }]);
  });
});

describe("saudação, voz e batidas do dia (comprovante)", () => {
  // 10:42Z = 07:42 em Recife (UTC-3).
  const HOJE = "2026-10-01T10:42:00.000Z";
  const ev = (marcadoEm, extra = {}) => ({ formatVersion: 2, employeeId: "e1", terceiroId: "", marcadoEm, ...extra });

  it("saudação pelo horário da obra (America/Recife)", () => {
    expect(saudacao(Date.parse("2026-10-01T10:42:00Z"))).toBe("Bom dia");      // 07:42
    expect(saudacao(Date.parse("2026-10-01T16:00:00Z"))).toBe("Boa tarde");    // 13:00
    expect(saudacao(Date.parse("2026-10-01T23:30:00Z"))).toBe("Boa noite");    // 20:30
    expect(saudacao(Date.parse("2026-10-01T06:00:00Z"))).toBe("Boa noite");    // 03:00
  });

  it("fala curta só com o primeiro nome", () => {
    expect(falaDeConfirmacao("João Silva", Date.parse(HOJE))).toBe("Bom dia, João. Ponto registrado.");
    expect(falaDeConfirmacao("", Date.parse(HOJE))).toBe("Ponto registrado.");
  });

  it("batidas do dia: só da pessoa, só do dia local, em ordem; ignora outros e legado", () => {
    const eventos = [
      ev("2026-10-01T15:01:00.000Z"), ev(HOJE), ev("2026-10-01T16:05:00.000Z"),
      ev("2026-10-01T02:00:00.000Z"),                       // 23:00 do dia anterior em Recife
      ev("2026-10-01T12:00:00.000Z", { employeeId: "e2" }),  // outra pessoa
      { formatVersion: 1, employeeId: "e1", marcadoEm: HOJE }, // legado não entra
    ];
    expect(batidasDoDia(eventos, { id: "e1", marcadoEm: HOJE })).toEqual(["07:42", "12:01", "13:05"]);
    expect(batidasDoDia(eventos, { id: "", marcadoEm: HOJE })).toEqual([]);
  });

  it("terceirizado é procurado pelo terceiroId", () => {
    const eventos = [ev(HOJE, { employeeId: "", terceiroId: "t1" }), ev(HOJE)];
    expect(batidasDoDia(eventos, { tipo: "terceiro", id: "t1", marcadoEm: HOJE })).toEqual(["07:42"]);
  });

  it("comprovante: saudação com o nome; 'hoje' só quando há mais de uma marcação", () => {
    const c = { nome: "João Silva", marcadoEm: HOJE, localSequence: 3, hash: "a".repeat(64), horaConfiavel: true };
    expect(linhasDoComprovante(c).saudacao).toBe("Bom dia, João Silva");
    expect(linhasDoComprovante({ ...c, batidasHoje: ["07:42"] }).batidasHoje).toEqual([]);
    expect(linhasDoComprovante({ ...c, batidasHoje: ["07:42", "12:01"] }).batidasHoje).toEqual(["07:42", "12:01"]);
  });

  it("menu do encarregado mostra o estado da voz por escrito", () => {
    const voz = s => secoesDoEncarregado({ situacao: s }).at(-1).linhas.find(l => l.id === "voz");
    expect(voz({ voz: true }).valor).toBe("Ligada");
    expect(voz({ voz: false }).valor).toBe("Desligada");
  });
});
