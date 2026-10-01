// Armazém do aparelho: SQLite criptografado (SQLCipher, chave aleatória
// guardada no SecureStore). O SQL fica em armazem-sqlite-nucleo.js (testado
// contra SQLite real); aqui só a ligação com Expo, chave e arquivo.
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { criarArmazemSobreBanco, prepararBanco, serializarBanco } from "./armazem-sqlite-nucleo";

const CHAVE_BANCO = "ponto-obra.chave-banco";
const NOME_BANCO = "ponto-obra.db";
// No Android o expo-sqlite informa um caminho puro; o File do expo-file-system quer URI.
const pastaBanco = () => { const d = String(SQLite.defaultDatabaseDirectory || ""); return d.startsWith("file://") ? d : `file://${d}`; };

// Erro de banco com tipo, para a tela saber o que oferecer.
export class BancoIndisponivel extends Error {
  constructor(tipo, causa) {
    super(tipo === "ilegivel" ? "banco local ilegível com a chave deste aparelho" : "banco local não abriu");
    this.tipo = tipo;   // "ilegivel" | "falha"
    this.causa = causa;
  }
}

async function chaveDoBanco() {
  let chave = await SecureStore.getItemAsync(CHAVE_BANCO);
  if (!chave) {
    // Chave nova só quando ainda não existe banco: com banco e sem chave, gerar
    // outra não abriria nada (e esconderia o problema).
    if (new File(pastaBanco(), NOME_BANCO).exists) throw new BancoIndisponivel("ilegivel", new Error("chave do banco ausente no SecureStore"));
    const bytes = Crypto.getRandomBytes(32);
    chave = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(CHAVE_BANCO, chave);
  }
  return chave;
}

const ehBancoIlegivel = e => /not a database|SQLITE_NOTADB|file is encrypted/i.test(String(e?.message || e));

export async function abrirArmazem() {
  let db = null;
  try {
    const chave = await chaveDoBanco();
    // Conexão única com a chave; transações nela mesma (ver serializarBanco).
    db = serializarBanco(await SQLite.openDatabaseAsync(NOME_BANCO));
    // Hexadecimal gerado aqui (nunca vem de fora): seguro dentro do PRAGMA.
    await db.execAsync(`PRAGMA key = '${chave}'`);
    await prepararBanco(db);
  } catch (e) {
    try { await db?.closeAsync(); } catch { /* já está com erro */ }
    if (e instanceof BancoIndisponivel) throw e;
    throw new BancoIndisponivel(ehBancoIlegivel(e) ? "ilegivel" : "falha", e);
  }
  const armazem = criarArmazemSobreBanco(db);
  armazem.fechar = () => db.closeAsync();
  return armazem;
}

// Recuperação de banco ilegível (chave perdida): o arquivo antigo é
// PRESERVADO com outro nome - nunca apagado - e um banco novo começa. O
// realinhamento com o servidor (sincronizacao.js) continua a sequência do NSR.
// Também usado ao parear o aparelho de novo (outro dispositivo no ARCD).
export async function arquivarBanco(motivo) {
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  for (const sufixo of ["", "-wal", "-shm"]) {
    const f = new File(pastaBanco(), `${NOME_BANCO}${sufixo}`);
    if (f.exists) f.rename(`ponto-obra.${motivo}.${carimbo}.db${sufixo}`);
  }
  // Banco ilegível: a chave atual pode ser a certa de um arquivo corrompido -
  // ela é guardada com o mesmo carimbo do arquivo (para perícia) antes de o
  // banco novo ganhar chave nova. Novo pareamento: a chave continua a mesma
  // e abre tanto o arquivo preservado quanto o novo.
  if (motivo === "ilegivel") {
    const atual = await SecureStore.getItemAsync(CHAVE_BANCO);
    if (atual) await SecureStore.setItemAsync(`${CHAVE_BANCO}.${carimbo}`, atual);
    await SecureStore.deleteItemAsync(CHAVE_BANCO);
  }
}
