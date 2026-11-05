// @vitest-environment node
import { describe, it, expect } from "vitest";
import { snapshotFixture, empregador, rep, opts, ESTAB, EMPRESA, DEVICE, CPF } from "./fixtures.test-helper.js";
import { sha256, crc16Kermit, dh, data } from "./campos.js";
import { gerarAfd, validarAfd, registroAfd } from "./afd.js";
import { gerarAej, validarAej } from "./aej.js";
import { auditarSnapshot } from "./auditoria.js";
import { exportarSnapshot, registrosAfdDoSnapshot, comprovanteHtml } from "./servico.js";
import { capturarSnapshotFiscal } from "./snapshot.js";
import { consultarDocumentosFiscais } from "./endpoint.js";
import { criarTratadorPonto } from "../handler.js";
import { tratamentoDoPontoExistente } from "./tratamento.js";
import { sourceSignature } from "../../../src/domains/ponto-eletronico/conferencia.js";

const freeze = o => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
const model = async () => { const s = await snapshotFixture(); return { s, afd: { empregador, rep, registros: registrosAfdDoSnapshot(s), ...opts }, aej: { ...s.config.tratamento, empregador, ...opts, originais: s.eventos.map(e => ({ eventId: e.event_id, employeeId: e.employee_id, cpf: e.cpf, marcadoEm: e.marcado_em_texto })) } }; };

describe("leiautes oficiais - bytes e referências", () => {
  it("confere vetor oficial CRC-16/KERMIT e fuso, sem alterar instante original", () => {
    expect(crc16Kermit("123456789")).toBe("2189");
    expect(dh("2026-11-05T02:59:57.123Z", "America/Recife")).toBe("2026-11-04T23:59:00-0300");
    expect(() => data("2026-02-30")).toThrow("DATA_INVALIDA");
    expect(() => data("2026-99-01")).toThrow("DATA_INVALIDA");
  });
  it("AFD 004 usa Latin-1, CRLF, posições, contadores e hash do leiaute distinto do fiscal interno", async () => {
    const { afd, s } = await model(), original = JSON.stringify(s);
    freeze(s);
    const out = gerarAfd(afd), lines = out.bytes.toString("latin1").split("\r\n");
    expect(lines[0]).toHaveLength(302); expect(lines[0].slice(250, 253)).toBe("004");
    expect(lines[0].slice(39, 189).trim()).toBe(empregador.nome);
    expect(out.bytes.includes(Buffer.from([0xc9]))).toBe(true);
    expect(lines[1]).toHaveLength(137);
    expect(lines[1].slice(10, 34)).toBe("2026-11-04T07:00:00-0300");
    expect(lines[1].slice(34, 46)).toBe(CPF + " ");
    expect(lines[1].slice(70, 73)).toBe("011");
    expect(lines[1].slice(73)).toBe(sha256(Buffer.from(lines[1].slice(0, 73), "latin1")));
    expect(lines[1].slice(73)).not.toBe(s.registros[0].fiscal_hash);
    expect(lines[2].slice(73)).toBe(sha256(Buffer.from(lines[2].slice(0, 73) + lines[1].slice(73), "latin1")));
    expect(validarAfd(out.bytes).ok).toBe(true);
    expect(out.status).toBe("rascunho_nao_assinado");
    expect(out.assinatura.verificada).toBe(false);
    expect(JSON.stringify(s)).toBe(original);
  });
  it("não confunde recebimento tardio com captura off-line; exige indicador explícito", async () => {
    const { afd } = await model();
    delete afd.registros[0].offline;
    expect(() => gerarAfd(afd)).toThrow("MODO_CAPTURA_AUSENTE");
    afd.registros[0].offline = false;
    expect(gerarAfd(afd).bytes.toString("latin1").split("\r\n")[1][72]).toBe("0");
  });
  it("não renumera NSRs nem reinicia a cadeia em um filtro temporal", async () => {
    const { afd } = await model();
    afd.registros[0].gravadoEm = "2026-11-03T20:00:00Z";
    const out = gerarAfd(afd);
    expect(out.bytes.toString("latin1").split("\r\n")[1].slice(0, 9).trim()).toBe("2");
    expect(validarAfd(out.bytes, { hashAnterior: out.hashAnteriorAoPeriodo }).ok).toBe(true);
    expect(validarAfd(out.bytes).ok).toBe(false);
    afd.registros.splice(1, 1);
    expect(() => gerarAfd(afd)).toThrow("CADEIA_NSR_INCOMPLETA");
  });
  it("detecta alterações posteriores nos bytes do AFD", async () => {
    const { afd } = await model(), out = gerarAfd(afd);
    const damaged = Buffer.from(out.bytes); damaged[302 + 2 + 15] = 57;
    expect(validarAfd(damaged).erros).toContain("HASH_AFD_INVALIDO");
    const badTrailer = out.bytes.toString("latin1").replace("4        9", "3        9");
    expect(validarAfd(Buffer.from(badTrailer, "latin1")).ok).toBe(false);
  });
  it("suporta registros administrativos sem atribuir NSR novo", () => {
    const tz = empregador.timezone;
    const rows = [
      { tipo: 2, nsr: 1, empregador, gravadoEm: opts.geradoEm, responsavelCpf: CPF, local: "LOCAL SINTÉTICO" },
      { tipo: 4, nsr: 2, antes: opts.geradoEm, depois: opts.geradoEm, responsavelCpf: CPF },
      { tipo: 5, nsr: 3, operacao: "I", gravadoEm: opts.geradoEm, cpf: CPF, nome: "TESTE", responsavelCpf: CPF },
      { tipo: 6, nsr: 4, evento: "08", gravadoEm: opts.geradoEm },
    ];
    expect(rows.map(r => registroAfd(r, tz).linha.length)).toEqual([331, 73, 118, 36]);
    expect(() => registroAfd({ ...rows[3], evento: "01" }, tz)).toThrow("EVENTO_SENSIVEL_INVALIDO");
  });
  it("não presume encadeamento de AFD misto onde falta histórico administrativo validado", async () => {
    const { afd } = await model();
    afd.registros.push({ tipo: 6, nsr: 5, evento: "07", gravadoEm: opts.geradoEm });
    expect(() => gerarAfd(afd)).toThrow("CADEIA_AFD_MISTA_REQUER_VALIDACAO");
  });
  it("rejeita INPI ausente, dados longos e caracteres não representáveis sem truncar", async () => {
    const { afd } = await model();
    expect(() => gerarAfd({ ...afd, rep: { ...rep, inpi: null } })).toThrow("INPI");
    expect(() => gerarAfd({ ...afd, empregador: { ...empregador, nome: "x".repeat(151) } })).toThrow("TAMANHO");
    expect(() => gerarAfd({ ...afd, empregador: { ...empregador, nome: "Teste 😀" } })).toThrow("CARACTERE");
  });
  it("AEJ 002 conserva todas as originais e referências a vínculo/REP/horário", async () => {
    const { aej } = await model(), out = gerarAej(freeze(aej)), lines = out.bytes.toString("latin1").split("\r\n");
    expect(lines[0]).toBe("01|1|11222333000181|||EMPRESA SINTÉTICA - SOMENTE TESTE LOCAL|2026-11-04|2026-11-04|2026-11-05T07:00:00-0300|002");
    expect(lines.find(l => l.startsWith("05|"))).toBe("05|1|2026-11-04T07:00:00-0300|1|E|001|O|H1|");
    expect(validarAej(out.bytes).ok).toBe(true);
    expect(out.contagens).toEqual([1, 1, 1, 1, 4, 0, 0, 1]);
  });
  it("AEJ exige justificativa e responsável para desconsiderar ou incluir; não apaga original", async () => {
    const { aej } = await model();
    aej.marcacoes[0].tipo = "D";
    expect(() => gerarAej(aej)).toThrow("TAMANHO_INVALIDO");
    aej.marcacoes[0].motivo = "Duplicidade conferida";
    expect(() => gerarAej(aej)).toThrow("TRATAMENTO_SEM_RESPONSAVEL");
    aej.marcacoes[0].responsavel = "rh-sintetico"; aej.marcacoes[0].tratadoEm = opts.geradoEm;
    aej.marcacoes.push({ vinculoId: 1, tipo: "E", par: 1, fonte: "I", marcadoEm: aej.marcacoes[0].marcadoEm, horarioCodigo: "H1", motivo: "Horário conferido", responsavel: "rh-sintetico", tratadoEm: opts.geradoEm });
    expect(gerarAej(aej).contagens[4]).toBe(5);
    aej.marcacoes.splice(0, 1);
    expect(() => gerarAej(aej)).toThrow("ORIGINAIS_OMITIDOS");
  });
  it("AEJ recusa fonte original alterada, referência inválida, jornada aberta e arquivo adulterado", async () => {
    const { aej } = await model();
    aej.marcacoes[0].marcadoEm = "2026-11-04T10:01:00Z";
    expect(() => gerarAej(aej)).toThrow("ORIGINAL_ALTERADO");
    aej.marcacoes[0].marcadoEm = aej.originais[0].marcadoEm;
    aej.marcacoes[0].horarioCodigo = "inexistente";
    expect(() => gerarAej(aej)).toThrow("PRIMEIRA_ENTRADA_SEM_HORARIO");
    aej.marcacoes[0].horarioCodigo = "H1";
    const out = gerarAej(aej);
    expect(validarAej(Buffer.from(out.bytes.toString("latin1").replace("99|1|1", "99|2|1"), "latin1")).ok).toBe(false);
    aej.marcacoes.pop(); aej.originais.pop();
    expect(() => gerarAej(aej)).toThrow("JORNADA_ABERTA");
  });
  it("não inventa faltas/DSR e só inclui banco de horas confirmado", async () => {
    const { aej } = await model();
    expect(gerarAej(aej).contagens[6]).toBe(0);
    aej.ausencias = [{ vinculoId: 1, tipo: 3, data: opts.de, minutos: 60, movimento: 1 }];
    expect(() => gerarAej(aej)).toThrow("AUSENCIA_SEM_CONFIRMACAO");
    Object.assign(aej.ausencias[0], { responsavel: "rh-sintetico", tratadoEm: opts.geradoEm });
    expect(gerarAej(aej).contagens[6]).toBe(1);
  });
  it("não substitui o CPF original por um cadastro atual divergente", async () => {
    const { aej } = await model();
    aej.vinculos[0].cpf = "12345678909";
    expect(() => gerarAej(aej)).toThrow("CPF_ORIGINAL_DIVERGE_DO_VINCULO");
  });
  it("exige matrículas eSocial distintas para múltiplos vínculos do mesmo CPF", async () => {
    const { aej } = await model();
    aej.vinculos.push({ ...aej.vinculos[0], id: 2 });
    expect(() => gerarAej(aej)).toThrow("TAMANHO_INVALIDO");
    aej.vinculos.forEach(v => { v.matriculaEsocial = "IGUAL"; });
    expect(() => gerarAej(aej)).toThrow("MATRICULA_ESOCIAL_DUPLICADA");
    aej.vinculos[1].matriculaEsocial = "OUTRA";
    expect(gerarAej(aej).contagens[5]).toBe(2);
  });
});

describe("integridade, segurança e preservação", () => {
  it("aprova cadeias válidas sem gravar em nenhum registro", async () => {
    const s = await snapshotFixture(), before = JSON.stringify(s);
    expect((await auditarSnapshot(freeze(s))).integridadeValida).toBe(true);
    await exportarSnapshot(s, { tipo: "afd", ...opts });
    await exportarSnapshot(s, { tipo: "aej", ...opts });
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each(["nsr", "evento", "localHash", "contador", "escopo", "colunaMaterial", "cadeiaLocal"])("detecta adulteração: %s", async change => {
    const s = await snapshotFixture();
    if (change === "nsr") s.registros[1].nsr = 1;
    if (change === "evento") s.eventos[0].payload.employeeId = "outro";
    if (change === "localHash") s.eventos[0].local_hash = "f".repeat(64);
    if (change === "contador") s.contador.ultimo_nsr++;
    if (change === "escopo") s.eventos[0].company_id = "outra-empresa";
    if (change === "colunaMaterial") s.eventos[0].cpf = "12345678909";
    if (change === "cadeiaLocal") s.eventos[1].local_previous_hash = "0".repeat(64);
    expect((await auditarSnapshot(s)).integridadeValida).toBe(false);
    await expect(exportarSnapshot(s, { tipo: "afd", ...opts })).rejects.toThrow("INTEGRIDADE_REPROVADA");
  });
  it("audita dados antigos sem fabricar indicador, NSR ou registro administrativo", async () => {
    const s = await snapshotFixture({ withMode: false });
    s.config = null; s.legados = [{ id: "legado" }];
    const r = await auditarSnapshot(s);
    expect(r.integridadeValida).toBe(true);
    expect(r.aptoParaGeracao.afd).toBe(false);
    expect(r.pendencias.map(p => p.codigo)).toContain("MODO_CAPTURA_NAO_REGISTRADO");
    expect(r.pendencias.map(p => p.codigo)).toContain("LEGADO_SEM_NSR_FISCAL_NAO_CONVERTER");
    expect(r.conforme).toBe(false);
  });
  it("comprovante é rascunho explícito, usa NSR real e escapa conteúdo HTML", async () => {
    const s = await snapshotFixture(); s.config = null; s.employees[0].name = '<img src=x onerror=alert(1)>';
    const result = await exportarSnapshot(s, { tipo: "comprovante", eventId: s.eventos[0].event_id, ...opts });
    const html = comprovanteHtml(result.comprovante);
    expect(html).toContain("Rascunho - não assinado");
    expect(html).toContain("&lt;img"); expect(html).not.toContain("<img src=x");
    expect(result.comprovante.fields.find(f => f[0] === "NSR")[1]).toBe("1");
    expect(result.comprovante.fields.find(f => f[0] === "Registro no INPI")[1]).toBe("Não informado");
    expect(result.comprovante.rastreabilidade.instanteOriginal).toContain(":17.123Z");
    expect(result.comprovante.fields.find(f => f[0] === "Data e hora da marcação")[1]).toContain(":17-0300");
  });
  it("comprovante com dados completos usa o mesmo hash AFD, nunca o hash fiscal interno", async () => {
    const s = await snapshotFixture(), eventId = s.eventos[0].event_id;
    const receipt = await exportarSnapshot(s, { tipo: "comprovante", eventId, ...opts });
    const afd = await exportarSnapshot(s, { tipo: "afd", ...opts });
    const hash = receipt.comprovante.fields.find(f => f[0] === "Hash da marcação no leiaute AFD")[1];
    expect(hash).toBe(afd.arquivo.hashes[1]);
    expect(hash).not.toBe(s.registros[0].fiscal_hash);
    expect(receipt.comprovante.status).toBe("rascunho_nao_assinado");
  });
  it("mantém a autorização existente: não aceita token de aparelho, engenharia ou RH restrito", async () => {
    const deniedDb = { from() { throw Error("NÃO CONSULTAR"); } };
    for (const usuario of [null, { role: "engenheiro" }, { role: "rh", obraId: "obra-a" }]) {
      expect((await consultarDocumentosFiscais({ db: deniedDb, usuario, body: {}, tipo: "auditoria" })).status).toBe(403);
    }
    const tratar = criarTratadorPonto({ db: deniedDb, company: EMPRESA, autenticarUsuario: async () => ({ role: "engenheiro" }), lerDados: async () => ({}) });
    expect((await tratar({ action: "ponto-fiscal", body: {} })).status).toBe(403);
  });
});

function dbLeitura(s, { cap = 2, concurrent = false } = {}) {
  let counterReads = 0;
  const calls = [];
  const tables = { ponto_estabelecimentos: [s.estabelecimento], ponto_arp_contadores: [s.contador], ponto_eventos: s.eventos,
    ponto_arp_registros: s.registros, ponto_dispositivos: s.dispositivos, ponto_estabelecimento_obras: [], ponto_marcacoes: [] };
  return { calls, from(table) {
    const filters = [], log = { table, filters, range: null }; calls.push(log);
    const q = { select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, in() { return q; }, order() { return q; },
      range(start, end) { log.range = [start, end]; return q; },
      maybeSingle() { if (table === "ponto_arp_contadores" && concurrent && counterReads++) return Promise.resolve({ data: { ...s.contador, ultimo_nsr: 5 } }); return Promise.resolve({ data: tables[table]?.[0] || null }); },
      then(resolve) { const start = log.range?.[0] || 0; resolve({ data: (tables[table] || []).slice(start, start + cap) }); },
      insert() { throw Error("ESCRITA PROIBIDA"); }, update() { throw Error("ESCRITA PROIBIDA"); }, delete() { throw Error("ESCRITA PROIBIDA"); } };
    return q;
  } };
}
describe("extração paginada sem escrita", () => {
  it("prontidão não expõe dados pessoais nem aceita evidência do navegador", async () => {
    const s = await snapshotFixture(), db = dbLeitura(s);
    const result = await consultarDocumentosFiscais({ db, companyId: EMPRESA, usuario: { role: "rh" }, body: { estabelecimentoId: ESTAB, config: s.config }, tipo: "prontidao", config: null });
    expect(result.status).toBe(200); expect(result.json.prontidao.conforme).toBe(false);
    expect(result.json.prontidao.requisitos.find(r => r.codigo === "INPI").status).toBe("pendente");
    expect(JSON.stringify(result.json)).not.toContain(CPF);
  });
  it("lê além de páginas limitadas pelo servidor, sem perder registros ou atravessar empresa", async () => {
    const s = await snapshotFixture(), db = dbLeitura(s);
    const out = await capturarSnapshotFiscal({ db, companyId: EMPRESA, estabelecimentoId: ESTAB, config: s.config });
    expect(out.eventos).toHaveLength(4); expect(out.registros).toHaveLength(4); expect(out.completo).toBe(true);
    expect(db.calls.every(c => c.filters.some(([k, v]) => k === "company_id" && v === EMPRESA))).toBe(true);
    expect((await auditarSnapshot(out)).integridadeValida).toBe(true);
  });
  it("bloqueia snapshot cujo contador mudou durante a leitura", async () => {
    const s = await snapshotFixture(), db = dbLeitura(s, { concurrent: true });
    const out = await capturarSnapshotFiscal({ db, companyId: EMPRESA, estabelecimentoId: ESTAB });
    expect(out.completo).toBe(false);
    expect((await auditarSnapshot(out)).integridadeValida).toBe(false);
  });
  it("recusa parâmetros inválidos antes de consultar o banco", async () => {
    const db = { from() { throw Error("NÃO CONSULTAR"); } };
    await expect(capturarSnapshotFiscal({ db, companyId: EMPRESA, estabelecimentoId: "../outro" })).rejects.toThrow("ESTABELECIMENTO_INVALIDO");
    expect((await consultarDocumentosFiscais({ db, companyId: EMPRESA, usuario: { role: "admin" }, body: { de: "2026-02-30", ate: "2026-11-04" }, tipo: "afd" })).status).toBe(422);
  });
  it("ação autenticada audita sem devolver payload ou alterar registros; configuração do body não é confiável", async () => {
    const s = await snapshotFixture(), db = dbLeitura(s);
    const tratar = criarTratadorPonto({ db, company: EMPRESA, autenticarUsuario: async () => ({ id: "rh", role: "rh" }),
      lerDados: async () => ({ employees: s.employees }), agora: () => new Date(opts.geradoEm) });
    const result = await tratar({ action: "ponto-fiscal", body: { tipo: "auditoria", estabelecimentoId: ESTAB } });
    expect(result.status).toBe(200);
    expect(result.json.auditoria.integridadeValida).toBe(true);
    expect(JSON.stringify(result.json)).not.toContain(CPF);
    const attempted = await tratar({ action: "ponto-fiscal", body: { tipo: "afd", estabelecimentoId: ESTAB, ...opts, config: s.config } });
    expect(attempted.status).toBe(422);
    expect(attempted.json.codigo).toBe("DADOS_FISCAIS_PENDENTES");
  });
});

describe("reaproveitamento da conferência existente", () => {
  async function reviewed() {
    const s = await snapshotFixture();
    s.config.ptrp = s.config.tratamento.ptrp; s.config.tratamento = null;
    const source = s.eventos.map(e => ({ eventId: e.event_id, marcadoEm: e.marcado_em_texto, obraId: e.obra_id, tipoEvento: e.payload.tipoEvento }));
    s.dadosPonto = { employees: [{ ...s.employees[0], cpf: CPF }], attendance: { "sintetico-1": { "2026-11-04": {
      status: "P", entrada: "07:00", intervaloSaida: "12:00", intervaloRetorno: "13:00", saida: "17:00",
      pontoReview: { adjusted: false, reviewedBy: "rh-sintetico", reviewedAt: opts.geradoEm, sourceSignature: sourceSignature(source),
        schedule: { working: true, minutes: 540, entrada: "07:00", intervaloSaida: "12:00", intervaloRetorno: "13:00", saida: "17:00" } },
    } } }, payments: [{ id: "pagamento-sintetico-intocavel", value: 777 }] };
    return s;
  }
  it("usa escala e conferência do RH, mantendo horários, segundos, grade e pagamentos", async () => {
    const s = await reviewed(), original = JSON.stringify(s);
    const result = await exportarSnapshot(freeze(s), { tipo: "aej", ...opts });
    expect(validarAej(result.arquivo.bytes).ok).toBe(true);
    expect(result.arquivo.contagens).toEqual([1, 1, 1, 1, 4, 0, 0, 1]);
    expect(JSON.stringify(s)).toBe(original);
  });
  it.each(["semConferencia", "alterado", "novaBatida", "gradeAlterada", "ausencia"])("recusa reconstrução ambígua: %s", async change => {
    const s = await reviewed(), record = s.dadosPonto.attendance["sintetico-1"]["2026-11-04"];
    if (change === "semConferencia") delete record.pontoReview;
    if (change === "alterado") record.pontoReview.adjusted = true;
    if (change === "novaBatida") record.pontoReview.sourceSignature = "desatualizada";
    if (change === "gradeAlterada") record.saida = "18:00";
    if (change === "ausencia") record.status = "F";
    expect(() => tratamentoDoPontoExistente(s, s.dadosPonto, opts)).toThrow();
  });
  it("não omite lançamento da grade sem batidas originais", async () => {
    const s = await reviewed();
    s.dadosPonto.attendance["sintetico-1"]["2026-11-03"] = { status: "F" };
    expect(() => tratamentoDoPontoExistente(s, s.dadosPonto, { de: "2026-11-03", ate: opts.ate })).toThrow("GRADE_SEM_ORIGINAIS");
  });
  it("validador AEJ detecta referência inexistente mesmo com contadores intactos", async () => {
    const { aej } = await model(), out = gerarAej(aej);
    const damaged = out.bytes.toString("latin1").replace("05|1|", "05|9|");
    expect(validarAej(Buffer.from(damaged, "latin1")).erros).toContain("DADOS_OU_REFERENCIAS_INVALIDOS");
  });
});
