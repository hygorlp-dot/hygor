// @ts-check
import { profileIndexOutdated } from "./data-codec.js";
import { projectDataForUser, publicUser } from "./data-projection.js";

/** @typedef {Record<string, unknown>} CompanySnapshot */
/** @typedef {{ id: string, nome?: string, role: string, email?: string, obraId?: string, accessTabs?: string[]|null }} WorkspaceUser */
/** @typedef {{ data: CompanySnapshot|null, updatedAt: string|null, user: WorkspaceUser }} WorkspaceQuery */
/** @typedef {{ data: ReturnType<typeof projectDataForUser>, updatedAt: string|null, usuario: ReturnType<typeof publicUser> }} WorkspaceResponse */

/**
 * @param {{
 *   anexarCustosArquivados: (data: CompanySnapshot|null) => Promise<CompanySnapshot>,
 *   lerIndicePerfis: () => Promise<unknown>,
 *   atualizarIndicePerfisSeguro: (data: CompanySnapshot|null) => Promise<void>
 * }} dependencies
 * @returns {(query: WorkspaceQuery) => Promise<WorkspaceResponse>}
 */
export function createCompanyWorkspaceLoader({ anexarCustosArquivados, lerIndicePerfis, atualizarIndicePerfisSeguro }) {
  return async function loadCompanyWorkspace({ data, updatedAt, user }) {
    const [complete, index] = await Promise.all([
      anexarCustosArquivados(data),
      lerIndicePerfis().catch(() => null),
    ]);
    // O índice de login e OneDrive pode estar desatualizado após comandos operacionais.
    if (profileIndexOutdated(index, data)) await atualizarIndicePerfisSeguro(data);
    return { data: projectDataForUser(complete, user), updatedAt, usuario: publicUser(user) };
  };
}
