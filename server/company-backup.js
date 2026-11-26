import { backupKeyFromEnv, createBackupBundle, verifyBackupBundle } from "./backup.js";
import { currentCompany, isolationEnabled } from "./company-context.js";
import { getOrCreateFolder, graph, refresh, rootItem } from "./microsoft/graph.js";

export function createCompanyBackup(db) {
  const backupFolder=()=>`00 - Backups ${isolationEnabled()?currentCompany().toUpperCase():'ARCD'}`;
  const listarLinhasBackup=async()=>{
    const rows=[];let from=0;
    while(true){const {data,error}=await db.from("company_app_data").select("key,value,updated_at").eq("company_id",currentCompany()).range(from,from+999);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<1000)break;from+=1000;}
    return rows.filter(row=>row.key!=="onedrive_auth_v1");
  };
  const pastaBackup=async token=>{const root=await rootItem(token),driveId=root.parentReference.driveId;return{driveId,folder:await getOrCreateFolder(token,driveId,root.id,backupFolder())};};
  const enviarBufferBackup=async(token,driveId,parentId,name,buffer,contentType)=>{
    const session=await (await graph(token,`/drives/${driveId}/items/${parentId}:/${encodeURIComponent(name)}:/createUploadSession`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({item:{"@microsoft.graph.conflictBehavior":"fail",name}})})).json();
    const chunkSize=5*320*1024;
    for(let start=0;start<buffer.length;start+=chunkSize){const end=Math.min(buffer.length,start+chunkSize)-1;const r=await fetch(session.uploadUrl,{method:"PUT",headers:{"Content-Length":String(end-start+1),"Content-Range":`bytes ${start}-${end}/${buffer.length}`,"Content-Type":contentType},body:buffer.subarray(start,end+1)});if(!r.ok&&r.status!==202)throw new Error(`Falha ao enviar backup ao OneDrive (${r.status}).`);}
  };
  const criarBackupOneDrive=async(req,actor)=>{
    const key=backupKeyFromEnv(process.env.BACKUP_ENCRYPTION_KEY),{accessToken}=await refresh(req),{driveId,folder}=await pastaBackup(accessToken),now=new Date().toISOString(),name=`${currentCompany()}-${now.replace(/[:.]/g,"-")}.arcdbackup`;
    const bundle=createBackupBundle({companyId:currentCompany(),rows:await listarLinhasBackup(),now,key});const manifest={...bundle.manifest,actor,encryptedFile:name,bytes:bundle.body.length,excludedKeys:["onedrive_auth_v1"]};
    await enviarBufferBackup(accessToken,driveId,folder.id,name,bundle.body,"application/octet-stream");
    await enviarBufferBackup(accessToken,driveId,folder.id,`${name}.manifest.json`,Buffer.from(JSON.stringify(manifest,null,2)),"application/json");
    return{ok:true,name,recordCount:manifest.recordCount,sha256:manifest.sha256,bytes:manifest.bytes,createdAt:now};
  };
  const verificarBackupOneDrive=async req=>{
    const key=backupKeyFromEnv(process.env.BACKUP_ENCRYPTION_KEY),{accessToken}=await refresh(req),{driveId,folder}=await pastaBackup(accessToken);
    const children=(await (await graph(accessToken,`/drives/${driveId}/items/${folder.id}/children?$select=id,name,lastModifiedDateTime,size,file`)).json()).value||[];
    const manifestItem=children.filter(item=>item.file&&item.name.endsWith(".arcdbackup.manifest.json")).sort((a,b)=>String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)))[0];if(!manifestItem)throw Object.assign(new Error("Nenhum backup encontrado no OneDrive."),{status:404});
    const read=async item=>Buffer.from(await (await graph(accessToken,`/drives/${driveId}/items/${item.id}/content`,{redirect:"follow"})).arrayBuffer());const manifest=JSON.parse((await read(manifestItem)).toString("utf8")),backup=children.find(item=>item.name===manifest.encryptedFile);if(!backup)throw new Error("Arquivo criptografado correspondente não encontrado.");
    return{...verifyBackupBundle({body:await read(backup),key,manifest,expectedCompanyId:currentCompany()}),name:backup.name,bytes:Number(backup.size||manifest.bytes||0)};
  };

  return { backupFolder, criarBackupOneDrive, verificarBackupOneDrive };
}
