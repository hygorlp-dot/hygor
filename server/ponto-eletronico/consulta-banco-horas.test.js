// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarTratadorPonto } from "./handler.js";
import { consultarBancoHoras } from "./consulta-banco-horas.js";
import { camadaSupabase, novoPglite } from "./banco-pglite.test-helper.js";
import { calcularHashLocal, FORMATO_EVENTO, HASH_INICIAL } from "../../src/domains/ponto-eletronico/evento.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const COMPANY = "empresa-teste";
const CORTE = "2026-10-28T12:00:00.000Z";
const PERIODO = { de: "2026-10-01", ate: "2026-10-01" };
const BASE = {
  obras: [{ id: "obra-a", name: "Obra A" }, { id: "obra-b", name: "Obra B" }],
  employees: [{ id: "e1", name: "Funcionário de teste", obra: "obra-a", active: true }],
};
const linhaMarcacao = (indice, extra = {}) => ({
  id: `legado-${String(indice).padStart(5, "0")}`, event_id: `evento-${String(indice).padStart(5, "0")}`,
  company_id: COMPANY, employee_id: "e1", obra_id: "obra-a", tipo_registro: "ponto",
  marcado_em: "2026-10-01T10:00:00.000Z", recebido_em: "2026-10-28T11:00:00.000Z",
  hora_confiavel: true, relogio_alterado: false, metodo: "facial", ...extra,
});
const linhaApropriacao = (indice, extra = {}) => ({
  id: `apropriacao-${String(indice).padStart(5, "0")}`, company_id: COMPANY, employee_id: "e1",
  data: "2026-10-01", inicio: "2026-10-01T10:00:00.000Z", fim: "2026-10-01T14:00:00.000Z",
  obra_apropriada_id: "obra-b", origem: "manual", status: "ativa", version: 1,
  atualizado_em: "2026-10-28T11:00:00.000Z", ...extra,
});

// Simula somente SELECT do PostgREST. O cap é independente do range pedido,
// como ocorre quando o servidor limita a resposta abaixo do tamanho da página.
function bancoDeConsulta({ tabelas = {}, cap = Infinity, alterarResposta } = {}) {
  const consultas = [];
  const chamadasPorTabela = new Map();
  const db = {
    consultas,
    from(tabela) {
      const filtros = [], ordens = [];
      let colunas = "*", opcoes = {}, faixa = [0, Infinity];
      const executar = () => {
        const numero = (chamadasPorTabela.get(tabela) || 0) + 1;
        chamadasPorTabela.set(tabela, numero);
        const consulta = { tabela, filtros: [...filtros], ordens: [...ordens], colunas, opcoes, faixa: [...faixa], numero };
        consultas.push(consulta);
        const linhas = (tabelas[tabela] || []).filter(linha => filtros.every(([operador, campo, valor]) => {
          if (operador === "eq") return linha[campo] === valor;
          if (operador === "gte") return linha[campo] >= valor;
          return linha[campo] <= valor;
        })).sort((a, b) => {
          for (const [campo, ascendente] of ordens) {
            if (a[campo] !== b[campo]) return (a[campo] < b[campo] ? -1 : 1) * (ascendente ? 1 : -1);
          }
          return 0;
        });
        const selecionadas = linhas.slice(faixa[0], Math.min(faixa[1] + 1, faixa[0] + cap));
        const data = selecionadas.map(linha => colunas === "*" ? { ...linha }
          : Object.fromEntries(colunas.split(",").map(campo => [campo, linha[campo]])));
        const resposta = { data, error: null, ...(opcoes.count === "exact" ? { count: linhas.length } : {}) };
        return alterarResposta?.(consulta, resposta) || resposta;
      };
      const q = {
        select(campos = "*", opts = {}) { colunas = campos; opcoes = opts; return q; },
        eq(campo, valor) { filtros.push(["eq", campo, valor]); return q; },
        gte(campo, valor) { filtros.push(["gte", campo, valor]); return q; },
        lte(campo, valor) { filtros.push(["lte", campo, valor]); return q; },
        order(campo, opts = {}) { ordens.push([campo, opts.ascending !== false]); return q; },
        range(de, ate) { faixa = [de, ate]; return q; },
        then(resolve, reject) { return Promise.resolve().then(executar).then(resolve, reject); },
      };
      return q;
    },
  };
  return db;
}

function tratador(db, { papel = "admin", corte = CORTE } = {}) {
  return criarTratadorPonto({
    db, company: COMPANY, lerDados: async () => BASE, agora: () => new Date(corte),
    autenticarUsuario: async body => body.accessToken === "sessao-sintetica" ? { id: "usuario-teste", role: papel } : null,
  });
}
const chamar = (tratar, body = {}) => tratar({ action: "ponto-banco-horas", body: { accessToken: "sessao-sintetica", ...PERIODO, ...body } });
const consultar = (db, extra = {}) => consultarBancoHoras({ db, company: COMPANY, ...PERIODO, consultadoEm: CORTE, ...extra });

describe("ponto-banco-horas: autorização e escopo", () => {
  it("recusa falta de sessão antes de consultar qualquer tabela", async () => {
    const db = bancoDeConsulta();
    expect(await tratador(db)({ action: "ponto-banco-horas", body: PERIODO })).toMatchObject({ status: 401 });
    expect(db.consultas).toEqual([]);
  });

  it.each(["user", "comercial", "cliente", "almoxarife"])("recusa perfil %s mesmo com sessão e parâmetros válidos", async papel => {
    const db = bancoDeConsulta();
    expect(await chamar(tratador(db, { papel }))).toMatchObject({ status: 403 });
    expect(db.consultas).toEqual([]);
  });

  it.each(["admin", "rh", "engenheiro", "engenheiro_auditor", "financeiro"])("permite consulta ao perfil %s", async papel => {
    const r = await chamar(tratador(bancoDeConsulta(), { papel }));
    expect(r).toMatchObject({ status: 200, json: { marcacoes: [], apropriacoes: [], cobertura: { completa: true } } });
  });

  it("usa a empresa e o relógio do servidor e não corta a jornada pela obra enviada pelo navegador", async () => {
    const tabelas = {
      ponto_eventos: [linhaMarcacao(1, { obra_id: "obra-b" }), linhaMarcacao(2, { company_id: "empresa-intrusa" })],
      ponto_marcacoes: [linhaMarcacao(3), linhaMarcacao(4, { company_id: "empresa-intrusa" })],
      ponto_apropriacoes: [linhaApropriacao(1), linhaApropriacao(2, { company_id: "empresa-intrusa" })],
    };
    const antes = structuredClone(tabelas);
    const db = bancoDeConsulta({ tabelas });
    const r = await chamar(tratador(db), { company: "empresa-intrusa", companyId: "empresa-intrusa", obraId: "obra-a", consultadoEm: "2099-01-01T00:00:00.000Z" });
    expect(r.status).toBe(200);
    expect(r.json.marcacoes.map(m => m.id)).toEqual(["evento-00001", "legado-00003"]);
    expect(r.json.marcacoes.map(m => m.obraId)).toEqual(["obra-b", "obra-a"]);
    expect(r.json.apropriacoes).toMatchObject([{ id: "apropriacao-00001", obraApropriadaId: "obra-b" }]);
    expect(r.json.cobertura.consultadoEm).toBe(CORTE);
    expect(r.json.servidorMs).toBe(Date.parse(CORTE));
    for (const q of db.consultas) {
      expect(q.filtros).toContainEqual(["eq", "company_id", COMPANY]);
      expect(q.filtros.some(([, campo]) => campo === "obra_id" || campo === "obra_apropriada_id")).toBe(false);
    }
    expect(tabelas).toEqual(antes);
  });

  it("filtra por funcionário nas três fontes, mantendo suas capturas e apropriações em qualquer obra", async () => {
    const db = bancoDeConsulta({ tabelas: {
      ponto_eventos: [linhaMarcacao(1, { employee_id: "e2", obra_id: "obra-b" }), linhaMarcacao(2)],
      ponto_marcacoes: [linhaMarcacao(3, { employee_id: "e2" }), linhaMarcacao(4)],
      ponto_apropriacoes: [linhaApropriacao(1, { employee_id: "e2" }), linhaApropriacao(2)],
    } });
    const r = await chamar(tratador(db), { employeeId: " e2 ", obraId: "obra-a" });
    expect(r.json.marcacoes.map(m => m.employeeId)).toEqual(["e2", "e2"]);
    expect(r.json.apropriacoes.map(a => a.employeeId)).toEqual(["e2"]);
    expect(r.json.marcacoes.some(m => m.obraId === "obra-b")).toBe(true);
    expect(db.consultas.every(q => q.filtros.some(f => f[0] === "eq" && f[1] === "employee_id" && f[2] === "e2"))).toBe(true);
  });
});

describe("ponto-banco-horas: período, paginação e cobertura", () => {
  it.each([
    { de: "", ate: "2026-10-01" },
    { de: "2026-02-30", ate: "2026-03-01" },
    { de: "01/10/2026", ate: "2026-10-01" },
    { de: "2026-10-02", ate: "2026-10-01" },
    { de: "2026-08-27", ate: "2026-10-28" },
  ])("recusa período inválido antes de ler as tabelas: %j", async periodo => {
    const db = bancoDeConsulta();
    expect(await chamar(tratador(db), periodo)).toMatchObject({ status: 400, json: { error: expect.any(String) } });
    expect(db.consultas).toEqual([]);
  });

  it("aceita exatamente 62 dias civis inclusivos", async () => {
    expect(await chamar(tratador(bancoDeConsulta()), { de: "2026-08-28", ate: "2026-10-28" })).toMatchObject({ status: 200 });
  });

  it.each([500, 137])("lê mais de 2.000 registros por fonte, com cap real de %i e contagem exata", async cap => {
    const db = bancoDeConsulta({ cap, tabelas: {
      ponto_eventos: Array.from({ length: 2501 }, (_, i) => linhaMarcacao(i)).reverse(),
      ponto_marcacoes: Array.from({ length: 2103 }, (_, i) => linhaMarcacao(i)).reverse(),
      ponto_apropriacoes: Array.from({ length: 601 }, (_, i) => linhaApropriacao(i)).reverse(),
    } });
    const r = await consultar(db);
    expect(r).toMatchObject({ status: 200, json: { cobertura: { completa: true, totalMarcacoes: 4604, totalApropriacoes: 601 } } });
    expect(r.json.marcacoes).toHaveLength(4604);
    expect(new Set(r.json.marcacoes.map(m => m.eventId)).size).toBe(4604);
    expect(r.json.apropriacoes).toHaveLength(601);
    expect(r.json.marcacoes.at(0).id).toBe("evento-00000");
    expect(r.json.marcacoes.at(-1).id).toBe("legado-02102");
    const paginas = db.consultas.filter(q => q.tabela === "ponto_eventos" && q.faixa[1] > 0);
    expect(paginas.map(q => q.faixa[0])).toEqual(Array.from({ length: Math.ceil(2501 / cap) }, (_, i) => i * cap));
    expect(db.consultas.every(q => q.opcoes.count === "exact")).toBe(true);
    expect(paginas.every(q => q.ordens.at(-1)?.[0] === "event_id")).toBe(true);
  });

  it.each(["pagina", "verificacao"])("mudança de contagem na %s recusa a leitura inteira com 409", async etapa => {
    const db = bancoDeConsulta({ cap: 200, tabelas: { ponto_eventos: Array.from({ length: 450 }, (_, i) => linhaMarcacao(i)) },
      alterarResposta(q, r) {
        if (q.tabela === "ponto_eventos" && (etapa === "pagina" ? q.numero === 2 : q.faixa[1] === 0)) return { ...r, count: r.count + 1 };
        return r;
      },
    });
    const r = await consultar(db);
    expect(r).toMatchObject({ status: 409, json: { error: expect.stringContaining("mudaram") } });
    expect(r.json).not.toHaveProperty("cobertura");
    expect(r.json).not.toHaveProperty("marcacoes");
  });

  it.each([
    { count: undefined }, { count: null }, { count: -1 }, { count: 1.5 }, { data: null },
  ])("não declara cobertura sem contagem inteira e conteúdo válido: %j", async defeito => {
    const db = bancoDeConsulta({ alterarResposta: (_q, r) => ({ ...r, ...defeito }) });
    expect(await consultar(db)).toMatchObject({ status: 503, json: { error: expect.any(String) } });
  });

  it("página vazia antes do total esperado é conflito, não fim bem-sucedido", async () => {
    const db = bancoDeConsulta({ alterarResposta: (_q, r) => ({ ...r, count: 1, data: [] }) });
    expect(await consultar(db)).toMatchObject({ status: 409 });
  });

  it("recusa mais de 10.000 linhas numa fonte sem publicar a primeira página", async () => {
    const db = bancoDeConsulta({ alterarResposta: (q, r) => q.tabela === "ponto_eventos" ? { ...r, count: 10001 } : r });
    const r = await consultar(db);
    expect(r).toMatchObject({ status: 422, json: { error: expect.stringContaining("intervalo menor") } });
    expect(r.json).not.toHaveProperty("marcacoes");
    expect(db.consultas.filter(q => q.tabela === "ponto_eventos")).toHaveLength(1);
  });

  it.each([10000, 10001])("o limite de 10.000 também vale para a soma das fontes: %i linhas", async total => {
    const db = bancoDeConsulta({ tabelas: {
      ponto_eventos: Array.from({ length: 6000 }, (_, i) => linhaMarcacao(i)),
      ponto_marcacoes: Array.from({ length: total - 6000 }, (_, i) => linhaMarcacao(i)),
    } });
    const r = await consultar(db);
    expect(r.status).toBe(total === 10000 ? 200 : 422);
    if (total === 10000) expect(r.json.cobertura).toMatchObject({ completa: true, totalMarcacoes: 10000 });
    else expect(r.json).not.toHaveProperty("cobertura");
  });

  it("erro de banco não é convertido em lista vazia ou cobertura completa", async () => {
    const falha = new Error("Consulta indisponível");
    const db = bancoDeConsulta({ alterarResposta: (q, r) => q.tabela === "ponto_marcacoes" ? { ...r, error: falha } : r });
    await expect(consultar(db)).rejects.toBe(falha);
  });
});

describe("ponto-banco-horas: projeção e corte temporal", () => {
  it("usa dias civis de Recife, contexto noturno de um dia e só dados até o corte do servidor", async () => {
    const db = bancoDeConsulta({ tabelas: {
      ponto_eventos: [
        linhaMarcacao(1, { marcado_em: "2026-10-01T02:59:59.999Z" }),
        linhaMarcacao(2, { marcado_em: "2026-10-01T03:00:00.000Z" }),
        linhaMarcacao(3, { marcado_em: "2026-10-02T02:59:59.999Z", recebido_em: CORTE }),
        linhaMarcacao(4, { marcado_em: "2026-10-02T03:00:00.000Z" }),
        linhaMarcacao(5, { recebido_em: "2026-10-28T12:00:00.001Z" }),
        linhaMarcacao(6, { tipo_registro: "acesso_terceiro" }),
      ],
      ponto_marcacoes: [linhaMarcacao(7, { recebido_em: CORTE }), linhaMarcacao(8, { recebido_em: "2026-10-28T12:00:00.001Z" })],
      ponto_apropriacoes: [
        linhaApropriacao(1, { atualizado_em: CORTE }), linhaApropriacao(2, { status: "cancelada" }),
        linhaApropriacao(3, { atualizado_em: "2026-10-28T12:00:00.001Z" }),
        linhaApropriacao(4, { data: "2026-09-30", inicio: "2026-10-01T01:00:00.000Z", fim: "2026-10-01T05:00:00.000Z" }),
        linhaApropriacao(5, { data: "2026-10-02", inicio: "2026-10-02T03:00:00.000Z", fim: "2026-10-02T07:00:00.000Z" }),
        linhaApropriacao(6, { data: "2026-09-29" }), linhaApropriacao(7, { data: "2026-10-03" }),
      ],
    } });
    const r = await consultar(db);
    expect(r.json.marcacoes.map(m => m.id)).toEqual(["evento-00002", "legado-00007", "evento-00003"]);
    expect(r.json.apropriacoes.map(a => a.id)).toEqual(["apropriacao-00001", "apropriacao-00004", "apropriacao-00005"]);
    for (const q of db.consultas.filter(q => q.tabela !== "ponto_apropriacoes")) {
      expect(q.filtros).toContainEqual(["gte", "marcado_em", "2026-10-01T03:00:00.000Z"]);
      expect(q.filtros).toContainEqual(["lte", "marcado_em", "2026-10-02T02:59:59.999Z"]);
      expect(q.filtros).toContainEqual(["lte", "recebido_em", CORTE]);
    }
    for (const q of db.consultas.filter(q => q.tabela === "ponto_apropriacoes")) {
      expect(q.filtros).toContainEqual(["gte", "data", "2026-09-30"]);
      expect(q.filtros).toContainEqual(["lte", "data", "2026-10-02"]);
      expect(q.filtros).toContainEqual(["eq", "status", "ativa"]);
      expect(q.filtros).toContainEqual(["lte", "atualizado_em", CORTE]);
    }
  });

  it("consulta e devolve só campos necessários, sem CPF, fotos, GPS, payload ou credenciais", async () => {
    const sensiveis = {
      cpf: "documento-sintetico-restrito", gps: { lat: -8, lng: -35 }, foto_sha256: "hash-foto-restrito",
      payload: { detalhe: "conteudo-restrito" }, pin_hash: "pin-restrito", token_hash: "token-restrito", vetor: [0.5],
    };
    const db = bancoDeConsulta({ tabelas: {
      ponto_eventos: [linhaMarcacao(1, sensiveis)], ponto_marcacoes: [linhaMarcacao(2, sensiveis)],
      ponto_apropriacoes: [linhaApropriacao(1, { motivo: "texto-restrito", responsavel_id: "autor-restrito" })],
    } });
    const r = await consultar(db);
    expect(r.status).toBe(200);
    const camposMarcacao = ["id", "eventId", "formato", "employeeId", "obraId", "obraCapturaId", "tipoRegistro", "marcadoEm", "horaConfiavel", "relogioAlterado", "metodo"].sort();
    for (const m of r.json.marcacoes) expect(Object.keys(m).sort()).toEqual(camposMarcacao);
    expect(Object.keys(r.json.apropriacoes[0]).sort()).toEqual(["id", "employeeId", "data", "inicio", "fim", "obraApropriadaId", "origem", "status", "version", "atualizadoEm"].sort());
    for (const q of db.consultas) {
      expect(q.colunas).not.toContain("*");
      expect(q.colunas.split(",").some(campo => Object.keys(sensiveis).includes(campo) || ["motivo", "responsavel_id"].includes(campo))).toBe(false);
    }
    expect(JSON.stringify(r.json)).not.toMatch(/restrito|"cpf"|"gps"|"payload"|"vetor"|"pin"|"token"/);
  });
});

let pg;
afterEach(async () => { await pg?.close(); pg = null; });

describe("ponto-banco-horas com migrations reais", () => {
  it("pagina legado, lê evento pela ARP e apropriações por RPC sem alterar tabelas ou proteções", async () => {
    pg = await novoPglite();
    const db = camadaSupabase(pg);
    const corte = new Date(Date.now() + 60_000).toISOString();
    const tratar = tratador(db, { corte });
    const usuario = (action, body = {}) => tratar({ action, body: { accessToken: "sessao-sintetica", ...body } });
    const { json: { estabelecimento } } = await usuario("ponto-estabelecimento-salvar", { estabelecimento: { nome: "Estabelecimento sintético" } });
    await usuario("ponto-estabelecimento-vincular-obra", { obraId: "obra-b", estabelecimentoId: estabelecimento.id });
    const { json: { codigo } } = await usuario("ponto-codigo-pareamento", { obraId: "obra-b" });
    const { json: aparelho } = await tratar({ action: "ponto-parear", body: { codigo } });
    const evento = {
      formatVersion: FORMATO_EVENTO, eventId: randomUUID(), deviceId: aparelho.dispositivoId,
      estabelecimentoId: "", localSequence: 1, tipoRegistro: "ponto", employeeId: "e1", cpf: "",
      marcadoEm: "2026-10-01T19:00:00.000Z", horaConfiavel: true, metodo: "facial", localPreviousHash: HASH_INICIAL,
    };
    evento.localHash = await calcularHashLocal(evento, valor => createHash("sha256").update(valor).digest("hex"));
    const envio = await tratar({ action: "ponto-enviar-marcacoes", headers: { authorization: `Bearer ${aparelho.token}` }, body: { eventos: [evento] } });
    expect(envio.json.resultados[0]).toMatchObject({ status: "registrado", nsr: 1 });

    const dispositivoLegado = randomUUID();
    await pg.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,'obra-a','Legado de teste',repeat('a',64),'teste')", [COMPANY, dispositivoLegado]);
    await pg.query(`insert into public.ponto_marcacoes(company_id,id,dispositivo_id,obra_id,nsr,tipo_registro,employee_id,marcado_em,hora_confiavel,metodo,hash_anterior,hash)
      select $1,md5('legado-teste-' || n)::uuid,$2,'obra-a',n,'ponto','e1',timestamptz '2026-10-01 10:00:00+00' + n * interval '1 second',true,'facial',repeat('0',64),repeat('b',64)
      from generate_series(1,2003) n`, [COMPANY, dispositivoLegado]);
    const salvarApropriacao = async extra => {
      const r = await db.rpc("ponto_apropriacao_salvar", {
        p_company_id: COMPANY, p_id: null, p_employee_id: "e1", p_data: "2026-10-01",
        p_inicio: "2026-10-01T10:00:00Z", p_fim: "2026-10-01T14:00:00Z", p_obra_apropriada_id: "obra-b",
        p_origem: "manual", p_responsavel_id: "usuario-teste", p_motivo: null, p_versao_esperada: null, ...extra,
      });
      expect(r.error).toBeNull();
      return r.data[0];
    };
    const ativa = await salvarApropriacao();
    const cancelada = await salvarApropriacao({ p_inicio: "2026-10-01T15:00:00Z", p_fim: "2026-10-01T19:00:00Z" });
    const cancelamento = await db.rpc("ponto_apropriacao_cancelar", {
      p_company_id: COMPANY, p_id: cancelada.id, p_responsavel_id: "usuario-teste", p_motivo: "Correção sintética", p_versao_esperada: 1,
    });
    expect(cancelamento.error).toBeNull();

    const tabelas = ["ponto_dispositivos", "ponto_marcacoes", "ponto_eventos", "ponto_arp_registros", "ponto_arp_contadores", "ponto_apropriacoes", "ponto_apropriacoes_auditoria"];
    const retrato = async () => ({
      dados: await Promise.all(tabelas.map(async tabela => (await pg.query(`select md5(coalesce(jsonb_agg(to_jsonb(linha) order by to_jsonb(linha)::text)::text,'[]')) as hash from public.${tabela} linha`)).rows[0].hash)),
      funcoes: (await pg.query("select proname, md5(prosrc) as hash from pg_proc where proname like 'ponto_%' order by proname")).rows,
      triggers: (await pg.query("select tgname,tgenabled,pg_get_triggerdef(oid) as definicao from pg_trigger where tgname like 'ponto_%' order by tgname")).rows,
    });
    const antes = await retrato();
    const paginas = [];
    const somenteLeitura = {
      from(tabela) {
        const q = db.from(tabela);
        const range = q.range;
        q.range = (de, ate) => { paginas.push({ tabela, de, ate }); return range(de, Math.min(ate, de + 136)); };
        for (const metodo of ["insert", "update", "upsert", "delete"]) q[metodo] = () => { throw new Error(`Escrita indevida: ${metodo}`); };
        return q;
      },
      rpc() { throw new Error("A consulta não pode executar funções de escrita"); },
    };
    const r = await chamar(tratador(somenteLeitura, { corte }), { obraId: "obra-a" });
    expect(r.status).toBe(200);
    expect(r.json.cobertura).toMatchObject({ completa: true, totalMarcacoes: 2004, totalApropriacoes: 1 });
    expect(r.json.marcacoes.filter(m => m.formato === 1)).toHaveLength(2003);
    expect(r.json.marcacoes.find(m => m.eventId === evento.eventId)).toMatchObject({ formato: 2, obraCapturaId: "obra-b" });
    expect(r.json.apropriacoes).toMatchObject([{ id: ativa.id, status: "ativa", obraApropriadaId: "obra-b" }]);
    expect(paginas.filter(p => p.tabela === "ponto_marcacoes" && p.ate > 0)).toHaveLength(Math.ceil(2003 / 137));
    expect(await retrato()).toEqual(antes);
  });
});
