import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto';

const COOKIE = 'mrc_remembered_login';
const DURATION = 7 * 24 * 60 * 60;

function responseCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/data; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

export function clearRememberedLogin(res) {
  responseCookie(res, '', 0);
}

export function readRememberedLogin(req, key, now = Date.now()) {
  const cookie = String(req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`));
  if (!cookie || !key) return null;
  try {
    const sealed = Buffer.from(cookie.slice(COOKIE.length + 1), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, 12));
    decipher.setAuthTag(sealed.subarray(12, 28));
    const content = JSON.parse(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString('utf8'));
    return typeof content.refreshToken === 'string' && content.refreshToken && content.until > now ? content : null;
  } catch {
    return null;
  }
}

export function writeRememberedLogin(res, key, refreshToken, now = Date.now(), until = now + DURATION * 1000) {
  if (!key || !refreshToken || until <= now) return false;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify({refreshToken, until}), 'utf8'), cipher.final()]);
  responseCookie(res, Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url'), Math.ceil((until - now) / 1000));
  return true;
}

export const createRememberedLoginKey = secret => secret
  ? createHmac('sha256', secret).update('marcell:remembered-login:v1').digest()
  : null;
