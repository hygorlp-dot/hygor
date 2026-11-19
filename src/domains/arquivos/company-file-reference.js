export const COMPANY_FILE_BUCKET='company-files-private';
const companies=new Set(['arcd','mrc']);
const segment=/^[A-Za-z0-9_-]+$/;
const filename=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,12}$/i;

// Stable reference only: no credentials, signed URLs or storage host persisted.
export function parseCompanyFileReference(value){
 if(typeof value!=='string'||!value.startsWith('company-file://'))return null;
 try{
  const url=new URL(value),parts=url.pathname.slice(1).split('/');
  if(!companies.has(url.hostname)||url.username||url.password||url.port||url.search||url.hash||parts.length!==3||!segment.test(parts[0])||!/^\d{4}$/.test(parts[1])||!filename.test(parts[2]))return null;
  const name=[url.hostname,...parts].join('/');
  if(value!==`company-file://${name}`)return null;
  return {companyId:url.hostname,projectId:parts[0],name,bucket:COMPANY_FILE_BUCKET};
 }catch{return null;}
}

export function companyFileReference(path){
 const value=`company-file://${String(path||'')}`;
 if(!parseCompanyFileReference(value))throw new Error('Referência privada de arquivo inválida.');
 return value;
}
