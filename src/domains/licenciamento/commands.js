export const LICENSING_COMMAND = Object.freeze({
  LICENSE_CHECKLIST_SAVED: "LICENCA_CHECKLIST_SALVA",
  CONDOMINIUM_SAVED: "CONDOMINIO_SALVO",
});

export const LICENSING_COMMAND_TYPES = new Set(Object.values(LICENSING_COMMAND));
// Condomínio é cadastro corporativo; só o checklist pertence a uma obra.
export const LICENSING_COMPANY_COMMAND_TYPES = new Set([LICENSING_COMMAND.CONDOMINIUM_SAVED]);

export const licensingCommandObraId = (data = {}, command = {}) =>
  command?.type === LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED ? String(command.payload?.license?.obraId || "") : "";

const fail = reason => ({ ok: false, reason });
const versionOf = item => Number(item?.version || 0);

// A seção `obras` é exclusiva do administrador em save-sections, mas anexar um
// documento ou vincular o condomínio no checklist precisa refletir dois campos
// na obra. Eles viajam no próprio comando e são aplicados aqui, campo a campo,
// em vez de o cliente regravar a lista inteira de obras (mesmo padrão de
// updateWorkspace em financeiro/payable-payment-commands.js).
const applyWorkspace = (obra, workspace) => {
  if (!workspace || typeof workspace !== "object") return obra;
  return {
    ...obra,
    oneDriveDriveId: String(workspace.driveId || obra.oneDriveDriveId || ""),
    oneDriveFolderId: String(workspace.folderId || obra.oneDriveFolderId || ""),
    oneDriveFolders: workspace.folders && typeof workspace.folders === "object"
      ? workspace.folders : obra.oneDriveFolders,
    oneDriveUrl: String(workspace.webUrl || obra.oneDriveUrl || ""),
  };
};

export const applyLicensingCommand = (data = {}, command = {}, now = new Date().toISOString()) => {
  if (!LICENSING_COMMAND_TYPES.has(command.type)) return null;

  if (command.type === LICENSING_COMMAND.LICENSE_CHECKLIST_SAVED) {
    const raw = command.payload?.license || {};
    const obraId = String(raw.obraId || "").trim();
    const id = String(raw.id || "").trim();
    if (!obraId || !id) return fail("Checklist de licenciamento sem obra ou identificação.");
    if (!(data.obras || []).some(item => String(item.id) === obraId)) {
      return fail("A obra do checklist de licenciamento não existe.");
    }
    const licenses = Array.isArray(data.licencas) ? data.licencas : [];
    const current = licenses.find(item => String(item.obraId) === obraId);
    if (versionOf(current) !== Number(command.expectedVersion || 0)) {
      return fail("O checklist de licenciamento foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.");
    }
    const record = {
      ...(current || {}), ...raw, id, obraId,
      version: versionOf(current) + 1, updatedAt: now,
      createdAt: current?.createdAt || raw.createdAt || now,
    };
    const next = current
      ? licenses.map(item => String(item.obraId) === obraId ? record : item)
      : [...licenses, record];
    const payload = command.payload || {};
    const linkCondo = Object.prototype.hasOwnProperty.call(payload, "obraCondominioId");
    const condoId = String(payload.obraCondominioId || "").trim();
    // O nome vem do cadastro do servidor, nunca do cliente; "" = fora de condomínio.
    const condo = condoId ? (data.condominios || []).find(item => String(item.id) === condoId) : null;
    if (linkCondo && condoId && !condo) return fail("O condomínio selecionado não existe.");
    const obras = (data.obras || []).map(obra => {
      if (String(obra.id) !== obraId) return obra;
      const linked = linkCondo ? { ...obra, condominioId: condoId, condominioNome: condo?.nome || "" } : obra;
      return applyWorkspace(linked, payload.workspace);
    });
    return { ok: true, entityId: id, data: { ...data, licencas: next, obras } };
  }

  const raw = command.payload?.condominium || {};
  const id = String(raw.id || "").trim();
  if (!id) return fail("Condomínio sem identificação.");
  if (!String(raw.nome || "").trim()) return fail("Informe o nome do condomínio.");
  const condominiums = Array.isArray(data.condominios) ? data.condominios : [];
  const current = condominiums.find(item => String(item.id) === id);
  if (versionOf(current) !== Number(command.expectedVersion || 0)) {
    return fail("O condomínio foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.");
  }
  const record = {
    ...(current || {}), ...raw, id,
    version: versionOf(current) + 1, updatedAt: now,
    createdAt: current?.createdAt || raw.createdAt || now,
  };
  const next = current
    ? condominiums.map(item => item.id === id ? record : item)
    : [...condominiums, record];
  return { ok: true, entityId: id, data: { ...data, condominios: next } };
};
