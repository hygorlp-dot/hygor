// Testes de CARACTERIZAÇÃO do motor de cronograma LEGADO (src/LegacyApp.jsx).
//
// Objetivo: registrar o comportamento ATUAL das funções puras de planejamento
// que hoje desenham a tela de Planejamento em produção, para servir de rede
// de segurança antes de uma futura migração para o motor novo em
// src/domains/planejamento/calculations.js. Não é objetivo "corrigir" nada
// aqui - inclusive peculiaridades e bugs latentes são capturados como estão.
//
// Importar qualquer coisa de LegacyApp.jsx avalia o módulo inteiro (~21 mil
// linhas), que por sua vez importa componentes de UI. Os mocks abaixo são
// copiados de src/LegacyApp.test.jsx para permitir a importação em ambiente
// de teste.
vi.mock("../../components/ui/button", () => ({ Button: () => null }));
vi.mock("../../components/ui/input", () => ({ Input: () => null }));
vi.mock("../../components/ui/label", () => ({ Label: () => null }));
vi.mock("../../components/ui/card", () => ({
  Card: () => null, CardHeader: () => null, CardTitle: () => null,
  CardDescription: () => null, CardContent: () => null, CardFooter: () => null,
}));
vi.mock("../../components/ui/tabs", () => ({
  Tabs: () => null, TabsList: () => null, TabsTrigger: () => null, TabsContent: () => null,
}));
vi.mock("../../components/ui/alert", () => ({ Alert: () => null, AlertDescription: () => null }));

import { describe, it, expect, beforeAll } from "vitest";

let legacy;

// Importa o módulo UMA única vez e reusa em todos os testes: o import
// dinâmico do arquivo monolítico é lento (mesmo mockando a UI), então
// reimportar em cada teste desperdiçaria a maior parte do tempo do arquivo.
beforeAll(async () => {
  legacy = await import("../../LegacyApp.jsx");
}, 60000);

// ==============================================================
// Utilitários simples (fora da faixa 11119-12148, mas exportados e citados
// na tarefa: monthName, maiusculoOrcamento, obraContextoSalvo)
// ==============================================================
describe("utilitários simples", () => {
  it("monthName mapeia índice 0-11 para abreviação em português", () => {
    expect(legacy.monthName(0)).toBe("Jan");
    expect(legacy.monthName(11)).toBe("Dez");
  });

  it("monthName devolve string vazia fora do intervalo (sem lançar erro)", () => {
    expect(legacy.monthName(12)).toBe("");
    expect(legacy.monthName(-1)).toBe("");
  });

  it("maiusculoOrcamento converte para maiúsculas via locale pt-BR", () => {
    expect(legacy.maiusculoOrcamento("orçamento residencial")).toBe("ORÇAMENTO RESIDENCIAL");
  });

  it("maiusculoOrcamento coage null/undefined/number para string antes de converter", () => {
    expect(legacy.maiusculoOrcamento(null)).toBe("");
    expect(legacy.maiusculoOrcamento(undefined)).toBe("");
    expect(legacy.maiusculoOrcamento(123)).toBe("123");
  });

  it("obraContextoSalvo lê o sessionStorage do browser (jsdom)", () => {
    expect(legacy.obraContextoSalvo()).toBe("");
    window.sessionStorage.setItem("arcd_obra_contexto", "obra-123");
    expect(legacy.obraContextoSalvo()).toBe("obra-123");
    window.sessionStorage.removeItem("arcd_obra_contexto");
  });
});

// ==============================================================
// Datas e calendário de trabalho
// ==============================================================
describe("diasCorridos / somaDias", () => {
  it("conta dias corridos entre duas datas ISO", () => {
    expect(legacy.diasCorridos("2026-01-05", "2026-01-16")).toBe(11);
  });

  it("nunca é negativo, mesmo com fim antes do início", () => {
    expect(legacy.diasCorridos("2026-01-16", "2026-01-05")).toBe(0);
  });

  it("devolve 0 quando falta uma das datas", () => {
    expect(legacy.diasCorridos("", "2026-01-05")).toBe(0);
    expect(legacy.diasCorridos("2026-01-05", "")).toBe(0);
  });

  it("somaDias soma (ou subtrai) dias corridos a uma data ISO", () => {
    expect(legacy.somaDias("2026-01-30", 5)).toBe("2026-02-04");
    expect(legacy.somaDias("2026-01-05", -5)).toBe("2025-12-31");
  });
});

describe("calendário de dias úteis", () => {
  // Sábado 2026-08-22, domingo 2026-08-23, segunda 2026-08-24.
  it("ehDiaUtil: calendário padrão (sem diasSemana definido) TRABALHA sábado e só folga domingo", () => {
    expect(legacy.ehDiaUtil("2026-08-22", {})).toBe(true);  // sábado
    expect(legacy.ehDiaUtil("2026-08-23", {})).toBe(false); // domingo
    expect(legacy.ehDiaUtil("2026-08-24", {})).toBe(true);  // segunda
  });

  it("ehDiaUtil respeita diasSemana customizado (seg-sex)", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] };
    expect(legacy.ehDiaUtil("2026-08-22", cal)).toBe(false); // sábado fora da lista
  });

  it("ehDiaUtil só considera feriado quando pularFeriados=true", () => {
    const feriado = { data: "2026-08-24" };
    expect(legacy.ehDiaUtil("2026-08-24", { feriados: [feriado] })).toBe(true); // pularFeriados ausente => feriado ignorado
    expect(legacy.ehDiaUtil("2026-08-24", { pularFeriados: true, feriados: [feriado] })).toBe(false);
  });

  it("diasUteis conta o intervalo INCLUSIVE conforme o calendário", () => {
    // padrão (trabalha sábado): sáb(útil) + dom(não) + seg(útil) = 2
    expect(legacy.diasUteis("2026-08-22", "2026-08-24", {})).toBe(2);
    // seg-sex: sáb(não) + dom(não) + seg(útil) = 1
    expect(legacy.diasUteis("2026-08-22", "2026-08-24", { diasSemana: [1, 2, 3, 4, 5] })).toBe(1);
  });

  it("somaDiasUteis: se a data de partida já é útil, +1 dia útil devolve A MESMA data (o próprio dia conta como 1)", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] }; // 2026-08-21 é sexta = útil
    expect(legacy.somaDiasUteis("2026-08-21", 1, cal)).toBe("2026-08-21");
  });

  it("somaDiasUteis avança pulando fim de semana quando a partida NÃO é útil", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] };
    // 2026-08-22 é sábado (não útil); +1 útil deve cair na segunda 2026-08-24
    expect(legacy.somaDiasUteis("2026-08-22", 1, cal)).toBe("2026-08-24");
  });

  it("somaDiasUteis com n negativo anda para trás", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] };
    // 2026-08-24 é segunda; -1 útil deve voltar para a sexta anterior 2026-08-21
    expect(legacy.somaDiasUteis("2026-08-24", -1, cal)).toBe("2026-08-21");
  });

  it("ajustarParaDiaUtil empurra para frente (ou para trás) até cair em dia trabalhado", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] };
    expect(legacy.ajustarParaDiaUtil("2026-08-22", cal, 1)).toBe("2026-08-24"); // sábado -> segunda
    expect(legacy.ajustarParaDiaUtil("2026-08-23", cal, -1)).toBe("2026-08-21"); // domingo -> sexta anterior
  });

  it("proximoDiaUtil pula para o próximo dia trabalhado a partir do dia seguinte", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5] };
    // a partir de sexta 2026-08-21, o próximo dia útil é segunda 2026-08-24
    expect(legacy.proximoDiaUtil("2026-08-21", cal)).toBe("2026-08-24");
  });
});

// ==============================================================
// Fixture de orçamento reutilizada por custoEtapa / ordemEtapasOrcamento /
// montarTarefas / resumoPlano / progressoPlano / janelaPlano
// ==============================================================
function orcamentoFixtureA() {
  const etapas = [
    { id: "e1", nome: "Serviços Preliminares", parentId: "" },
    { id: "e2", nome: "Fundação", parentId: "" },
    { id: "e3", nome: "Estrutura", parentId: "" },
    { id: "e4", nome: "Título Acabamentos", parentId: "" }, // etapa-título (só agrega os filhos)
    { id: "e4a", nome: "Pintura", parentId: "e4" },
    { id: "e4b", nome: "Revestimento Cerâmico", parentId: "e4" },
  ];
  const itens = [
    { id: "i1", etapaId: "e1", tipo: "servico", quantidade: 1, precoUnit: 5000 },
    { id: "i2", etapaId: "e2", tipo: "servico", quantidade: 100, precoUnit: 80 },
    { id: "i3", etapaId: "e3", tipo: "servico", quantidade: 50, precoUnit: 600 },
    { id: "i4", etapaId: "e4a", tipo: "servico", quantidade: 200, precoUnit: 25 },
    { id: "i5", etapaId: "e4b", tipo: "servico", quantidade: 150, precoUnit: 40 },
    // item tipo "titulo" na própria etapa-título: NÃO deve entrar no custo.
    { id: "i6", etapaId: "e4", tipo: "titulo", quantidade: 999, precoUnit: 999 },
  ];
  return { etapas, itens };
}

describe("custoEtapa / ordemEtapasOrcamento", () => {
  it("custoEtapa soma os itens da etapa E de suas sub-etapas, ignorando itens tipo titulo", () => {
    const orc = orcamentoFixtureA();
    expect(legacy.custoEtapa(orc, "e1")).toBe(5000);
    expect(legacy.custoEtapa(orc, "e4")).toBe(11000); // e4a(5000) + e4b(6000), i6 (titulo) excluído
  });

  it("custoEtapa devolve 0 para orçamento/etapa ausentes", () => {
    expect(legacy.custoEtapa(null, "e1")).toBe(0);
    expect(legacy.custoEtapa(orcamentoFixtureA(), "")).toBe(0);
  });

  it("ordemEtapasOrcamento devolve os ids das etapas em ordem de árvore (pai antes dos filhos)", () => {
    const orc = orcamentoFixtureA();
    expect(legacy.ordemEtapasOrcamento(orc)).toEqual(["e1", "e2", "e3", "e4", "e4a", "e4b"]);
  });
});

describe("montarTarefas", () => {
  it("enriquece tarefas com nome/custo/dias da etapa, ordena pela ordem do orçamento e marca órfãs", () => {
    const orc = orcamentoFixtureA();
    const plano = {
      tarefas: [
        { id: "t3", etapaId: "e3", nome: "Tarefa", inicio: "2026-01-19", fim: "2026-02-06", progresso: 50 },
        { id: "t1", etapaId: "e1", nome: "Tarefa", inicio: "2026-01-05", fim: "2026-01-16", progresso: 100 },
        { id: "tOrfa", etapaId: "e99", nome: "Tarefa", inicio: "2026-01-01", fim: "2026-01-02", progresso: 0 },
        { id: "t4a", etapaId: "e4a", nome: "Pintura Externa", inicio: "2026-03-01", fim: "2026-03-10", progresso: 20 },
        { id: "t2", etapaId: "e2", nome: "Tarefa", inicio: "2026-01-05", fim: "2026-01-19", progresso: 80 },
        { id: "tSemEtapa", etapaId: "", nome: "Reunião Geral", inicio: "2026-01-01", fim: "2026-01-01", progresso: 0 },
      ],
    };

    const tarefas = legacy.montarTarefas(plano, orc);

    expect(tarefas.map(t => t.id)).toEqual(["t1", "t2", "t3", "t4a", "tOrfa", "tSemEtapa"]);

    const t1 = tarefas.find(t => t.id === "t1");
    expect(t1).toMatchObject({ nome: "Serviços Preliminares", custo: 5000, dias: 11, orfa: false });

    // nome customizado pelo usuário (diferente do default "Tarefa") prevalece
    // sobre o nome da etapa vinculada, mesmo divergindo dele ("Pintura Externa" vs "Pintura").
    const t4a = tarefas.find(t => t.id === "t4a");
    expect(t4a).toMatchObject({ nome: "Pintura Externa", etapaNome: "Pintura", custo: 5000, dias: 9 });

    // etapaId aponta para uma etapa que não existe mais: custo cai para 0,
    // nome cai para o próprio (ou "Tarefa"), e orfa fica true.
    const tOrfa = tarefas.find(t => t.id === "tOrfa");
    expect(tOrfa).toMatchObject({ nome: "Tarefa", etapaNome: "", custo: 0, dias: 1, orfa: true });

    // etapaId vazio (nunca vinculada) NÃO conta como órfã.
    const tSemEtapa = tarefas.find(t => t.id === "tSemEtapa");
    expect(tSemEtapa).toMatchObject({ nome: "Reunião Geral", custo: 0, dias: 0, orfa: false });
  });
});

describe("janelaPlano / resumoPlano / progressoPlano", () => {
  const orc = orcamentoFixtureA();
  const plano = {
    tarefas: [
      { id: "t3", etapaId: "e3", nome: "Tarefa", inicio: "2026-01-19", fim: "2026-02-06", progresso: 50 },
      { id: "t1", etapaId: "e1", nome: "Tarefa", inicio: "2026-01-05", fim: "2026-01-16", progresso: 100 },
      { id: "tOrfa", etapaId: "e99", nome: "Tarefa", inicio: "2026-01-01", fim: "2026-01-02", progresso: 0 },
      { id: "t4a", etapaId: "e4a", nome: "Pintura Externa", inicio: "2026-03-01", fim: "2026-03-10", progresso: 20 },
      { id: "t2", etapaId: "e2", nome: "Tarefa", inicio: "2026-01-05", fim: "2026-01-19", progresso: 80 },
      { id: "tSemEtapa", etapaId: "", nome: "Reunião Geral", inicio: "2026-01-01", fim: "2026-01-01", progresso: 0 },
    ],
  };
  const tarefas = () => legacy.montarTarefas(plano, orc);

  it("janelaPlano abrange tarefas e marcos", () => {
    const janela = legacy.janelaPlano(tarefas(), [{ data: "2026-04-01" }]);
    expect(janela).toEqual({ ini: "2026-01-01", fim: "2026-04-01", dias: 90 });
  });

  it("resumoPlano soma o orçamento inteiro em orcTotal, não só o que já virou tarefa", () => {
    const resumo = legacy.resumoPlano(tarefas(), orc);
    expect(resumo.planejado).toBe(48000);
    expect(resumo.executado).toBe(27400);
    expect(resumo.orcTotal).toBe(54000); // soma de TODOS os itens do orçamento (i1..i5), i6 é "titulo"
    expect(resumo.coberto).toBeCloseTo(88.8888888, 5);
  });

  it("progressoPlano pondera o progresso pela duração (dias) de cada tarefa", () => {
    // tSemEtapa tem 0 dias e é excluída do cálculo; tOrfa tem 1 dia e ENTRA (mesmo órfã).
    expect(legacy.progressoPlano(tarefas())).toBeCloseTo(3300 / 53, 6);
  });
});

// ==============================================================
// Roll-up de etapas-título
// ==============================================================
describe("aplicarRollup", () => {
  it("etapa-título herda inicio/fim/custo/progresso agregados dos filhos", () => {
    const orc = {
      etapas: [
        { id: "p1", nome: "Instalações (título)", parentId: "" },
        { id: "c1", nome: "Elétrica", parentId: "p1" },
        { id: "c2", nome: "Hidráulica", parentId: "p1" },
      ],
      itens: [
        { id: "i1", etapaId: "c1", tipo: "servico", quantidade: 10, precoUnit: 100 }, // 1000
        { id: "i2", etapaId: "c2", tipo: "servico", quantidade: 20, precoUnit: 50 },  // 1000
      ],
    };
    const plano = {
      tarefas: [
        { id: "tp1", etapaId: "p1", nome: "Tarefa", inicio: "", fim: "", progresso: 0 },
        { id: "tc1", etapaId: "c1", nome: "Tarefa", inicio: "2026-02-01", fim: "2026-02-10", progresso: 30 },
        { id: "tc2", etapaId: "c2", nome: "Tarefa", inicio: "2026-02-05", fim: "2026-02-20", progresso: 70 },
      ],
    };
    const tarefas = legacy.montarTarefas(plano, orc);
    const comRollup = legacy.aplicarRollup(tarefas, orc);
    const tp1 = comRollup.find(t => t.id === "tp1");
    expect(tp1).toMatchObject({
      inicio: "2026-02-01", fim: "2026-02-20",
      progresso: 50, titulo: true, custo: 2000, dias: 19,
    });
    // Filhas não são alteradas pelo rollup.
    const tc1 = comRollup.find(t => t.id === "tc1");
    expect(tc1.titulo).toBeUndefined();
  });
});

// ==============================================================
// Distribuição mensal / curva S / físico-financeiro
// ==============================================================
function tarefasFixtureC() {
  return [
    {
      id: "X", nome: "Fundação", titulo: false,
      inicio: "2026-08-24", fim: "2026-08-28", // seg a sex, mesma semana ISO
      custo: 1000, custoReal: 900, progresso: 100,
    },
    {
      id: "Y", nome: "Estrutura", titulo: false,
      inicio: "2026-08-31", fim: "2026-09-04", // seg a sex, cruza virada de mês (mesma semana ISO)
      custo: 1200, custoReal: 600, progresso: 50,
    },
  ];
}
const calSegSex = { diasSemana: [1, 2, 3, 4, 5] };

describe("distribuicaoMensal / fisicoFinanceiroMensal / curvaS / fisicoFinanceiro", () => {
  it("distribuicaoMensal rateia o custo pelos dias úteis e acumula por mês de competência", () => {
    const dist = legacy.distribuicaoMensal(tarefasFixtureC(), calSegSex);
    expect(dist).toEqual([
      { mes: "2026-08", valor: 1240, acumulado: 1240 },
      { mes: "2026-09", valor: 960, acumulado: 2200 },
    ]);
  });

  it("fisicoFinanceiroMensal (modo previsto) monta a matriz etapa x mês", () => {
    const matriz = legacy.fisicoFinanceiroMensal(tarefasFixtureC(), calSegSex);
    expect(matriz.meses).toEqual(["2026-08", "2026-09"]);
    expect(matriz.totalPorMes).toEqual({ "2026-08": 1240, "2026-09": 960 });
    expect(matriz.totalGeral).toBe(2200);
  });

  it("fisicoFinanceiroMensal (modo realizado) usa custoReal e, na ausência de datas reais, cai para as datas planejadas", () => {
    const matriz = legacy.fisicoFinanceiroMensal(tarefasFixtureC(), calSegSex, { realizado: true });
    // custoReal (900 e 600) substitui o custo previsto; como não há inicioReal/fimReal,
    // a distribuição ainda usa o período PLANEJADO (peculiaridade: "realizado" sem datas
    // reais registradas não deixa de ratear no calendário do plano).
    expect(matriz.totalPorMes).toEqual({ "2026-08": 1020, "2026-09": 480 });
    expect(matriz.totalGeral).toBe(1500);
  });

  it("curvaS agrupa por SEMANA (não por mês) e acumula percentual", () => {
    const curva = legacy.curvaS(tarefasFixtureC(), calSegSex);
    expect(curva.map(p => p.mes)).toEqual(["2026-08-24", "2026-08-31"]);
    expect(curva[0]).toMatchObject({ periodo: "semana", valor: 1000, acumulado: 1000 });
    expect(curva[0].pctAcum).toBeCloseTo(1000 / 2200 * 100, 6);
    expect(curva[1]).toMatchObject({ valor: 1200, acumulado: 2200 });
    expect(curva[1].pctAcum).toBeCloseTo(100, 6);
  });

  it("fisicoFinanceiro usa o custo REAL lançado quando >0; senão estimaria pelo progresso", () => {
    const ff = legacy.fisicoFinanceiro(tarefasFixtureC());
    expect(ff.linhas.find(l => l.id === "X")).toMatchObject({ previsto: 1000, realizado: 900, valorAgregado: 1000, desvio: 100 });
    expect(ff.linhas.find(l => l.id === "Y")).toMatchObject({ previsto: 1200, realizado: 600, valorAgregado: 600, desvio: 0 });
    expect(ff.total.previsto).toBe(2200);
    expect(ff.total.realizado).toBe(1500);
    expect(ff.total.valorAgregado).toBe(1600);
    expect(ff.total.desvio).toBe(100);
    expect(ff.total.pctFisico).toBeCloseTo(1600 / 2200 * 100, 6);
    expect(ff.total.cpi).toBeCloseTo(1600 / 1500, 6);
    expect(ff.total.previsaoFinal).toBeCloseTo(2062.5, 6);
  });

  it("fisicoFinanceiro exclui tarefas-título da lista de linhas", () => {
    const comTitulo = [...tarefasFixtureC(), { id: "T", titulo: true, custo: 999999, progresso: 0 }];
    const ff = legacy.fisicoFinanceiro(comTitulo);
    expect(ff.linhas.map(l => l.id)).toEqual(["X", "Y"]);
  });
});

// ==============================================================
// Caminho crítico (CPM)
// ==============================================================
describe("caminhoCritico", () => {
  it("calcula ES/EF/LS/LF e identifica a cadeia crítica; ramo paralelo não-crítico tem folga > 0", () => {
    const calTodosOsDias = { diasSemana: [0, 1, 2, 3, 4, 5, 6] };
    const tarefas = [
      { id: "a", inicio: "2026-01-01", fim: "2026-01-02", depende: [] },          // dur=2
      { id: "b", inicio: "2026-01-03", fim: "2026-01-05", depende: ["a"] },        // dur=3
      { id: "c", inicio: "2026-01-06", fim: "2026-01-06", depende: ["b"] },        // dur=1
      { id: "d", inicio: "2026-01-03", fim: "2026-01-03", depende: ["a"] },        // dur=1, ramo paralelo
    ];
    const cpm = legacy.caminhoCritico(tarefas, calTodosOsDias);
    expect(cpm.fimProjeto).toBe(6);
    expect(cpm.criticas.sort()).toEqual(["a", "b", "c"]);
    expect(cpm.folgas).toEqual({ a: 0, b: 0, c: 0, d: 3 });
  });

  it("tarefas-título ficam fora do cálculo do caminho crítico", () => {
    const calTodosOsDias = { diasSemana: [0, 1, 2, 3, 4, 5, 6] };
    const tarefas = [
      { id: "a", inicio: "2026-01-01", fim: "2026-01-02", depende: [] },
      { id: "titulo", titulo: true, inicio: "2026-01-01", fim: "2026-01-10", depende: [] },
    ];
    const cpm = legacy.caminhoCritico(tarefas, calTodosOsDias);
    expect(cpm.criticas).toEqual(["a"]);
  });
});

// ==============================================================
// Planejado x Realizado - comparativo com linha de base
// ==============================================================
describe("compararBaseline", () => {
  it("compara datas/custo atuais (ou reais) contra a baseline aprovada e resume atrasos/adiantamentos", () => {
    const plano = {
      baseline: [
        { tarefaId: "x1", inicio: "2026-01-05", fim: "2026-01-20", custo: 10000 },
        { tarefaId: "x2", inicio: "2026-01-05", fim: "2026-01-20", custo: 1000 }, // etapa-título: deve ser ignorada
        { tarefaId: "x3", inicio: "2026-02-01", fim: "2026-02-15", custo: 5000 },
      ],
    };
    const tarefas = [
      { id: "x1", nome: "Fundação", titulo: false, inicio: "2026-01-05", fim: "2026-01-25", custo: 12000, progresso: 100 },
      { id: "x2", nome: "Título", titulo: true, inicio: "2026-01-05", fim: "2026-01-20", custo: 1000, progresso: 100 },
      {
        id: "x3", nome: "Estrutura", titulo: false, custo: 4000, custoReal: 3500, progresso: 100,
        inicioReal: "2026-02-01", fimReal: "2026-02-10", // concluída 5 dias ANTES da baseline
      },
    ];
    const comp = legacy.compararBaseline(tarefas, plano);
    expect(comp.temBaseline).toBe(true);
    // x2 (etapa-título) não entra, mesmo tendo baseline própria.
    expect(comp.linhas.map(l => l.id)).toEqual(["x1", "x3"]);

    const l1 = comp.linhas.find(l => l.id === "x1");
    expect(l1).toMatchObject({ desvIni: 0, desvFim: 5, desvCusto: 2000, situacao: "atrasada" });

    // PECULIARIDADE/BUG: x3 terminou 5 dias ANTES da baseline (fim real 02-10 vs
    // baseline 02-15), mas diasCorridos() nunca devolve valor negativo (Math.max(0, ...)).
    // Como desvIni e desvFim vêm de diasCorridos, o desvio "adiantado" vira 0 em vez de
    // negativo, e a situação cai em "no-prazo" - o branch "adiantada" deste comparativo é,
    // na prática, inalcançável por essa via.
    const l3 = comp.linhas.find(l => l.id === "x3");
    expect(l3).toMatchObject({ desvIni: 0, desvFim: 0, situacao: "no-prazo", desvCusto: -1500 });

    expect(comp.resumo).toMatchObject({
      atrasadas: 1, adiantadas: 0, noPrazo: 1, semRealizado: 0,
      piorAtraso: 5, desvioCustoTotal: 500, custoBase: 15000, custoAtual: 15500,
    });
  });

  it("sem baseline cadastrada, devolve temBaseline=false", () => {
    expect(legacy.compararBaseline([], { baseline: [] })).toEqual({ temBaseline: false, linhas: [], resumo: null });
  });
});

// ==============================================================
// Desvio automático (planejado x avanço medido, sem depender de baseline)
// ==============================================================
describe("desvioAutomatico", () => {
  it("classifica cada tarefa (sem-datas / futura / atrasada / adiantada / no-prazo) e resume por custo", () => {
    const hoje = "2026-08-20";
    const tarefas = [
      { id: "semDatas", nome: "Sem datas", progresso: 0 },
      { id: "futura", nome: "Futura", inicio: "2026-09-01", fim: "2026-09-30", progresso: 0 },
      { id: "atrasoNaoIniciada", nome: "Não iniciada e já deveria ter começado", inicio: "2026-08-01", fim: "2026-08-20", progresso: 0 },
      { id: "concluidaAdiantada", nome: "Concluída adiantada", inicio: "2026-07-01", fim: "2026-07-31", fimReal: "2026-07-20", progresso: 100 },
      { id: "andamentoAdiantada", nome: "Em ritmo acima do previsto", inicio: "2026-08-01", fim: "2026-08-31", progresso: 80 },
      { id: "andamentoAtrasada", nome: "Em ritmo abaixo do previsto", inicio: "2026-08-01", fim: "2026-08-31", progresso: 20 },
    ];
    const resultado = legacy.desvioAutomatico(tarefas, hoje);

    expect(resultado.linhas.find(l => l.id === "semDatas")).toMatchObject({ situacao: "sem-datas", desvio: null });
    expect(resultado.linhas.find(l => l.id === "futura")).toMatchObject({ situacao: "futura", desvio: 0 });
    expect(resultado.linhas.find(l => l.id === "atrasoNaoIniciada")).toMatchObject({ situacao: "atrasada", desvio: 19 });

    // Ao contrário de compararBaseline, aqui o desvio vem de um helper com SINAL
    // (difDiasAssinada), então "adiantada" É alcançável.
    expect(resultado.linhas.find(l => l.id === "concluidaAdiantada")).toMatchObject({ situacao: "adiantada", desvio: -11, concluida: true });
    expect(resultado.linhas.find(l => l.id === "andamentoAdiantada")).toMatchObject({ situacao: "adiantada", desvio: -5 });
    expect(resultado.linhas.find(l => l.id === "andamentoAtrasada")).toMatchObject({ situacao: "atrasada", desvio: 14 });

    expect(resultado.resumo).toMatchObject({
      atrasadas: 2, adiantadas: 2, noPrazo: 0, concluidas: 1, futuras: 1, semDatas: 1,
      piorAtraso: 19, maiorAvanco: 11,
    });
    // Nenhuma tarefa tem custo>0 aqui: desvioObra cai para a MÉDIA SIMPLES dos
    // desvios medidos (não a ponderada por custo) - Math.round(17/4) = 4.
    expect(resultado.resumo.desvioObra).toBe(4);
  });
});

// ==============================================================
// Fusão de evolução (RDOs) nas tarefas do plano
// ==============================================================
describe("fundirEvolucao", () => {
  it("aplica o registro do RDO mais recente por timestamp, mas protege progresso com medição técnica aprovada", () => {
    const rdos = [
      { id: "rdo1", obraId: "obraX", data: "2026-08-10", servicos: [
        { tarefaId: "tA", progressoAte: 40, atualizadoEm: "2026-08-10T08:00:00.000Z" },
      ] },
      { id: "rdo2", obraId: "obraX", data: "2026-08-15", servicos: [
        { tarefaId: "tA", progressoAte: 60, atualizadoEm: "2026-08-15T08:00:00.000Z" },
        { tarefaId: "tB", progressoAte: 30, atualizadoEm: "2026-08-15T09:00:00.000Z" },
      ] },
      { id: "rdo3", obraId: "obraX", data: "2026-08-12", servicos: [
        { etapaId: "eD", progressoAte: 55, atualizadoEm: "2026-08-12T00:00:00.000Z" },
      ] },
    ];
    const tarefas = [
      { id: "tA", progressoOrigem: "manual" },
      { id: "tB", progressoOrigem: "manual", progresso: 99, progressoAtualizadoEm: "2026-08-20T00:00:00.000Z" },
      { id: "tC", progressoOrigem: "medicao_tecnica_aprovada", progresso: 75, ultimaMedicao: "2026-08-01" },
      { id: "tD", etapaId: "eD" },
    ];

    const fundidas = legacy.fundirEvolucao(tarefas, rdos, "obraX");

    const tA = fundidas.find(t => t.id === "tA");
    expect(tA).toMatchObject({ progresso: 60, diasTrabalhados: 2, ultimaMedicao: "2026-08-15", origemProgresso: "diario", rdoOrigemId: "rdo2" });

    // tB foi editado manualmente DEPOIS do último RDO (08-20 > 08-15): o valor
    // de progresso manual (99) é preservado...
    const tB = fundidas.find(t => t.id === "tB");
    expect(tB.progresso).toBe(99);
    expect(tB.origemProgresso).toBe("manual");
    // ...mas PECULIARIDADE: ultimaMedicao/diasTrabalhados são atualizados pelo
    // diário mesmo assim, porque só o número de progresso é protegido pela
    // comparação de timestamp - o "rastro" do diário sobrescreve o resto.
    expect(tB.ultimaMedicao).toBe("2026-08-15");
    expect(tB.diasTrabalhados).toBe(1);

    // tC tem origem "medicao_tecnica_aprovada": nenhum RDO consegue alterá-la,
    // mesmo sem nenhum RDO referenciando essa tarefa.
    const tC = fundidas.find(t => t.id === "tC");
    expect(tC).toMatchObject({ progresso: 75, origemProgresso: "medicao_tecnica_aprovada", ultimaMedicao: "2026-08-01" });

    // tD não tem RDO por tarefaId, mas o RDO3 referencia por etapaId (fallback).
    const tD = fundidas.find(t => t.id === "tD");
    expect(tD).toMatchObject({ progresso: 55, origemProgresso: "diario", ultimaMedicao: "2026-08-12" });
  });
});

// ==============================================================
// Sugestão de dependências / sucessoras
// ==============================================================
describe("sugerirDependenciasPlanejamento / idsSucessoras", () => {
  function orcamentoFixtureG() {
    return {
      etapas: [
        { id: "ea", nome: "Canteiro de obras", parentId: "" },
        { id: "eb", nome: "Fundacao", parentId: "" },
        { id: "ec", nome: "Estrutura", parentId: "" },
        { id: "ed", nome: "Alvenaria", parentId: "" },
        { id: "ee", nome: "Instalacao Predial", parentId: "" },
      ],
      itens: [
        { id: "i1", etapaId: "ea", tipo: "servico", quantidade: 1, precoUnit: 100 },
        { id: "i2", etapaId: "eb", tipo: "servico", quantidade: 1, precoUnit: 100 },
        { id: "i3", etapaId: "ec", tipo: "servico", quantidade: 1, precoUnit: 100 },
        { id: "i4", etapaId: "ed", tipo: "servico", quantidade: 1, precoUnit: 100 },
        { id: "i5", etapaId: "ee", tipo: "servico", quantidade: 1, precoUnit: 100 },
      ],
    };
  }
  // sugerirDependenciasPlanejamento classifica cada tarefa pelo NOME DA
  // TAREFA (t.nome), não pelo nome da etapa vinculada - por isso os nomes
  // abaixo replicam o nome da etapa (como faria montarTarefas em uso real).
  function tarefasFixtureG() {
    return [
      { id: "ta", etapaId: "ea", nome: "Canteiro de obras" },
      { id: "tb", etapaId: "eb", nome: "Fundacao" },
      { id: "tc", etapaId: "ec", nome: "Estrutura" },
      { id: "td", etapaId: "ed", nome: "Alvenaria" },
      { id: "te", etapaId: "ee", nome: "Instalacao Predial" },
    ];
  }

  it("modo paralelo aponta para os PRÉ-REQUISITOS TÉCNICOS de cada fase (podendo pular a tarefa imediatamente anterior)", () => {
    const orc = orcamentoFixtureG();
    const resultado = legacy.sugerirDependenciasPlanejamento(tarefasFixtureG(), orc, true);
    expect(resultado).toEqual({
      ta: [], tb: ["ta"], tc: ["tb"], td: ["tc"],
      te: ["td", "tc"], // instalações exige alvenaria E estrutura, não só a tarefa anterior
    });
  });

  it("modo sequencial ignora a matriz técnica e encadeia sempre na tarefa imediatamente anterior", () => {
    const orc = orcamentoFixtureG();
    const resultado = legacy.sugerirDependenciasPlanejamento(tarefasFixtureG(), orc, false);
    expect(resultado).toEqual({
      ta: [], tb: ["ta"], tc: ["tb"], td: ["tc"], te: ["td"],
    });
  });

  it("idsSucessoras devolve as tarefas cujo campo depende inclui o id informado", () => {
    const tarefas = [
      { id: "a", depende: [] },
      { id: "b", depende: ["a"] },
      { id: "c", depende: ["a", "b"] },
      { id: "d", depende: ["b"] },
    ];
    expect(legacy.idsSucessoras(tarefas, "a")).toEqual(["b", "c"]);
    expect(legacy.idsSucessoras(tarefas, "b")).toEqual(["c", "d"]);
  });
});

// ==============================================================
// Montagem automática do cronograma (questionário de planejamento)
// ==============================================================
describe("montarCronogramaIA", () => {
  it("avisa quando etapas não são reconhecidas por nenhuma fase construtiva", () => {
    // PECULIARIDADE/BUG relevante: faseDaEtapa() não remove acentos antes de
    // comparar com a lista de termos (que é toda escrita sem acento). Boa
    // parte dos nomes-PADRÃO de etapa (ETAPAS_PADRAO, exportado pelo próprio
    // arquivo) tem acentuação correta em português e por isso NÃO bate com
    // termo nenhum (ex.: "instalação"/"elétrica" != "instalacao"/"eletrica"),
    // caindo em "outros" (peso genérico, sem prioridade de sequenciamento).
    const orc = {
      etapas: legacy.ETAPAS_PADRAO.map((nome, i) => ({ id: `e${i}`, nome, parentId: "" })),
      itens: legacy.ETAPAS_PADRAO.map((_, i) => ({ id: `i${i}`, etapaId: `e${i}`, tipo: "servico", quantidade: 1, precoUnit: 1000 })),
    };
    const resultado = legacy.montarCronogramaIA(orc, { inicio: "2026-01-05", prazoMeses: 6, diasSemana: 6, paralelo: "nao" }, {});

    const avisoSemFase = resultado.avisos.find(a => a.includes("sem fase reconhecida"));
    expect(avisoSemFase).toBeTruthy();
    expect(avisoSemFase).toContain("5 etapa(s) sem fase reconhecida");
    expect(avisoSemFase).toContain("SERVIÇOS PRELIMINARES");
    expect(avisoSemFase).toContain("INSTALAÇÕES HIDROSSANITÁRIAS");

    expect(resultado.tarefas).toHaveLength(legacy.ETAPAS_PADRAO.length);
    expect(resultado.resumo.nEtapas).toBe(legacy.ETAPAS_PADRAO.length);
  });

  it("sem etapas no orçamento, devolve aviso e nenhuma tarefa", () => {
    const resultado = legacy.montarCronogramaIA({ etapas: [], itens: [] }, {}, {});
    expect(resultado).toEqual({ tarefas: [], resumo: null, avisos: ["O orcamento nao tem etapas para planejar."] });
  });

  it("etapas-título não consomem prazo próprio: datas vêm do roll-up dos filhos", () => {
    const orc = {
      etapas: [
        { id: "p1", nome: "Fundacao", parentId: "" }, // fase reconhecida, é o pai
        { id: "c1", nome: "Sapata", parentId: "p1" },
        { id: "c2", nome: "Estrutura", parentId: "" },
      ],
      itens: [
        // p1 não tem item próprio de valor: é etapa-título (todo o custo está no filho c1)
        { id: "i1", etapaId: "c1", tipo: "servico", quantidade: 10, precoUnit: 100 },
        { id: "i2", etapaId: "c2", tipo: "servico", quantidade: 10, precoUnit: 100 },
      ],
    };
    const resultado = legacy.montarCronogramaIA(orc, { inicio: "2026-01-05", prazoMeses: 3, diasSemana: 6, paralelo: "nao" }, {});
    const tarefaP1 = resultado.tarefas.find(t => t.etapaId === "p1");
    const tarefaC1 = resultado.tarefas.find(t => t.etapaId === "c1");
    // Roll-up: a data da etapa-título coincide com a da sua única filha "real".
    expect(tarefaP1.inicio).toBe(tarefaC1.inicio);
    expect(tarefaP1.fim).toBe(tarefaC1.fim);
  });
});
