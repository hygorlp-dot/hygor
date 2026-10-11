// @vitest-environment node
//
// ENSAIO DE BACKUP E RESTAURAÇÃO em bancos descartáveis (PGlite), só com
// dados SINTÉTICOS (CPF de teste, vetor gerado, fotos de bytes fixos):
//   - estados da restauração: completa / apenas_banco / parcial / falha;
//   - fotos: ausente, corrompida, truncada, substituída, falha de escrita,
//     restauração interrompida e nova tentativa;
//   - consistência banco x Storage no backup: referência sem arquivo, órfão,
//     hash divergente, bucket mudando durante o backup;
//   - pacote adulterado, chave errada, cadeia fiscal depois da restauração.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { caminhoFotoCadastro, caminhoFotoMarcacao } from "../../server/ponto-eletronico/fotos-caminho.js";
import { adaptadorPglite } from "../migracoes-ponto/adaptadores.mjs";
import { aplicar } from "../migracoes-ponto/livro.mjs";
import { abrir, empacotar, exportar, manifestoDoEsquema, restaurar } from "./pacote.mjs";
import { storageMemoria } from "./storages.mjs";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const MANIFESTO_019 = JSON.parse(readFileSync(new URL("../migracoes-ponto/manifesto-com-019.json", import.meta.url), "utf8")).migracoes;
const lerArquivo = async a => lerMigration(a);
const C = "arcd", ZERO = "0".repeat(64);
const CPF = "12345678909", VETOR = Array.from({ length: 192 }, (_, i) => Number((Math.sin(i) / 10).toFixed(6)));
const jpeg = n => Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(`foto-sintetica-${n}`)]);

const novoBanco = async () => { const pg = new PGlite({ extensions: { pgcrypto } }); await pg.exec(PAPEIS_SUPABASE); return pg; };
const aplicarEsquemaEm = db => async dados => { await aplicar({ db, manifesto: await manifestoDoEsquema(dados, lerArquivo), lerArquivo, origem: "restauracao" }); };

let origem, destino, dbO, dbD, fotosO, estab, dispA, seq, ultimo, ultimaBatida;
async function bater(db, { comFoto = true, storage = fotosO } = {}) {
  seq += 1;
  const localHash = sha256(`${dispA}-${seq}`), foto = jpeg(`batida-${seq}`), marcadoEm = new Date().toISOString(), eventId = randomUUID();
  const e = { formatVersion: 2, eventId, deviceId: dispA, localSequence: seq, localPreviousHash: ultimo, localHash,
    tipoRegistro: "ponto", employeeId: "emp-1", cpf: CPF, marcadoEm, horaConfiavel: true, metodo: "facial", ...(comFoto ? { fotoSha256: sha256(foto) } : {}) };
  ultimo = localHash;
  const [r] = (await db.query("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)",
    [C, dispA, JSON.stringify([e]), JSON.stringify({ serverTime: new Date().toISOString(), source: "host", status: "verificada", toleranciaMs: 30000 })])).rows;
  ultimaBatida = { caminho: caminhoFotoMarcacao("obra-1", marcadoEm, eventId), foto };
  if (comFoto && storage) await storage.enviar(ultimaBatida.caminho, foto);       // o aparelho envia depois da ARP
  return r;
}
async function popular(db, { comLivro = true } = {}) {
  if (comLivro) await aplicar({ db: adaptadorPglite(db), manifesto: MANIFESTO_019, lerArquivo, origem: "teste" });
  else for (const m of MANIFESTO_019) await db.exec(lerMigration(m.arquivo));
  estab = randomUUID(); dispA = randomUUID(); seq = 0; ultimo = ZERO;
  const dispB = randomUUID();
  await db.query("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Matriz','admin')", [C, estab]);
  for (const [d, o] of [[dispA, "obra-1"], [dispB, "obra-2"]]) {
    await db.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,$3,'A',$4,'admin')", [C, d, o, sha256(d)]);
  }
  await db.query("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-1',$2,'admin')", [C, estab]);
  // Legado (formato 1) no aparelho B, com foto.
  const fotoLegado = jpeg("legado-1"), idLegado = randomUUID(), marcadoLegado = "2026-09-30T10:00:00.000Z";
  await db.query("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, dispB, JSON.stringify([{ id: idLegado, nsr: 1, hashAnterior: ZERO, hash: sha256("legado-1"),
    employeeId: "emp-2", cpf: CPF, marcadoEm: marcadoLegado, metodo: "facial", fotoSha256: sha256(fotoLegado) }])]);
  await fotosO.enviar(caminhoFotoMarcacao("obra-2", marcadoLegado, idLegado), fotoLegado);
  // Cadastro facial com 1 foto.
  const bio = randomUUID(), fotoCad = jpeg("cadastro-1"), caminhoCad = caminhoFotoCadastro("emp-1", bio, 0);
  await fotosO.enviar(caminhoCad, fotoCad);
  await db.query("insert into public.ponto_biometrias(company_id,id,employee_id,modelo,vetor,fotos,consentimento,cadastrado_por) values ($1,$2,'emp-1','mobilefacenet',$3::jsonb,$4::jsonb,$5::jsonb,'enc')",
    [C, bio, JSON.stringify(VETOR), JSON.stringify([{ caminho: caminhoCad, sha256: sha256(fotoCad) }]), JSON.stringify({ termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00Z" })]);
  await db.query("insert into public.ponto_responsaveis(company_id,user_id,nome,pin_hash,pin_salt,pin_iteracoes,atualizado_por) values ($1,'u1','Enc',$2,'sal',120000,'admin')", [C, "a".repeat(64)]);
  await db.query("insert into public.ponto_tempo_verificacoes(fonte,servidor,verificado_em,ok) values ('ntp','a.ntp.br',now(),true)");
  for (let i = 0; i < 3; i++) await bater(db);
  await db.query("update public.ponto_estabelecimentos set tipo_inscricao='cnpj', numero_inscricao='11222333000181', atualizado_por='fiscal', atualizado_em=now() where id=$1", [estab]);
}
async function backup({ storage = fotosO, chave = randomBytes(32) } = {}) {
  const dados = await exportar({ db: dbO, storage });
  const { manifesto, corpo } = await empacotar({ dados, chave, origem: "teste", autorizadoPor: "teste" });
  return { dados, manifesto, corpo, chave };
}
const restaurarEm = (db, p, extra = {}) => restaurar({ db, dados: abrir(p), manifesto: p.manifesto, aplicarEsquema: aplicarEsquemaEm(db), ...extra });

beforeEach(async () => {
  origem = await novoBanco(); destino = await novoBanco(); dbO = adaptadorPglite(origem); dbD = adaptadorPglite(destino); fotosO = storageMemoria();
});
afterEach(async () => { await origem?.close(); await destino?.close(); });

describe("restauração: estados e fotos", () => {
  it("COMPLETA: banco conferido, todas as fotos gravadas e relidas por SHA-256, cadeia fiscal íntegra; a ARP continua e as travas voltam", async () => {
    await popular(origem);
    const p = await backup();
    // Manifesto sem dado pessoal, biométrico ou hash cru; pacote cifrado.
    const texto = JSON.stringify(p.manifesto);
    for (const proibido of [CPF, "11222333000181", String(VETOR[5]), "a".repeat(64), ultimo]) expect(texto).not.toContain(proibido);
    expect(p.corpo.includes(Buffer.from(CPF))).toBe(false);
    expect(p.manifesto.fotos).toMatchObject({ incluidas: true, quantidade: 5, consistencia: { qualidade: "consistente", referencias: 5 } });
    expect(p.manifesto.fiscal).toEqual([expect.objectContaining({ registros: 3, ultimoNsr: 3, cadeiaIntegra: true, contadorConfere: true })]);

    const fotosD = storageMemoria();
    const r = await restaurarEm(dbD, p, { storage: fotosD });
    expect(r).toMatchObject({ estado: "completa", motivos: [], fotos: { noPacote: 5, restauradas: 5, verificadas: 5, falhasEscrita: [], ausentes: [], corrompidas: [] } });
    expect(r.banco.fiscal).toEqual(p.manifesto.fiscal);
    for (const [c, b] of fotosO.arquivos) expect(Buffer.compare(fotosD.arquivos.get(c), b)).toBe(0);
    const n4 = await bater(destino, { storage: fotosD });
    expect(Number(n4.nsr)).toBe(4);
    await expect(destino.query("update public.ponto_arp_registros set gravado_em = now()")).rejects.toThrow(/imutável/);
  });

  it("APENAS BANCO: sem destino de fotos, ou pacote sem fotos - nunca vira 'completa'", async () => {
    await popular(origem);
    const r1 = await restaurarEm(dbD, await backup());
    expect(r1.estado).toBe("apenas_banco");
    expect(r1.motivos[0]).toMatch(/5 foto\(s\) no pacote NÃO restaurada\(s\).*não satisfaz o gate/);
    const destino2 = await novoBanco();
    try {
      const semFotos = await backup({ storage: null });
      expect(semFotos.manifesto.fotos).toMatchObject({ incluidas: false, consistencia: { qualidade: "sem_fotos" } });
      const r2 = await restaurarEm(adaptadorPglite(destino2), semFotos, { storage: storageMemoria() });
      expect(r2).toMatchObject({ estado: "apenas_banco", motivos: [expect.stringMatching(/pacote não contém fotos/)] });
    } finally { await destino2.close(); }
  });

  it("PARCIAL: foto ausente, corrompida, truncada ou substituída no destino é detectada na releitura", async () => {
    await popular(origem);
    const p = await backup();
    const [a, b, c] = [...fotosO.arquivos.keys()];
    const fotosD = storageMemoria({ [c]: jpeg("outra-foto") }, {               // c: destino já tem OUTRA foto
      baixar: caminho => {
        if (caminho === a && fotosD.arquivos.has(a)) return null;                 // a: some depois de gravar
        if (caminho === b && fotosD.arquivos.has(b)) return fotosD.arquivos.get(b).subarray(0, 3);   // b: truncada
        return undefined;
      },
    });
    const r = await restaurarEm(dbD, p, { storage: fotosD });
    expect(r.estado).toBe("parcial");
    expect(r.fotos.verificadas).toBe(2);
    expect(r.fotos.ausentes.map(x => x.caminho)).toEqual([a]);
    expect(r.fotos.corrompidas).toEqual(expect.arrayContaining([{ caminho: b, motivo: expect.stringMatching(/truncada/) }, { caminho: c, motivo: expect.stringMatching(/outra foto/) }]));
    expect(r.motivos[0]).toMatch(/2\/5 verificadas/);
  });

  it("prova que já FALTAVA ou estava TROCADA na origem: a restauração nunca diz 'completa', mesmo com todas as fotos do pacote conferidas; órfão não impede", async () => {
    await popular(origem);
    await bater(origem, { storage: null });                                     // batida 4 sem foto na origem
    const semFoto = ultimaBatida.caminho;
    const r1 = await restaurarEm(dbD, await backup(), { storage: storageMemoria() });
    expect(r1).toMatchObject({ estado: "parcial", fotos: { noPacote: 5, verificadas: 5, referencias: 6, referenciasSemFoto: [{ caminho: semFoto, tipo: "batida" }], referenciasDivergentes: [] } });
    expect(r1.motivos).toEqual([expect.stringMatching(/1 registro\(s\) do banco sem foto conferida/)]);

    const destino2 = await novoBanco(), destino3 = await novoBanco();
    try {
      await fotosO.enviar(semFoto, ultimaBatida.foto);                          // a foto chegou; agora uma prova é trocada
      const [trocada] = [...fotosO.arquivos.keys()].filter(k => k.startsWith("marcacoes/obra-1/")).sort();
      const original = fotosO.arquivos.get(trocada);
      fotosO._gravar(trocada, jpeg("trocada"));
      const r2 = await restaurarEm(adaptadorPglite(destino2), await backup(), { storage: storageMemoria() });
      expect(r2).toMatchObject({ estado: "parcial", fotos: { verificadas: 6, referenciasSemFoto: [], referenciasDivergentes: [{ caminho: trocada, tipo: "batida" }] } });
      expect(r2.motivos.join(" ")).toMatch(/SHA-256 diferente do registrado no banco/);

      fotosO._gravar(trocada, original);                                        // prova correta de volta + um órfão
      fotosO._gravar("marcacoes/obra-1/2026-10-11/sem-evento.jpg", jpeg("orfa"));
      const r3 = await restaurarEm(adaptadorPglite(destino3), await backup(), { storage: storageMemoria() });
      expect(r3).toMatchObject({ estado: "completa", motivos: [], fotos: { noPacote: 7, verificadas: 7, referencias: 6, referenciasSemFoto: [], referenciasDivergentes: [] } });
    } finally { await destino2.close(); await destino3.close(); }
  });

  it("PARCIAL por SHA-256 divergente: bytes do mesmo tamanho, conteúdo diferente", async () => {
    await popular(origem);
    const p = await backup();
    const [a] = [...fotosO.arquivos.keys()];
    const fotosD = storageMemoria({}, { baixar: c => (c === a && fotosD.arquivos.has(a) ? Buffer.alloc(fotosD.arquivos.get(a).length, 7) : undefined) });
    const r = await restaurarEm(dbD, p, { storage: fotosD });
    expect(r).toMatchObject({ estado: "parcial", fotos: { verificadas: 4, corrompidas: [{ caminho: a, motivo: expect.stringMatching(/SHA-256 diferente/) }] } });
  });

  it("falha de escrita -> PARCIAL; nova tentativa só das fotos (banco já conferido) -> COMPLETA", async () => {
    await popular(origem);
    const p = await backup();
    let quebrar = true;
    const fotosD = storageMemoria({}, { enviar: c => quebrar && c.startsWith("biometria/") });
    const r1 = await restaurarEm(dbD, p, { storage: fotosD });
    expect(r1).toMatchObject({ estado: "parcial", fotos: { verificadas: 4, falhasEscrita: [{ caminho: expect.stringMatching(/^biometria\//), motivo: expect.stringMatching(/falha simulada/) }] } });
    quebrar = false;
    const r2 = await restaurarEm(dbD, p, { storage: fotosD, somenteFotos: true });
    expect(r2).toMatchObject({ estado: "completa", fotos: { noPacote: 5, verificadas: 5 } });
  });

  it("restauração INTERROMPIDA na carga do banco -> FALHA sem deixar linha; nova tentativa -> COMPLETA", async () => {
    await popular(origem);
    const p = await backup();
    let cortar = true;
    const interrompido = { ...dbD, query: async (t, params) => { if (cortar && /insert into public\.ponto_arp_registros/.test(t)) throw new Error("conexão caiu"); return dbD.query(t, params); } };
    const r1 = await restaurar({ db: interrompido, dados: abrir(p), manifesto: p.manifesto, aplicarEsquema: aplicarEsquemaEm(dbD), storage: storageMemoria() });
    expect(r1).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/conexão caiu/)] });
    for (const t of ["ponto_eventos", "ponto_estabelecimentos", "ponto_arp_registros"]) expect((await destino.query(`select count(*)::int n from public.${t}`)).rows[0].n).toBe(0);
    cortar = false;
    const r2 = await restaurarEm(dbD, p, { storage: storageMemoria() });
    expect(r2.estado).toBe("completa");
  });

  it("destino com dados: FALHA sem tocar em nada; somenteFotos sobre banco que não confere: FALHA", async () => {
    await popular(origem);
    const p = await backup();
    const r = await restaurarEm(dbO, p, { storage: storageMemoria() });
    expect(r).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/já tem o esquema do ponto e ele não foi criado por esta ferramenta/)] });
    expect((await origem.query("select count(*)::int n from public.ponto_arp_registros")).rows[0].n).toBe(3);
    await bater(origem);                                                           // origem mudou depois do backup
    const r2 = await restaurarEm(dbO, p, { storage: storageMemoria(), somenteFotos: true });
    expect(r2).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/banco não confere/)] });
  });

  it("pacote adulterado, chave errada ou manifesto trocado: não abre", async () => {
    await popular(origem);
    const p = await backup();
    expect(() => abrir({ ...p, chave: randomBytes(32) })).toThrow();
    const adulterado = Buffer.from(p.corpo); adulterado[adulterado.length - 5] ^= 0xff;
    expect(() => abrir({ ...p, corpo: adulterado })).toThrow();
    const outro = structuredClone(p.manifesto); outro.fotos.quantidade = 4;
    expect(() => abrir({ ...p, manifesto: outro })).toThrow(/manifesto foi alterado/);
    // Manifesto editado E com o SHA recalculado: o índice é autenticado com o SHA original - não abre.
    const forjado = structuredClone(p.manifesto); forjado.fotos.incluidas = false; forjado.sha256 = "f".repeat(64);
    expect(() => abrir({ ...p, manifesto: forjado })).toThrow();
    // Um byte de UMA foto dentro do pacote: a tag GCM daquele registro acusa.
    const umaFoto = Buffer.from(p.corpo); umaFoto[40] ^= 0x01;
    expect(() => abrir({ ...p, corpo: umaFoto })).toThrow();
    // Pacote cortado no meio (cópia interrompida): sem rodapé, não abre.
    expect(() => abrir({ ...p, corpo: p.corpo.subarray(0, p.corpo.length - 100) })).toThrow(/rodapé/);
  });

  it("backup tirado ANTES do livro (produção hoje): esquema pela validação de objetos e restauração completa", async () => {
    await popular(origem, { comLivro: false });
    const p = await backup();
    expect(p.dados.livro).toEqual([]);
    expect(p.dados.esquema).toEqual(MANIFESTO_019.map(m => m.arquivo));
    expect((await restaurarEm(dbD, p, { storage: storageMemoria() })).estado).toBe("completa");
  });

  it("backup exige registro de quem autorizou", async () => {
    await expect(empacotar({ dados: { tabelas: {}, livro: [], esquema: [], fotos: [], consistencia: { qualidade: "sem_fotos" } }, chave: randomBytes(32), origem: "x" })).rejects.toThrow(/quem autorizou/);
  });
});

describe("consistência banco x Storage no backup", () => {
  it("batida sem arquivo (foto ainda no aparelho) e órfão: 'consistente_com_pendencias'; listas só DENTRO do pacote, contagens no manifesto", async () => {
    await popular(origem);
    await bater(origem, { storage: null });                                     // foto ainda não chegou
    const pendente = ultimaBatida.caminho;
    fotosO._gravar("marcacoes/obra-1/2026-10-11/sem-evento.jpg", jpeg("orfa"));
    const p = await backup();
    expect(p.dados.consistencia).toMatchObject({ qualidade: "consistente_com_pendencias", semArquivo: [{ caminho: pendente, tipo: "batida" }],
      orfaos: [{ caminho: "marcacoes/obra-1/2026-10-11/sem-evento.jpg" }], hashDivergente: [] });
    // Manifesto (texto claro): só contagens, nenhum caminho com ID interno.
    expect(p.manifesto.fotos.consistencia).toMatchObject({ qualidade: "consistente_com_pendencias", semArquivo: 1, orfaos: 1, hashDivergente: 0 });
    expect(JSON.stringify(p.manifesto)).not.toContain("marcacoes/");
    expect(JSON.stringify(p.manifesto)).not.toContain("biometria/");
  });

  it("foto de prova trocada (SHA-256 ≠ o da marcação): 'inconsistente'", async () => {
    await popular(origem);
    const [c] = [...fotosO.arquivos.keys()].filter(k => k.startsWith("marcacoes/obra-1/"));
    fotosO._gravar(c, jpeg("trocada"));
    expect((await backup()).dados.consistencia).toMatchObject({ qualidade: "inconsistente", hashDivergente: [{ caminho: c, tipo: "batida" }], semArquivo: [] });
  });

  it("cadastro facial sem foto - SÓ isso: 'inconsistente' (não é pendência como a batida)", async () => {
    await popular(origem);
    const cad = [...fotosO.arquivos.keys()].find(k => k.startsWith("biometria/"));
    fotosO.arquivos.delete(cad);
    expect((await backup()).dados.consistencia).toMatchObject({ qualidade: "inconsistente", semArquivo: [{ caminho: cad, tipo: "cadastro" }], hashDivergente: [], orfaos: [], mudouDuranteBackup: false });
  });

  it("foto JÁ LISTADA mudou durante o backup: tenta de novo; mudando sempre: 'inconsistente' (nunca afirma consistência)", async () => {
    await popular(origem);
    const [alvo] = [...fotosO.arquivos.keys()];
    let chamadas = 0;
    const umaVez = { ...fotosO, listar: async () => { chamadas += 1; if (chamadas === 2) fotosO._gravar(alvo, fotosO.arquivos.get(alvo)); return fotosO.listar(); } };
    const d1 = await exportar({ db: dbO, storage: umaVez });
    expect(d1.consistencia).toMatchObject({ qualidade: "consistente", tentativas: 2, mudouDuranteBackup: false });
    const sempre = { ...fotosO, listar: async () => { const l = await fotosO.listar(); fotosO._gravar(alvo, fotosO.arquivos.get(alvo)); return l; } };
    const d2 = await exportar({ db: dbO, storage: sempre, tentativas: 3 });
    expect(d2.consistencia).toMatchObject({ qualidade: "inconsistente", mudouDuranteBackup: true, tentativas: 3 });
  });

  it("bucket que só CRESCE (batidas chegando durante o backup) não é mudança: uma tentativa só, e a foto nova fica de fora (é posterior ao retrato)", async () => {
    await popular(origem);
    let n = 0;
    const crescendo = { ...fotosO, listar: async () => { n += 1; fotosO._gravar(`marcacoes/obra-1/2026-10-11/nova-${n}.jpg`, jpeg(n)); return fotosO.listar(); } };
    const d = await exportar({ db: dbO, storage: crescendo });
    expect(d.consistencia).toMatchObject({ tentativas: 1, mudouDuranteBackup: false });
    expect(d.fotos.map(f => f.caminho)).not.toContain("marcacoes/obra-1/2026-10-11/nova-2.jpg");
  });
});

describe("fidelidade do banco restaurado", () => {
  it("cadeia fiscal QUEBRADA na origem: o backup registra, e a restauração termina em FALHA (nunca 'completa')", async () => {
    await popular(origem);
    await origem.exec(`set session_replication_role = replica;
      update public.ponto_arp_registros set fiscal_hash = repeat('e', 64) where nsr = 2;
      set session_replication_role = origin;`);
    const p = await backup();
    expect(p.manifesto.fiscal).toEqual([expect.objectContaining({ cadeiaIntegra: false })]);
    const r = await restaurarEm(dbD, p, { storage: storageMemoria() });
    expect(r).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/cadeia fiscal\/contador/)] });
  });

  it("contador divergente do último registro na origem: FALHA", async () => {
    await popular(origem);
    await origem.exec(`set session_replication_role = replica;
      update public.ponto_arp_contadores set ultimo_nsr = ultimo_nsr + 1;
      set session_replication_role = origin;`);
    const r = await restaurarEm(dbD, await backup(), { storage: storageMemoria() });
    expect(r).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/cadeia fiscal\/contador/)] });
  });

  it("queda ao ajustar as sequências: nada fica (mesma transação da carga); nova tentativa completa e a auditoria seguinte não colide", async () => {
    await popular(origem);
    const p = await backup();
    let cortar = true;
    const caindo = { ...dbD, query: async (t, params) => { if (cortar && /select setval/.test(t)) throw new Error("conexão caiu no setval"); return dbD.query(t, params); } };
    const r1 = await restaurar({ db: caindo, dados: abrir(p), manifesto: p.manifesto, aplicarEsquema: aplicarEsquemaEm(dbD), storage: storageMemoria() });
    expect(r1).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/setval/)] });
    expect((await destino.query("select count(*)::int n from public.ponto_estabelecimentos_auditoria")).rows[0].n).toBe(0);
    cortar = false;
    expect((await restaurarEm(dbD, p, { storage: storageMemoria() })).estado).toBe("completa");
    // Próxima linha de auditoria (sequência) não colide com as restauradas.
    await destino.query("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Filial','admin')", [C, randomUUID()]);
    expect((await destino.query("select count(*)::int n from public.ponto_estabelecimentos_auditoria where acao = 'criado'")).rows[0].n).toBeGreaterThan(0);
  });

  it("sequência atrás dos dados num banco 'restaurado' por fora: a conferência acusa e não declara nada", async () => {
    await popular(origem);
    const p = await backup();
    expect((await restaurarEm(dbD, p, { storage: storageMemoria() })).estado).toBe("completa");
    await destino.exec("select setval(pg_get_serial_sequence('public.ponto_estabelecimentos_auditoria', 'id'), 1, false)");
    const r = await restaurarEm(dbD, p, { storage: storageMemoria(), somenteFotos: true });
    expect(r).toMatchObject({ estado: "falha", motivos: [expect.stringMatching(/sequência atrás dos dados em ponto_estabelecimentos_auditoria\.id/)] });
  });

  it("fuso da sessão diferente na origem e no destino, e numeric com escala (1.50): restauração exata e 'completa'", async () => {
    await popular(origem);
    await origem.query("insert into public.ponto_tempo_verificacoes(fonte,servidor,verificado_em,offset_ms,atraso_ms,ok) values ('ntp','b.ntp.br','2026-10-11T23:30:00-03:00',1.50,12.300,true)");
    await origem.exec("set timezone = 'Etc/GMT+3'");
    await destino.exec("set timezone = 'America/Sao_Paulo'");
    const p = await backup();
    const r = await restaurarEm(dbD, p, { storage: storageMemoria() });
    expect(r.estado).toBe("completa");
    const [v] = (await destino.query("select offset_ms::text o, atraso_ms::text a, verificado_em at time zone 'UTC' as utc from public.ponto_tempo_verificacoes where servidor = 'b.ntp.br'")).rows;
    expect([v.o, v.a]).toEqual(["1.50", "12.300"]);
  });

  it("toda tabela das migrations está no backup (uma tabela nova de uma 020 não pode ficar de fora em silêncio)", async () => {
    const { OBJETOS } = await import("../migracoes-ponto/validacao.mjs");
    const { TABELAS } = await import("./pacote.mjs");
    expect([...TABELAS].sort()).toEqual([...new Set(Object.values(OBJETOS).flatMap(o => o.tabelasComRls))].sort());
  });
});

describe("storageSupabase (caminho --com-fotos de produção) com um bucket falso no formato do storage-js", () => {
  const bucketFalso = (arquivos, { erroDownload } = {}) => ({
    async list(prefixo, { limit, offset }) {
      const nivel = prefixo ? `${prefixo}/` : "";
      const nomes = [...new Set([...arquivos.keys()].filter(c => c.startsWith(nivel)).map(c => c.slice(nivel.length).split("/")[0]))].sort();
      const pagina = nomes.slice(offset, offset + limit);
      return { data: pagina.map(nome => (arquivos.has(`${nivel}${nome}`)
        ? { name: nome, id: `id-${nome}`, updated_at: "2026-10-11T10:00:00Z", metadata: { size: arquivos.get(`${nivel}${nome}`).length, eTag: `"${nome}"` } }
        : { name: nome, id: null, metadata: null })), error: null };
    },
    async download(c) {
      if (erroDownload) return { data: null, error: erroDownload };
      if (!arquivos.has(c)) return { data: null, error: { message: "Object not found", statusCode: "404" } };
      const b = arquivos.get(c);
      return { data: { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }, error: null };
    },
    async upload() { return { error: { message: "The resource already exists", statusCode: "409" } }; },
  });

  it("lista pastas aninhadas e mais de 1000 itens (paginação), baixa, devolve null para 404 e propaga outros erros", async () => {
    const { storageSupabase } = await import("./storages.mjs");
    const arquivos = new Map();
    for (let i = 0; i < 1203; i += 1) arquivos.set(`marcacoes/obra-1/2026-10-11/${String(i).padStart(5, "0")}.jpg`, jpeg(i));
    arquivos.set("biometria/emp-1/b-1.jpg", jpeg("cad"));
    const s = storageSupabase(bucketFalso(arquivos));
    const lista = await s.listar();
    expect(lista).toHaveLength(1204);
    expect(lista[0]).toMatchObject({ caminho: "biometria/emp-1/b-1.jpg", tamanho: jpeg("cad").length });
    expect(Buffer.compare(await s.baixar("biometria/emp-1/b-1.jpg"), jpeg("cad"))).toBe(0);
    expect(await s.baixar("biometria/emp-1/nao-existe.jpg")).toBeNull();
    await expect(s.enviar("biometria/emp-1/b-1.jpg", jpeg("x"))).rejects.toMatchObject({ statusCode: "409" });
    await expect(storageSupabase(bucketFalso(arquivos, { erroDownload: { message: "Internal error", statusCode: "500" } })).baixar("biometria/emp-1/b-1.jpg")).rejects.toMatchObject({ statusCode: "500" });
  });
});
