export const UPLOAD_DESTINATION = Object.freeze({
  WORK: "work",
  CHAT: "chat",
});

const CHAT_MIME_ALLOWLIST = Object.freeze([
  "image/",
  "audio/",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
]);

export const uploadDestination = folder => (
  folder === UPLOAD_DESTINATION.CHAT
    ? UPLOAD_DESTINATION.CHAT
    : UPLOAD_DESTINATION.WORK
);

export function canUploadToDestination(user, { obraId, folder } = {}) {
  if (!user) return false;
  if (uploadDestination(folder) === UPLOAD_DESTINATION.CHAT) return true;
  if (!user.obraId) return true;
  return String(obraId || "") === String(user.obraId);
}

export function isAcceptedUploadMime(mime, folder) {
  const value = String(mime || "").toLowerCase();
  if (uploadDestination(folder) === UPLOAD_DESTINATION.CHAT) {
    return CHAT_MIME_ALLOWLIST.some(prefix => value.startsWith(prefix));
  }
  return value.startsWith("image/");
}

export function uploadStoragePrefix({ obraId, folder } = {}) {
  if (uploadDestination(folder) === UPLOAD_DESTINATION.CHAT) return "chat";
  return String(obraId || "geral").replace(/[^a-zA-Z0-9_-]/g, "") || "geral";
}
