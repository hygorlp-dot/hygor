// @ts-check
import { canAccessCompanyAttendanceArchive } from "../src/domains/ponto/permissions.js";

/** @typedef {{role?: string, active?: boolean, obraId?: string | null, accessTabs?: string[]}} ArchiveActor */
/** @typedef {{inicio?: unknown}} ArchiveMetadata */
/** @typedef {{key: string, updated_at: string | null, meta?: ArchiveMetadata | null}} ArchiveSummaryRow */
/** @typedef {{value: unknown, updated_at: string | null}} ArchiveRow */
/** @typedef {{key: string, updatedAt: string | null, meta: ArchiveMetadata}} ArchiveSummary */
/** @typedef {{status: 403, body: {error: string}} | {status: 200, body: {ok: true, arquivos: ArchiveSummary[]}}} ListArchiveResult */
/** @typedef {{status: 400 | 403 | 404, body: {error: string}} | {status: 200, body: {ok: true, arquivo: unknown, updatedAt: string | null}}} LoadArchiveResult */
/**
 * @param {{
 *   key: string,
 *   listArchiveRows: (pattern: string) => Promise<ArchiveSummaryRow[]>,
 *   readArchiveRow: (key: string) => Promise<ArchiveRow | null>,
 * }} options
 */
export function createAttendanceArchiveReader({ listArchiveRows, readArchiveRow, key: KEY }) {
  /** @param {unknown} qid */
  const chaveArquivo = (qid) => `${KEY}__arq__${qid}`;
  /** @param {unknown} qid */
  const quinzenaValida = (qid) => /^\d{4}-\d{2}-Q[12]$/.test(String(qid || ""));

  /** @param {ArchiveActor} usuario @returns {Promise<ListArchiveResult>} */
  async function listQuinzenaArchives(usuario) {
    if (!canAccessCompanyAttendanceArchive(usuario)) {
      return { status: 403, body: { error: "Sem permissão para ver os arquivos." } };
    }
    const linhas = await listArchiveRows(`${KEY}__arq__%`);
    const arquivos = linhas
      .map(({ key, updated_at, meta }) => ({ key, updatedAt: updated_at, meta: meta || {} }))
      .sort((a, b) => String(b.meta?.inicio || "").localeCompare(String(a.meta?.inicio || "")));
    return { status: 200, body: { ok: true, arquivos } };
  }

  /** @param {ArchiveActor} usuario @param {unknown} quinzenaId @returns {Promise<LoadArchiveResult>} */
  async function loadQuinzenaArchive(usuario, quinzenaId) {
    if (!canAccessCompanyAttendanceArchive(usuario)) {
      return { status: 403, body: { error: "Sem permissão para ler o arquivo." } };
    }
    if (!quinzenaValida(quinzenaId)) return { status: 400, body: { error: "Quinzena inválida." } };
    const linha = await readArchiveRow(chaveArquivo(quinzenaId));
    if (!linha) return { status: 404, body: { error: "Arquivo não encontrado." } };
    return { status: 200, body: { ok: true, arquivo: linha.value, updatedAt: linha.updated_at } };
  }

  return { chaveArquivo, quinzenaValida, listQuinzenaArchives, loadQuinzenaArchive };
}
