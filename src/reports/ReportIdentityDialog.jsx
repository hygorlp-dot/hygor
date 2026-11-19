import {useEffect,useRef,useState} from 'react';
import {Dialog} from '../design-system/primitives/Dialog.jsx';
import {Button} from '../design-system/primitives/Button.jsx';
import {IdentityPreview} from '../design-system/patterns/IdentityPreview.jsx';
import {Alert,AlertDescription} from '../components/ui/alert.jsx';
import {HelpButton} from '../features/help/HelpButton.jsx';
import {useHelpTopic} from '../features/help/HelpContext.jsx';
import {registerReportIdentityPresenter} from './report-preview.js';
import {MARCELL_LOGO} from '../brand/identity.js';
import {loadReportFonts} from './report-fonts.js';

function ReportConfirmation({request,onClose,pageId,allowedTabs}) {
  useHelpTopic(pageId,'report_identity',100);
  const [fontsReady,setFontsReady]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const generating=useRef(false),triggerRef=useRef(request.trigger);
  useEffect(()=>{
    let active=true;setError('');setReady(false);setFontsReady(false);
    loadReportFonts().then(()=>{if(active)setFontsReady(true);}).catch(failure=>{if(active)setError(failure.message);});
    return ()=>{active=false;};
  },[retry]);
  function close(){request.cancel();onClose();}
  function generate(){
    if(generating.current||!fontsReady||!ready)return;
    generating.current=true;setError('');
    try{request.generate();onClose();}catch(failure){setError(failure.message||'Não foi possível gerar. Tente novamente.');generating.current=false;}
  }
  return <Dialog open title="Identidade do relatório" triggerRef={triggerRef} onOpenChange={open=>{if(!open)close();}}>
      {fontsReady?<IdentityPreview key={retry} src={MARCELL_LOGO} name="MARCELL" onLoad={()=>setReady(true)} onError={()=>{setReady(false);setError('Não foi possível exibir a logomarca. Tente carregar novamente.');}}/>:!error&&<p role="status">Carregando logomarca e fontes…</p>}
      {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {error&&!ready&&<Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>Tentar carregar novamente</Button>}
      <div className="arcd-page-header__actions">
        <HelpButton pageId="report_identity" allowedTabs={allowedTabs}/>
        <Button variant="secondary" onClick={close}>Cancelar</Button>
        <Button disabled={!ready||!fontsReady} onClick={generate}>Gerar relatório</Button>
      </div>
  </Dialog>;
}

export function ReportIdentityDialog({pageId,allowedTabs}) {
  const [request,setRequest]=useState(null);
  useEffect(()=>registerReportIdentityPresenter(setRequest),[]);
  useEffect(()=>{void loadReportFonts().catch(()=>{});},[]);
  return request?<ReportConfirmation request={request} onClose={()=>setRequest(null)} pageId={pageId} allowedTabs={allowedTabs}/>:null;
}
