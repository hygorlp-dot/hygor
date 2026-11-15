import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {createHash,createDecipheriv} from 'node:crypto';

export const REVIEW_TABLES={
  financial_titles:'id,company_id,origin_type,obra_id,direction,competence,due_date,created_at,original_amount,status,metadata',
  settlements:'id,company_id,title_id,bank_transaction_id,amount,settlement_date,status',
  bank_transactions:'id,company_id,amount,status,metadata',
  reconciliation_links:'id,company_id,bank_transaction_id,amount,status',
};
export const reviewFingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function readOnlyDatabaseFetch(fetchImpl=fetch){
  return (input,options={})=>{
    const method=String(options.method||input?.method||'GET').toUpperCase();
    if(!['GET','HEAD'].includes(method))throw new Error('Gravação na origem real bloqueada.');
    return fetchImpl(input,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(30000)});
  };
}
export function readOnlyOneDriveFetch(fetchImpl=fetch){
  return (input,options={})=>{
    const method=String(options.method||input?.method||'GET').toUpperCase();
    const url=String(input?.url||input);
    if(method==='POST'&&url==='https://login.microsoftonline.com/common/oauth2/v2.0/token'&&['authorization_code','refresh_token'].includes(options.body?.get?.('grant_type'))){
      return fetchImpl(input,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(30000)});
    }
    if(!['GET','HEAD'].includes(method))throw new Error('Gravação na origem real bloqueada.');
    // O leitor valida cada salto do /content e nunca encaminha o bearer ao
    // armazenamento. Preserve manual; seguir redirects automaticamente é vedado.
    return fetchImpl(input,{...options,redirect:options.redirect==='manual'?'manual':'error',signal:options.signal||AbortSignal.timeout(30000)});
  };
}
export async function loadRealPortalSnapshot(){
  const env=loadEnv('development',process.cwd(),'');
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Configure a origem de leitura no .env.local.');
  const company=env.COMPANY_ID||'arcd';
  if(company!=='arcd')throw new Error('Esta revisão local está preparada para a empresa arcd.');
  const remote=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:readOnlyDatabaseFetch()}});
  async function all(table,columns,source=false){
    const rows=[];
    for(let offset=0;;offset+=1000){
      let query=remote.from(table).select(columns).eq('company_id',company);
      if(source)query=query.like('key','arced_ponto_v1%');
      const result=await query.order(source?'key':'id').range(offset,offset+999);
      if(result.error)throw new Error(`Falha de leitura em ${table}: ${result.error.code||result.status}`);
      rows.push(...result.data);if(result.data.length<1000)break;
    }
    return source?rows.filter(row=>row.key==='arced_ponto_v1'||row.key.startsWith('arced_ponto_v1__')):rows;
  }
  const sourceRows=await all('company_app_data','key,value,updated_at',true);
  const tables=Object.fromEntries(await Promise.all(Object.entries(REVIEW_TABLES).map(async([table,columns])=>[table,await all(table,columns)])));
  const latest=await all('company_app_data','key,updated_at',true);
  if(reviewFingerprint(sourceRows.map(({key,updated_at})=>({key,updated_at})))!==reviewFingerprint(latest))throw new Error('A origem mudou durante a captura. Execute a revisão novamente.');
  return {sourceRows,tables,env,remote,capturedAt:new Date().toISOString(),fingerprint:reviewFingerprint({sourceRows,tables})};
}

// A credencial Microsoft permanece apenas na memória deste processo. O refresh
// existente do ERP NÃO é chamado: ele gravaria a sessão central em produção.
export function createReviewMicrosoftToken({remote,env,fetchImpl=fetch}){
  let token=null,refreshing=null;
  return async()=>{
    if(token&&token.expiresAt>Date.now())return token.value;
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      const {data,error}=await remote.from('company_app_data').select('value').eq('company_id',env.COMPANY_ID||'arcd').eq('key','onedrive_auth_v1').maybeSingle();
      if(error||!data?.value?.sealed||!env.MICROSOFT_CLIENT_SECRET||!env.MICROSOFT_CLIENT_ID)throw Object.assign(new Error('A conexão Microsoft não está disponível para a leitura local.'),{status:503});
      let session;
      try{
        const raw=Buffer.from(data.value.sealed,'base64url'),key=createHash('sha256').update(env.MICROSOFT_CLIENT_SECRET).digest();
        const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));
        session=JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8'));
      }catch{throw Object.assign(new Error('Não foi possível abrir a conexão Microsoft para esta leitura.'),{status:503});}
      const response=await fetchImpl('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID,client_secret:env.MICROSOFT_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:session.refreshToken,scope:'openid profile offline_access User.Read Files.ReadWrite'}),redirect:'error',signal:AbortSignal.timeout(30000)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.access_token)throw Object.assign(new Error('A conexão Microsoft exige nova autorização. Nenhuma sessão real foi gravada.'),{status:401});
      token={value:result.access_token,expiresAt:Date.now()+Math.max(0,Number(result.expires_in||0)-60)*1000};
      return token.value;
    })().finally(()=>{refreshing=null;});
    return refreshing;
  };
}
