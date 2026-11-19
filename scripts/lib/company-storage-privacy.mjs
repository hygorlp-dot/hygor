import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function protectCompanyStorage({storage,photos,anonymousRead,apply=false}){
 if(!Array.isArray(photos)||photos.length!==2)throw Error('Expected two reviewed legacy photos');
 const checks=[];
 for(const photo of photos){
  if(photo.source?.bucket!=='diario-obra'||photo.destination?.bucket!=='company-files-private'||!['arcd','mrc'].includes(photo.companyId)||!photo.destination.name.startsWith(photo.companyId+'/')||!photo.destination.name.endsWith('/'+photo.source.name.split('/').at(-1)))throw Error('Photo identity or company scope changed');
  const {data,error}=await storage.from(photo.destination.bucket).download(photo.destination.name);if(error||!data)throw Error('Private photo not available');const bytes=Buffer.from(await data.arrayBuffer());if(bytes.length!==photo.bytes||digest(bytes)!==photo.sha256)throw Error('Private photo content changed');checks.push({id:photo.objectId,companyId:photo.companyId,sha256:photo.sha256,bytes:bytes.length});
 }
 if(!apply)return {passed:false,prepared:true,copiesVerified:checks,remoteWrites:0,activationReady:false};
 const first=await storage.updateBucket('company-files-private',{public:false,fileSizeLimit:4*1024*1024,allowedMimeTypes:null});if(first.error)throw Error('Private bucket configuration refused');
 const second=await storage.updateBucket('diario-obra',{public:false});if(second.error)throw Error('Legacy photo privacy refused');
 const privateInfo=await storage.getBucket('company-files-private'),legacyInfo=await storage.getBucket('diario-obra');if(privateInfo.error||legacyInfo.error||privateInfo.data.public!==false||legacyInfo.data.public!==false||Number(privateInfo.data.file_size_limit)!==4*1024*1024)throw Error('Storage privacy not confirmed');
 const anonymous=[];for(const photo of photos)for(const file of [photo.source,photo.destination]){const status=await anonymousRead(file.bucket,file.name);anonymous.push({id:photo.objectId,bucket:file.bucket,status});if(status===200)throw Error('Anonymous photo access remains open');}
 return {at:new Date().toISOString(),passed:true,copiesVerified:checks,anonymous,legacyPublic:false,destinationPublic:false,limitBytes:4*1024*1024,mimeValidation:'existing authenticated server upload-policy; private bucket accepts its MIME superset',sourceObjectsPreserved:true,objectsDeleted:0,remoteWrites:2};
}
