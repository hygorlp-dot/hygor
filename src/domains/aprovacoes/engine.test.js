import { createApprovalEngine } from "./engine";

// Resolvedores de teste: simulam a base de usuários/grupos sem depender do
// LegacyApp.jsx. Cada teste ajusta o que precisar via `grupos`/`usuariosPorId`.
const criarResolvedoresTeste = ({ grupos = {}, administrador = [] } = {}) => ({
  usuario: (ref) => (ref ? [{ id: ref, nome: ref }] : []),
  grupo: (ref) => grupos[ref] || [],
  administrador: () => administrador,
});

const dataBase = (extra = {}) => ({
  politicasAprovacao: [], instanciasAprovacao: [], decisoesAprovacao: [],
  delegacoesAprovacao: [], auditoriaAprovacao: [],
  ...extra,
});

describe("cenário 1 - aprovação desativada (empresa pequena, dois usuários)", () => {
  test("sem NENHUMA política cadastrada, aprova automaticamente e registra o motivo", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase();
    const { data: next, resumo } = engine.iniciarInstancia(data, {
      entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { valorTotal: 500 }, operador: { id: "u1", nome: "Ana" },
    });
    expect(resumo.status).toBe("aprovada");
    expect(next.auditoriaAprovacao[0].motivo).toMatch(/ausência de política/);
  });

  test("política ativa com ZERO etapas também aprova automaticamente", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({ politicasAprovacao: [{ id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", condicoes: [], etapas: [], versao: 1 }] });
    const { resumo } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    expect(resumo.status).toBe("aprovada");
  });
});

describe("cenário 2 - único aprovador", () => {
  test("uma etapa com um usuário específico conclui a instância ao ser aprovada", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [{ id: "e1", ordem: 1, nome: "Aprovação única", tipoAprovador: "usuario", referenciasAprovadores: ["u1"], modoQuorum: "qualquer" }],
      }],
    });
    const { data: iniciado, resumo: r1 } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    expect(r1.status).toBe("em_andamento");
    const instancia = iniciado.instanciasAprovacao[0];
    const { resumo: r2 } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "e1", aprovadorId: "u1", aprovadorNome: "Bruno", decisao: "aprovado", contexto: {} });
    expect(r2.status).toBe("aprovada");
  });
});

describe("cenário 3 - qualquer integrante de um grupo", () => {
  test("qualquer um dos 3 membros do grupo pode aprovar sozinho", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste({ grupos: { coordenadores: [{ id: "c1", nome: "C1" }, { id: "c2", nome: "C2" }, { id: "c3", nome: "C3" }] } }));
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [{ id: "e1", ordem: 1, nome: "Coordenação", tipoAprovador: "grupo", referenciasAprovadores: ["coordenadores"], modoQuorum: "qualquer" }],
      }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis).toHaveLength(3);
    const { resumo } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "e1", aprovadorId: "c2", aprovadorNome: "C2", decisao: "aprovado", contexto: {} });
    expect(resumo.status).toBe("aprovada");
  });
});

describe("cenário 4 - três alçadas por valor", () => {
  const politicas = [
    { id: "baixo", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [{ campo: "valorTotal", operador: "menor", valor: 5000 }], etapas: [] },
    { id: "medio", ativa: true, prioridade: 2, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [{ campo: "valorTotal", operador: "entre", valor: [5000, 50000] }], etapas: [{ id: "e1", ordem: 1, nome: "Coordenador", tipoAprovador: "usuario", referenciasAprovadores: ["coord"], modoQuorum: "qualquer" }] },
    { id: "alto", ativa: true, prioridade: 3, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [{ campo: "valorTotal", operador: "maior", valor: 50000 }], etapas: [{ id: "e1", ordem: 1, nome: "Diretor", tipoAprovador: "usuario", referenciasAprovadores: ["diretor"], modoQuorum: "qualquer" }] },
  ];

  test("valor baixo cai na política sem etapas (aprovação automática)", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const { resumo } = engine.iniciarInstancia(dataBase({ politicasAprovacao: politicas }), { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { valorTotal: 1000 } });
    expect(resumo.status).toBe("aprovada");
  });

  test("valor alto exige aprovação do diretor", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const { data: iniciado, resumo } = engine.iniciarInstancia(dataBase({ politicasAprovacao: politicas }), { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { valorTotal: 100000 } });
    expect(resumo.status).toBe("em_andamento");
    expect(iniciado.instanciasAprovacao[0].resultadosEtapas[0].aprovadoresElegiveis[0].id).toBe("diretor");
  });
});

describe("cenário 5 - aprovação paralela entre duas áreas", () => {
  test("Engenharia e Financeiro precisam aprovar, cada um na sua etapa, antes de concluir", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [
          { id: "eng", ordem: 1, nome: "Engenharia", tipoAprovador: "usuario", referenciasAprovadores: ["eng1"], modoQuorum: "qualquer" },
          { id: "fin", ordem: 1, nome: "Financeiro", tipoAprovador: "usuario", referenciasAprovadores: ["fin1"], modoQuorum: "qualquer" },
        ],
      }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    const instancia = iniciado.instanciasAprovacao[0];
    // As duas etapas ficam em_andamento AO MESMO TEMPO (paralelo)
    expect(instancia.resultadosEtapas[0].status).toBe("em_andamento");
    expect(instancia.resultadosEtapas[1].status).toBe("em_andamento");

    const { data: aposEng, resumo: r1 } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "eng", aprovadorId: "eng1", aprovadorNome: "Eng", decisao: "aprovado", contexto: {} });
    expect(r1.status).toBe("em_andamento");
    expect(r1.aguardandoParalela).toBe(true); // Financeiro ainda não decidiu

    const { resumo: r2 } = engine.registrarDecisao(aposEng, { instanciaId: instancia.id, etapaId: "fin", aprovadorId: "fin1", aprovadorNome: "Fin", decisao: "aprovado", contexto: {} });
    expect(r2.status).toBe("aprovada");
  });
});

describe("cenário 6 - aprovador em férias com substituto (delegação)", () => {
  test("delegação ativa troca o aprovador elegível pelo destinatário", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{ id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [], etapas: [{ id: "e1", ordem: 1, nome: "Aprovação", tipoAprovador: "usuario", referenciasAprovadores: ["u1"], modoQuorum: "qualquer" }] }],
      delegacoesAprovacao: [{ id: "d1", usuarioOrigemId: "u1", usuarioDestinoId: "u2", usuarioDestinoNome: "Substituta", inicio: "2026-01-01", fim: "2026-01-31", ativo: true }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {}, agora: "2026-01-10T00:00:00.000Z" });
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis[0].id).toBe("u2");
    const { resumo } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "e1", aprovadorId: "u1", aprovadorNome: "Original", decisao: "aprovado", contexto: {} });
    expect(resumo.ok).toBe(false); // u1 não é mais elegível (foi substituído)
  });
});

describe("cenário 7 - etapa vencida com escalonamento", () => {
  test("depois do prazo, o substituto é adicionado aos elegíveis sem remover o original", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{ id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [], etapas: [{ id: "e1", ordem: 1, nome: "Aprovação", tipoAprovador: "usuario", referenciasAprovadores: ["u1"], modoQuorum: "qualquer", prazoValor: 1, prazoUnidade: "horas", acaoNoVencimento: "escalonar", substitutos: ["u2"] }] }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {}, agora: "2026-01-10T10:00:00.000Z" });
    const { data: escalonado } = engine.aplicarEscalonamento(iniciado, { contexto: {}, agora: "2026-01-10T12:00:00.000Z" });
    const instancia = escalonado.instanciasAprovacao[0];
    const ids = instancia.resultadosEtapas[0].aprovadoresElegiveis.map(u => u.id);
    expect(ids).toEqual(expect.arrayContaining(["u1", "u2"]));
  });
});

describe("cenário 8 - grupo sem nenhum usuário ativo", () => {
  test("grupo vazio aplica a contingência configurada (enviar_administrador por padrão)", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste({ grupos: { vazio: [] }, administrador: [{ id: "admin1", nome: "Admin" }] }));
    const data = dataBase({
      politicasAprovacao: [{ id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [], etapas: [{ id: "e1", ordem: 1, nome: "Coordenação", tipoAprovador: "grupo", referenciasAprovadores: ["vazio"], modoQuorum: "qualquer" }] }],
    });
    const { data: iniciado, resumo } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    expect(resumo.status).toBe("em_andamento");
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].semAprovadorEncontrado).toBe(true);
    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis[0].id).toBe("admin1");
  });

  test("grupo vazio com semAprovadorAcao pular_etapa avança para a etapa seguinte", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste({ grupos: { vazio: [] } }));
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [
          { id: "e1", ordem: 1, nome: "Vazia", tipoAprovador: "grupo", referenciasAprovadores: ["vazio"], modoQuorum: "qualquer", semAprovadorAcao: "pular_etapa" },
          { id: "e2", ordem: 2, nome: "Final", tipoAprovador: "usuario", referenciasAprovadores: ["u1"], modoQuorum: "qualquer" },
        ],
      }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].status).toBe("pulada");
    expect(instancia.resultadosEtapas[1].status).toBe("em_andamento");
  });
});

describe("cenário 9 - regra sem correspondência", () => {
  test("nenhuma política bate com o contexto - comportamento padrão auto-aprova e destaca o motivo", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{ id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [{ campo: "obraId", operador: "igual", valor: "outra-obra" }], etapas: [{ id: "e1", ordem: 1, nome: "X", tipoAprovador: "usuario", referenciasAprovadores: ["u1"] }] }],
    });
    const { data: next, resumo } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { obraId: "o1" } });
    expect(resumo.status).toBe("aprovada");
    expect(resumo.semPolitica).toBe(true);
    expect(next.auditoriaAprovacao.at(-1).motivo).toMatch(/ausência de política/);
  });
});

describe("cenário 12/13 - autoaprovação", () => {
  const politicaComAuto = (autoaprovacao) => ({
    id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
    autoaprovacao,
    etapas: [{ id: "e1", ordem: 1, nome: "Aprovação", tipoAprovador: "usuario", referenciasAprovadores: ["solicitante"], modoQuorum: "qualquer" }],
  });

  test("autoaprovação permitida abaixo de determinado valor mantém o solicitante elegível e destaca", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({ politicasAprovacao: [politicaComAuto({ modo: "abaixo_valor", valorLimite: 1000 })] });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { valorTotal: 500, solicitanteId: "solicitante" } });
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis.map(u => u.id)).toContain("solicitante");
    expect(instancia.resultadosEtapas[0].autoaprovacaoDestacada).toBe(true);
  });

  test("autoaprovação proibida remove o solicitante e, se era o único elegível, aciona a contingência", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste({ administrador: [{ id: "admin1", nome: "Admin" }] }));
    const data = dataBase({ politicasAprovacao: [politicaComAuto({ modo: "proibida" })] });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: { valorTotal: 500, solicitanteId: "solicitante" } });
    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.resultadosEtapas[0].aprovadoresElegiveis.map(u => u.id)).not.toContain("solicitante");
    expect(instancia.resultadosEtapas[0].semAprovadorEncontrado).toBe(true); // caiu na fila administrativa
  });
});

describe("cenário 14 - versionamento: alterar a política não afeta processo em andamento", () => {
  test("mudar a política original depois de iniciada não muda o snapshot da instância", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const politica = { id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, nome: "V1", condicoes: [], etapas: [{ id: "e1", ordem: 1, nome: "Etapa V1", tipoAprovador: "usuario", referenciasAprovadores: ["u1"], modoQuorum: "qualquer" }] };
    const data = dataBase({ politicasAprovacao: [politica] });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });

    // "Administrador" edita a política depois que a instância já começou.
    politica.nome = "V2 - mudou depois";
    politica.etapas[0].nome = "Etapa renomeada";

    const instancia = iniciado.instanciasAprovacao[0];
    expect(instancia.snapshotPolitica.nome).toBe("V1");
    expect(instancia.snapshotPolitica.etapas[0].nome).toBe("Etapa V1");
  });
});

describe("cenário: reprovação encerra a instância imediatamente", () => {
  test("uma reprovação muda o status para reprovada mesmo com etapas paralelas pendentes", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [
          { id: "eng", ordem: 1, nome: "Engenharia", tipoAprovador: "usuario", referenciasAprovadores: ["eng1"], modoQuorum: "qualquer" },
          { id: "fin", ordem: 1, nome: "Financeiro", tipoAprovador: "usuario", referenciasAprovadores: ["fin1"], modoQuorum: "qualquer" },
        ],
      }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    const instancia = iniciado.instanciasAprovacao[0];
    const { resumo } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "eng", aprovadorId: "eng1", aprovadorNome: "Eng", decisao: "reprovado", justificativa: "Fora do orçamento", contexto: {} });
    expect(resumo.status).toBe("reprovada");
  });
});

describe("quórum mínimo (2 de 3)", () => {
  test("só conclui a etapa quando 2 aprovadores distintos aprovarem", () => {
    const engine = createApprovalEngine(criarResolvedoresTeste());
    const data = dataBase({
      politicasAprovacao: [{
        id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", versao: 1, condicoes: [],
        etapas: [{ id: "e1", ordem: 1, nome: "Comitê", tipoAprovador: "usuario", referenciasAprovadores: ["c1", "c2", "c3"], modoQuorum: "minimo", quantidadeMinima: 2 }],
      }],
    });
    const { data: iniciado } = engine.iniciarInstancia(data, { entidadeTipo: "solicitacaoCompra", entidadeId: "s1", contexto: {} });
    const instancia = iniciado.instanciasAprovacao[0];
    const { data: apos1, resumo: r1 } = engine.registrarDecisao(iniciado, { instanciaId: instancia.id, etapaId: "e1", aprovadorId: "c1", aprovadorNome: "C1", decisao: "aprovado", contexto: {} });
    expect(r1.status).toBe("em_andamento");
    expect(r1.aguardandoQuorum).toBe(true);
    const { resumo: r2 } = engine.registrarDecisao(apos1, { instanciaId: instancia.id, etapaId: "e1", aprovadorId: "c2", aprovadorNome: "C2", decisao: "aprovado", contexto: {} });
    expect(r2.status).toBe("aprovada");
  });
});
