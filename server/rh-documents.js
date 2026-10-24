import crypto from 'node:crypto';
import {decodeAppData} from './data-codec.js';
import {EMPLOYEE_DOCUMENT_CATEGORIES} from '../src/domains/rh/document-categories.js';

export const RH_BUCKET='rh-prontuarios';
const types={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
const validDate=v=>{if(!v)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const date=new Date(v+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;};
const failed=(status,error)=>({status,body:{ok:false,error}});
export async function handleRhDocuments({db,user,body,company,now=new Date().toISOString()}){
  if(!['admin','rh'].includes(user?.role))return failed(403,'Prontuário restrito ao RH e administradores.');
  const employeeId=String(body.employeeId||'');
  if(!employeeId||employeeId.length>150)return failed(400,'Funcionário inválido.');
  const {data:source,error:sourceError}=await db.from('company_app_data').select('value').eq('company_id',company).eq('key','arced_ponto_v1').maybeSingle();
  if(sourceError)return failed(503,'Não foi possível verificar o funcionário.');
  if(!decodeAppData(source?.value)?.employees?.some(e=>String(e.id)===employeeId))return failed(404,'Funcionário não encontrado.');
  const prefix=`rh_doc_${Buffer.from(employeeId).toString('base64url')}_`;
  const action=body.documentAction||'list';
  if(action==='list'){
    // Prefix contains underscores: escape LIKE wildcards to isolate employees.
    const escaped=prefix.replace(/[_%\\]/g,'\\$&');
    const {data,error}=await db.from('company_app_data').select('key,value,updated_at').eq('company_id',company).like('key',escaped+'%').order('updated_at',{ascending:false}).limit(501);
    if(error)return failed(503,'Não foi possível consultar os documentos.');
    if(data.length>500)return failed(422,'Mais de 500 documentos: solicite paginação ao administrador.');
    return {status:200,body:{ok:true,documents:data.map(r=>r.value)}};
  }
  if(!['upload','open','archive'].includes(action))return failed(400,'Operação de prontuário inválida.');
  const id=String(body.documentId||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return failed(400,'Identificação do documento inválida.');
  const key=prefix+id;
  const {data:existing,error:readError}=await db.from('company_app_data').select('value,updated_at').eq('company_id',company).eq('key',key).maybeSingle();
  if(readError)return failed(503,'Não foi possível verificar o documento.');
  if(action==='upload'&&existing)return {status:200,body:{ok:true,document:existing.value}};
  if(action!=='upload'&&!existing)return failed(404,'Documento não encontrado neste funcionário.');
  if(action==='archive'){
    const reason=String(body.reason||'').trim();
    if(reason.length<10||reason.length>1000)return failed(400,'Informe o motivo do arquivamento (10 a 1000 caracteres).');
    if(existing.value.archivedAt)return {status:200,body:{ok:true,document:existing.value}};
    const document={...existing.value,archivedAt:now,archivedBy:user.id,archiveReason:reason};
    const {data,error}=await db.from('company_app_data').update({value:document,updated_at:now}).eq('company_id',company).eq('key',key).eq('updated_at',existing.updated_at).select('key');
    if(error||!data?.length)return failed(409,'O documento mudou. Atualize a lista antes de arquivar.');
    return {status:200,body:{ok:true,document}};
  }
  const {data:bucket,error:bucketError}=await db.storage.getBucket(RH_BUCKET);
  if(bucketError||!bucket||bucket.public!==false)return failed(503,'Armazenamento privado do RH indisponível. Contate o administrador.');
  if(action==='open'){
    if(!existing.value.path?.startsWith(`${company}/${Buffer.from(employeeId).toString('base64url')}/`))return failed(403,'Caminho do documento inválido.');
    const {data,error}=await db.storage.from(RH_BUCKET).createSignedUrl(existing.value.path,60,{download:existing.value.name});
    return error?failed(503,'Não foi possível abrir o documento.'):{status:200,body:{ok:true,url:data.signedUrl,expiresIn:60}};
  }
  const match=/^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.dataUrl||''));
  if(!match)return failed(400,'Envie PDF, JPEG ou PNG.');
  const buffer=Buffer.from(match[2],'base64'),mime=match[1];
  const signature=mime==='application/pdf'?buffer.subarray(0,5).toString()==='%PDF-':mime==='image/jpeg'?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(!signature)return failed(400,'O conteúdo do arquivo não corresponde ao formato informado.');
  if(!buffer.length||buffer.length>3*1024*1024)return failed(413,'O arquivo deve ter no máximo 3 MB.');
  if(!EMPLOYEE_DOCUMENT_CATEGORIES.some(([value])=>value===body.category))return failed(400,'Categoria inválida.');
  if(!validDate(body.issuedAt)||!validDate(body.expiresAt)||body.issuedAt&&body.expiresAt&&body.expiresAt<body.issuedAt)return failed(400,'Datas do documento inválidas.');
  const name=String(body.fileName||'').trim().replace(/[\x00-\x1f\\/]/g,'_').slice(0,180);
  if(!name)return failed(400,'Informe o nome do arquivo.');
  const path=`${company}/${Buffer.from(employeeId).toString('base64url')}/${id}.${types[mime]}`;
  const {error:uploadError}=await db.storage.from(RH_BUCKET).upload(path,buffer,{contentType:mime,upsert:false});
  if(uploadError)return failed(503,'Falha no envio do arquivo. Atualize a lista antes de repetir.');
  const document={id,employeeId,name,path,mime,size:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),category:body.category,issuedAt:body.issuedAt||'',expiresAt:body.expiresAt||'',notes:String(body.notes||'').slice(0,1000),createdAt:now,createdBy:user.id,createdByName:user.nome||user.id};
  const {error:writeError}=await db.from('company_app_data').insert({company_id:company,key,value:document,updated_at:now});
  if(writeError){await db.storage.from(RH_BUCKET).remove([path]);return failed(503,'Falha ao registrar o documento. O envio não foi concluído.');}
  return {status:200,body:{ok:true,document}};
}
