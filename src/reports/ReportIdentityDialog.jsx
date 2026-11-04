import {useEffect,useRef,useState} from 'react';
import {Dialog} from '../design-system/primitives/Dialog.jsx';
import {Button} from '../design-system/primitives/Button.jsx';
import {Select} from '../design-system/primitives/Select.jsx';
import {IdentityPreview} from '../design-system/patterns/IdentityPreview.jsx';
import {Alert,AlertDescription} from '../components/ui/alert.jsx';
import {HelpButton} from '../features/help/HelpButton.jsx';
import {useHelpTopic} from '../features/help/HelpContext.jsx';
import {registerReportIdentityPresenter} from './report-preview.js';
import {loadReportIdentity} from './report-identities.js';

function IdentityChoice({request,onClose,pageId,allowedTabs}) {
  useHelpTopic(pageId,'report_identity',100);
  const [selected,setSelected]=useState('marcell'),[identity,setIdentity]=useState(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const generating=useRef(false),triggerRef=useRef(request.trigger);
  useEffect(()=>{
    let active=true;setError('');setReady(false);setIdentity(null);
    loadReportIdentity(selected).then(value=>{if(active)setIdentity(value);}).catch(failure=>{if(active)setError(failure.message);});
    return ()=>{active=false;};
  },[selected,retry]);
  function close(){request.cancel();onClose();}
  function generate(){
    if(generating.current||!identity||identity.id!==selected||!ready)return;
    generating.current=true;setError('');
    try{request.generate(identity);onClose();}catch(failure){setError(failure.message||'Não foi possível gerar. Tente novamente.');generating.current=false;}
  }
  return <Dialog open title="Identidade do relatório" triggerRef={triggerRef} onOpenChange={open=>{if(!open)close();}}>
    <p>Escolha a logomarca e confira a prévia antes de gerar o documento.</p>
      <Select label="Logomarca do relatório" value={selected} onChange={event=>{if(event.target.value!==selected){setReady(false);setSelected(event.target.value);}}} options={[{value:'marcell',label:'MARCELL'},{value:'arcd',label:'ARCD'}]}/>
      {identity?<IdentityPreview key={selected+'-'+retry} src={identity.logo} name={identity.name} onLoad={()=>setReady(true)} onError={()=>{setReady(false);setError('Não foi possível exibir a logomarca. Tente carregar novamente.');}}/>:<p role="status">Carregando logomarca…</p>}
      {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {error&&!ready&&<Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>Tentar carregar logomarca novamente</Button>}
      <div className="arcd-page-header__actions">
        <HelpButton pageId="report_identity" allowedTabs={allowedTabs}/>
        <Button variant="secondary" onClick={close}>Cancelar</Button>
        <Button disabled={!ready||!identity||identity.id!==selected} onClick={generate}>Gerar relatório</Button>
      </div>
  </Dialog>;
}

export function ReportIdentityDialog({pageId,allowedTabs}) {
  const [request,setRequest]=useState(null);
  useEffect(()=>registerReportIdentityPresenter(setRequest),[]);
  return request?<IdentityChoice request={request} onClose={()=>setRequest(null)} pageId={pageId} allowedTabs={allowedTabs}/>:null;
}
