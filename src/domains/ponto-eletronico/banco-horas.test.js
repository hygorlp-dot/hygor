// @vitest-environment node
import { describe, expect, it } from "vitest";
import { construirBancoHoras, formatarSaldoMinutos, resumirLinhasBancoHoras, validarPeriodoBancoHoras } from "./banco-horas.js";

const DIA = "2026-10-05";
const employee = { id: "e1", name: "Ana", role: "Pedreira", obra: "o1", workdayHours: 8 };
const batida = (id, hora, { data = DIA, obraId = "o1", employeeId = "e1", ...extras } = {}) => ({
  id, eventId: id, employeeId, tipoRegistro: "ponto", obraId, obraCapturaId: obraId,
  marcadoEm: `${data}T${hora}:00-03:00`, horaConfiavel: true, relogioAlterado: false, metodo: "facial", ...extras,
});
const apropriacao = (id, inicio, fim, extras = {}) => ({
  id, employeeId: "e1", data: DIA, inicio: `${DIA}T${inicio}:00-03:00`, fim: `${DIA}T${fim}:00-03:00`,
  obraApropriadaId: "o1", status: "ativa", origem: "manual", ...extras,
});
const modelo = extras => construirBancoHoras({ employees: [employee], de: DIA, ate: DIA, cobertura: { completa: true }, ...extras });
const linha = extras => modelo(extras).linhas[0];
const codigos = dia => dia.pendencias.map(p => p.codigo);
const diaCompleto = extras => [batida("1", "07:00", extras), batida("2", "11:00", extras), batida("3", "12:00", extras), batida("4", "16:00", extras)];

describe("projeção do banco de horas do período", () => {
  it("compara apenas dias completos, desconta intervalos registrados e acumula créditos e débitos", () => {
    const r = modelo({ ate: "2026-10-07", marcacoes: [
      batida("1", "07:00"), batida("2", "11:00"), batida("3", "12:00"), batida("4", "17:30"),
      batida("5", "07:00", { data: "2026-10-06" }), batida("6", "14:30", { data: "2026-10-06" }),
    ] });
    expect(r.ok).toBe(true);
    expect(r.linhas[0]).toMatchObject({
      jornadaMinutos: 480, fonteJornada: "funcionario", saldoMinutos: 60, creditosMinutos: 90, debitosMinutos: 30,
      trabalhadosMinutos: 1020, previstosMinutos: 960, diasConsiderados: 2, diasPendentes: 0, diasSemRegistro: 1,
    });
    expect(r.linhas[0].dias[0]).toMatchObject({ trabalhadosMinutos: 570, intervaloMinutos: 60, saldoMinutos: 90, confianca: "estimado" });
    expect(r.linhas[0].evolucao.map(d => [d.saldoMinutos, d.acumuladoMinutos])).toEqual([[90, 90], [-30, 60], [null, 60]]);
    expect(r.resumo).toMatchObject({ funcionariosComSaldo: 1, diasComRegistro: 2, saldoMinutos: 60, previstosMinutos: 960 });
  });

  it("não inventa débito, calendário ou saldo inicial para dias sem registro", () => {
    const vazia = linha({ de: "2026-10-03", ate: "2026-10-05" });
    expect(vazia).toMatchObject({ saldoMinutos: null, previstosMinutos: 0, trabalhadosMinutos: 0, diasSemRegistro: 3, diasConsiderados: 0 });
    expect(vazia.dias.every(d => d.saldoMinutos === null && d.previstosMinutos === null && d.acumuladoMinutos === null)).toBe(true);
    const comRegistro = linha({ de: "2026-10-03", ate: "2026-10-05", marcacoes: diaCompleto() });
    expect(comRegistro.evolucao.map(d => d.acumuladoMinutos)).toEqual([null, null, 0]);
    expect(comRegistro.previstosMinutos).toBe(480);
  });

  it("exclui todo o dia com saída faltante, preservando as horas observadas para conferência", () => {
    const r = linha({ ate: "2026-10-06", marcacoes: [
      batida("1", "07:00"), batida("2", "11:00"), batida("3", "12:00"),
      ...diaCompleto({ data: "2026-10-06" }).map(b => ({ ...b, id: `${b.id}b`, eventId: `${b.eventId}b` })),
    ] });
    expect(r.dias[0]).toMatchObject({ situacao: "pendente", trabalhadosMinutos: 240, saldoMinutos: null, acumuladoMinutos: null });
    expect(codigos(r.dias[0])).toContain("sem_saida");
    expect(r).toMatchObject({ diasPendentes: 1, diasConsiderados: 1, saldoMinutos: 0, trabalhadosMinutos: 480, previstosMinutos: 480 });
  });

  it("reutiliza a transferência entre obras, que pode encerrar jornada com três batidas", () => {
    const r = linha({ marcacoes: [batida("1", "07:00"), batida("3", "17:00", { obraId: "o2" }), batida("2", "11:00", { obraId: "o2" })] });
    expect(r.dias[0]).toMatchObject({ situacao: "considerado", trabalhadosMinutos: 600, saldoMinutos: 120, confianca: "conferir" });
    expect(r.dias[0].obras).toEqual([{ obraId: "o2", minutos: 360 }, { obraId: "o1", minutos: 240 }]);
    expect(r.obrasIds.sort()).toEqual(["o1", "o2"]);
    expect(r.dias[0].alertas.map(a => a.codigo)).toContain("mudanca_obra");
  });

  it("não conta deslocamento quando saída e chegada em outra obra estão registradas", () => {
    const r = linha({ marcacoes: [batida("1", "07:00"), batida("2", "11:00"), batida("3", "11:30", { obraId: "o2" }), batida("4", "17:00", { obraId: "o2" })] });
    expect(r.dias[0]).toMatchObject({ trabalhadosMinutos: 570, intervaloMinutos: 30, saldoMinutos: 90 });
    expect(r.dias[0].alertas).toEqual([]);
  });

  it("prefere apropriações ativas tratadas, ignora canceladas e não soma batidas novamente", () => {
    const r = linha({ marcacoes: [batida("1", "07:00")], apropriacoes: [
      apropriacao("a1", "07:00", "11:00"),
      apropriacao("a2", "12:00", "16:30", { obraApropriadaId: "o2" }),
      apropriacao("cancelada", "16:30", "23:00", { status: "cancelada" }),
    ] });
    expect(r.dias[0]).toMatchObject({ origem: "apropriacao", situacao: "considerado", confianca: "tratado", trabalhadosMinutos: 510, intervaloMinutos: 60, saldoMinutos: 30 });
    expect(r.dias[0].pendencias).toEqual([]);
    expect(r.previstosMinutos).toBe(480);
    expect(r.dias[0].obras).toEqual([{ obraId: "o2", minutos: 270 }, { obraId: "o1", minutos: 240 }]);
  });

  it("mantém os sinais de hora e identificação como alertas, sem nova invalidação da batida", () => {
    const r = linha({ marcacoes: [batida("1", "07:00", { horaConfiavel: false }), batida("2", "15:00", { relogioAlterado: true, metodo: "encarregado" })] });
    expect(r.dias[0]).toMatchObject({ situacao: "considerado", saldoMinutos: 0, confianca: "conferir", pendencias: [] });
    expect(r.dias[0].alertas.map(a => a.codigo)).toEqual(["hora_nao_confirmada", "relogio_alterado", "identificacao_encarregado"]);
  });

  it("não duplica tempo em reenvio idêntico de um identificador", () => {
    const registros = diaCompleto();
    const r = modelo({ marcacoes: [...registros, { ...registros[1] }] });
    expect(r.linhas[0]).toMatchObject({ saldoMinutos: 0, trabalhadosMinutos: 480, diasConsiderados: 1 });
    expect(r.linhas[0].dias[0].batidas).toHaveLength(4);
    expect(r.cobertura.duplicatasIgnoradas).toBe(1);
    const a = apropriacao("a1", "07:00", "15:00");
    expect(linha({ apropriacoes: [a, { ...a }] })).toMatchObject({ saldoMinutos: 0, trabalhadosMinutos: 480 });
  });

  it("exclui batidas simultâneas distintas e identificadores conflitantes, sem adivinhar qual é correta", () => {
    const simultaneas = linha({ marcacoes: [batida("1", "07:00"), batida("2", "07:00"), batida("3", "15:00"), batida("4", "15:00")] });
    expect(simultaneas.saldoMinutos).toBeNull();
    expect(codigos(simultaneas.dias[0])).toContain("batidas_simultaneas");
    const conflito = linha({ ate: "2026-10-06", marcacoes: [
      batida("repetida", "07:00"), batida("saida1", "15:00"),
      batida("repetida", "07:00", { data: "2026-10-06" }), batida("saida2", "15:00", { data: "2026-10-06" }),
    ] });
    expect(conflito).toMatchObject({ saldoMinutos: null, diasPendentes: 2 });
    expect(conflito.dias.every(d => codigos(d).includes("identificador_conflitante"))).toBe(true);
  });

  it("exclui sobreposição de apropriações e aceita intervalos adjacentes", () => {
    const sobreposta = linha({ apropriacoes: [apropriacao("a1", "07:00", "12:00"), apropriacao("a2", "11:00", "16:00", { obraApropriadaId: "o2" })] });
    expect(sobreposta.saldoMinutos).toBeNull();
    expect(codigos(sobreposta.dias[0])).toContain("intervalos_sobrepostos");
    const adjacente = linha({ apropriacoes: [apropriacao("a1", "07:00", "11:00"), apropriacao("a2", "11:00", "15:00", { obraApropriadaId: "o2" })] });
    expect(adjacente).toMatchObject({ saldoMinutos: 0, trabalhadosMinutos: 480 });
  });

  it("não usa um snapshot misturado da mesma apropriação ativa e cancelada", () => {
    const a = apropriacao("a1", "07:00", "15:00");
    const r = linha({ apropriacoes: [a, { ...a, status: "cancelada", version: 2 }] });
    expect(r.saldoMinutos).toBeNull();
    expect(codigos(r.dias[0])).toContain("identificador_conflitante");
  });

  it("detecta sobreposição entre apropriações declaradas em dias diferentes", () => {
    const r = linha({ ate: "2026-10-06", apropriacoes: [
      apropriacao("a1", "22:00", "23:00", { fim: "2026-10-06T06:00:00-03:00" }),
      apropriacao("a2", "04:00", "12:00", { data: "2026-10-06", inicio: "2026-10-06T04:00:00-03:00", fim: "2026-10-06T12:00:00-03:00" }),
    ] });
    expect(r).toMatchObject({ diasPendentes: 2, diasConsiderados: 0, saldoMinutos: null });
  });

  it("usa a data tratada na jornada noturna e impede reaproveitar a saída na jornada seguinte", () => {
    const r = linha({ ate: "2026-10-06", apropriacoes: [apropriacao("a1", "22:00", "23:00", { fim: "2026-10-06T06:00:00-03:00" })], marcacoes: [
      batida("entrada", "22:00"), batida("saida", "06:00", { data: "2026-10-06" }), batida("outra", "14:00", { data: "2026-10-06" }),
    ] });
    expect(r.dias[0]).toMatchObject({ origem: "apropriacao", saldoMinutos: 0, trabalhadosMinutos: 480 });
    expect(r.dias[1].saldoMinutos).toBeNull();
    expect(codigos(r.dias[1])).toContain("batida_em_outra_jornada");
    expect(r).toMatchObject({ diasConsiderados: 1, diasPendentes: 1, trabalhadosMinutos: 480 });
    const semTratamento = linha({ ate: "2026-10-06", marcacoes: [batida("1", "22:00"), batida("2", "06:00", { data: "2026-10-06" })] });
    expect(semTratamento).toMatchObject({ diasPendentes: 2, saldoMinutos: null });
  });

  it("usa o contexto anterior para não interpretar saída noturna como entrada no início do período", () => {
    const marcacoes = [batida("saida_noturna", "06:00"), batida("nova_entrada", "14:00")];
    expect(linha({ marcacoes }).saldoMinutos).toBe(0); // Sem contexto, os dois instantes aparentam 8 h completas.
    const r = linha({ marcacoes, apropriacoes: [apropriacao("noturna", "22:00", "23:00", {
      data: "2026-10-04", inicio: "2026-10-04T22:00:00-03:00", fim: `${DIA}T06:00:00-03:00`,
    })] });
    expect(r).toMatchObject({ saldoMinutos: null, trabalhadosMinutos: 0, previstosMinutos: 0, diasComRegistro: 1, diasPendentes: 1 });
    expect(r.dias).toHaveLength(1);
    expect(codigos(r.dias[0])).toContain("batida_em_outra_jornada");
    expect(r.dias[0].pendencias.some(p => p.mensagem.includes("04/10/2026"))).toBe(true);
  });

  it("usa contexto posterior sem somá-lo, inclusive jornada atribuída ao dia da saída", () => {
    const noturna = apropriacao("noturna", "22:00", "23:00", {
      data: "2026-10-06", inicio: `${DIA}T22:00:00-03:00`, fim: "2026-10-06T06:00:00-03:00",
    });
    const borda = linha({ marcacoes: [batida("1", "14:00"), batida("2", "23:00")], apropriacoes: [noturna] });
    expect(borda).toMatchObject({ saldoMinutos: null, diasPendentes: 1, previstosMinutos: 0 });
    expect(codigos(borda.dias[0])).toContain("intervalos_sobrepostos");
    expect(linha({ de: "2026-10-06", ate: "2026-10-06", apropriacoes: [noturna] }))
      .toMatchObject({ saldoMinutos: 0, trabalhadosMinutos: 480, diasConsiderados: 1 });
  });

  it("não acrescenta funcionário, dia ou horas que só existem no contexto de apropriações", () => {
    const r = modelo({ employees: [], apropriacoes: [apropriacao("fora", "07:00", "15:00", {
      data: "2026-10-04", inicio: "2026-10-04T07:00:00-03:00", fim: "2026-10-04T15:00:00-03:00",
    })] });
    expect(r.linhas).toEqual([]);
    expect(r.resumo).toMatchObject({ saldoMinutos: null, funcionarios: 0, diasComRegistro: 0, trabalhadosMinutos: 0 });
  });

  it("agrupa pela data de Recife, ordena instantes reais e respeita os limites do período", () => {
    const r = linha({ employees: [{ ...employee, workdayHours: 2 }], marcacoes: [
      batida("fim", "23:30", { marcadoEm: "2026-10-06T02:30:00Z" }),
      batida("inicio", "21:30", { marcadoEm: "2026-10-06T00:30:00Z" }),
      batida("fora", "00:00", { marcadoEm: "2026-10-06T03:00:00Z" }),
      batida("antes", "23:59", { marcadoEm: "2026-10-05T02:59:59Z" }),
    ] });
    expect(r.dias[0]).toMatchObject({ data: DIA, trabalhadosMinutos: 120, saldoMinutos: 0 });
    expect(r.dias[0].batidas).toHaveLength(2);
    const offsets = linha({ marcacoes: [batida("b", "08:00", { marcadoEm: `${DIA}T14:00:00+03:00` }), batida("a", "07:00")] });
    expect(offsets.dias[0].trabalhadosMinutos).toBe(60);
  });

  it("usa jornada explícita do funcionário ou empresa, sem fallback oculto nem corrigir cadastro inválido", () => {
    expect(linha({ config: { payrollWorkdayHours: 6 }, marcacoes: diaCompleto() })).toMatchObject({ jornadaMinutos: 480, fonteJornada: "funcionario", saldoMinutos: 0 });
    expect(linha({ employees: [{ ...employee, workdayHours: null }], config: { payrollWorkdayHours: 7 }, marcacoes: diaCompleto() }))
      .toMatchObject({ jornadaMinutos: 420, fonteJornada: "empresa", saldoMinutos: 60 });
    for (const workdayHours of [null, 0, -1, 25, true, "inválido"]) {
      const r = linha({ employees: [{ ...employee, workdayHours }], marcacoes: diaCompleto() });
      expect(r).toMatchObject({ jornadaMinutos: null, saldoMinutos: null, diasPendentes: 1 });
      expect(codigos(r.dias[0])).toContain("jornada_ausente");
    }
    expect(linha({ employees: [{ ...employee, workdayHours: 0 }], config: { payrollWorkdayHours: 8 }, marcacoes: diaCompleto() }).saldoMinutos).toBeNull();
  });

  it("exige cobertura explícita completa antes de totalizar", () => {
    for (const cobertura of [undefined, { completa: false }]) {
      const r = modelo({ cobertura, marcacoes: diaCompleto() });
      expect(r.resumo).toMatchObject({ saldoMinutos: null, diasConsiderados: 0, diasPendentes: 1, previstosMinutos: 0 });
      expect(codigos(r.linhas[0].dias[0])).toContain("cobertura_incompleta");
      expect(r.avisos.map(a => a.codigo)).toContain("cobertura_incompleta");
    }
  });

  it("não oculta funcionário transferido ou fora do cadastro e exclui acessos de terceiros", () => {
    const r = modelo({ employees: [], config: { payrollWorkdayHours: 8 }, marcacoes: [
      ...diaCompleto({ employeeId: "desligado", obraId: "outra_obra" }),
      batida("terceiro", "07:00", { employeeId: "terceiro", tipoRegistro: "acesso_terceiro" }),
    ] });
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({ employeeId: "desligado", foraDoCadastro: true, saldoMinutos: 0, obrasIds: ["outra_obra"] });
  });

  it("mantém datas inválidas como pendência, sem depender do fuso da máquina nem lançar exceção", () => {
    for (const marcadoEm of ["inválido", "2026-02-30T07:00:00-03:00", "2026-10-05T07:00:00", "2026-10-05T24:00:00-03:00"]) {
      const r = linha({ marcacoes: [...diaCompleto(), batida("ruim", "07:00", { marcadoEm })] });
      expect(r.saldoMinutos).toBeNull();
      expect(r.pendencias.map(p => p.codigo)).toContain("data_invalida_batida");
    }
    const semId = modelo({ marcacoes: [...diaCompleto(), batida("ruim", "07:00", { employeeId: "" })] });
    expect(semId.cobertura.completa).toBe(false);
    expect(semId.resumo.saldoMinutos).toBeNull();
    const semDia = linha({ apropriacoes: [apropriacao("a1", "07:00", "15:00"), apropriacao("a2", "07:00", "15:00", { data: "2026-02-30" })] });
    expect(semDia.saldoMinutos).toBeNull();
    expect(codigos(semDia.dias[0])).toContain("data_invalida_apropriacao");
  });

  it.each([
    [{ fim: `${DIA}T07:00:00-03:00` }, "apropriacao_invalida"],
    [{ fim: "2026-10-06T08:00:00-03:00" }, "apropriacao_invalida"],
    [{ obraApropriadaId: "" }, "apropriacao_invalida"],
    [{ status: "rascunho" }, "apropriacao_nao_confirmada"],
    [{ inicio: "2026-10-03T07:00:00-03:00", fim: "2026-10-03T15:00:00-03:00" }, "data_apropriacao_divergente"],
  ])("não troca apropriação inconsistente por batidas que aparentam um dia válido: %o", (alteracao, codigo) => {
    const r = linha({ marcacoes: diaCompleto(), apropriacoes: [apropriacao("a1", "07:00", "15:00", alteracao)] });
    expect(r.saldoMinutos).toBeNull();
    expect(codigos(r.dias[0])).toContain(codigo);
  });

  it("resume a seleção da tela sem dividir jornada entre obras nem transportar saldo de outra pessoa", () => {
    const r = modelo({ employees: [employee, { ...employee, id: "e2", name: "Bruno" }], marcacoes: [
      batida("1", "07:00"), batida("2", "16:00"), batida("3", "07:00", { employeeId: "e2" }), batida("4", "14:00", { employeeId: "e2" }),
    ] });
    expect(r.resumo.saldoMinutos).toBe(0);
    expect(resumirLinhasBancoHoras(r.linhas.filter(l => l.employeeId === "e1"))).toMatchObject({ funcionarios: 1, saldoMinutos: 60, creditosMinutos: 60, debitosMinutos: 0 });
    expect(resumirLinhasBancoHoras([])).toMatchObject({ funcionarios: 0, saldoMinutos: null, diasConsiderados: 0 });
  });

  it("é puro e preserva precisão em minutos sem arredondamento de hora extra nem adicional financeiro", () => {
    const marcacoes = Object.freeze([Object.freeze(batida("1", "07:00")), Object.freeze(batida("2", "15:07"))]);
    const employees = Object.freeze([Object.freeze({ ...employee })]);
    const r = modelo({ employees, marcacoes, config: { payrollOvertimeAdditionalPercent: 100 } });
    expect(r.linhas[0]).toMatchObject({ saldoMinutos: 7, creditosMinutos: 7 });
    expect(marcacoes[0].marcadoEm).toBe(`${DIA}T07:00:00-03:00`);
  });
});

describe("período e formatação", () => {
  it("valida dias reais, ordem, ano bissexto e limite inclusivo de 62 dias", () => {
    expect(validarPeriodoBancoHoras("2026-10-01", "2026-12-01")).toMatchObject({ ok: true, totalDias: 62 });
    expect(validarPeriodoBancoHoras("2026-10-01", "2026-12-02")).toMatchObject({ ok: false });
    expect(validarPeriodoBancoHoras("2026-10-06", "2026-10-05").ok).toBe(false);
    expect(validarPeriodoBancoHoras("2026-02-30", "2026-03-01").ok).toBe(false);
    expect(validarPeriodoBancoHoras("2028-02-29", "2028-03-01").dias).toEqual(["2028-02-29", "2028-03-01"]);
    expect(modelo({ de: "", ate: "" })).toMatchObject({ ok: false, linhas: [], resumo: { saldoMinutos: null } });
  });

  it("distingue positivo, negativo, zero medido e ausência de saldo", () => {
    expect([90, -90, 0, null, undefined, NaN].map(formatarSaldoMinutos)).toEqual(["+1h30", "−1h30", "0h00", "—", "—", "—"]);
  });
});
