// Backup e restauração das tabelas e fotos do Ponto de Obra
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). O backup diário do ARCD
// (server/backup.js) cobre só company_app_data - NÃO estas tabelas nem o
// bucket de fotos.
//
// Pacote: cabeçalho + AES-256-GCM (IV 12 bytes, tag 16) sobre gzip do JSON
// estável - mesma construção de server/backup.js, formato próprio. O
// manifesto (arquivo separado) não tem dado pessoal: contagens, SHA-256 por
// tabela e por foto, consistência banco x Storage, topo de cada cadeia
// fiscal (resumido em SHA-256), versão do esquema e quem autorizou.
//
// CONSISTÊNCIA banco x Storage: não há transação entre os dois. O retrato
// é: lista o bucket -> retrato do banco (REPEATABLE READ READ ONLY) ->
// baixa as fotos -> lista de novo. Se o bucket mudou no meio, tenta de novo
// (até N vezes). Depois cruza as referências do banco com os arquivos:
// referência sem arquivo, arquivo órfão, hash divergente. A qualidade da
// cópia vai no manifesto - nunca se afirma consistência não comprovada.
//
// RESTAURAÇÃO: só em banco VAZIO; esquema pelo livro de migrations; linhas
// com session_replication_role = replica (triggers suspensos SÓ na
// transação de carga - como pg_restore --disable-triggers); cada foto
// gravada e RELIDA do destino para conferir o SHA-256. Estados:
//   completa      - banco conferido + TODAS as fotos do pacote restauradas e verificadas
//   apenas_banco  - banco conferido, fotos não restauradas (sem destino ou pacote sem fotos)
//   parcial       - banco conferido, alguma foto ausente/corrompida/não gravada
//   falha         - o banco não foi restaurado/conferido (nada é afirmado)
// Só "completa" satisfaz o gate de recuperação integral.
import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { verificarCadeiaFiscal } from "../../src/domains/ponto-eletronico/registro-fiscal.js";
import { caminhoFotoMarcacao } from "../../server/ponto-eletronico/fotos-caminho.js";
import { OBJETOS, validarMigracao } from "../migracoes-ponto/validacao.mjs";
import { sha256Migracao } from "../migracoes-ponto/livro.mjs";

export const FORMATO = "arcd-ponto-backup-v2";
const CABECALHO = Buffer.from("ARCD-PONTO-BACKUP-2\n", "utf8");
export const ESTADOS = ["completa", "apenas_banco", "parcial", "falha"];

// Ordem de inserção (chaves estrangeiras). O livro de migrations não entra
// nos dados: a restauração registra o próprio (origem "restauracao") e o
// original fica no pacote como evidência.
export const TABELAS = [
  "ponto_estabelecimentos", "ponto_dispositivos", "ponto_estabelecimento_obras", "ponto_pareamentos", "ponto_marcacoes",
  "ponto_biometrias", "ponto_responsaveis", "ponto_eventos", "ponto_arp_contadores", "ponto_arp_registros",
  "ponto_tempo_verificacoes", "ponto_apropriacoes", "ponto_apropriacoes_auditoria", "ponto_estabelecimentos_auditoria",
];

const estavel = v => {
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${estavel(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
};
const sha = v => crypto.createHash("sha256").update(v).digest("hex");

export const chaveDoAmbiente = valor => {
  const k = Buffer.from(String(valor || ""), "base64");
  if (k.length !== 32) throw new Error("chave do backup do ponto: base64 de 32 bytes (PONTO_BACKUP_KEY)");
  return k;
};

async function existe(db, tabela) {
  const [l] = await db.query(`select to_regclass($1) is not null as e`, [`public.${tabela}`]);
  return !!l.e;
}

// Fotos que o banco diz que existem: batida (formato 2 e legado) e cadastro facial.
export function referenciasDeFotos(tabelas) {
  const refs = [];
  for (const e of tabelas.ponto_eventos || []) {
    if (e.foto_sha256) refs.push({ caminho: caminhoFotoMarcacao(e.obra_id, new Date(e.marcado_em).toISOString(), e.event_id), sha256: e.foto_sha256, tipo: "batida" });
  }
  for (const m of tabelas.ponto_marcacoes || []) {
    if (m.foto_sha256) refs.push({ caminho: caminhoFotoMarcacao(m.obra_id, new Date(m.marcado_em).toISOString(), m.id), sha256: m.foto_sha256, tipo: "batida_legado" });
  }
  for (const b of tabelas.ponto_biometrias || []) {
    for (const f of Array.isArray(b.fotos) ? b.fotos : []) if (f?.caminho) refs.push({ caminho: f.caminho, sha256: f.sha256 || null, tipo: "cadastro" });
  }
  return refs.sort((a, b) => a.caminho.localeCompare(b.caminho));
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

const assinaturaLista = lista => estavel([...lista].map(i => [i.caminho, i.tamanho ?? null, i.versao ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

// Lê tudo (somente leitura). storage opcional (storages.mjs).
export async function exportar({ db, storage = null, tentativas = 3 }) {
  for (let tentativa = 1; ; tentativa += 1) {
    const antes = storage ? await storage.listar() : [];
    const tabelas = {}; let livro = []; const esquema = [];
    await db.transacao(async () => {
      await db.exec("set transaction isolation level repeatable read, read only");
      for (const t of TABELAS) {
        if (!(await existe(db, t))) continue;
        const linhas = (await db.query(`select to_jsonb(x) as l from public.${t} x`)).map(r => r.l);
        linhas.sort((a, b) => estavel(a).localeCompare(estavel(b)));
        tabelas[t] = linhas;
      }
      livro = (await existe(db, "ponto_migracoes_aplicadas"))
        ? (await db.query("select arquivo, sha256, modo, aplicada_em, origem from public.ponto_migracoes_aplicadas order by arquivo")) : [];
      // Versão do esquema mesmo sem livro (produção hoje): migrations completas.
      for (const arquivo of Object.keys(OBJETOS)) if ((await validarMigracao(db, arquivo)).completa) esquema.push(arquivo);
    });
    const fotos = [];
    for (const { caminho } of antes) {
      const bytes = await storage.baixar(caminho);
      if (!bytes) continue;                                   // sumiu entre listar e baixar: a segunda lista acusa
      fotos.push({ caminho, base64: Buffer.from(bytes).toString("base64"), sha256: sha(bytes), bytes: bytes.length });
    }
    const depois = storage ? await storage.listar() : [];
    const mudou = assinaturaLista(antes) !== assinaturaLista(depois) || fotos.length !== antes.length;
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
  const eventos = new Map((tabelas.ponto_eventos || []).map(e => [e.event_id, e]));
  const contadores = new Map((tabelas.ponto_arp_contadores || []).map(c => [c.estabelecimento_id, c]));
  const porEstab = new Map();
  for (const r of tabelas.ponto_arp_registros || []) {
    if (!porEstab.has(r.estabelecimento_id)) porEstab.set(r.estabelecimento_id, []);
    porEstab.get(r.estabelecimento_id).push(r);
  }
  const resumo = [];
  for (const [estab, regs] of [...porEstab.entries()].sort()) {
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

export async function empacotar({ dados, chave, agora = new Date().toISOString(), origem, autorizadoPor }) {
  if (!autorizadoPor) throw new Error("backup do ponto exige quem autorizou (dado pessoal e biométrico)");
  const manifesto = {
    formato: FORMATO, criadoEm: agora, origem, autorizadoPor,
    tabelas: Object.fromEntries(Object.entries(dados.tabelas).map(([t, l]) => [t, { linhas: l.length, sha256: sha(estavel(l)) }])),
    fotos: { incluidas: dados.consistencia?.qualidade !== "sem_fotos", quantidade: dados.fotos.length, bytes: dados.fotos.reduce((s, f) => s + f.bytes, 0),
      sha256: sha(estavel(dados.fotos.map(f => [f.caminho, f.sha256]))), consistencia: dados.consistencia },
    livro: dados.livro.map(l => ({ arquivo: l.arquivo, sha256: l.sha256, modo: l.modo })),
    esquema: dados.esquema,
    fiscal: await resumoFiscal(dados.tabelas),
  };
  manifesto.sha256 = sha(estavel({ tabelas: manifesto.tabelas, fotos: manifesto.fotos, livro: manifesto.livro, fiscal: manifesto.fiscal }));
  const claro = gzipSync(Buffer.from(estavel({ formato: FORMATO, criadoEm: agora, ...dados }), "utf8"), { level: 9 });
  const iv = crypto.randomBytes(12), cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const corpo = Buffer.concat([CABECALHO, iv, Buffer.alloc(16), cifra.update(claro), cifra.final()]);
  cifra.getAuthTag().copy(corpo, CABECALHO.length + 12);
  return { manifesto, corpo };
}

// Abre e confere contra o manifesto (chave errada ou pacote adulterado: erro).
export function abrir({ corpo, chave, manifesto }) {
  const raw = Buffer.from(corpo);
  if (raw.length < CABECALHO.length + 28 || !raw.subarray(0, CABECALHO.length).equals(CABECALHO)) throw new Error("pacote: formato inválido");
  if (manifesto?.formato !== FORMATO) throw new Error("pacote: manifesto de outro formato");
  const d = crypto.createDecipheriv("aes-256-gcm", chave, raw.subarray(CABECALHO.length, CABECALHO.length + 12));
  d.setAuthTag(raw.subarray(CABECALHO.length + 12, CABECALHO.length + 28));
  const dados = JSON.parse(gunzipSync(Buffer.concat([d.update(raw.subarray(CABECALHO.length + 28)), d.final()])).toString("utf8"));
  if (dados.formato !== FORMATO) throw new Error("pacote: formato não confere");
  for (const [t, info] of Object.entries(manifesto.tabelas)) {
    if ((dados.tabelas[t] || []).length !== info.linhas || sha(estavel(dados.tabelas[t] || [])) !== info.sha256) throw new Error(`pacote: ${t} não confere com o manifesto`);
  }
  for (const f of dados.fotos) {
    const b = Buffer.from(f.base64, "base64");
    if (b.length !== f.bytes || sha(b) !== f.sha256) throw new Error(`pacote: foto ${f.caminho} corrompida no pacote`);
  }
  if (dados.fotos.length !== manifesto.fotos.quantidade || sha(estavel(dados.fotos.map(f => [f.caminho, f.sha256]))) !== manifesto.fotos.sha256) {
    throw new Error("pacote: conjunto de fotos não confere com o manifesto");
  }
  return dados;
}

// Grava cada foto do pacote no destino e RELÊ para conferir. Idempotente:
// foto já presente e idêntica conta como restaurada (nova tentativa depois
// de falha). Nunca sobrescreve foto diferente.
export async function restaurarFotos({ dados, storage }) {
  const r = { noPacote: dados.fotos.length, restauradas: 0, verificadas: 0, falhasEscrita: [], ausentes: [], corrompidas: [] };
  for (const f of dados.fotos) {
    const esperado = Buffer.from(f.base64, "base64");
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
    else r.verificadas += 1;
  }
  return r;
}

async function bancoConfere({ db, manifesto }) {
  const atual = {};
  for (const t of TABELAS) {
    if (!(await existe(db, t))) continue;
    const linhas = (await db.query(`select to_jsonb(x) as l from public.${t} x`)).map(r => r.l);
    linhas.sort((a, b) => estavel(a).localeCompare(estavel(b)));
    atual[t] = linhas;
  }
  const divergentes = Object.keys(manifesto.tabelas).filter(t => (atual[t] || []).length !== manifesto.tabelas[t].linhas || sha(estavel(atual[t] || [])) !== manifesto.tabelas[t].sha256);
  const fiscal = await resumoFiscal(atual);
  return { divergentes, fiscal, fiscalConfere: estavel(fiscal) === estavel(manifesto.fiscal) && fiscal.every(f => f.cadeiaIntegra && f.contadorConfere) };
}

// Restaura em banco VAZIO (ou, com somenteFotos, só as fotos sobre um banco
// já restaurado e conferido - nova tentativa depois de falha nas fotos).
// aplicarEsquema(dados) recria o esquema (livro de migrations com
// manifestoDoEsquema). Devolve SEMPRE um relatório com estado.
export async function restaurar({ db, dados, manifesto, aplicarEsquema, storage = null, somenteFotos = false }) {
  const rel = { estado: "falha", banco: null, fotos: null, motivos: [] };
  try {
    if (!somenteFotos) {
      for (const t of TABELAS) {
        if (await existe(db, t)) {
          const [{ n }] = await db.query(`select count(*)::int as n from public.${t}`);
          if (n > 0) { rel.motivos.push(`restauração recusada: ${t} já tem ${n} linha(s) - só em banco vazio e descartável`); return rel; }
        }
      }
      await aplicarEsquema(dados);
      await db.transacao(async () => {
        await db.exec("set local session_replication_role = replica");
        for (const t of TABELAS) {
          const linhas = dados.tabelas[t];
          if (!linhas?.length) continue;
          await db.query(`insert into public.${t} overriding system value select * from jsonb_populate_recordset(null::public.${t}, $1::text::jsonb)`, [JSON.stringify(linhas)]);
        }
      });
      const seqs = await db.query(`select c.relname as tabela, a.attname as coluna from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) and a.attidentity <> ''`, [TABELAS]);
      for (const s of seqs) {
        await db.query(`select setval(pg_get_serial_sequence($1, $2), coalesce((select max(${s.coluna}) from public.${s.tabela}), 0) + 1, false)`, [`public.${s.tabela}`, s.coluna]);
      }
    }
    const banco = await bancoConfere({ db, manifesto });
    rel.banco = { tabelas: Object.keys(manifesto.tabelas).length, linhas: Object.values(manifesto.tabelas).reduce((s, i) => s + i.linhas, 0), ...banco };
    if (banco.divergentes.length || !banco.fiscalConfere) {
      rel.motivos.push(banco.divergentes.length ? `banco não confere: ${banco.divergentes.join(", ")}` : "banco não confere: cadeia fiscal/contador");
      return rel;
    }
  } catch (e) {
    rel.motivos.push(`banco: ${String(e.message || e).slice(0, 200)}`);
    return rel;
  }
  // Banco conferido. Fotos:
  if (!manifesto.fotos.incluidas) {
    rel.estado = "apenas_banco"; rel.motivos.push("o pacote não contém fotos (backup sem --com-fotos): recuperação integral impossível com este pacote");
    return rel;
  }
  if (!storage) {
    rel.estado = "apenas_banco"; rel.fotos = { noPacote: dados.fotos.length, restauradas: 0, verificadas: 0, falhasEscrita: [], ausentes: [], corrompidas: [] };
    rel.motivos.push(`${dados.fotos.length} foto(s) no pacote NÃO restaurada(s): sem destino de fotos - não satisfaz o gate de recuperação integral`);
    return rel;
  }
  rel.fotos = await restaurarFotos({ dados, storage });
  const f = rel.fotos;
  if (f.verificadas === f.noPacote && !f.falhasEscrita.length && !f.ausentes.length && !f.corrompidas.length) rel.estado = "completa";
  else {
    rel.estado = "parcial";
    rel.motivos.push(`fotos: ${f.verificadas}/${f.noPacote} verificadas; ${f.falhasEscrita.length} falha(s) de escrita, ${f.ausentes.length} ausente(s), ${f.corrompidas.length} corrompida(s)/substituída(s)`);
  }
  return rel;
}
