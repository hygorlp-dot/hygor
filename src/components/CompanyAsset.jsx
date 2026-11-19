import {useEffect,useState} from 'react';
import {assetAuthorizationKey,protectedCompanyAsset,resolveCompanyAssetUrl} from '../api.js';

export function useCompanyAssetUrl(reference){
 const key=`${assetAuthorizationKey()}:${reference||''}`;
 const [resolved,setResolved]=useState(null);
 const protectedAsset=protectedCompanyAsset(reference);
 useEffect(()=>{
  if(!protectedAsset)return;
  let active=true,timer;
  const refresh=async()=>{
   const result=await resolveCompanyAssetUrl(reference);
   if(!active)return;
   setResolved({key,url:result.ok?result.url:undefined,error:result.ok?'':result.error||'Não foi possível abrir o arquivo.'});
   if(result.ok)timer=setTimeout(refresh,240000);
  };
  refresh();return()=>{active=false;clearTimeout(timer);};
 },[key,protectedAsset,reference]);
 if(!protectedAsset)return {url:reference,error:'',loading:false};
 return resolved?.key===key?{...resolved,loading:false}:{url:undefined,error:'',loading:true};
}

export function CompanyAssetImage({src,alt,...props}){
 const file=useCompanyAssetUrl(src);
 return <img {...props} src={file.url} alt={file.error?`${alt||'Imagem'} — indisponível`:alt} aria-busy={file.loading||undefined} title={file.error||props.title}/>;
}

export function CompanyAssetLink({href,children,onClick,...props}){
 const file=useCompanyAssetUrl(href);
 return <a {...props} href={file.url} aria-disabled={!file.url||undefined} title={file.error||props.title} onClick={event=>{if(!file.url)event.preventDefault();else onClick?.(event);}}>{children}</a>;
}
