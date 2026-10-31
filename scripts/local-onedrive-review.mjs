import crypto from 'node:crypto';
import {knownWorkspace, scopedWorks} from '../server/onedrive-scope.js';

export const LOCAL_ONEDRIVE_CALLBACK = 'http://localhost:4192/api/local-onedrive/callback';
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access https://graph.microsoft.com/Files.Read';
const fail = (status, message) => Object.assign(new Error(message), {status});
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const itemPath = (drive, item) => `/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(item)}`;

// This adapter belongs only to the loopback review server. No central-session
// helpers, database writes, folder preparation or production cookies are used.
export function createLocalOneDriveReview({clientId, clientSecret, authenticate, fetchImpl = fetch, now = Date.now}) {
  let session = null, refreshing = null;
  const pending = new Map();
  const signingKey = crypto.randomBytes(32);
  const configured = () => Boolean(clientId && clientSecret);
  const signature = (drive, item, expires) => crypto.createHmac('sha256', signingKey)
    .update(JSON.stringify([drive, item, expires])).digest('base64url');
  const fileLink = (drive, item) => {
    const expires = String(now() + 10 * 60_000);
    return `/api/microsoft/onedrive?${new URLSearchParams({action:'file', driveId:drive, itemId:item, expires, sig:signature(drive, item, expires)})}`;
  };
  async function tokenRequest(params) {
    const response = await fetchImpl(`${AUTHORITY}/token`, {
      method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId, client_secret:clientSecret, scope:SCOPES, ...params}),
      signal:AbortSignal.timeout(30_000), redirect:'error',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) throw fail(401, 'Não foi possível autenticar o OneDrive local. Confira a credencial e o endereço de retorno no Microsoft Entra.');
    // Never echo Microsoft's error_description: it may contain request details.
    return {accessToken:result.access_token, refreshToken:result.refresh_token,
      expiresAt:now() + Math.max(0, Number(result.expires_in || 0) - 60) * 1000};
  }
  async function accessToken() {
    if (!session) throw fail(401, 'Conecte o OneDrive neste ambiente local.');
    if (session.expiresAt > now()) return session.accessToken;
    if (!session.refreshToken) throw fail(401, 'A sessão local expirou. Conecte o OneDrive novamente.');
    if (!refreshing) {
      const previous = session;
      refreshing = tokenRequest({grant_type:'refresh_token', refresh_token:previous.refreshToken})
        .then(next => {session = {...next, refreshToken:next.refreshToken || previous.refreshToken}; return session.accessToken;})
        .finally(() => {refreshing = null;});
    }
    return refreshing;
  }
  async function graph(path, {contentRedirect = false} = {}) {
    const url = new URL(path.startsWith('/') ? `${GRAPH}${path}` : path);
    if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/') || url.username || url.password) throw fail(403, 'Destino de consulta não permitido.');
    const response = await fetchImpl(url.href, {method:'GET', headers:{authorization:`Bearer ${await accessToken()}`}, redirect:contentRedirect?'manual':'error', signal:AbortSignal.timeout(30_000)});
    if(contentRedirect && url.pathname.endsWith('/content') && response.status===302)return response;
    if (!response.ok) throw fail(response.status === 404 ? 404 : 502, 'Não foi possível consultar o documento no OneDrive.');
    return response;
  }
  async function assertScope(context, drive, item) {
    const roots = new Set(scopedWorks(context).map(knownWorkspace)
      .filter(ws => ws.driveId === drive && ws.folderId).map(ws => ws.folderId));
    if (!roots.size || !item) throw fail(403, 'O item não pertence às obras disponíveis para este usuário.');
    let current = item;
    const visited = new Set();
    for (let depth = 0; depth < 32 && current && !visited.has(current); depth++) {
      if (roots.has(current)) return;
      visited.add(current);
      const metadata = await (await graph(`${itemPath(drive, current)}?$select=id,parentReference`)).json();
      if (metadata.parentReference?.driveId && metadata.parentReference.driveId !== drive) break;
      current = String(metadata.parentReference?.id || '');
    }
    throw fail(403, 'O item está fora da pasta protegida da obra.');
  }
  async function sendFile(query, res) {
    const {driveId:drive = '', itemId:item = '', expires = '', sig} = query;
    const expiry = Number(expires);
    if (!drive || !item || !Number.isFinite(expiry) || expiry <= now() || expiry > now() + 10 * 60_000 || !safeEqual(sig, signature(drive, item, expires))) throw fail(403, 'O acesso ao documento expirou ou é inválido. Abra o memorial novamente.');
    // /content is the canonical download endpoint. A projected metadata
    // response can omit file/downloadUrl without the underlying file being
    // absent; never turn that omission into a fabricated 404.
    let response = await graph(`${itemPath(drive,item)}/content`, {contentRedirect:true});
    let downloadHops=0;
    while([301,302,303,307,308].includes(response.status)){
      if(++downloadHops>4)throw fail(502,'O OneDrive excedeu o limite de redirecionamentos.');
      const location=response.headers.get('location');
      if(!location)throw fail(502,'O OneDrive não informou o endereço de download.');
      const download = new URL(location);
      // OneDrive consumer also uses livefilestore/storage.msn endpoints, and
      // current Microsoft personal content hosts. Keep every hop constrained.
      const microsoftHost = /(?:^|\.)(?:sharepoint\.com|1drv\.com|onedrive\.com|live\.com|livefilestore\.com|storage\.msn\.com|microsoftpersonalcontent\.com)$/.test(download.hostname);
      if (download.protocol !== 'https:' || download.username || download.password || download.port || !microsoftHost){
        res.setHeader('x-marcell-download-host',download.hostname);
        throw fail(502, 'Endereço do documento não reconhecido.');
      }
      // The preauthenticated storage request must never receive the bearer.
      response = await fetchImpl(download.href, {method:'GET', redirect:'manual', signal:AbortSignal.timeout(60_000)});
    }
    if (!response.ok) throw fail(502, 'Não foi possível abrir o documento original.');
    const mime = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('content-type', mime);
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    // Uploaded HTML/SVG must never execute in the ERP origin.
    res.setHeader('content-security-policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
    return res.send(buffer);
  }
  async function handleApi(req, res) {
    try {
      const action = req.query?.action || req.body?.action;
      if (req.method === 'GET' && action === 'file') return await sendFile(req.query, res);
      if (req.method !== 'POST') throw fail(405, 'Método não permitido.');
      if (!['status', 'file-link', 'list-folder'].includes(action)) throw fail(403, 'Somente leitura: alterações no OneDrive estão bloqueadas.');
      const context = await authenticate(req.body || {});
      if (!context) throw fail(401, 'Sessão do aplicativo inválida.');
      if (action === 'status') return res.json({ok:true, connected:Boolean(session), localReview:true, readOnly:true, configured:configured()});
      const drive = String(req.body.driveId || '');
      const item = String((action === 'file-link' ? req.body.itemId : req.body.parentId) || '');
      if (!drive || !item) throw fail(400, 'Documento ou pasta sem identificação no OneDrive.');
      await assertScope(context, drive, item);
      if (action === 'file-link') return res.json({ok:true, url:fileLink(drive, item)});
      let path = `${itemPath(drive, item)}/children?$top=200&$select=id,name,folder,file,size,lastModifiedDateTime`, pages = 0;
      const items = [];
      while (path) {
        if (++pages > 50) throw fail(413, 'Pasta muito grande. Consulte uma subpasta.');
        const page = await (await graph(path)).json();
        for (const entry of page.value || []) items.push({id:entry.id, name:entry.name, type:entry.folder ? 'folder' : 'file',
          url:entry.folder ? '' : fileLink(drive, entry.id), size:Number(entry.size || 0),
          childCount:Number(entry.folder?.childCount || 0), lastModifiedDateTime:entry.lastModifiedDateTime || ''});
        path = page['@odata.nextLink'] || '';
      }
      items.sort((a,b) => a.type === b.type ? a.name.localeCompare(b.name, 'pt-BR', {sensitivity:'base'}) : a.type === 'folder' ? -1 : 1);
      return res.json({ok:true, items});
    } catch (error) {
      return res.status(error.status || 502).json({error:error.status ? error.message : 'Falha na consulta local ao OneDrive.', needsConnection:error.status === 401});
    }
  }
  async function handleOAuth(req, res, url) {
    const headers = {'cache-control':'no-store', 'referrer-policy':'no-referrer'};
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    try {
      if (req.method !== 'GET') throw fail(405, 'Método não permitido.');
      if (!configured()) throw fail(503, 'Configure MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET no .env.local.');
      if (url.pathname.endsWith('/connect')) {
        if (req.headers['sec-fetch-site'] && !['none', 'same-origin'].includes(req.headers['sec-fetch-site'])) throw fail(403, 'Abra a conexão pelo endereço local.');
        for (const [key, value] of pending) if (value.expiresAt <= now()) pending.delete(key);
        if (pending.size >= 20) throw fail(429, 'Há conexões em andamento. Aguarde alguns minutos.');
        const state = crypto.randomBytes(32).toString('base64url'), verifier = crypto.randomBytes(48).toString('base64url');
        pending.set(state, {verifier, expiresAt:now() + 10 * 60_000});
        res.setHeader('set-cookie', `marcell_local_ms_state=${state}; HttpOnly; SameSite=Lax; Path=/api/local-onedrive; Max-Age=600`);
        const target = new URL(`${AUTHORITY}/authorize`);
        target.search = new URLSearchParams({client_id:clientId, response_type:'code', redirect_uri:LOCAL_ONEDRIVE_CALLBACK,
          response_mode:'query', scope:SCOPES, state, code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method:'S256', prompt:'select_account'}).toString();
        res.statusCode = 302; res.setHeader('location', target.href); return res.end();
      }
      const state = url.searchParams.get('state') || '';
      const cookie = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('marcell_local_ms_state='))?.slice('marcell_local_ms_state='.length);
      const attempt = pending.get(state);
      if (!attempt || attempt.expiresAt <= now() || !safeEqual(cookie, state)) throw fail(403, 'Autorização local inválida ou expirada. Inicie a conexão novamente.');
      pending.delete(state);
      res.setHeader('set-cookie', 'marcell_local_ms_state=; HttpOnly; SameSite=Lax; Path=/api/local-onedrive; Max-Age=0');
      if (url.searchParams.has('error') || !url.searchParams.get('code')) throw fail(401, 'A autorização Microsoft não foi concluída.');
      session = await tokenRequest({grant_type:'authorization_code', code:url.searchParams.get('code'), redirect_uri:LOCAL_ONEDRIVE_CALLBACK, code_verifier:attempt.verifier});
      res.statusCode = 302; res.setHeader('location', 'http://127.0.0.1:4192/?onedrive=connected'); return res.end();
    } catch (error) {
      res.statusCode = error.status || 502;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({error:error.status ? error.message : 'Não foi possível conectar o OneDrive local.'}));
    }
  }
  return {handleApi, handleOAuth};
}
