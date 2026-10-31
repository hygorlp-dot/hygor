const origin='https://marcell.invalid';

export function protectedDocumentReference(value){
 try{
  if(!financialDocumentUrl(value))return null;
  const url=new URL(value,origin);
  if(url.pathname!=='/api/microsoft/onedrive'||url.searchParams.get('action')!=='file')return null;
  const driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');
  return driveId&&itemId?{driveId,itemId}:null;
 }catch{return null;}
}

// A mesma referência deve ser reconhecida na pendência, memorial e prévia.
// Rotas relativas ficam limitadas ao leitor autenticado já usado pelo ERP.
export function financialDocumentUrl(value){
 if(typeof value!=='string'||!value.trim())return null;
 try{
  const url=new URL(value,origin);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
  if(value.startsWith('/api/microsoft/onedrive?')&&url.origin===origin&&url.pathname==='/api/microsoft/onedrive'&&url.searchParams.get('action')==='file')return `${url.pathname}${url.search}`;
  return /^https?:\/\//i.test(value)&&url.origin!==origin?url.href:null;
 }catch{return null;}
}
