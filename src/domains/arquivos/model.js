export const FILE_MAX_BYTES = 3 * 1024 * 1024;
export const FILE_EXTENSIONS = ['pdf','png','jpg','jpeg','webp','gif','txt','csv','doc','docx','xls','xlsx','ppt','pptx','dwg','dxf','rvt','rfa','ifc','zip'];
export const FILE_ACCEPT = FILE_EXTENSIONS.map(ext => `.${ext}`).join(',');
export const fileMime = name => ({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',txt:'text/plain',csv:'text/csv',zip:'application/zip'}[String(name).split('.').pop().toLowerCase()]||'application/octet-stream');
export const DEFAULT_FOLDERS = ['Contratos e ART / RRT','Projetos','Licenciamento','Financeiro','Diário e fotos','Medições','Entrega final'];
export function fileValidation(file) {
  if (!file?.size || file.size > FILE_MAX_BYTES) return 'Selecione um arquivo de até 3 MB. Para arquivos maiores, adicione um link da nuvem.';
  if (!FILE_EXTENSIONS.includes(String(file.name).split('.').pop().toLowerCase())) return 'Formato não permitido. Use PDF, imagem, documento, planilha, CAD, BIM ou ZIP.';
  return '';
}
export function fileUrl(value) {
  if (typeof value !== 'string') return null;
  if (/^\/api\/local-files\/[a-f0-9-]{36}$/.test(value)) return value;
  try {
    const url = new URL(value, 'https://marcell.invalid');
    if (url.username || url.password || !['http:','https:'].includes(url.protocol)) return null;
    if (value.startsWith('/api/microsoft/onedrive?') && url.origin === 'https://marcell.invalid' && url.searchParams.get('action') === 'file' && url.searchParams.get('driveId') && url.searchParams.get('itemId')) return value;
    return /^https?:\/\//i.test(value) ? url.href : null;
  } catch { return null; }
}
export const fileSize = value => value ? value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB` : 'Link';
export function folderPath(folders, id) {
  const path = [], seen = new Set();
  while (id && !seen.has(id)) { seen.add(id); const folder = folders.find(item => item.id === id); if (!folder) break; path.unshift(folder); id = folder.parentId; }
  return path;
}
