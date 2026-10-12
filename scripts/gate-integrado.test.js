// @vitest-environment node
//
// TESTE INTEGRADO DO GATE DE PRODUÇÃO (PGlite, dados SINTÉTICOS), na ordem
// do runbook - nunca em produção:
//  1 banco limpo  2-4 016/017/018 (deploys antigos)  5-6 dados e NSR
//  7 livro  8 019  9 novo deploy  10 funções da 019 ativas
//  11 registros fiscais anteriores intactos  12 backup cifrado com fotos
//  13 restauração em outro banco  14 fotos restauradas e conferidas
//  15 cadeias recalculadas  16 NSR, contadores e hashes  17 nova batida
//  18 próxima sequência correta
// + cenários negativos (deploy antigo sem guarda, foto adulterada, chave
// errada, restauração parcial).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../server/ponto-eletronico/banco-pglite.test-helper.js";
import { caminhoFotoCadastro, caminhoFotoMarcacao } from "../server/ponto-eletronico/fotos-caminho.js";
import { adaptadorPglite } from "./migracoes-ponto/adaptadores.mjs";
import { aplicar, guardaScriptAntigo, verificarGate } from "./migracoes-ponto/livro.mjs";
import { abrir, empacotar, exportar, manifestoDoEsquema, restaurar } from "./backup-ponto/pacote.mjs";
import { storageMemoria } from "./backup-ponto/storages.mjs";

vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const manifesto = nome => JSON.parse(readFileSync(new URL(`./migracoes-ponto/${nome}`, import.meta.url), "utf8")).migracoes;
const lerArquivo = async a => lerMigration(a);
const ANTIGAS = ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql"];
const C = "arcd", ZERO = "0".repeat(64), CPF = "12345678909";
const jpeg = n => Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from(`sintetica-${n}`)]);
const bancos = [];
const novoBanco = async () => { const pg = new PGlite({ extensions: { pgcrypto } }); await pg.exec(PAPEIS_SUPABASE); bancos.push(pg); return pg; };
afterAll(async () => { for (const b of bancos) await b.close(); });

async function retratoFiscal(pg) {
  const q = async s => (await pg.query(s)).rows;
  const [f] = await q(`select md5(string_agg(p.proname || pg_get_functiondef(p.oid), '|' order by p.proname)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ponto%' and p.proname not like 'ponto_migracoes%'`);
  const dados = {};
  for (const t of ["ponto_eventos", "ponto_arp_registros", "ponto_arp_contadores", "ponto_marcacoes"]) {
    dados[t] = (await q(`select count(*)::int n, md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) h from public.${t} x`))[0];
  }
  return { funcoes: f.h, dados };
}

describe("gate de produção integrado (sintético)", () => {
  it("016 -> 017 -> 018 -> dados -> livro -> 019 -> deploy -> backup -> restauração -> nova batida", async () => {
    // 1-4: banco limpo e deploys antigos (cada um reaplica tudo, como hoje).
    const pg = await novoBanco(), db = adaptadorPglite(pg);
    for (let i = 0; i < 2; i++) for (const f of ANTIGAS) await pg.exec(lerMigration(f));
    // 5-6: dados sintéticos e NSR (3 batidas com foto + legado + cadastro facial).
    const fotos = storageMemoria(), estab = randomUUID(), disp = randomUUID(), dispL = randomUUID();
    await pg.query("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Matriz','admin')", [C, estab]);
    for (const [d, o] of [[disp, "obra-1"], [dispL, "obra-2"]]) await pg.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,$3,'A',$4,'admin')", [C, d, o, sha256(d)]);
    await pg.query("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-1',$2,'admin')", [C, estab]);
    const fotoL = jpeg("legado"), idL = randomUUID();
    await pg.query("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, dispL, JSON.stringify([{ id: idL, nsr: 1, hashAnterior: ZERO, hash: sha256("l1"), employeeId: "emp-2", cpf: CPF, marcadoEm: "2026-09-30T10:00:00.000Z", metodo: "facial", fotoSha256: sha256(fotoL) }])]);
    await fotos.enviar(caminhoFotoMarcacao("obra-2", "2026-09-30T10:00:00.000Z", idL), fotoL);
    const bio = randomUUID(), fotoCad = jpeg("cadastro"), caminhoCad = caminhoFotoCadastro("emp-1", bio, 0);
    await fotos.enviar(caminhoCad, fotoCad);
    await pg.query("insert into public.ponto_biometrias(company_id,id,employee_id,modelo,vetor,fotos,consentimento,cadastrado_por) values ($1,$2,'emp-1','m',$3::jsonb,$4::jsonb,$5::jsonb,'enc')",
      [C, bio, JSON.stringify(Array.from({ length: 64 }, (_, i) => i / 100)), JSON.stringify([{ caminho: caminhoCad, sha256: sha256(fotoCad) }]), JSON.stringify({ termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00Z" })]);
    let seq = 0, ultimo = ZERO;
    const bater = async (banco, storage) => {
      seq += 1;
      const h = sha256(`${disp}-${seq}`), foto = jpeg(`b${seq}`), marcadoEm = new Date().toISOString(), id = randomUUID();
      const [r] = (await banco.query("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)", [C, disp, JSON.stringify([{ formatVersion: 2, eventId: id, deviceId: disp, localSequence: seq,
        localPreviousHash: ultimo, localHash: h, tipoRegistro: "ponto", employeeId: "emp-1", cpf: CPF, marcadoEm, horaConfiavel: true, metodo: "facial", fotoSha256: sha256(foto) }]),
        JSON.stringify({ serverTime: new Date().toISOString(), source: "host", status: "verificada", toleranciaMs: 30000 })])).rows;
      ultimo = h;
      await storage.enviar(caminhoFotoMarcacao("obra-1", marcadoEm, id), foto);
      return r;
    };
    for (let i = 0; i < 3; i++) expect(Number((await bater(pg, fotos)).nsr)).toBe(i + 1);
    expect(await guardaScriptAntigo(db, { lerArquivo })).toMatchObject({ resultado: "GO", acao: "seguir" });
    const antes = await retratoFiscal(pg);

    // 7: livro (016-018 só registradas). 8: 019 pela janela.
    expect((await aplicar({ db, manifesto: manifesto("manifesto.json"), lerArquivo, origem: "ensaio" })).passos.map(p => p.acao)).toEqual(Array(3).fill("registrar_existente"));
    expect((await aplicar({ db, manifesto: manifesto("manifesto-com-019.json"), lerArquivo, origem: "ensaio" })).passos.map(p => p.acao)).toEqual(["ja_aplicada", "ja_aplicada", "ja_aplicada", "aplicar"]);
    const na019 = await retratoFiscal(pg);
    // 9: novo deploy (script antigo com o gate). 10: funções da 019 ativas.
    expect(await guardaScriptAntigo(db, { lerArquivo })).toMatchObject({ resultado: "GO", acao: "pular", versaoFiscal: "019" });
    expect((await retratoFiscal(pg)).funcoes).toBe(na019.funcoes);
    expect((await pg.query("select prosrc from pg_proc where proname = 'ponto_arp_registrar'")).rows[0].prosrc).toContain("fonteGravacao");
    // 11: registros fiscais anteriores intactos.
    expect(na019.dados).toEqual(antes.dados);

    // 12: backup cifrado com fotos (consistência banco x Storage).
    const chave = randomBytes(32);
    const dados = await exportar({ db, storage: fotos });
    expect(dados.consistencia).toMatchObject({ qualidade: "consistente", referencias: 5, arquivos: 5 });
    const { manifesto: man, corpo } = await empacotar({ dados, chave, origem: "ensaio", autorizadoPor: "ensaio" });
    // 13-16: restauração noutro banco, fotos relidas, cadeia, NSR, contadores e hashes.
    const pg2 = await novoBanco(), db2 = adaptadorPglite(pg2), fotos2 = storageMemoria();
    const r = await restaurar({ db: db2, dados: abrir({ corpo, chave, manifesto: man }), manifesto: man, storage: fotos2,
      aplicarEsquema: async d => { await aplicar({ db: db2, manifesto: await manifestoDoEsquema(d, lerArquivo), lerArquivo, origem: "restauracao" }); } });
    expect(r).toMatchObject({ estado: "completa", fotos: { noPacote: 5, verificadas: 5 } });
    expect(r.banco.fiscal).toEqual([expect.objectContaining({ registros: 3, ultimoNsr: 3, cadeiaIntegra: true, contadorConfere: true })]);
    for (const [c, b] of fotos.arquivos) expect(sha256(fotos2.arquivos.get(c))).toBe(sha256(b));
    expect((await retratoFiscal(pg2)).dados).toEqual(antes.dados);
    expect(await verificarGate(db2, { lerArquivo })).toMatchObject({ resultado: "GO", versaoFiscal: "019" });
    // 17-18: nova batida no restaurado: NSR 4, sequência local 4, cadeia íntegra.
    const n4 = await bater(pg2, fotos2);
    expect([Number(n4.nsr), Number(n4.local_sequence), n4.status]).toEqual([4, 4, "registrado"]);
    const [cont] = (await pg2.query("select ultimo_nsr from public.ponto_arp_contadores where estabelecimento_id = $1", [estab])).rows;
    expect(Number(cont.ultimo_nsr)).toBe(4);
    const depois = await exportar({ db: db2, storage: fotos2 });
    const resumo = (await empacotar({ dados: depois, chave, origem: "x", autorizadoPor: "x" })).manifesto.fiscal;
    expect(resumo).toEqual([expect.objectContaining({ registros: 4, ultimoNsr: 4, cadeiaIntegra: true, contadorConfere: true })]);

    // Negativos no mesmo cenário:
    // (a) deploy antigo SEM guarda reverteria a 019 - o gate acusa NO-GO.
    await pg.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
    expect(await verificarGate(db, { lerArquivo })).toMatchObject({ resultado: "NO-GO" });
    // (b) foto de prova adulterada na origem: backup marca 'inconsistente'.
    const [cam] = [...fotos.arquivos.keys()].filter(k => k.startsWith("marcacoes/obra-1/"));
    fotos._gravar(cam, jpeg("adulterada"));
    expect((await exportar({ db, storage: fotos })).consistencia).toMatchObject({ qualidade: "inconsistente", hashDivergente: [{ caminho: cam, tipo: "batida" }] });
    // (c) chave errada não abre.
    expect(() => abrir({ corpo, chave: randomBytes(32), manifesto: man })).toThrow();
  });
});
