// @vitest-environment node
//
// ENSAIO DE RESTAURAÇÃO em bancos descartáveis (PGlite), só com dados
// sintéticos: backup cifrado de um banco do ponto (016-019 + livro, NSR,
// legado, biometria, auditoria, fotos) e restauração num banco novo, com
// conferência de cada tabela, da cadeia fiscal e das travas. Nenhum dado
// real é lido ou gravado.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { adaptadorPglite } from "../migracoes-ponto/adaptadores.mjs";
import { aplicar } from "../migracoes-ponto/livro.mjs";
import { abrir, empacotar, exportar, manifestoDoEsquema, restaurar } from "./pacote.mjs";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const MANIFESTO_019 = JSON.parse(readFileSync(new URL("../migracoes-ponto/manifesto-com-019.json", import.meta.url), "utf8")).migracoes;
const lerArquivo = async a => lerMigration(a);
const C = "arcd", ZERO = "0".repeat(64);
const CPF = "12345678909", VETOR = Array.from({ length: 192 }, (_, i) => Number((Math.sin(i) / 10).toFixed(6)));

const novoBanco = async () => { const pg = new PGlite({ extensions: { pgcrypto } }); await pg.exec(PAPEIS_SUPABASE); return pg; };
const storageFalso = (inicial = {}) => {
  const arquivos = new Map(Object.entries(inicial));
  return { arquivos, listar: async () => [...arquivos.keys()].sort().map(caminho => ({ caminho })), baixar: async c => arquivos.get(c), enviar: async (c, b) => { arquivos.set(c, b); } };
};
const aplicarEsquemaEm = db => async dados => { await aplicar({ db, manifesto: await manifestoDoEsquema(dados, lerArquivo), lerArquivo, origem: "restauracao" }); };

let origem, destino, dbO, dbD, estab, dispA, dispB, seq, ultimo;
async function bater(db, disp) {
  seq += 1;
  const localHash = sha256(`${disp}-${seq}`);
  const e = { formatVersion: 2, eventId: randomUUID(), deviceId: disp, localSequence: seq, localPreviousHash: ultimo, localHash,
    tipoRegistro: "ponto", employeeId: "emp-1", cpf: CPF, marcadoEm: new Date().toISOString(), horaConfiavel: true, metodo: "facial" };
  ultimo = localHash;
  const [r] = await db.query("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)",
    [C, disp, JSON.stringify([e]), JSON.stringify({ serverTime: new Date().toISOString(), source: "host", status: "verificada", toleranciaMs: 30000 })]);
  return r;
}
async function popular(db, { comLivro = true } = {}) {
  if (comLivro) await aplicar({ db, manifesto: MANIFESTO_019, lerArquivo, origem: "teste" });
  else for (const m of MANIFESTO_019) await db.exec(lerMigration(m.arquivo));
  estab = randomUUID(); dispA = randomUUID(); dispB = randomUUID(); seq = 0; ultimo = ZERO;
  await db.query("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Matriz','admin')", [C, estab]);
  for (const [d, o] of [[dispA, "obra-1"], [dispB, "obra-2"]]) {
    await db.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,$3,'A',$4,'admin')", [C, d, o, sha256(d)]);
  }
  await db.query("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-1',$2,'admin')", [C, estab]);
  // Legado no aparelho B (formato 1), biometria e responsável.
  const hl = sha256("legado-1");
  await db.query("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, dispB, JSON.stringify([{ id: randomUUID(), nsr: 1, hashAnterior: ZERO, hash: hl, employeeId: "emp-2", cpf: CPF, marcadoEm: "2026-09-30T10:00:00.000Z", metodo: "facial" }])]);
  await db.query("insert into public.ponto_biometrias(company_id,employee_id,modelo,vetor,consentimento,cadastrado_por) values ($1,'emp-1','mobilefacenet',$2::jsonb,$3::jsonb,'enc')",
    [C, JSON.stringify(VETOR), JSON.stringify({ termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00Z" })]);
  await db.query("insert into public.ponto_responsaveis(company_id,user_id,nome,pin_hash,pin_salt,pin_iteracoes,atualizado_por) values ($1,'u1','Enc',$2,'sal',120000,'admin')", [C, "a".repeat(64)]);
  await db.query("insert into public.ponto_tempo_verificacoes(fonte,servidor,verificado_em,ok) values ('ntp','a.ntp.br',now(),true)");
  for (let i = 0; i < 3; i++) await bater(db, dispA);
  await db.query("update public.ponto_estabelecimentos set tipo_inscricao='cnpj', numero_inscricao='11222333000181', atualizado_por='fiscal', atualizado_em=now() where id=$1", [estab]);
}

beforeEach(async () => { origem = await novoBanco(); destino = await novoBanco(); dbO = adaptadorPglite(origem); dbD = adaptadorPglite(destino); });
afterEach(async () => { await origem?.close(); await destino?.close(); });

describe("backup e restauração do ponto (bancos descartáveis)", () => {
  it("backup cifrado -> restauração em banco novo: cada tabela, fotos e cadeia fiscal idênticas; a ARP continua e as travas voltam", async () => {
    await popular(dbO);
    const fotosO = storageFalso({ "marcacoes/obra-1/2026-10-11/x.jpg": Buffer.from([0xff, 0xd8, 1, 2]), "biometria/emp-1/y-1.jpg": Buffer.from([0xff, 0xd8, 3]) });
    const chave = randomBytes(32);
    const dados = await exportar({ db: dbO, storage: fotosO });
    const { manifesto, corpo } = await empacotar({ dados, chave, origem: "teste", autorizadoPor: "teste" });

    // Manifesto sem dado pessoal, biométrico ou hash cru.
    const texto = JSON.stringify(manifesto);
    for (const proibido of [CPF, "11222333000181", String(VETOR[5]), "a".repeat(64), ultimo]) expect(texto).not.toContain(proibido);
    expect(manifesto.fiscal).toEqual([expect.objectContaining({ registros: 3, ultimoNsr: 3, cadeiaIntegra: true })]);
    expect(manifesto.tabelas.ponto_arp_registros.linhas).toBe(3);
    expect(manifesto.fotos.quantidade).toBe(2);
    expect(corpo.includes(Buffer.from(CPF))).toBe(false);                          // cifrado

    const fotosD = storageFalso();
    const r = await restaurar({ db: dbD, dados: abrir({ corpo, chave, manifesto }), manifesto, aplicarEsquema: aplicarEsquemaEm(dbD), storage: fotosD });
    expect(r).toMatchObject({ fotos: 2 });
    expect(r.fiscal).toEqual(manifesto.fiscal);
    expect([...fotosD.arquivos.keys()].sort()).toEqual([...fotosO.arquivos.keys()].sort());
    for (const [k, v] of fotosO.arquivos) expect(Buffer.compare(fotosD.arquivos.get(k), v)).toBe(0);

    // Banco restaurado funciona: NSR 4 encadeado, travas de imutabilidade ativas, livro próprio.
    const n4 = await bater(dbD, dispA);
    expect(Number(n4.nsr)).toBe(4);
    await expect(destino.query("update public.ponto_arp_registros set gravado_em = now()")).rejects.toThrow(/imutável/);
    await expect(destino.query("delete from public.ponto_eventos")).rejects.toThrow(/imutável/);
    expect((await destino.query("select count(*)::int n from public.ponto_migracoes_aplicadas where origem = 'restauracao'")).rows[0].n).toBe(4);
    // Identidade da auditoria segue sem colisão.
    await destino.query("update public.ponto_estabelecimentos set nome = 'Matriz 2', atualizado_por='f', atualizado_em=now() where id = $1", [estab]);
  });

  it("chave errada, pacote adulterado ou manifesto trocado: não abre", async () => {
    await popular(dbO);
    const chave = randomBytes(32);
    const { manifesto, corpo } = await empacotar({ dados: await exportar({ db: dbO }), chave, origem: "teste", autorizadoPor: "teste" });
    expect(() => abrir({ corpo, chave: randomBytes(32), manifesto })).toThrow();
    const adulterado = Buffer.from(corpo); adulterado[adulterado.length - 5] ^= 0xff;
    expect(() => abrir({ corpo: adulterado, chave, manifesto })).toThrow();
    const outro = structuredClone(manifesto); outro.tabelas.ponto_arp_registros.linhas = 2;
    expect(() => abrir({ corpo, chave, manifesto: outro })).toThrow(/ponto_arp_registros não confere/);
  });

  it("restauração só em banco vazio: destino com dados é recusado sem tocar em nada", async () => {
    await popular(dbO);
    const chave = randomBytes(32);
    const { manifesto, corpo } = await empacotar({ dados: await exportar({ db: dbO }), chave, origem: "teste", autorizadoPor: "teste" });
    await expect(restaurar({ db: dbO, dados: abrir({ corpo, chave, manifesto }), manifesto, aplicarEsquema: aplicarEsquemaEm(dbO) }))
      .rejects.toThrow(/só em banco vazio/);
    expect((await origem.query("select count(*)::int n from public.ponto_arp_registros")).rows[0].n).toBe(3);
  });

  it("backup tirado ANTES do livro (produção hoje): o esquema vem da validação de objetos e a restauração confere", async () => {
    await popular(dbO, { comLivro: false });
    const chave = randomBytes(32);
    const dados = await exportar({ db: dbO });
    expect(dados.livro).toEqual([]);
    expect(dados.esquema).toEqual(MANIFESTO_019.map(m => m.arquivo));
    const { manifesto, corpo } = await empacotar({ dados, chave, origem: "teste", autorizadoPor: "teste" });
    const r = await restaurar({ db: dbD, dados: abrir({ corpo, chave, manifesto }), manifesto, aplicarEsquema: aplicarEsquemaEm(dbD) });
    expect(r.fiscal).toEqual(manifesto.fiscal);
  });

  it("backup exige registro de quem autorizou", async () => {
    await expect(empacotar({ dados: { tabelas: {}, livro: [], esquema: [], fotos: [] }, chave: randomBytes(32), origem: "x" })).rejects.toThrow(/quem autorizou/);
  });
});
