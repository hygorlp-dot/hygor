import {useState} from 'react';
import {obterLinkArquivoOneDrive} from '../../api.js';
import {financialDocumentUrl,protectedDocumentReference} from '../../domains/financeiro/document-links.js';

// Stored signed URLs can belong to another session or already be expired.
// Authorize a fresh link at click time using the existing ERP credentials.
export default function FinancialDocumentLink({href,children,resolveFile=obterLinkArquivoOneDrive}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const url=financialDocumentUrl(href),reference=protectedDocumentReference(href);
 if(!url)return null;
 const open=async event=>{
  if(!reference)return;
  event.preventDefault();
  if(busy)return;
  setError('');
  const target=window.open('about:blank','_blank');
  if(!target){setError('Permita abrir uma nova aba e tente novamente.');return;}
  target.opener=null;
  setBusy(true);
  try{
   const response=await resolveFile(reference);
   const freshUrl=response?.ok&&financialDocumentUrl(response.url);
   if(!freshUrl){
    target.close();
    setError(response?.status===404?'Original não encontrado no OneDrive. Confira o vínculo no registro de origem.':response?.status===403?'Seu acesso não permite abrir este documento.':response?.status===401?'Conecte o OneDrive e confira sua sessão do MARCELL antes de tentar novamente.':'Não foi possível abrir o original. Tente novamente.');
    return;
   }
   target.location.replace(freshUrl);
  }catch{target.close();setError('Não foi possível abrir o original. Tente novamente.');}
  finally{setBusy(false);}
 };
 return <><a href={url} target="_blank" rel="noopener noreferrer" aria-busy={busy||undefined} onClick={open}>{children}</a>{busy&&<span role="status"> Preparando original…</span>}{error&&<span role="alert"> {error}</span>}</>;
}
