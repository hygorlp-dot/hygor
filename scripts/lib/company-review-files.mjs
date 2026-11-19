// Projection for a local review only; the captured records are never changed.
export function projectLocalReviewFiles(value,company,audit,localUrl){
  if(Array.isArray(value))return value.map(item=>projectLocalReviewFiles(item,company,audit,localUrl));
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>{
    if(typeof item==='string'&&/^https?:\/\//i.test(item)){
      try{
        const url=new URL(item),match=/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/.exec(url.pathname);
        const object=match&&audit?.objects?.find(object=>object.company===company&&!object.quarantine&&object.localCopy&&object.originHost===url.host&&object.bucket===decodeURIComponent(match[1])&&object.name===decodeURIComponent(match[2]));
        return [key,object?localUrl(object):'/api/local-review-file-unavailable'];
      }catch{return [key,'/api/local-review-file-unavailable'];}
    }
    return [key,projectLocalReviewFiles(item,company,audit,localUrl)];
  }));
}
