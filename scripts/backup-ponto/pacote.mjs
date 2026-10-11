// Backup e restauração das tabelas e fotos do Ponto de Obra
// (docs/PONTO-OBRA-BACKUP-RESTAURACAO.md). O backup diário do ARCD
// (server/backup.js) cobre só company_app_data - NÃO estas tabelas nem o
// bucket de fotos.
//
// Pacote: cabeçalho + AES-256-GCM (IV 12 bytes, tag 16) sobre gzip do JSON
// estável - mesma construção de server/backup.js, formato próprio. O
// manifesto (arquivo separado) não tem dado pessoal: contagens, SHA-256 por
// tabela e por foto, topo de cada cadeia fiscal (resumido em SHA-256, sem o
// hash cru), versão do esquema (livro de migrations) e quem autorizou.
//
// Restauração: só em banco VAZIO (nenhuma linha nas tabelas do ponto);
// esquema recriado pelas mesmas migrations (livro); linhas inseridas com
// session_replication_role = replica (triggers de imutabilidade e de FK
// suspensos SÓ nessa transação - como pg_restore --disable-triggers);
// depois tudo é conferido contra o manifesto e a cadeia fiscal recalculada.
import crypto from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { verificarCadeiaFiscal } from "../../src/domains/ponto-eletronico/registro-fiscal.js";
import { OBJETOS, validarMigracao } from "../migracoes-ponto/validacao.mjs";
import { sha256Migracao } from "../migracoes-ponto/livro.mjs";

export const FORMATO = "arcd-ponto-backup-v1";
const CABECALHO = Buffer.from("ARCD-PONTO-BACKUP-1\n", "utf8");

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

// Lê tudo (somente leitura). storage opcional: { listar() -> [{caminho}], baixar(caminho) -> Buffer }.
export async function exportar({ db, storage = null }) {
  const tabelas = {};
  for (const t of TABELAS) {
    if (!(await existe(db, t))) continue;
    const linhas = (await db.query(`select to_jsonb(x) as l from public.${t} x`)).map(r => r.l);
    linhas.sort((a, b) => estavel(a).localeCompare(estavel(b)));
    tabelas[t] = linhas;
  }
  const livro = (await existe(db, "ponto_migracoes_aplicadas"))
    ? (await db.query("select arquivo, sha256, modo, aplicada_em, origem from public.ponto_migracoes_aplicadas order by arquivo")) : [];
  const fotos = [];
  if (storage) for (const { caminho } of await storage.listar()) {
    const bytes = Buffer.from(await storage.baixar(caminho));
    fotos.push({ caminho, base64: bytes.toString("base64"), sha256: sha(bytes), bytes: bytes.length });
  }
  // Versão do esquema mesmo sem livro (produção hoje): migrations completas.
  const esquema = [];
  for (const arquivo of Object.keys(OBJETOS)) if ((await validarMigracao(db, arquivo)).completa) esquema.push(arquivo);
  return { tabelas, livro, esquema, fotos };
}

// Manifesto de migrations para recriar o esquema na restauração: o livro do
// pacote, ou (backup tirado antes do livro) as migrations completas, com o
// SHA-256 dos arquivos atuais. lerArquivo(arquivo) -> conteúdo.
export async function manifestoDoEsquema(dados, lerArquivo) {
  if (dados.livro?.length) return dados.livro.map(l => ({ arquivo: l.arquivo, sha256: l.sha256 }));
  return Promise.all((dados.esquema || []).map(async arquivo => ({ arquivo, sha256: sha256Migracao(await lerArquivo(arquivo)) })));
}

// Resumo fiscal sem expor hash: por estabelecimento, último NSR, quantos
// registros, SHA-256 da sequência de hashes e se a cadeia confere.
async function resumoFiscal(tabelas) {
  const eventos = new Map((tabelas.ponto_eventos || []).map(e => [e.event_id, e]));
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
    resumo.push({ estabelecimentoId: estab, registros: regs.length, ultimoNsr: Number(regs.at(-1).nsr), cadeiaSha256: sha(regs.map(r => r.fiscal_hash).join("")), cadeiaIntegra: cadeia.ok });
  }
  return resumo;
}

export async function empacotar({ dados, chave, agora = new Date().toISOString(), origem, autorizadoPor }) {
  if (!autorizadoPor) throw new Error("backup do ponto exige quem autorizou (dado pessoal e biométrico)");
  const manifesto = {
    formato: FORMATO, criadoEm: agora, origem, autorizadoPor,
    tabelas: Object.fromEntries(Object.entries(dados.tabelas).map(([t, l]) => [t, { linhas: l.length, sha256: sha(estavel(l)) }])),
    fotos: { quantidade: dados.fotos.length, bytes: dados.fotos.reduce((s, f) => s + f.bytes, 0), sha256: sha(estavel(dados.fotos.map(f => [f.caminho, f.sha256]))) },
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
  const d = crypto.createDecipheriv("aes-256-gcm", chave, raw.subarray(CABECALHO.length, CABECALHO.length + 12));
  d.setAuthTag(raw.subarray(CABECALHO.length + 12, CABECALHO.length + 28));
  const dados = JSON.parse(gunzipSync(Buffer.concat([d.update(raw.subarray(CABECALHO.length + 28)), d.final()])).toString("utf8"));
  if (dados.formato !== FORMATO) throw new Error("pacote: formato não confere");
  for (const [t, info] of Object.entries(manifesto.tabelas)) {
    if ((dados.tabelas[t] || []).length !== info.linhas || sha(estavel(dados.tabelas[t] || [])) !== info.sha256) throw new Error(`pacote: ${t} não confere com o manifesto`);
  }
  for (const f of dados.fotos) if (sha(Buffer.from(f.base64, "base64")) !== f.sha256) throw new Error(`pacote: foto ${f.caminho} corrompida`);
  return dados;
}

// Restaura em banco VAZIO. aplicarEsquema(dados) recria o esquema (livro de
// migrations com manifestoDoEsquema). storage opcional: { enviar(caminho, Buffer) }.
export async function restaurar({ db, dados, manifesto, aplicarEsquema, storage = null }) {
  for (const t of TABELAS) {
    if (await existe(db, t)) {
      const [{ n }] = await db.query(`select count(*)::int as n from public.${t}`);
      if (n > 0) throw new Error(`restauração recusada: ${t} já tem ${n} linha(s) - só em banco vazio e descartável`);
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
  // Sequências de identidade acompanham o maior id restaurado.
  const seqs = await db.query(`select c.relname as tabela, a.attname as coluna from pg_attribute a join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) and a.attidentity <> ''`, [TABELAS]);
  for (const s of seqs) {
    await db.query(`select setval(pg_get_serial_sequence($1, $2), coalesce((select max(${s.coluna}) from public.${s.tabela}), 0) + 1, false)`, [`public.${s.tabela}`, s.coluna]);
  }
  if (storage) for (const f of dados.fotos) await storage.enviar(f.caminho, Buffer.from(f.base64, "base64"));
  // Conferência final: o banco restaurado gera o mesmo manifesto.
  const novo = await exportar({ db });
  const conf = await empacotar({ dados: { ...novo, fotos: dados.fotos, livro: dados.livro, esquema: dados.esquema }, chave: crypto.randomBytes(32), origem: "conferencia", autorizadoPor: "conferencia" });
  const divergentes = Object.keys(manifesto.tabelas).filter(t => estavel(conf.manifesto.tabelas[t]) !== estavel(manifesto.tabelas[t]));
  if (divergentes.length) throw new Error(`restauração não confere: ${divergentes.join(", ")}`);
  if (estavel(conf.manifesto.fiscal) !== estavel(manifesto.fiscal)) throw new Error("restauração não confere: cadeia fiscal");
  return { tabelas: Object.keys(manifesto.tabelas).length, linhas: Object.values(manifesto.tabelas).reduce((s, i) => s + i.linhas, 0), fotos: dados.fotos.length, fiscal: conf.manifesto.fiscal };
}
