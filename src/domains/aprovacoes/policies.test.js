import { encontrarPoliticaAplicavel, congelarPolitica, validarPolitica } from "./policies";

describe("seleção de política aplicável", () => {
  const politicas = [
    { id: "p1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", condicoes: [], etapas: [] },
    { id: "p2", ativa: true, prioridade: 5, entidadeTipo: "solicitacaoCompra", condicoes: [{ campo: "valorTotal", operador: "maior", valor: 50000 }], etapas: [] },
    { id: "p3", ativa: false, prioridade: 10, entidadeTipo: "solicitacaoCompra", condicoes: [], etapas: [] },
  ];

  test("escolhe a de maior prioridade entre as que batem com o contexto", () => {
    const escolhida = encontrarPoliticaAplicavel(politicas, "solicitacaoCompra", { valorTotal: 60000 });
    expect(escolhida.id).toBe("p2");
  });

  test("ignora política inativa mesmo com prioridade maior", () => {
    const escolhida = encontrarPoliticaAplicavel(politicas, "solicitacaoCompra", { valorTotal: 999999 });
    expect(escolhida.id).toBe("p2"); // p3 tem prioridade 10 mas está inativa
  });

  test("cai na política genérica quando a condicionada não bate", () => {
    const escolhida = encontrarPoliticaAplicavel(politicas, "solicitacaoCompra", { valorTotal: 100 });
    expect(escolhida.id).toBe("p1");
  });

  test("respeita vigência", () => {
    const comVigencia = [{ id: "v1", ativa: true, prioridade: 1, entidadeTipo: "solicitacaoCompra", condicoes: [], etapas: [], vigenciaInicio: "2030-01-01" }];
    expect(encontrarPoliticaAplicavel(comVigencia, "solicitacaoCompra", {}, "2026-01-01")).toBeNull();
  });

  test("não aplica política de outro tipo de entidade", () => {
    const escolhida = encontrarPoliticaAplicavel(politicas, "pedido", { valorTotal: 100 });
    expect(escolhida).toBeNull();
  });
});

describe("congelarPolitica gera uma cópia independente (snapshot)", () => {
  test("mudar o objeto original não afeta o snapshot", () => {
    const politica = { id: "p1", nome: "Original", etapas: [{ id: "e1", nome: "Etapa 1" }] };
    const snap = congelarPolitica(politica);
    politica.nome = "Mudou";
    politica.etapas[0].nome = "Mudou também";
    expect(snap.nome).toBe("Original");
    expect(snap.etapas[0].nome).toBe("Etapa 1");
  });
});

describe("validação de política (§18)", () => {
  test("política sem nome é erro bloqueante", () => {
    const r = validarPolitica({ nome: "", etapas: [] });
    expect(r.valida).toBe(false);
    expect(r.erros.some(e => e.includes("nome"))).toBe(true);
  });

  test("vigência final antes da inicial é erro", () => {
    const r = validarPolitica({ nome: "X", vigenciaInicio: "2026-06-01", vigenciaFim: "2026-01-01", etapas: [] });
    expect(r.erros.some(e => e.includes("vigência"))).toBe(true);
  });

  test("etapa sem tipoAprovador é erro", () => {
    const r = validarPolitica({ nome: "X", etapas: [{ nome: "Etapa 1" }] });
    expect(r.erros.some(e => e.includes("tipo de aprovador"))).toBe(true);
  });

  test("quantidade mínima maior que aprovadores configurados é erro", () => {
    const r = validarPolitica({
      nome: "X",
      etapas: [{ nome: "Comitê", tipoAprovador: "usuario", referenciasAprovadores: ["u1", "u2"], modoQuorum: "minimo", quantidadeMinima: 3, semAprovadorAcao: "enviar_administrador" }],
    });
    expect(r.erros.some(e => e.includes("mínima"))).toBe(true);
  });

  test("política onde toda etapa sem aprovador bloqueia é erro (travaria toda compra)", () => {
    const r = validarPolitica({
      nome: "X",
      etapas: [{ nome: "Etapa 1", tipoAprovador: "grupo", referenciasAprovadores: [], semAprovadorAcao: "bloquear" }],
    });
    expect(r.erros.some(e => e.includes("travaria"))).toBe(true);
  });

  test("política bem formada não gera erros", () => {
    const r = validarPolitica({
      nome: "Política padrão", vigenciaInicio: "2026-01-01",
      etapas: [{ nome: "Aprovação", tipoAprovador: "administrador", modoQuorum: "qualquer", semAprovadorAcao: "enviar_administrador" }],
    });
    expect(r.erros).toHaveLength(0);
    expect(r.valida).toBe(true);
  });

  test("duas políticas com mesmas condições e prioridade geram alerta de conflito", () => {
    const existentes = [{ id: "outra", entidadeTipo: "solicitacaoCompra", ativa: true, prioridade: 5, condicoes: [{ campo: "valorTotal", operador: "maior", valor: 1000 }] }];
    const r = validarPolitica(
      { id: "nova", nome: "Nova", entidadeTipo: "solicitacaoCompra", prioridade: 5, condicoes: [{ campo: "valorTotal", operador: "maior", valor: 1000 }], etapas: [] },
      { politicasExistentes: existentes }
    );
    expect(r.alertas.some(a => a.includes("mesmas condições"))).toBe(true);
  });
});
