import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { criarTratadorPonto, ehAcaoPonto, hashPin } from "./handler.js";
import { HASH_INICIAL, calcularHashMarcacao } from "../../src/domains/ponto-eletronico/marcacao.js";

const sha256 = v => createHash("sha256").update(v).digest("hex");

// Banco falso mínimo com a mesma API encadeada do supabase-js usada no handler.
function bancoFalso() {
  const tabelas = { ponto_dispositivos: [], ponto_pareamentos: [], ponto_marcacoes: [], ponto_biometrias: [], ponto_responsaveis: [] };
  const arquivos = new Map();
  const consulta = tabela => {
    const filtros = [];
    let modo = "select", patch = null, novo = null, ordem = null, limite = null, retornar = false, conflito = null;
    const casa = linha => filtros.every(f => f(linha));
    const executar = () => {
      const linhas = tabelas[tabela];
      if (modo === "insert") { for (const r of [].concat(novo)) linhas.push({ ...r }); return { data: null, error: null }; }
      if (modo === "upsert") {
        const chaves = conflito.split(",");
        for (const r of [].concat(novo)) {
          const i = linhas.findIndex(l => chaves.every(k => l[k] === r[k]));
          if (i >= 0) linhas[i] = { ...linhas[i], ...r }; else linhas.push({ ...r });
        }
        return { data: null, error: null };
      }
      if (modo === "update") {
        const alvo = linhas.filter(casa); alvo.forEach(l => Object.assign(l, patch));
        return { data: retornar ? alvo.map(l => ({ ...l })) : null, error: null };
      }
      if (modo === "delete") { tabelas[tabela] = linhas.filter(l => !casa(l)); return { data: null, error: null }; }
      let r = linhas.filter(casa).map(l => ({ ...l }));
      if (ordem) r.sort((a, b) => (a[ordem.k] < b[ordem.k] ? -1 : 1) * (ordem.asc ? 1 : -1));
      if (limite) r = r.slice(0, limite);
      return { data: r, error: null };
    };
    const b = {
      select() { if (modo !== "select") retornar = true; return b; },
      eq(k, v) { filtros.push(l => String(l[k]) === String(v)); return b; },
      gte(k, v) { filtros.push(l => String(l[k]) >= String(v)); return b; },
      lte(k, v) { filtros.push(l => String(l[k]) <= String(v)); return b; },
      is(k, v) { filtros.push(l => (l[k] ?? null) === v); return b; },
      order(k, o = {}) { ordem = { k, asc: o.ascending !== false }; return b; },
      limit(n) { limite = n; return b; },
      insert(r) { modo = "insert"; novo = r; return b; },
      update(p) { modo = "update"; patch = p; return b; },
      upsert(r, o) { modo = "upsert"; novo = r; conflito = o.onConflict; return b; },
      delete() { modo = "delete"; return b; },
      async maybeSingle() { const { data } = executar(); return { data: data?.[0] || null, error: null }; },
      then(ok, falha) { return Promise.resolve(executar()).then(ok, falha); },
    };
    return b;
  };
  return {
    tabelas, arquivos,
    from: consulta,
    async rpc(nome, p) {
      expect(nome).toBe("ponto_registrar_marcacoes");
      const d = tabelas.ponto_dispositivos.find(x => x.id === p.p_dispositivo_id);
      let aceitas = 0;
      for (const m of p.p_marcacoes) {
        if (m.nsr <= d.ultimo_nsr) continue;
        tabelas.ponto_marcacoes.push({ company_id: p.p_company_id, id: m.id, dispositivo_id: d.id, obra_id: d.obra_id, nsr: m.nsr,
          tipo_registro: m.tipoRegistro || "ponto", employee_id: m.employeeId || null, terceiro_id: m.terceiroId || null, marcado_em: m.marcadoEm,
          hora_confiavel: m.horaConfiavel, relogio_alterado: !!m.relogioAlterado, metodo: m.metodo, confianca: m.confianca ?? null,
          encarregado_id: m.encarregadoId || null, gps: m.gps || null, foto_sha256: m.fotoSha256 || null, recebido_em: "agora" });
        d.ultimo_nsr = m.nsr; d.ultimo_hash = m.hash; aceitas++;
      }
      return { data: [{ aceitas, ultimo_nsr: d.ultimo_nsr, ultimo_hash: d.ultimo_hash, erro: null }], error: null };
    },
    storage: { from: () => ({
      async upload(caminho, buffer) { if (arquivos.has(caminho)) return { error: { message: "The resource already exists" } }; arquivos.set(caminho, buffer); return { error: null }; },
      async createSignedUrl(caminho) { return arquivos.has(caminho) ? { data: { signedUrl: `https://assinado/${caminho}` }, error: null } : { data: null, error: { message: "not found" } }; },
    }) },
  };
}

const ADMIN = { id: "u-admin", role: "admin", nome: "Admin" };
const ENCARREGADO = { id: "u-enc", role: "user", nome: "Encarregado" };
const DADOS = {
  obras: [{ id: "obra-a", name: "Residencial Alameda" }, { id: "obra-b", name: "Outra" }],
  usuarios: [ADMIN, { ...ENCARREGADO, active: true }],
  employees: [
    { id: "e1", name: "Zé Pedreiro", role: "Pedreiro", cpf: "123.456.789-09", obra: "obra-a", active: true },
    { id: "e2", name: "Fora da obra", obra: "obra-b", active: true },
  ],
  terceirizados: [{ id: "t1", name: "Elétrica X", obraId: "obra-a" }],
};
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

let db, tratar, sessao;
beforeEach(() => {
  db = bancoFalso();
  sessao = ADMIN;
  tratar = criarTratadorPonto({
    db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date("2026-10-01T10:00:00.000Z"),
    autenticarUsuario: async body => (body.accessToken === "ok" ? sessao : null),
  });
});

async function parear() {
  const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Portaria" } });
  const r = await tratar({ action: "ponto-parear", body: { codigo: json.codigo, appVersao: "1.0.0" } });
  return r.json;
}
async function marcacoes(dispositivoId, qtd, { anterior = HASH_INICIAL, inicio = 1, foto = null } = {}) {
  const lista = [];
  for (let i = 0; i < qtd; i++) {
    const m = { id: `00000000-0000-4000-8000-${String(inicio + i).padStart(12, "0")}`, dispositivoId, nsr: inicio + i, tipoRegistro: "ponto",
      employeeId: "e1", cpf: "12345678909", marcadoEm: `2026-10-01T10:0${i}:00.000Z`, horaConfiavel: true, metodo: "facial",
      confianca: 0.91, hashAnterior: anterior, fotoSha256: foto ? sha256(foto) : undefined };
    m.hash = await calcularHashMarcacao(m, sha256);
    anterior = m.hash; lista.push(m);
  }
  return lista;
}

describe("ponto eletrônico - servidor", () => {
  it("só ações 'ponto-*' são despachadas para cá", () => {
    expect(ehAcaoPonto("ponto-sincronizar")).toBe(true);
    expect(ehAcaoPonto("load")).toBe(false);
  });

  it("pareia o aparelho com código de uso único e guarda só o hash do token", async () => {
    const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a", nome: "Portaria" } });
    expect(json.codigo).toMatch(/^\d{8}$/);
    const r = await tratar({ action: "ponto-parear", body: { codigo: json.codigo } });
    expect(r.status).toBe(200);
    expect(r.json.obra).toEqual({ id: "obra-a", nome: "Residencial Alameda" });
    expect(db.tabelas.ponto_dispositivos[0].token_hash).toBe(sha256(r.json.token));
    expect(JSON.stringify(db.tabelas.ponto_dispositivos)).not.toContain(r.json.token);
    const segunda = await tratar({ action: "ponto-parear", body: { codigo: json.codigo } });
    expect(segunda.json.code).toBe("CODIGO_INVALIDO");
  });

  it("código expirado não pareia", async () => {
    const { json } = await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a" } });
    db.tabelas.ponto_pareamentos[0].expira_em = "2026-10-01T09:00:00.000Z";
    expect((await tratar({ action: "ponto-parear", body: { codigo: json.codigo } })).json.code).toBe("CODIGO_EXPIRADO");
  });

  it("perfil sem gestão não gera código; sem sessão é recusado", async () => {
    sessao = ENCARREGADO;
    expect((await tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "ok", obraId: "obra-a" } })).status).toBe(403);
    expect((await tratar({ action: "ponto-dispositivos", body: {} })).status).toBe(401);
  });

  it("sincroniza a base única: só funcionários ativos da obra do aparelho, terceirizados e responsáveis da obra", async () => {
    const p = await parear();
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-a"] } });
    const r = await tratar({ action: "ponto-sincronizar", headers: { authorization: `Bearer ${p.token}` }, body: { gps: { lat: -8.2, lng: -35.9, precisao: 9 } } });
    expect(r.status).toBe(200);
    expect(r.json.funcionarios.map(f => f.id)).toEqual(["e1"]);
    expect(r.json.terceirizados.map(t => t.id)).toEqual(["t1"]);
    expect(r.json.servidorMs).toBe(Date.parse("2026-10-01T10:00:00.000Z"));
    const [resp] = r.json.responsaveis;
    expect(resp.userId).toBe("u-enc");
    expect(hashPin("4321", resp.pinSalt, resp.pinIteracoes)).toBe(resp.pinHash);
    expect(db.tabelas.ponto_dispositivos[0].ultimo_gps).toMatchObject({ lat: -8.2, lng: -35.9 });
  });

  it("aparelho sem token, desconhecido ou revogado não sincroniza", async () => {
    expect((await tratar({ action: "ponto-sincronizar" })).json.code).toBe("APARELHO_SEM_TOKEN");
    expect((await tratar({ action: "ponto-sincronizar", headers: { authorization: "Bearer xyz" } })).json.code).toBe("APARELHO_DESCONHECIDO");
    const p = await parear();
    await tratar({ action: "ponto-dispositivo-revogar", body: { accessToken: "ok", dispositivoId: p.dispositivoId } });
    expect((await tratar({ action: "ponto-sincronizar", headers: { authorization: `Bearer ${p.token}` } })).json.code).toBe("APARELHO_REVOGADO");
  });

  it("recebe marcações encadeadas, é idempotente e recusa marcação adulterada", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    const lote = await marcacoes(p.dispositivoId, 3);
    let r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: lote } });
    expect(r.json).toMatchObject({ aceitas: 3, ultimoNsr: 3, erro: null });
    r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: lote } });
    expect(r.json).toMatchObject({ aceitas: 0, ultimoNsr: 3 });
    const proximas = await marcacoes(p.dispositivoId, 2, { inicio: 4, anterior: lote[2].hash });
    proximas[1] = { ...proximas[1], employeeId: "e2" }; // adulterada depois do hash
    r = await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: proximas } });
    expect(r.json.aceitas).toBe(1);
    expect(r.json.erro).toMatch(/alterada/);
    expect(db.tabelas.ponto_marcacoes).toHaveLength(4);
  });

  it("não aceita marcação de outro aparelho no lote", async () => {
    const p = await parear();
    const lote = await marcacoes("6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", 1);
    const r = await tratar({ action: "ponto-enviar-marcacoes", headers: { authorization: `Bearer ${p.token}` }, body: { marcacoes: lote } });
    expect(r.status).toBe(400);
  });

  it("foto só é aceita se for exatamente a registrada na marcação, e o ARCD vê por link assinado", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    const [m] = await marcacoes(p.dispositivoId, 1, { foto: JPEG });
    await tratar({ action: "ponto-enviar-marcacoes", headers: auth, body: { marcacoes: [m] } });
    const outra = Buffer.from([0xff, 0xd8, 9, 9]);
    expect((await tratar({ action: "ponto-enviar-foto", headers: auth, body: { marcacaoId: m.id, foto: outra.toString("base64") } })).status).toBe(400);
    expect((await tratar({ action: "ponto-enviar-foto", headers: auth, body: { marcacaoId: m.id, foto: JPEG.toString("base64") } })).json).toEqual({ recebida: true });
    const url = await tratar({ action: "ponto-foto-url", body: { accessToken: "ok", marcacaoId: m.id } });
    expect(url.json.url).toContain(`marcacoes/obra-a/2026-10-01/${m.id}.jpg`);
  });

  it("biometria exige consentimento, funcionário da obra e responsável autorizado", async () => {
    const p = await parear();
    const auth = { authorization: `Bearer ${p.token}` };
    await tratar({ action: "ponto-responsavel-pin", body: { accessToken: "ok", userId: "u-enc", pin: "4321", obras: ["obra-a"] } });
    const base = { employeeId: "e1", modelo: "mobilefacenet-v1", vetor: Array.from({ length: 128 }, (_, i) => i / 128), fotos: [JPEG.toString("base64")], responsavelId: "u-enc" };
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: base })).json.error).toMatch(/consentimento/);
    const consentimento = { termoVersao: "2026-10", aceitoEm: "2026-10-01T09:59:00.000Z" };
    expect((await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, employeeId: "e2", consentimento } })).status).toBe(400);
    const r = await tratar({ action: "ponto-cadastrar-biometria", headers: auth, body: { ...base, consentimento } });
    expect(r.status).toBe(200);
    const status = await tratar({ action: "ponto-biometria-status", body: { accessToken: "ok" } });
    expect(status.json.biometrias).toEqual([expect.objectContaining({ employeeId: "e1", cadastradoPor: "u-enc" })]);
    await tratar({ action: "ponto-biometria-excluir", body: { accessToken: "ok", employeeId: "e1" } });
    expect(db.tabelas.ponto_biometrias).toHaveLength(0);
  });
});
