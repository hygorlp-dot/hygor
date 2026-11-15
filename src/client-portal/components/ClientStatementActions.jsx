import {useState} from 'react';
import {Button} from '../../design-system/primitives/Button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';

export function ClientStatementActions({projectId,month,enabled=true}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const download=async(format='pdf',share=false)=>{
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const query=new URLSearchParams({format,...(month?{month}:{})});
   const response=await fetch(`/api/client/projects/${encodeURIComponent(projectId)}/statement?${query}`,{credentials:'same-origin'});
   if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||'Não foi possível preparar o arquivo. Tente novamente.');}
   const blob=await response.blob(),name=`prestacao-contas-${month||'atual'}.${format==='email'?'eml':'pdf'}`;
   const file=new File([blob],name,{type:blob.type});
   if(share&&navigator.canShare?.({files:[file]})){
    await navigator.share({files:[file],title:'Prestação de contas MARCELL',text:'Confira a prestação de contas da obra no PDF.'});
    setMessage('Arquivo entregue ao compartilhamento do aparelho. Confira o destinatário e conclua o envio no aplicativo escolhido.');
   }else{
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    setMessage(format==='email'?'Rascunho de e-mail baixado com o PDF anexado. Nenhuma mensagem foi enviada.':share?'PDF baixado. Anexe o arquivo à conversa do cliente no WhatsApp do financeiro.':'PDF preparado para download.');
   }
  }catch(failure){if(failure.name!=='AbortError')setError(failure.message);}finally{setBusy(false);}
 };
 return <section className="arcd-client-section" aria-label="Prestação de contas"><h3>Prestação de contas em PDF</h3><p>Gastos com equipe, materiais e terceiros, reservas, administração, cobranças e extrato no mesmo documento. O PDF respeita as informações liberadas para este acesso.</p>
 <div className="arcd-client-actions"><Button disabled={!enabled||busy} loading={busy} onClick={()=>download()}>Baixar prestação de contas</Button><Button variant="secondary" disabled={!enabled||busy} onClick={()=>download('pdf',true)}>Compartilhar PDF</Button><Button variant="secondary" disabled={!enabled||busy} onClick={()=>download('email')}>Preparar e-mail com PDF</Button></div>
 <p className="arcd-client-muted">Financeiro: financeiro@marcelleng.com.br · (81) 98975-1300. O e-mail preparado tem esse remetente previsto; o envio depende da conta autenticada. Compartilhar abre as opções do aparelho, incluindo WhatsApp quando disponível. Nenhum envio automático está ativado nesta revisão local.</p>
 {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{message&&<p role="status">{message}</p>}
 </section>;
}
