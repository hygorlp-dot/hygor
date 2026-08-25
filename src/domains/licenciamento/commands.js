export const LICENSING_COMMAND = Object.freeze({
  LICENSE_CHECKLIST_SAVED: "LICENCA_CHECKLIST_SALVA",
  CONDOMINIUM_SAVED: "CONDOMINIO_SALVO",
});

export const LICENSING_COMMAND_TYPES = new Set(Object.values(LICENSING_COMMAND));

const fail = reason => ({ ok: false, reason });
const versionOf = item => Number(item?.version || 0);

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
    return { ok: true, entityId: id, data: { ...data, licencas: next } };
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
