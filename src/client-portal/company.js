export function portalCompany(){
  const company=new URLSearchParams(globalThis.location?.search||'').get('empresa');
  return company==='mrc'?'mrc':'arcd';
}
export function portalApiUrl(path){
  return portalCompany()==='mrc'?`${path}${path.includes('?')?'&':'?'}companyId=mrc`:path;
}
export function portalNavigationPath(path){
  return portalCompany()==='mrc'?`${path}${path.includes('?')?'&':'?'}empresa=mrc`:path;
}
