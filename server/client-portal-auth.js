import crypto from "node:crypto";

const SCRYPT_PREFIX = "scrypt-v1";
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 12;

export const PORTAL_SESSION_COOKIE = "arcd_client_session";

export function normalizePortalEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validPortalPassword(password) {
  const value = String(password || "");
  return value.length >= MIN_PASSWORD_LENGTH && /[a-z]/i.test(value) && /\d/.test(value);
}

export function hashPortalPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  if (!validPortalPassword(password)) throw new Error("A senha do portal deve ter ao menos 12 caracteres, letras e números.");
  const derived = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString("base64url");
  return `${SCRYPT_PREFIX}$${salt}$${derived}`;
}

export function verifyPortalPassword(password, storedHash) {
  const [prefix, salt, expected] = String(storedHash || "").split("$");
  if (prefix !== SCRYPT_PREFIX || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password || ""), salt, KEY_LENGTH).toString("base64url");
  const left = Buffer.from(actual), right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createPortalSessionToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashPortalSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function parseCookies(cookieHeader = "") {
  return Object.fromEntries(String(cookieHeader).split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

export function createPortalSessionCookie(token, { maxAgeSeconds = 60 * 60 * 12, secure = true } = {}) {
  return `${PORTAL_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api/client; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function clearPortalSessionCookie({ secure = true } = {}) {
  return `${PORTAL_SESSION_COOKIE}=; Path=/api/client; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
