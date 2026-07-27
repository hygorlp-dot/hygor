export const CLIENT_PORTAL_CAPABILITIES = Object.freeze([
  "viewProgress", "viewMedia", "viewWeeklyUpdates", "viewDecisions", "approveDecisions", "viewChanges", "approveChanges", "viewFinancial", "viewProjectCash", "viewProcurement", "approveMeasurements", "downloadDocuments", "sendMessages", "viewTeam", "openAssistance",
]);

const ALL = Object.freeze([...CLIENT_PORTAL_CAPABILITIES]);
const PROFILES = Object.freeze({
  owner: ALL,
  spouse: ALL,
  representative: ["viewProgress", "viewMedia", "viewWeeklyUpdates", "viewDecisions", "approveDecisions", "viewChanges", "approveChanges", "viewFinancial", "viewProjectCash", "viewProcurement", "approveMeasurements", "downloadDocuments", "sendMessages", "viewTeam", "openAssistance"],
  financial: ["viewProgress", "viewWeeklyUpdates", "viewFinancial", "viewProjectCash", "viewProcurement", "approveMeasurements", "downloadDocuments", "sendMessages"],
  external_architect: ["viewProgress", "viewMedia", "viewWeeklyUpdates", "viewDecisions", "viewChanges", "downloadDocuments", "sendMessages", "viewTeam"],
  observer: ["viewProgress", "viewMedia", "viewWeeklyUpdates", "viewDecisions", "viewChanges", "downloadDocuments", "viewTeam"],
});

export function clientPortalPermissions(client = {}) {
  const base = new Set(PROFILES[client.profile] || []);
  for (const capability of client.grant || []) if (CLIENT_PORTAL_CAPABILITIES.includes(capability)) base.add(capability);
  for (const capability of client.revoke || []) base.delete(capability);
  return Object.fromEntries(CLIENT_PORTAL_CAPABILITIES.map(capability => [capability, base.has(capability)]));
}

export function authorizeClientPortalAccess({ client, projectId, capability } = {}) {
  if (!client || client.active === false) return { ok:false, status:401, error:"Sessão do portal inválida." };
  if (!projectId || !(client.projectIds || []).map(String).includes(String(projectId))) return { ok:false, status:403, error:"Você não possui acesso a esta obra." };
  const permissions = clientPortalPermissions(client);
  if (capability && !permissions[capability]) return { ok:false, status:403, error:"Você não possui permissão para esta ação." };
  return { ok:true, permissions };
}
