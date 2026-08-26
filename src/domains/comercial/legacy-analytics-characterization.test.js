// Testes de CARACTERIZAÇÃO das funções de analytics comercial (funil de
// vendas, NPS, ciclo de venda, indicação, ranking) que vivem hoje dentro do
// arquivo monolítico src/LegacyApp.jsx (aprox. linhas 19404-19600).
//
// Objetivo: descrever o comportamento ATUAL do código, peculiaridades e
// bugs latentes incluídos, para servir de rede de segurança antes de uma
// eventual extração/refatoração. NÃO valida "o que seria correto".
//
// Importar qualquer coisa de LegacyApp.jsx dispara a avaliação do módulo
// inteiro (~21 mil linhas), que por sua vez importa componentes de UI. Os
// mocks abaixo são cópia exata dos usados em src/LegacyApp.test.jsx, com o
// caminho ajustado para a posição deste arquivo (src/domains/comercial/).
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

let mod;

// Import único e reaproveitado por todos os testes do arquivo: reimportar em
// cada teste seria muito mais lento pois o módulo é grande (~21 mil linhas).
beforeAll(async () => {
  mod = await import("../../LegacyApp.jsx");
}, 60000);

// Formata uma data local como "YYYY-MM-DD", no mesmo formato ISO-sem-hora
// usado internamente pelo módulo (today(), comAddMes, diasCorridos etc.
// todos operam com "YYYY-MM-DDT00:00:00" local).
function isoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

describe("módulo carrega e expõe as funções de analytics comercial", () => {
  test("smoke: exports esperados existem", () => {
    expect(Array.isArray(mod.COM_ETAPAS)).toBe(true);
    expect(Array.isArray(mod.COM_JORNADA)).toBe(true);
    expect(Array.isArray(mod.COM_PERDAS)).toBe(true);
    expect(typeof mod.COM_ROUTE_SECTION).toBe("object");
    expect(typeof mod.COM_TEMPERATURA).toBe("object");
    expect(typeof mod.cicloMedioVenda).toBe("function");
    expect(typeof mod.comEtapaLabel).toBe("function");
    expect(typeof mod.comFaseDaEtapa).toBe("function");
    expect(typeof mod.conversaoPorFase).toBe("function");
    expect(typeof mod.momentosIndicacao).toBe("function");
    expect(typeof mod.npsResumo).toBe("function");
    expect(typeof mod.rankingIndicadores).toBe("function");
    expect(typeof mod.taxaIndicacao).toBe("function");
  }, 30000);
});

describe("COM_ETAPAS / COM_PERDAS / COM_JORNADA (constantes do funil)", () => {
  test("COM_ETAPAS tem 20 etapas, na ordem cadastrada, cada uma [id,label]", () => {
    expect(mod.COM_ETAPAS).toHaveLength(20);
    expect(mod.COM_ETAPAS[0]).toEqual(["novo", "Novo lead"]);
    expect(mod.COM_ETAPAS[mod.COM_ETAPAS.length - 1]).toEqual(["arquivado", "Arquivado"]);
    // "perdido" é a penúltima etapa, antes de "arquivado".
    expect(mod.COM_ETAPAS[mod.COM_ETAPAS.length - 2]).toEqual(["perdido", "Perdido"]);
  });

  test("COM_PERDAS lista os motivos de perda cadastrados, nesta ordem", () => {
    expect(mod.COM_PERDAS).toEqual([
      "Preço", "Prazo", "Falta de orçamento", "Desistência",
      "Contratação de concorrente", "Falta de retorno",
      "Serviço fora do escopo", "Condições de pagamento", "Outro",
    ]);
  });

  test("COM_JORNADA tem 6 fases cobrindo as 18 etapas 'vivas' (exclui perdido/arquivado)", () => {
    expect(mod.COM_JORNADA).toHaveLength(6);
    const idsFases = mod.COM_JORNADA.map(f => f.id);
    expect(idsFases).toEqual(["captura", "qualifica", "reuniao", "proposta", "contrato", "ganho"]);

    const todasEtapasDaJornada = mod.COM_JORNADA.flatMap(f => f.etapas);
    const etapasVivas = mod.COM_ETAPAS.map(([id]) => id).filter(id => id !== "perdido" && id !== "arquivado");
    // Toda etapa "viva" pertence a exatamente uma fase da jornada.
    expect(todasEtapasDaJornada.sort()).toEqual(etapasVivas.sort());
  });

  test("comFaseDaEtapa mapeia etapa granular -> id da fase", () => {
    expect(mod.comFaseDaEtapa("novo")).toBe("captura");
    expect(mod.comFaseDaEtapa("proposta_enviada")).toBe("proposta");
    expect(mod.comFaseDaEtapa("contratado")).toBe("ganho");
  });

  test("comFaseDaEtapa devolve null para etapa fora da jornada (perdido/arquivado/inexistente)", () => {
    // CARACTERIZAÇÃO: "perdido" e "arquivado" existem em COM_ETAPAS mas não
    // pertencem a nenhuma fase de COM_JORNADA, então a etapa terminal do
    // funil (perdido) não tem fase - comportamento atual, não corrigido aqui.
    expect(mod.comFaseDaEtapa("perdido")).toBeNull();
    expect(mod.comFaseDaEtapa("arquivado")).toBeNull();
    expect(mod.comFaseDaEtapa("etapa_que_nao_existe")).toBeNull();
  });

  test("comEtapaLabel traduz id -> rótulo em pt-BR, e devolve o próprio id se desconhecido", () => {
    expect(mod.comEtapaLabel("qualificacao")).toBe("Em qualificação");
    expect(mod.comEtapaLabel("contrato_assinado")).toBe("Contrato assinado");
    expect(mod.comEtapaLabel("etapa_fantasma")).toBe("etapa_fantasma");
  });

  test("COM_TEMPERATURA tem as 3 chaves de temperatura do lead", () => {
    expect(Object.keys(mod.COM_TEMPERATURA).sort()).toEqual(["frio", "morno", "quente"]);
  });

  test("COM_ROUTE_SECTION mapeia sub-rota do Comercial -> seção de navegação", () => {
    expect(mod.COM_ROUTE_SECTION).toEqual({
      com_funil: "crm", com_leads: "crm",
      com_propostas: "proposals", com_negociacoes: "proposals",
      com_metas: "commissions",
    });
  });
});

describe("rankingIndicadores", () => {
  test("agrupa por indicador (cliente cadastrado ou nome livre), soma ganhos/perdidos/em aberto e valor gerado", () => {
    const clientes = [
      { id: "cli-1", nome: "Marcos Andrade" },
      { id: "cli-2", nome: "Fernanda Lima" },
    ];
    const leads = [
      // 3 indicados por cli-1: 1 ganho, 1 perdido, 1 em aberto
      { id: "lead-1", indicadoPorClienteId: "cli-1", etapa: "proposta_enviada" },
      { id: "lead-2", indicadoPorClienteId: "cli-1", etapa: "perdido", status: "perdido" },
      { id: "lead-3", indicadoPorClienteId: "cli-1", etapa: "negociacao" },
      // 2 indicados por nome livre "Zeca Pagodinho" (sem cliente cadastrado)
      { id: "lead-4", indicadoPorNome: "Zeca Pagodinho", etapa: "reuniao_agendada" },
      { id: "lead-5", indicadoPorNome: "Zeca Pagodinho", etapa: "contratado" },
      // lead sem nenhuma indicação: não deve aparecer no ranking
      { id: "lead-6", etapa: "novo" },
    ];
    const vendas = [
      { leadId: "lead-1", valor: 150000 },
      { leadId: "lead-5", valor: 90000 },
    ];
    const com = { leads, vendas, clientes };

    const ranking = mod.rankingIndicadores(com);

    expect(ranking).toHaveLength(2);
    // Ordenado por valorGerado desc: cli-1 (150000) antes de Zeca (90000).
    const [primeiro, segundo] = ranking;
    expect(primeiro.nome).toBe("Marcos Andrade");
    expect(primeiro.clienteId).toBe("cli-1");
    expect(primeiro.total).toBe(3);
    expect(primeiro.ganhos).toBe(1);
    expect(primeiro.perdidos).toBe(1);
    expect(primeiro.emAberto).toBe(1);
    expect(primeiro.valorGerado).toBe(150000);
    expect(primeiro.conversao).toBeCloseTo((1 / 3) * 100, 6);

    expect(segundo.nome).toBe("Zeca Pagodinho");
    expect(segundo.clienteId).toBe("");
    expect(segundo.total).toBe(2);
    expect(segundo.ganhos).toBe(1);
    expect(segundo.emAberto).toBe(1);
    expect(segundo.valorGerado).toBe(90000);
  });

  test("indicador cadastrado sem nome no cadastro de clientes cai no fallback 'Cliente'", () => {
    const com = {
      leads: [{ id: "lead-1", indicadoPorClienteId: "cli-fantasma", etapa: "novo" }],
      vendas: [],
      clientes: [], // cliente não encontrado
    };
    const ranking = mod.rankingIndicadores(com);
    expect(ranking[0].nome).toBe("Cliente");
  });

  test("com/leads/vendas/clientes ausentes não quebra (default para arrays vazios)", () => {
    expect(mod.rankingIndicadores({})).toEqual([]);
    expect(mod.rankingIndicadores(undefined)).toEqual([]);
  });

  test("venda sem indicação (leadId não bate com nenhum lead indicado) não afeta ranking", () => {
    const com = {
      leads: [{ id: "lead-1", indicadoPorClienteId: "cli-1", etapa: "novo" }],
      vendas: [{ leadId: "lead-fora-do-ranking", valor: 500000 }],
      clientes: [{ id: "cli-1", nome: "Cliente A" }],
    };
    const ranking = mod.rankingIndicadores(com);
    expect(ranking[0].ganhos).toBe(0);
    expect(ranking[0].valorGerado).toBe(0);
    expect(ranking[0].emAberto).toBe(1);
  });
});

describe("taxaIndicacao", () => {
  test("calcula indicações por obra entregue e % de clientes que já indicaram", () => {
    const obras = [
      { id: "o1", status: "done" }, { id: "o2", status: "done" },
      { id: "o3", status: "active" },
    ];
    const leads = [
      { id: "l1", indicadoPorClienteId: "cli-1" },
      { id: "l2", indicadoPorClienteId: "cli-1" }, // mesmo cliente indicou 2x
      { id: "l3", indicadoPorNome: "Fulano" },
      { id: "l4" }, // não é indicação
    ];
    const com = { leads, clientes: [{ id: "cli-1" }, { id: "cli-2" }, { id: "cli-3" }, { id: "cli-4" }] };

    const r = mod.taxaIndicacao(com, obras);

    expect(r.obrasEntregues).toBe(2);
    expect(r.indicacoes).toBe(3); // l1, l2, l3 (l4 não conta)
    expect(r.porObraEntregue).toBeCloseTo(3 / 2, 6);
    expect(r.clientesQueIndicaram).toBe(1); // só cli-1 indicou (por clienteId cadastrado)
    expect(r.totalClientes).toBe(4);
    expect(r.pctClientesAtivos).toBeCloseTo(25, 6);
  });

  test("zero obras entregues e zero clientes não quebra (divisão evitada, resultado 0)", () => {
    const r = mod.taxaIndicacao({ leads: [], clientes: [] }, []);
    expect(r.obrasEntregues).toBe(0);
    expect(r.porObraEntregue).toBe(0);
    expect(r.totalClientes).toBe(0);
    expect(r.pctClientesAtivos).toBe(0);
  });

  test("indicação por nome livre (sem clienteId) NÃO conta em clientesQueIndicaram", () => {
    // CARACTERIZAÇÃO: clientesQueIndicaram só olha indicadoPorClienteId; uma
    // indicação anotada só por nome livre entra em `indicacoes` mas não
    // move o contador de clientes ativos - assimetria do código atual.
    const com = { leads: [{ id: "l1", indicadoPorNome: "Alguém" }], clientes: [{ id: "cli-1" }] };
    const r = mod.taxaIndicacao(com, []);
    expect(r.indicacoes).toBe(1);
    expect(r.clientesQueIndicaram).toBe(0);
  });
});

describe("npsResumo", () => {
  test("classifica promotores (9-10) / neutros (7-8) / detratores (0-6) e calcula NPS e média", () => {
    const pesquisas = [
      { nota: 10, data: "2026-01-10" },
      { nota: 9, data: "2026-01-11" },
      { nota: 8, data: "2026-01-12" },
      { nota: 7, data: "2026-01-13" },
      { nota: 6, data: "2026-01-14" },
      { nota: 0, data: "2026-01-15" },
    ];
    const r = mod.npsResumo(pesquisas);
    expect(r.total).toBe(6);
    expect(r.promotores).toBe(2);
    expect(r.neutros).toBe(2);
    expect(r.detratores).toBe(2);
    expect(r.nps).toBeCloseTo(((2 - 2) / 6) * 100, 6); // 0
    expect(r.media).toBeCloseTo((10 + 9 + 8 + 7 + 6 + 0) / 6, 6);
  });

  test("pesquisa sem `data` é descartada mesmo com nota válida", () => {
    const pesquisas = [{ nota: 10, data: "2026-01-10" }, { nota: 5 /* sem data */ }];
    const r = mod.npsResumo(pesquisas);
    expect(r.total).toBe(1);
    expect(r.promotores).toBe(1);
  });

  test("pesquisas vazias/ausentes devolvem estrutura zerada com nps=null (não NaN)", () => {
    expect(mod.npsResumo([])).toEqual({ total: 0, promotores: 0, neutros: 0, detratores: 0, nps: null, media: 0 });
    expect(mod.npsResumo(undefined)).toEqual({ total: 0, promotores: 0, neutros: 0, detratores: 0, nps: null, media: 0 });
  });

  test("nota negativa é descartada pelo filtro (Number(p.nota) >= 0)", () => {
    const r = mod.npsResumo([{ nota: -1, data: "2026-01-01" }, { nota: 9, data: "2026-01-02" }]);
    expect(r.total).toBe(1);
    expect(r.promotores).toBe(1);
  });

  test("nota gravada como string numérica soma corretamente (corrigido em 26/08/2026)", () => {
    // Achado de 25/08/2026: a soma usada na média não tinha Number(), então
    // uma nota vinda como string do formulário/planilha virava concatenação
    // ("0"+"9" -> "09") em vez de soma aritmética. Corrigido na Onda 5 do
    // raio-X - este teste agora prova a média real, não mais a distorcida.
    const r = mod.npsResumo([
      { nota: "9", data: "2026-01-01" },
      { nota: "8", data: "2026-01-02" },
    ]);
    expect(r.media).toBeCloseTo(8.5, 6);
  });
});

describe("conversaoPorFase", () => {
  test("conta quantos leads alcançaram cada fase (etapa atual >= etapa da fase) e a perda entre fases", () => {
    const leads = [
      { id: "l1", etapa: "novo" },                 // fase 0 (captura)
      { id: "l2", etapa: "qualificacao" },         // fase 1 (qualifica)
      { id: "l3", etapa: "reuniao_realizada" },    // fase 2 (reuniao)
      { id: "l4", etapa: "proposta_enviada" },     // fase 3 (proposta)
      { id: "l5", etapa: "contrato_assinado" },    // fase 4 (contrato)
      { id: "l6", etapa: "contratado" },           // fase 5 (ganho)
    ];
    const linhas = mod.conversaoPorFase(leads);
    expect(linhas).toHaveLength(6);
    // "alcancaram" é cumulativo: cada lead conta em toda fase <= a sua.
    expect(linhas[0].alcancaram).toBe(6); // todos passaram por captura
    expect(linhas[1].alcancaram).toBe(5); // l1 ficou em captura, não chegou a qualifica
    expect(linhas[5].alcancaram).toBe(1); // só l6 chegou em "ganho"
    // Na fase 0, `ant` é a própria linhas[0].alcancaram (ver teste específico
    // abaixo sobre essa peculiaridade) - aqui todos os 6 leads chegaram na
    // fase 0, então taxaDaAnterior é 100%.
    expect(linhas[0].taxaDaAnterior).toBe(100);
  });

  test("CARACTERIZAÇÃO: primeira fase sempre tem taxaDaAnterior=100% mesmo sem perda real (ant é a própria fase 0)", () => {
    const leads = [{ id: "l1", etapa: "contratado" }];
    const linhas = mod.conversaoPorFase(leads);
    // ant = linhas[0].alcancaram quando i=0, ou seja, compara a fase consigo
    // mesma -> taxaDaAnterior da fase 0 é sempre 100 (ou 0 se ninguém chegou),
    // nunca reflete perda real "antes" da primeira fase.
    expect(linhas[0].taxaDaAnterior).toBe(100);
    expect(linhas[0].perdaNaFase).toBe(0);
  });

  test("lead perdido usa etapaMaxima (maior etapa já alcançada) para contar nas fases anteriores", () => {
    const leads = [
      { id: "l1", etapa: "perdido", etapaMaxima: "proposta_enviada" },
    ];
    const linhas = mod.conversaoPorFase(leads);
    const porId = Object.fromEntries(linhas.map(l => [l.id, l]));
    expect(porId.captura.alcancaram).toBe(1);
    expect(porId.proposta.alcancaram).toBe(1);
    expect(porId.contrato.alcancaram).toBe(0); // não chegou lá antes de perder
  });

  test("CARACTERIZAÇÃO: lead perdido/arquivado SEM etapaMaxima não conta em NENHUMA fase, nem 'captura'", () => {
    // base cai para l.etapa ("perdido"), que não existe em nenhuma fase da
    // jornada -> oi fica undefined -> o lead desaparece do funil inteiro,
    // mesmo tendo existido e (presumivelmente) passado pela captura.
    const leads = [{ id: "l1", etapa: "perdido" /* sem etapaMaxima */ }];
    const linhas = mod.conversaoPorFase(leads);
    expect(linhas.every(l => l.alcancaram === 0)).toBe(true);
  });

  test("leads/undefined vazio devolve as 6 fases zeradas", () => {
    const linhas = mod.conversaoPorFase(undefined);
    expect(linhas).toHaveLength(6);
    expect(linhas.every(l => l.alcancaram === 0)).toBe(true);
  });
});

describe("cicloMedioVenda", () => {
  test("calcula dias entre createdAt do lead e fechadaEm da venda: média, mínimo, máximo e mediana", () => {
    const leads = [
      { id: "l1", createdAt: "2026-01-01T10:00:00.000Z" },
      { id: "l2", createdAt: "2026-01-01T10:00:00.000Z" },
      { id: "l3", createdAt: "2026-01-01T10:00:00.000Z" },
    ];
    const vendas = [
      { leadId: "l1", fechadaEm: "2026-01-11T10:00:00.000Z" }, // 10 dias
      { leadId: "l2", fechadaEm: "2026-01-21T10:00:00.000Z" }, // 20 dias
      { leadId: "l3", fechadaEm: "2026-01-31T10:00:00.000Z" }, // 30 dias
    ];
    const r = mod.cicloMedioVenda({ leads, vendas });
    expect(r.n).toBe(3);
    expect(r.medio).toBeCloseTo(20, 6);
    expect(r.minimo).toBe(10);
    expect(r.maximo).toBe(30);
    expect(r.mediana).toBe(20);
  });

  test("venda sem lead correspondente, sem createdAt ou sem fechadaEm é ignorada", () => {
    const leads = [{ id: "l1", createdAt: "2026-01-01T00:00:00.000Z" }, { id: "l2" /* sem createdAt */ }];
    const vendas = [
      { leadId: "l1", fechadaEm: "2026-01-11T00:00:00.000Z" }, // válida: 10 dias
      { leadId: "l2", fechadaEm: "2026-01-15T00:00:00.000Z" }, // lead sem createdAt: ignorada
      { leadId: "nao-existe", fechadaEm: "2026-01-20T00:00:00.000Z" }, // lead não existe: ignorada
      { leadId: "l1" /* sem fechadaEm */ }, // ignorada
    ];
    const r = mod.cicloMedioVenda({ leads, vendas });
    expect(r.n).toBe(1);
    expect(r.medio).toBe(10);
  });

  test("venda fechada ANTES da criação do lead (dia negativo) é descartada, não vira negativo na média", () => {
    const leads = [{ id: "l1", createdAt: "2026-01-10T00:00:00.000Z" }];
    const vendas = [{ leadId: "l1", fechadaEm: "2026-01-05T00:00:00.000Z" }]; // -5 dias
    const r = mod.cicloMedioVenda({ leads, vendas });
    expect(r.n).toBe(0);
    expect(r.medio).toBe(0);
  });

  test("sem vendas/leads devolve estrutura zerada", () => {
    expect(mod.cicloMedioVenda({})).toEqual({ n: 0, medio: 0, minimo: 0, maximo: 0, mediana: 0 });
    expect(mod.cicloMedioVenda(undefined)).toEqual({ n: 0, medio: 0, minimo: 0, maximo: 0, mediana: 0 });
  });
});

describe("momentosIndicacao", () => {
  test("obra entregue sem pesquisa de satisfação gera ação 'nps'", () => {
    const data = {
      obras: [{ id: "o1", name: "Residência Alfa", status: "done", cliente: "Cliente Alfa" }],
      comercial: { clientes: [], pesquisas: [] },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ tipo: "nps", obraId: "o1", obraNome: "Residência Alfa" });
  });

  test("promotor (nota>=9) que ainda não foi convidado a indicar gera ação 'pedir'", () => {
    const data = {
      obras: [{ id: "o1", name: "Residência Alfa", status: "done", cliente: "Cliente Alfa" }],
      comercial: {
        clientes: [{ id: "cli-1", nome: "Cliente Alfa", obraId: "o1" }],
        pesquisas: [{ obraId: "o1", nota: 10, pediuIndicacao: false }],
      },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ tipo: "pedir", obraId: "o1", clienteId: "cli-1", clienteNome: "Cliente Alfa" });
    expect(acoes[0].motivo).toContain("nota 10");
  });

  test("promotor que JÁ foi convidado a indicar não gera nenhuma ação", () => {
    const data = {
      obras: [{ id: "o1", name: "Residência Alfa", status: "done", cliente: "Cliente Alfa" }],
      comercial: {
        clientes: [],
        pesquisas: [{ obraId: "o1", nota: 9, pediuIndicacao: true }],
      },
    };
    expect(mod.momentosIndicacao(data)).toEqual([]);
  });

  test("detrator (nota<=6) gera ação 'recuperar'", () => {
    const data = {
      obras: [{ id: "o1", name: "Residência Beta", status: "done", cliente: "Cliente Beta" }],
      comercial: { clientes: [], pesquisas: [{ obraId: "o1", nota: 3, pediuIndicacao: false }] },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ tipo: "recuperar", obraId: "o1" });
    expect(acoes[0].motivo).toContain("nota 3");
  });

  test("nota neutra (7-8) não gera nem 'pedir' nem 'recuperar'", () => {
    const data = {
      obras: [{ id: "o1", name: "Residência Gama", status: "done", cliente: "Cliente Gama" }],
      comercial: { clientes: [], pesquisas: [{ obraId: "o1", nota: 7, pediuIndicacao: false }] },
    };
    expect(mod.momentosIndicacao(data)).toEqual([]);
  });

  test("obra ativa com progresso entre 60% e 100% do prazo gera ação 'marco'", () => {
    const hoje = new Date();
    // 100 dias decorridos de um prazo total de ~143 dias -> ~70%.
    const contractStart = isoLocal(addDays(hoje, -100));
    const contractEnd = isoLocal(addDays(hoje, 43));
    const data = {
      obras: [{ id: "o1", name: "Residência Delta", status: "active", cliente: "Cliente Delta", contractStart, contractEnd }],
      comercial: { clientes: [], pesquisas: [] },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ tipo: "marco", obraId: "o1" });
    expect(acoes[0].motivo).toMatch(/\d+% - fase de marco vis/);
  });

  test("obra ativa com progresso ainda baixo (<60%) não gera ação de marco", () => {
    const hoje = new Date();
    const contractStart = isoLocal(addDays(hoje, -10));
    const contractEnd = isoLocal(addDays(hoje, 90));
    const data = {
      obras: [{ id: "o1", name: "Residência Épsilon", status: "active", contractStart, contractEnd }],
      comercial: { clientes: [], pesquisas: [] },
    };
    expect(mod.momentosIndicacao(data)).toEqual([]);
  });

  test("uma obra entregue pode acumular MAIS DE UMA ação (ex.: sem pesquisa não é possível ser detrator, mas obra ativa some do bloco de pesquisa e pode somar com marco de outra obra)", () => {
    const hoje = new Date();
    const data = {
      obras: [
        { id: "o1", name: "Obra Entregue", status: "done", cliente: "Cliente 1" }, // -> nps
        {
          id: "o2", name: "Obra Marco", status: "active", cliente: "Cliente 2",
          contractStart: isoLocal(addDays(hoje, -80)), contractEnd: isoLocal(addDays(hoje, 20)),
        }, // 80/100 = 80% -> marco
      ],
      comercial: { clientes: [], pesquisas: [] },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes.map(a => a.tipo).sort()).toEqual(["marco", "nps"]);
  });

  test("cliente é resolvido por obraId OU por nome da obra (cliente.nome === obra.cliente)", () => {
    const data = {
      obras: [{ id: "o1", name: "Casa X", status: "done", cliente: "João da Silva" }],
      comercial: {
        clientes: [{ id: "cli-9", nome: "João da Silva" }], // sem obraId, casa pelo nome
        pesquisas: [],
      },
    };
    const acoes = mod.momentosIndicacao(data);
    expect(acoes[0].clienteId).toBe("cli-9");
    expect(acoes[0].clienteNome).toBe("João da Silva");
  });

  test("sem obras/comercial não quebra e devolve lista vazia", () => {
    expect(mod.momentosIndicacao({})).toEqual([]);
    expect(mod.momentosIndicacao(undefined)).toEqual([]);
  });
});
