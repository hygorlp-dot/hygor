import {createClient} from '@supabase/supabase-js';
import {RH_BUCKET} from '../server/rh-documents.js';
if(process.env.VERCEL_ENV!=='production'&&process.env.RH_STORAGE_SETUP!=='1'){
  console.log('RH: preparação do bucket privado ignorada fora de produção.');
}else{
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('RH: credenciais de armazenamento ausentes.');
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const existing=await db.storage.getBucket(RH_BUCKET);
  if(existing.error){
    const status=Number(existing.error.statusCode||existing.error.status);
    if(status!==404&&status!==400)throw Error('RH: não foi possível verificar o bucket privado.');
    const created=await db.storage.createBucket(RH_BUCKET,{public:false,fileSizeLimit:3*1024*1024,allowedMimeTypes:['application/pdf','image/jpeg','image/png']});
    if(created.error)throw Error('RH: não foi possível criar o bucket privado.');
  }
  const verified=await db.storage.getBucket(RH_BUCKET);
  if(verified.error||verified.data?.public!==false)throw Error('RH: o armazenamento deve ser privado. Nenhuma permissão foi alterada.');
  console.log('RH: bucket privado verificado; documentos sem acesso público.');
}
