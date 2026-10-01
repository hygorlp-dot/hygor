// Cenário dos testes de regressão do app: lógica REAL do aparelho
// (terminal, sincronização, armazém) falando com o tratador REAL do servidor
// (server/ponto-eletronico/handler.js) sobre o banco em memória. Relógio do
// servidor, relógio monotônico, boot e rede são controláveis.
import { createHash, randomUUID } from "node:crypto";
import { criarTratadorPonto } from "../../../../server/ponto-eletronico/handler.js";
import { bancoFalso } from "../../../../server/ponto-eletronico/banco-falso.test-helper.js";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { registrarBatida } from "./terminal.js";

export const sha256 = v => createHash("sha256").update(v).digest("hex");
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);

export const DADOS_BASE = () => ({
  obras: [{ id: "obra-a", name: "Residencial Alameda" }],
  usuarios: [{ id: "u-admin", role: "admin", nome: "Admin", active: true }, { id: "u-enc", role: "user", nome: "Encarregado", active: true }],
  employees: [
    { id: "e1", name: "Zé Pedreiro", cpf: "123.456.789-09", obra: "obra-a", active: true },
    { id: "e2", name: "Maria Servente", cpf: "987.654.321-00", obra: "obra-a", active: true },
  ],
  terceirizados: [{ id: "t1", name: "Elétrica X", obraId: "obra-a" }],
});

export async function criarCenario({ comResponsavel = true, dados = DADOS_BASE() } = {}) {
  const c = {
    db: bancoFalso(), dados,
    relogioServidor: Date.parse("2026-10-01T10:00:00.000Z"),
    monotonicoMs: 5_000_000, bootId: "boot-1",
    paredeAdiantadaMs: 60_000,          // celular 1 min adiantado
    online: true, statusForaDoAr: 0,    // statusForaDoAr: devolve esse HTTP (ex.: 503)
    chamadas: [],
  };
  c.tratar = criarTratadorPonto({
    db: c.db, company: "arcd", lerDados: async () => c.dados, agora: () => new Date(c.relogioServidor),
    autenticarUsuario: async b => (b.accessToken === "admin" ? c.dados.usuarios[0] : null),
  });
  c.parear = async () => {
    const { json: { codigo } } = await c.tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "admin", obraId: "obra-a", nome: "Portaria" } });
    const par = await c.tratar({ action: "ponto-parear", body: { codigo } });
    c.token = par.json.token; c.dispositivoId = par.json.dispositivoId;
    return par;
  };
  await c.parear();
  c.api = async (action, corpo = {}) => {
    c.chamadas.push({ action, corpo });
    if (!c.online) return { ok: false, status: 0, error: "sem rede" };
    if (c.statusForaDoAr) return { ok: false, status: c.statusForaDoAr, error: "fora do ar" };
    const r = await c.tratar({ action, body: corpo, headers: { authorization: `Bearer ${c.token}` } });
    return { ok: r.status === 200, status: r.status, ...r.json };
  };
  c.novoArmazem = () => {
    c.armazem = criarArmazemMemoria();
    const salvar = c.armazem.salvarReferenciaHora;
    c.armazem.salvarReferenciaHora = async r => { c.armazem._ref = r; return salvar(r); };
    return c.armazem;
  };
  c.novoArmazem();
  c.monotonico = () => ({ ms: c.monotonicoMs, bootId: c.bootId });
  c.relogio = () => ({
    agora: () => {
      const parede = c.relogioServidor + c.paredeAdiantadaMs;
      return { ...horaDaMarcacao({ referencia: c.armazem._ref, monotonicoMs: c.monotonicoMs, bootId: c.bootId, relogioParedeMs: parede }), relogioParedeMs: parede };
    },
  });
  c.passar = ms => { c.monotonicoMs += ms; c.relogioServidor += ms; };
  c.bater = (extra = {}) => registrarBatida({
    armazem: c.armazem, relogio: c.relogio(), sha256, gerarId: randomUUID, dispositivoId: c.dispositivoId,
    pessoa: { tipo: "funcionario", id: "e1", cpf: "12345678909" }, identificacao: { metodo: "facial", confianca: 0.88 },
    gps: { lat: -8.28, lng: -35.97, precisao: 10 }, ...extra,
  });
  if (comResponsavel) await c.tratar({ action: "ponto-responsavel-pin", body: { accessToken: "admin", userId: "u-enc", pin: "2468", obras: ["obra-a"] } });
  return c;
}
