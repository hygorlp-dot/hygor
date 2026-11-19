import {useEffect,useState} from 'react';
import {assetAuthorizationKey,protectedCompanyAsset,resolveCompanyAssetUrl} from '../api.js';
import {MediaBackground} from '../design-system/primitives/MediaBackground.jsx';

export function useCompanyAssetUrl(reference){
 const key=`${assetAuthorizationKey()}:${reference||''}`;
 const [resolved,setResolved]=useState(null);
 const protectedAsset=protectedCompanyAsset(reference);
 useEffect(()=>{
  if(!protectedAsset)return;
  let active=true,timer,objectUrl;
  const refresh=async()=>{
   const result=await resolveCompanyAssetUrl(reference);
   if(!active){if(result.temporaryObjectUrl)URL.revokeObjectURL(result.url);return;}
   const previous=objectUrl;
   objectUrl=result.temporaryObjectUrl?result.url:undefined;
   setResolved({key,url:result.ok?result.url:undefined,error:result.ok?'':result.error||'Não foi possível abrir o arquivo.'});
   if(previous)URL.revokeObjectURL(previous);
   if(result.ok)timer=setTimeout(refresh,240000);
  };
  refresh();return()=>{active=false;clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);};
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

export function CompanyAssetBackground({as:Component='div',src,backgroundFor,...props}){
 const file=useCompanyAssetUrl(src);
 return <MediaBackground as={Component} {...props} aria-busy={file.loading||undefined} background={backgroundFor(file.url)}/>;
}
