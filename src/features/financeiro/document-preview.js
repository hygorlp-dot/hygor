import {financialDocumentUrl} from '../../domains/financeiro/document-links.js';
const origin = 'https://marcell.invalid';

export function previewDocumentUrl(value) {
  return financialDocumentUrl(value);
}

export function isMicrosoftDocumentUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === 'onedrive.live.com' || host === '1drv.ms' || host === 'sharepoint.com' || host.endsWith('.sharepoint.com');
  } catch { return false; }
}

export function documentPreviewType(document = {}) {
  const mime = String(document.tipo || document.mimeType || document.file?.mimeType || '').toLowerCase().split(';')[0];
  let name = String(document.nome || document.name || '');
  try { name += ` ${new URL(document.url || document.webUrl, origin).pathname}`; } catch {}
  if (mime === 'application/pdf' || /\.pdf(?:\s|$)/i.test(name)) return 'pdf';
  if (['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'].includes(mime) || /\.(?:png|jpe?g|gif|webp|avif|bmp)(?:\s|$)/i.test(name)) return 'image';
  if (['text/xml','application/xml'].includes(mime) || /\.xml(?:\s|$)/i.test(name)) return 'xml';
  return 'unsupported';
}
