import {isPatrimonyDocumentMime} from "../src/domains/patrimonio/document-policy.js";

export const UPLOAD_DESTINATION = Object.freeze({
  WORK: "work",
  CHAT: "chat",
  PATRIMONIO: "patrimonio",
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

export const uploadDestination = folder => {
  if(folder===UPLOAD_DESTINATION.CHAT)return UPLOAD_DESTINATION.CHAT;
  if(folder===UPLOAD_DESTINATION.PATRIMONIO)return UPLOAD_DESTINATION.PATRIMONIO;
  return UPLOAD_DESTINATION.WORK;
};

export function canUploadToDestination(user, { obraId, folder } = {}) {
  if (!user) return false;
  const destination=uploadDestination(folder);
  if (destination === UPLOAD_DESTINATION.CHAT) return true;
  if (destination === UPLOAD_DESTINATION.PATRIMONIO) {
    return ["admin","financeiro","compras"].includes(user.role) && (user.role==="admin" || !user.obraId);
  }
  if (!user.obraId) return true;
  return String(obraId || "") === String(user.obraId);
}

export function isAcceptedUploadMime(mime, folder) {
  const value = String(mime || "").toLowerCase();
  const destination=uploadDestination(folder);
  if (destination === UPLOAD_DESTINATION.CHAT) {
    return CHAT_MIME_ALLOWLIST.some(prefix => value.startsWith(prefix));
  }
  if (destination === UPLOAD_DESTINATION.PATRIMONIO) {
    return isPatrimonyDocumentMime(value);
  }
  return value.startsWith("image/");
}

export function uploadStoragePrefix({ obraId, folder } = {}) {
  const destination=uploadDestination(folder);
  if (destination === UPLOAD_DESTINATION.CHAT) return "chat";
  if (destination === UPLOAD_DESTINATION.PATRIMONIO) return "patrimonio";
  return String(obraId || "geral").replace(/[^a-zA-Z0-9_-]/g, "") || "geral";
}
