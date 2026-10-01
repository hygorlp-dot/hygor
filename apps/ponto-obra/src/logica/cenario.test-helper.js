// Cenário dos testes do app: lógica REAL do aparelho (terminal,
// sincronização, armazém) falando com o tratador REAL do servidor
// (server/ponto-eletronico/handler.js) sobre um Postgres REAL em memória
// (PGlite com as migrations 016 + 017 - função da ARP, travas e triggers
// incluídos). Relógio do servidor, relógio monotônico, boot e rede são
// controláveis. Vários aparelhos podem ser criados no mesmo servidor.
import { createHash, randomUUID } from "node:crypto";
import { criarTratadorPonto } from "../../../../server/ponto-eletronico/handler.js";
import { camadaSupabase, novoPglite } from "../../../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { registrarBatida } from "./terminal.js";

export const sha256 = v => createHash("sha256").update(v).digest("hex");
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);
export const EMPRESA = "arcd";

export const DADOS_BASE = () => ({
  obras: [{ id: "obra-a", name: "Residencial Alameda" }, { id: "obra-b", name: "Galpão" }, { id: "obra-x", name: "Outra empresa" }],
  usuarios: [{ id: "u-admin", role: "admin", nome: "Admin", active: true }, { id: "u-enc", role: "user", nome: "Encarregado", active: true }],
  employees: [
    { id: "e1", name: "Zé Pedreiro", cpf: "123.456.789-09", obra: "obra-a", active: true },
    { id: "e2", name: "Maria Servente", cpf: "987.654.321-00", obra: "obra-a", active: true },
    { id: "e3", name: "João Armador", cpf: "111.444.777-35", obra: "obra-b", active: true },
  ],
  terceirizados: [{ id: "t1", name: "Elétrica X", obraId: "obra-a" }],
});

// Servidor (tratador + Postgres) compartilhado por vários aparelhos.
export async function criarServidor({ dados = DADOS_BASE(), estabelecimento = true, comResponsavel = true } = {}) {
  const s = { dados, relogioServidor: Date.parse("2026-10-01T10:00:00.000Z"), pg: await novoPglite() };
  s.db = camadaSupabase(s.pg);
  s.tratar = criarTratadorPonto({
    db: s.db, company: EMPRESA, lerDados: async () => s.dados, agora: () => new Date(s.relogioServidor),
    // accessToken "admin" ou o id de qualquer usuário ativo do cadastro.
    autenticarUsuario: async b => (b.accessToken === "admin" ? s.dados.usuarios[0] : s.dados.usuarios.find(u => u.id === b.accessToken && u.active !== false) || null),
  });
  s.admin = (action, body = {}) => s.tratar({ action, body: { accessToken: "admin", ...body } });
  s.sql = async (texto, p = []) => (await s.pg.query(texto, p)).rows;
  s.criarEstabelecimento = async (nome, obras) => {
    const r = await s.admin("ponto-estabelecimento-salvar", { estabelecimento: { nome } });
    for (const obraId of obras) await s.admin("ponto-estabelecimento-vincular-obra", { obraId, estabelecimentoId: r.json.estabelecimento.id });
    return r.json.estabelecimento.id;
  };
  // Registros fiscais (NSR) + evento de origem, em ordem de NSR.
  s.fiscais = estabelecimentoId => s.sql(`select r.nsr, r.event_id, r.dispositivo_id, r.fiscal_hash, e.local_sequence, e.employee_id
    from public.ponto_arp_registros r join public.ponto_eventos e using (company_id, event_id)
    where ($1::uuid is null or r.estabelecimento_id = $1::uuid) order by r.estabelecimento_id, r.nsr`, [estabelecimentoId || null]);
  s.eventos = () => s.sql("select * from public.ponto_eventos order by recebido_em, local_sequence");
  if (estabelecimento) s.estabelecimentoA = await s.criarEstabelecimento("Matriz (obras A e B)", ["obra-a", "obra-b"]);
  if (comResponsavel) await s.admin("ponto-responsavel-pin", { userId: "u-enc", pin: "2468", obras: [] });
  return s;
}

// Um aparelho pareado com uma obra, com armazém, relógio e rede próprios.
export async function criarAparelho(s, { obraId = "obra-a", nome = "Portaria" } = {}) {
  const a = { s, monotonicoMs: 5_000_000, bootId: "boot-1", paredeAdiantadaMs: 60_000, online: true, statusForaDoAr: 0, chamadas: [], perderResposta: 0 };
  const { json: { codigo } } = await s.admin("ponto-codigo-pareamento", { obraId, nome });
  const par = await s.tratar({ action: "ponto-parear", body: { codigo } });
  a.token = par.json.token; a.dispositivoId = par.json.dispositivoId; a.par = par;
  // perderResposta: o servidor PROCESSA e grava, mas a resposta "se perde"
  // (timeout depois do commit) - o aparelho vê status 0.
  a.api = async (action, corpo = {}) => {
    a.chamadas.push({ action, corpo });
    if (!a.online) return { ok: false, status: 0, error: "sem rede" };
    if (a.statusForaDoAr) return { ok: false, status: a.statusForaDoAr, error: "fora do ar" };
    const r = await s.tratar({ action, body: corpo, headers: { authorization: `Bearer ${a.token}` } });
    if (a.perderResposta > 0) { a.perderResposta--; return { ok: false, status: 0, error: "tempo esgotado" }; }
    return { ok: r.status === 200, status: r.status, ...r.json };
  };
  a.novoArmazem = () => {
    a.armazem = criarArmazemMemoria();
    const salvar = a.armazem.salvarReferenciaHora;
    a.armazem.salvarReferenciaHora = async r => { a.armazem._ref = r; return salvar(r); };
    return a.armazem;
  };
  a.novoArmazem();
  a.monotonico = () => ({ ms: a.monotonicoMs, bootId: a.bootId });
  a.relogio = () => ({
    agora: () => {
      const parede = s.relogioServidor + a.paredeAdiantadaMs;
      return { ...horaDaMarcacao({ referencia: a.armazem._ref, monotonicoMs: a.monotonicoMs, bootId: a.bootId, relogioParedeMs: parede }), relogioParedeMs: parede };
    },
  });
  a.passar = ms => { a.monotonicoMs += ms; s.relogioServidor += ms; };
  a.bater = async (extra = {}) => registrarBatida({
    armazem: a.armazem, relogio: a.relogio(), sha256, gerarId: randomUUID, dispositivoId: a.dispositivoId,
    estabelecimentoId: (await a.armazem.cadastro())?.estabelecimento?.id || null,
    pessoa: { tipo: "funcionario", id: "e1", cpf: "12345678909" }, identificacao: { metodo: "facial", confianca: 0.88 },
    gps: { lat: -8.28, lng: -35.97, precisao: 10 }, ...extra,
  });
  return a;
}

// Atalho dos testes de um aparelho só.
export async function criarCenario(opcoes = {}) {
  const s = await criarServidor(opcoes);
  const a = await criarAparelho(s);
  return { s, a };
}
