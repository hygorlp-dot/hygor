// Backup e restauração das tabelas e fotos do Ponto de Obra
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). O backup diário do ARCD
// (server/backup.js) cobre só company_app_data - NÃO estas tabelas nem o
// bucket de fotos.
//
// PACOTE (formato v3): uma sequência de REGISTROS cifrados independentes
// (AES-256-GCM, IV e tag próprios), cada um autenticado com o seu contexto
// (AAD): cada foto (posição, caminho, SHA-256), cada tabela e, no fim, o
// índice - autenticado junto com o SHA-256 do MANIFESTO (manifesto editado
// = pacote não abre). As fotos são gravadas e lidas UMA a UMA: o tamanho do
// bucket não vira um único texto na memória (o v2 estourava o limite de
// string do V8 por volta de 400 MB).
//
// LINHAS: guardadas como o TEXTO de to_jsonb (retrato em UTC), sem passar
// pelo JSON.parse do JS - numeric e bigint voltam exatos e o fuso da sessão
// não muda o resultado. O manifesto (arquivo separado) não tem dado pessoal:
// contagens, SHA-256 por tabela e do conjunto de fotos, consistência
// (contagens), topo de cada cadeia fiscal (resumido em SHA-256), versão do
// esquema, origem e quem autorizou.
//
// CONSISTÊNCIA banco x Storage: não há transação entre os dois. O retrato
// é: lista o bucket -> retrato do banco (REPEATABLE READ READ ONLY) ->
// baixa as fotos -> lista de novo. Se uma foto já listada mudou ou sumiu no
// meio, tenta de novo (até N vezes); foto NOVA não conta como mudança (é de
// batida posterior ao retrato). Depois cruza as referências do banco com os
// arquivos: referência sem arquivo, arquivo órfão, hash divergente. A
// qualidade vai no manifesto - nunca se afirma consistência não comprovada.
//
// RESTAURAÇÃO: só em banco NOVO (sem o esquema do ponto - ou com o esquema
// que uma tentativa anterior desta ferramenta criou e ainda vazio); esquema
// pelo livro de migrations; linhas e sequências na MESMA transação, com
// session_replication_role = replica (triggers suspensos SÓ nela - como
// pg_restore --disable-triggers); cada foto gravada e RELIDA do destino
// para conferir o SHA-256. Estados:
//   completa      - banco conferido + TODAS as fotos do pacote restauradas e verificadas
//                   + TODA referência de foto do banco com foto conferida e SHA-256 igual ao registrado
//   apenas_banco  - banco conferido, fotos não restauradas (sem destino ou pacote sem fotos)
//   parcial       - banco conferido, alguma foto ausente/corrompida/não gravada, ou
//                   registro do banco sem a sua foto (já faltava/estava trocada na origem)
//   falha         - o banco não foi restaurado/conferido (nada é afirmado)
// Só "completa" satisfaz o gate de recuperação integral.
import crypto from "node:crypto";
import fs from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { verificarCadeiaFiscal } from "../../src/domains/ponto-eletronico/registro-fiscal.js";
import { caminhoFotoMarcacao } from "../../server/ponto-eletronico/fotos-caminho.js";
import { OBJETOS, validarMigracao } from "../migracoes-ponto/validacao.mjs";
import { sha256Migracao } from "../migracoes-ponto/livro.mjs";

export const FORMATO = "arcd-ponto-backup-v3";
const MAGICO = Buffer.from("ARCD-PONTO-BACKUP-3\n", "utf8");
const FIM = Buffer.from("ARCDFIM3", "utf8");
const CAB_REGISTRO = 4 + 12 + 16;            // tamanho (UInt32BE) + IV + tag
const LOTE_INSERCAO = 500;
export const ESTADOS = ["completa", "apenas_banco", "parcial", "falha"];

// Ordem de inserção (chaves estrangeiras). O livro de migrations não entra
// nos dados: a restauração registra o próprio (origem "restauracao") e o
// original fica no pacote como evidência. Toda tabela das migrations
// (validacao.mjs, OBJETOS) precisa estar aqui - um teste confere.
export const TABELAS = [
  "ponto_estabelecimentos", "ponto_dispositivos", "ponto_estabelecimento_obras", "ponto_pareamentos", "ponto_marcacoes",
  "ponto_biometrias", "ponto_responsaveis", "ponto_eventos", "ponto_arp_contadores", "ponto_arp_registros",
  "ponto_tempo_verificacoes", "ponto_apropriacoes", "ponto_apropriacoes_auditoria", "ponto_estabelecimentos_auditoria",
];

const sha = v => crypto.createHash("sha256").update(v).digest("hex");
const binario = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const shaLinhas = linhas => sha(linhas.join("\n"));
const objetos = (tabelas, t) => (tabelas[t] || []).map(l => (typeof l === "string" ? JSON.parse(l) : l));

export const chaveDoAmbiente = valor => {
  const k = Buffer.from(String(valor || ""), "base64");
  if (k.length !== 32) throw new Error("chave do backup do ponto: base64 de 32 bytes (PONTO_BACKUP_KEY)");
  return k;
};

async function existe(db, tabela) {
  const [l] = await db.query(`select to_regclass($1) is not null as e`, [`public.${tabela}`]);
  return !!l.e;
}

// ---------------------------------------------------------------- registros cifrados
export function saidaMemoria() {
  const partes = []; let tamanho = 0;
  return {
    reiniciar() { partes.length = 0; tamanho = 0; },
    escrever(b) { partes.push(b); tamanho += b.length; },
    get tamanho() { return tamanho; },
    fechar() {},
    conteudo: () => Buffer.concat(partes),
  };
}
// Arquivo: grava direto no disco (permissão 0600), registro a registro.
export function saidaArquivo(caminho) {
  const fd = fs.openSync(caminho, "w", 0o600); let tamanho = 0, fechado = false;
  return {
    reiniciar() { fs.ftruncateSync(fd, 0); tamanho = 0; },
    escrever(b) { fs.writeSync(fd, b, 0, b.length, tamanho); tamanho += b.length; },
    get tamanho() { return tamanho; },
    fechar() { if (fechado) return; fechado = true; fs.fsyncSync(fd); fs.closeSync(fd); },
  };
}
const fonteMemoria = buf => ({ tamanho: buf.length, ler: (pos, n) => buf.subarray(pos, pos + n), fechar() {} });
export function fonteArquivo(caminho) {
  const fd = fs.openSync(caminho, "r"), tamanho = fs.fstatSync(fd).size;
  return { tamanho, ler(pos, n) { const b = Buffer.alloc(Math.max(0, Math.min(n, tamanho - pos))); fs.readSync(fd, b, 0, b.length, pos); return b; }, fechar: () => fs.closeSync(fd) };
}

function cifrar(chave, claro, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", chave, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const corpo = Buffer.concat([c.update(claro), c.final()]);
  const n = Buffer.alloc(4); n.writeUInt32BE(corpo.length);
  return Buffer.concat([n, iv, c.getAuthTag(), corpo]);
}
function decifrar(fonte, pos, chave, aad) {
  if (!Number.isSafeInteger(pos) || pos < MAGICO.length || pos + CAB_REGISTRO > fonte.tamanho) throw new Error("pacote: registro fora do arquivo");
  const cab = fonte.ler(pos, CAB_REGISTRO), n = cab.readUInt32BE(0);
  if (pos + CAB_REGISTRO + n > fonte.tamanho) throw new Error("pacote: registro truncado");
  const d = crypto.createDecipheriv("aes-256-gcm", chave, cab.subarray(4, 16));
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(cab.subarray(16, 32));
  return Buffer.concat([d.update(fonte.ler(pos + CAB_REGISTRO, n)), d.final()]);
}

// ---------------------------------------------------------------- referências e consistência
// Fotos que o banco diz que existem: batida (formato 2 e legado) e cadastro facial.
export function referenciasDeFotos(tabelas) {
  const refs = [];
  for (const e of objetos(tabelas, "ponto_eventos")) {
    if (e.foto_sha256) refs.push({ caminho: caminhoFotoMarcacao(e.obra_id, e.marcado_em, e.event_id), sha256: e.foto_sha256, tipo: "batida" });
  }
  for (const m of objetos(tabelas, "ponto_marcacoes")) {
    if (m.foto_sha256) refs.push({ caminho: caminhoFotoMarcacao(m.obra_id, m.marcado_em, m.id), sha256: m.foto_sha256, tipo: "batida_legado" });
  }
  for (const b of objetos(tabelas, "ponto_biometrias")) {
    for (const f of Array.isArray(b.fotos) ? b.fotos : []) if (f?.caminho) refs.push({ caminho: f.caminho, sha256: f.sha256 || null, tipo: "cadastro" });
  }
  return refs.sort((a, b) => binario(a.caminho, b.caminho));
}

// Cruza referências do banco com os arquivos baixados.
export function consistencia({ refs, fotos, mudouDuranteBackup, tentativas, incluidas }) {
  if (!incluidas) return { qualidade: "sem_fotos", referencias: refs.length, tentativas, motivo: "backup sem fotos (--com-fotos não usado): não serve para recuperação integral" };
  const porCaminho = new Map(fotos.map(f => [f.caminho, f]));
  const referenciados = new Set(refs.map(r => r.caminho));
  const semArquivo = refs.filter(r => !porCaminho.has(r.caminho)).map(r => ({ caminho: r.caminho, tipo: r.tipo }));
  const hashDivergente = refs.filter(r => r.sha256 && porCaminho.has(r.caminho) && porCaminho.get(r.caminho).sha256 !== r.sha256).map(r => ({ caminho: r.caminho, tipo: r.tipo }));
  const orfaos = fotos.filter(f => !referenciados.has(f.caminho)).map(f => ({ caminho: f.caminho }));
  // Inconsistente: prova adulterada/trocada, cadastro sem foto, ou bucket
  // mudando o tempo todo. Pendências: batida sem foto (o aparelho envia
  // depois da ARP - pode estar a caminho) e órfãos (foto de evento posterior
  // ao retrato do banco).
  let qualidade = "consistente";
  if (hashDivergente.length || mudouDuranteBackup || semArquivo.some(s => s.tipo === "cadastro")) qualidade = "inconsistente";
  else if (semArquivo.length || orfaos.length) qualidade = "consistente_com_pendencias";
  return { qualidade, referencias: refs.length, arquivos: fotos.length, semArquivo, orfaos, hashDivergente, mudouDuranteBackup, tentativas };
}
// No manifesto (texto claro) só as contagens; as listas (com IDs internos)
// ficam dentro do pacote cifrado.
const consistenciaResumida = c => c && ({ ...c, semArquivo: c.semArquivo?.length ?? 0, orfaos: c.orfaos?.length ?? 0, hashDivergente: c.hashDivergente?.length ?? 0 });

// Mudança real no meio do backup: um arquivo que JÁ estava listado mudou ou
// sumiu. Arquivo novo é de batida posterior ao retrato do banco - não conta.
function mudouNoMeio(antes, depois) {
  const d = new Map(depois.map(i => [i.caminho, i]));
  return antes.some(a => { const x = d.get(a.caminho); return !x || (x.tamanho ?? null) !== (a.tamanho ?? null) || (x.versao ?? null) !== (a.versao ?? null); });
}

// ---------------------------------------------------------------- backup
// Lê tudo (somente leitura). storage opcional (storages.mjs). pacote
// opcional (novoPacote): as fotos vão direto para ele, uma a uma; sem ele,
// ficam na memória (ensaios e testes) e empacotar() grava depois.
export async function exportar({ db, storage = null, tentativas = 3, pacote = null }) {
  for (let tentativa = 1; ; tentativa += 1) {
    pacote?.reiniciar();
    const antes = storage ? await storage.listar() : [];
    const tabelas = {}; let livro = []; const esquema = [];
    await db.transacao(async () => {
      await db.exec("set transaction isolation level repeatable read, read only");
      await db.exec("set local timezone = 'UTC'");
      for (const t of TABELAS) {
        if (!(await existe(db, t))) continue;
        tabelas[t] = (await db.query(`select to_jsonb(x)::text as l from public.${t} x`)).map(r => r.l).sort(binario);
      }
      livro = (await existe(db, "ponto_migracoes_aplicadas"))
        ? (await db.query("select arquivo, sha256, modo, aplicada_em::text as aplicada_em, origem from public.ponto_migracoes_aplicadas order by arquivo")) : [];
      // Versão do esquema mesmo sem livro (produção hoje): migrations completas.
      for (const arquivo of Object.keys(OBJETOS)) if ((await validarMigracao(db, arquivo)).completa) esquema.push(arquivo);
    });
    const fotos = []; let sumiu = false;
    for (const { caminho } of antes) {
      const baixada = await storage.baixar(caminho);
      if (!baixada) { sumiu = true; continue; }                // sumiu entre listar e baixar
      const bytes = Buffer.from(baixada);
      if (pacote) pacote.foto(caminho, bytes);
      fotos.push({ caminho, sha256: sha(bytes), bytes: bytes.length, ...(pacote ? {} : { conteudo: bytes }) });
    }
    const depois = storage ? await storage.listar() : [];
    const mudou = sumiu || mudouNoMeio(antes, depois);
    if (mudou && tentativa < tentativas) continue;
    const refs = referenciasDeFotos(tabelas);
    return { tabelas, livro, esquema, fotos, consistencia: consistencia({ refs, fotos, mudouDuranteBackup: mudou, tentativas: tentativa, incluidas: !!storage }) };
  }
}

// Manifesto de migrations para recriar o esquema na restauração: o livro do
// pacote, ou (backup tirado antes do livro) as migrations completas, com o
// SHA-256 dos arquivos atuais. lerArquivo(arquivo) -> conteúdo.
export async function manifestoDoEsquema(dados, lerArquivo) {
  if (dados.livro?.length) return dados.livro.map(l => ({ arquivo: l.arquivo, sha256: l.sha256 }));
  return Promise.all((dados.esquema || []).map(async arquivo => ({ arquivo, sha256: sha256Migracao(await lerArquivo(arquivo)) })));
}

// Resumo fiscal sem expor hash: por estabelecimento, último NSR, quantos
// registros, contador, SHA-256 da sequência de hashes e se a cadeia confere.
export async function resumoFiscal(tabelas) {
  const eventos = new Map(objetos(tabelas, "ponto_eventos").map(e => [e.event_id, e]));
  const contadores = new Map(objetos(tabelas, "ponto_arp_contadores").map(c => [c.estabelecimento_id, c]));
  const porEstab = new Map();
  for (const r of objetos(tabelas, "ponto_arp_registros")) {
    if (!porEstab.has(r.estabelecimento_id)) porEstab.set(r.estabelecimento_id, []);
    porEstab.get(r.estabelecimento_id).push(r);
  }
  const resumo = [];
  for (const [estab, regs] of [...porEstab.entries()].sort((a, b) => binario(a[0], b[0]))) {
    regs.sort((a, b) => Number(a.nsr) - Number(b.nsr));
    const cadeia = await verificarCadeiaFiscal(regs.map(r => {
      const e = eventos.get(r.event_id) || {};
      return { estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto", cpf: e.cpf, employeeId: e.employee_id,
        marcadoEm: e.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
        localHash: e.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash };
    }), async t => sha(t));
    const c = contadores.get(estab);
    resumo.push({ estabelecimentoId: estab, registros: regs.length, ultimoNsr: Number(regs.at(-1).nsr), cadeiaSha256: sha(regs.map(r => r.fiscal_hash).join("")),
      cadeiaIntegra: cadeia.ok, contadorConfere: !!c && Number(c.ultimo_nsr) === Number(regs.at(-1).nsr) && c.ultimo_hash_fiscal === regs.at(-1).fiscal_hash });
  }
  return resumo;
}

const listaDeFotos = fotos => sha(fotos.map(f => `${f.caminho}:${f.sha256}:${f.bytes}`).join("\n"));
const shaDoManifesto = m => sha(JSON.stringify([m.formato, m.criadoEm, m.origem, m.autorizadoPor, m.tabelas, m.fotos, m.livro, m.esquema, m.fiscal]));

// Escritor do pacote. foto() grava cada foto já cifrada; finalizar() grava
// as tabelas, o índice e o rodapé e devolve o manifesto.
export function novoPacote({ chave, saida = saidaMemoria() }) {
  let fotos = [];
  const iniciar = () => { saida.reiniciar(); fotos = []; saida.escrever(MAGICO); };
  iniciar();
  return {
    saida,
    reiniciar: iniciar,
    foto(caminho, bytes) {
      const s = sha(bytes), pos = saida.tamanho;
      saida.escrever(cifrar(chave, bytes, `foto:${fotos.length}:${caminho}:${s}`));
      fotos.push({ caminho, sha256: s, bytes: bytes.length, pos });
    },
    async finalizar({ dados, agora = new Date().toISOString(), origem, autorizadoPor }) {
      if (!autorizadoPor) throw new Error("backup do ponto exige quem autorizou (dado pessoal e biométrico)");
      const meta = fotos.map(({ caminho, sha256, bytes }) => ({ caminho, sha256, bytes }));
      if (listaDeFotos(meta) !== listaDeFotos(dados.fotos)) throw new Error("pacote: as fotos gravadas não conferem com as exportadas");
      const posTabelas = {}, tabelas = {};
      for (const [t, linhas] of Object.entries(dados.tabelas)) {
        posTabelas[t] = saida.tamanho;
        saida.escrever(cifrar(chave, gzipSync(Buffer.from(JSON.stringify(linhas), "utf8")), `tabela:${t}`));
        tabelas[t] = { linhas: linhas.length, sha256: shaLinhas(linhas) };
      }
      const manifesto = {
        formato: FORMATO, criadoEm: agora, origem, autorizadoPor, tabelas,
        fotos: { incluidas: dados.consistencia?.qualidade !== "sem_fotos", quantidade: meta.length, bytes: meta.reduce((s, f) => s + f.bytes, 0),
          sha256: listaDeFotos(meta), consistencia: consistenciaResumida(dados.consistencia) },
        livro: dados.livro.map(l => ({ arquivo: l.arquivo, sha256: l.sha256, modo: l.modo })),
        esquema: dados.esquema,
        fiscal: await resumoFiscal(dados.tabelas),
      };
      manifesto.sha256 = shaDoManifesto(manifesto);
      const indice = { formato: FORMATO, criadoEm: agora, livro: dados.livro, esquema: dados.esquema, consistencia: dados.consistencia, tabelas: posTabelas, fotos };
      const posIndice = saida.tamanho;
      saida.escrever(cifrar(chave, gzipSync(Buffer.from(JSON.stringify(indice), "utf8")), `indice:${manifesto.sha256}`));
      const rodape = Buffer.alloc(16); FIM.copy(rodape); rodape.writeBigUInt64BE(BigInt(posIndice), 8);
      saida.escrever(rodape);
      saida.fechar();
      return manifesto;
    },
  };
}

// Empacota na memória (ensaios e testes): fotos de exportar() sem pacote.
export async function empacotar({ dados, chave, agora = new Date().toISOString(), origem, autorizadoPor }) {
  if (!autorizadoPor) throw new Error("backup do ponto exige quem autorizou (dado pessoal e biométrico)");
  const p = novoPacote({ chave });
  for (const f of dados.fotos) {
    if (!f.conteudo) throw new Error("empacotar: foto sem conteúdo (exportar com pacote grava as fotos direto nele)");
    p.foto(f.caminho, f.conteudo);
  }
  const manifesto = await p.finalizar({ dados, agora, origem, autorizadoPor });
  return { manifesto, corpo: p.saida.conteudo() };
}

// Abre e confere contra o manifesto: chave errada, registro adulterado,
// manifesto editado ou foto corrompida -> erro. As fotos são conferidas uma
// a uma (lidas e descartadas); dados.lerFoto(i) relê cada uma sob demanda.
export function abrir({ corpo, fonte, chave, manifesto }) {
  const f = fonte || fonteMemoria(Buffer.from(corpo));
  if (manifesto?.formato !== FORMATO) throw new Error("pacote: manifesto de outro formato");
  if (f.tamanho < MAGICO.length + 16 || !f.ler(0, MAGICO.length).equals(MAGICO)) throw new Error("pacote: formato inválido");
  const rodape = f.ler(f.tamanho - 16, 16);
  if (!rodape.subarray(0, 8).equals(FIM)) throw new Error("pacote: rodapé inválido (arquivo incompleto?)");
  if (shaDoManifesto(manifesto) !== manifesto.sha256) throw new Error("pacote: o manifesto foi alterado");
  const indice = JSON.parse(gunzipSync(decifrar(f, Number(rodape.readBigUInt64BE(8)), chave, `indice:${manifesto.sha256}`)).toString("utf8"));
  if (indice.formato !== FORMATO) throw new Error("pacote: formato não confere");
  const tabelas = {};
  if (Object.keys(indice.tabelas).sort().join() !== Object.keys(manifesto.tabelas).sort().join()) throw new Error("pacote: conjunto de tabelas não confere com o manifesto");
  for (const [t, info] of Object.entries(manifesto.tabelas)) {
    const linhas = JSON.parse(gunzipSync(decifrar(f, indice.tabelas[t], chave, `tabela:${t}`)).toString("utf8"));
    if (linhas.length !== info.linhas || shaLinhas(linhas) !== info.sha256) throw new Error(`pacote: ${t} não confere com o manifesto`);
    tabelas[t] = linhas;
  }
  const fotos = indice.fotos.map(({ caminho, sha256, bytes }) => ({ caminho, sha256, bytes }));
  if (fotos.length !== manifesto.fotos.quantidade || listaDeFotos(fotos) !== manifesto.fotos.sha256) throw new Error("pacote: conjunto de fotos não confere com o manifesto");
  const lerFoto = i => {
    const m = indice.fotos[i];
    const b = decifrar(f, m.pos, chave, `foto:${i}:${m.caminho}:${m.sha256}`);
    if (b.length !== m.bytes || sha(b) !== m.sha256) throw new Error(`pacote: foto ${m.caminho} corrompida no pacote`);
    return b;
  };
  for (let i = 0; i < fotos.length; i += 1) lerFoto(i);
  return { formato: indice.formato, criadoEm: indice.criadoEm, tabelas, livro: indice.livro, esquema: indice.esquema, consistencia: indice.consistencia, fotos, lerFoto };
}

// ---------------------------------------------------------------- restauração
// Grava cada foto do pacote no destino e RELÊ para conferir. Idempotente:
// foto já presente e idêntica conta como restaurada (nova tentativa depois
// de falha). Nunca sobrescreve foto diferente.
export async function restaurarFotos({ dados, storage, conferidas = new Set() }) {
  const r = { noPacote: dados.fotos.length, restauradas: 0, verificadas: 0, falhasEscrita: [], ausentes: [], corrompidas: [] };
  for (let i = 0; i < dados.fotos.length; i += 1) {
    const f = dados.fotos[i];
    const esperado = dados.lerFoto(i);
    try {
      const atual = await storage.baixar(f.caminho);
      if (!atual || Buffer.compare(Buffer.from(atual), esperado) !== 0) {
        if (atual) { r.corrompidas.push({ caminho: f.caminho, motivo: "já existe outra foto no destino" }); continue; }
        await storage.enviar(f.caminho, esperado);
      }
      r.restauradas += 1;
    } catch (e) {
      r.falhasEscrita.push({ caminho: f.caminho, motivo: String(e.message || e).slice(0, 160) });
      continue;
    }
    const lida = await storage.baixar(f.caminho);
    if (!lida) r.ausentes.push({ caminho: f.caminho });
    else if (lida.length !== f.bytes) r.corrompidas.push({ caminho: f.caminho, motivo: `tamanho ${lida.length} ≠ ${f.bytes} (truncada)` });
    else if (sha(lida) !== f.sha256) r.corrompidas.push({ caminho: f.caminho, motivo: "SHA-256 diferente (corrompida ou substituída)" });
    else { r.verificadas += 1; conferidas.add(f.caminho); }
  }
  return r;
}

async function sequencias(db) {
  return db.query(`select c.relname as tabela, a.attname as coluna, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any($1::text[]) and a.attidentity <> ''`, [TABELAS]);
}

// Confere o banco restaurado (retrato em UTC, como o backup): linhas e
// SHA-256 por tabela, cadeia fiscal e contadores, e sequências à frente dos
// dados (senão o próximo INSERT colide na chave primária).
async function bancoConfere({ db, manifesto }) {
  const atual = {}, sequenciasAtrasadas = [];
  await db.transacao(async () => {
    await db.exec("set transaction isolation level repeatable read, read only");
    await db.exec("set local timezone = 'UTC'");
    for (const t of TABELAS) {
      if (!(await existe(db, t))) continue;
      atual[t] = (await db.query(`select to_jsonb(x)::text as l from public.${t} x`)).map(r => r.l).sort(binario);
    }
    for (const s of await sequencias(db)) {
      const [l] = await db.query(`select (select coalesce(max(${s.coluna}), 0) from public.${s.tabela})::text as maximo, last_value::text as ultimo, is_called from ${s.seq}`);
      const proxima = BigInt(l.ultimo) + (l.is_called ? 1n : 0n);
      if (proxima <= BigInt(l.maximo)) sequenciasAtrasadas.push(`${s.tabela}.${s.coluna}`);
    }
  });
  const divergentes = Object.keys(manifesto.tabelas).filter(t => (atual[t] || []).length !== manifesto.tabelas[t].linhas || shaLinhas(atual[t] || []) !== manifesto.tabelas[t].sha256);
  const fiscal = await resumoFiscal(atual);
  return { divergentes, sequenciasAtrasadas, fiscal, fiscalConfere: JSON.stringify(fiscal) === JSON.stringify(manifesto.fiscal) && fiscal.every(f => f.cadeiaIntegra && f.contadorConfere) };
}

// O destino precisa ser NOVO. Aceita só o esquema que uma tentativa
// anterior DESTA ferramenta criou (livro só com origem "restauracao") e
// ainda vazio - nunca um banco que já tinha o ponto (ex.: produção antes do
// go-live, com as tabelas vazias).
async function recusaDoDestino(db) {
  const existentes = [];
  for (const t of TABELAS) if (await existe(db, t)) existentes.push(t);
  const temLivro = await existe(db, "ponto_migracoes_aplicadas");
  if (!existentes.length && !temLivro) return null;
  const origens = temLivro ? (await db.query("select distinct origem from public.ponto_migracoes_aplicadas")).map(l => l.origem) : [];
  if (!temLivro || !origens.length || origens.some(o => o !== "restauracao")) {
    return "restauração recusada: o destino já tem o esquema do ponto e ele não foi criado por esta ferramenta - só em banco NOVO e descartável";
  }
  for (const t of existentes) {
    const [{ n }] = await db.query(`select count(*)::int as n from public.${t}`);
    if (n > 0) return `restauração recusada: ${t} já tem ${n} linha(s) - só em banco vazio e descartável`;
  }
  return null;
}

// Restaura em banco NOVO (ou, com somenteFotos, só as fotos sobre um banco
// já restaurado e conferido - nova tentativa depois de falha nas fotos).
// aplicarEsquema(dados) recria o esquema (livro de migrations com
// manifestoDoEsquema). Devolve SEMPRE um relatório com estado.
export async function restaurar({ db, dados, manifesto, aplicarEsquema, storage = null, somenteFotos = false }) {
  const rel = { estado: "falha", banco: null, fotos: null, motivos: [] };
  try {
    if (!somenteFotos) {
      const recusa = await recusaDoDestino(db);
      if (recusa) { rel.motivos.push(recusa); return rel; }
      await aplicarEsquema(dados);
      // Linhas E sequências na mesma transação: uma queda no meio não deixa
      // dado sem a sequência ajustada.
      await db.transacao(async () => {
        await db.exec("set local session_replication_role = replica");
        for (const t of TABELAS) {
          const linhas = dados.tabelas[t] || [];
          for (let i = 0; i < linhas.length; i += LOTE_INSERCAO) {
            await db.query(`insert into public.${t} overriding system value select * from jsonb_populate_recordset(null::public.${t}, $1::text::jsonb)`,
              [`[${linhas.slice(i, i + LOTE_INSERCAO).join(",")}]`]);
          }
        }
        for (const s of await sequencias(db)) {
          await db.query(`select setval($1, coalesce((select max(${s.coluna}) from public.${s.tabela}), 0) + 1, false)`, [s.seq]);
        }
      });
    }
    const banco = await bancoConfere({ db, manifesto });
    rel.banco = { tabelas: Object.keys(manifesto.tabelas).length, linhas: Object.values(manifesto.tabelas).reduce((s, i) => s + i.linhas, 0), ...banco };
    if (banco.divergentes.length || !banco.fiscalConfere || banco.sequenciasAtrasadas.length) {
      if (banco.divergentes.length) rel.motivos.push(`banco não confere: ${banco.divergentes.join(", ")}`);
      else if (!banco.fiscalConfere) rel.motivos.push("banco não confere: cadeia fiscal/contador");
      if (banco.sequenciasAtrasadas.length) rel.motivos.push(`banco não confere: sequência atrás dos dados em ${banco.sequenciasAtrasadas.join(", ")}`);
      return rel;
    }
  } catch (e) {
    rel.motivos.push(`banco: ${String(e.message || e).slice(0, 200)}`);
    return rel;
  }
  // Banco conferido. Fotos (o que vale é o conteúdo autenticado do pacote):
  if (dados.consistencia?.qualidade === "sem_fotos") {
    rel.estado = "apenas_banco"; rel.motivos.push("o pacote não contém fotos (backup sem --com-fotos): recuperação integral impossível com este pacote");
    return rel;
  }
  if (!storage) {
    rel.estado = "apenas_banco"; rel.fotos = { noPacote: dados.fotos.length, restauradas: 0, verificadas: 0, falhasEscrita: [], ausentes: [], corrompidas: [] };
    rel.motivos.push(`${dados.fotos.length} foto(s) no pacote NÃO restaurada(s): sem destino de fotos - não satisfaz o gate de recuperação integral`);
    return rel;
  }
  const conferidas = new Set();
  rel.fotos = await restaurarFotos({ dados, storage, conferidas });
  const f = rel.fotos;
  // Toda foto que o BANCO restaurado referencia precisa estar no destino,
  // conferida, e com o SHA-256 que o banco registrou. Conferir só o que está
  // no pacote não basta: se a prova já faltava ou estava trocada na origem,
  // o pacote sai sem ela e "todas as fotos do pacote" seria falso conforto.
  const shaNoPacote = new Map(dados.fotos.map(x => [x.caminho, x.sha256]));
  f.referencias = 0; f.referenciasSemFoto = []; f.referenciasDivergentes = [];
  for (const ref of referenciasDeFotos(dados.tabelas)) {
    f.referencias += 1;
    if (!conferidas.has(ref.caminho)) f.referenciasSemFoto.push({ caminho: ref.caminho, tipo: ref.tipo });
    else if (ref.sha256 && shaNoPacote.get(ref.caminho) !== ref.sha256) f.referenciasDivergentes.push({ caminho: ref.caminho, tipo: ref.tipo });
  }
  const fotosDoPacoteOk = f.verificadas === f.noPacote && !f.falhasEscrita.length && !f.ausentes.length && !f.corrompidas.length;
  if (fotosDoPacoteOk && !f.referenciasSemFoto.length && !f.referenciasDivergentes.length) rel.estado = "completa";
  else {
    rel.estado = "parcial";
    if (!fotosDoPacoteOk) rel.motivos.push(`fotos: ${f.verificadas}/${f.noPacote} verificadas; ${f.falhasEscrita.length} falha(s) de escrita, ${f.ausentes.length} ausente(s), ${f.corrompidas.length} corrompida(s)/substituída(s)`);
    if (f.referenciasSemFoto.length) rel.motivos.push(`${f.referenciasSemFoto.length} registro(s) do banco sem foto conferida no destino (faltava na origem ou não foi restaurada)`);
    if (f.referenciasDivergentes.length) rel.motivos.push(`${f.referenciasDivergentes.length} foto(s) com SHA-256 diferente do registrado no banco (prova trocada ou adulterada na origem)`);
  }
  return rel;
}
