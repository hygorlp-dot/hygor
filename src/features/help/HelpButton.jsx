import {lazy, Suspense, useId, useRef, useState} from 'react';
import {CircleHelp} from 'lucide-react';
import {Button} from '../../design-system/primitives/Button.jsx';
import {useCurrentHelpTopic} from './HelpContext.jsx';
import './help.css';

const HelpPanel=lazy(()=>import('./HelpPanel.jsx'));
export function HelpButton({pageId,allowedTabs,label="Ajuda"}){
 const [open,setOpen]=useState(false);
 const trigger=useRef(null);
 const panelId=useId();
 const topicId=useCurrentHelpTopic(pageId);
 return <>
  <Button ref={trigger} variant="outline" className="app-help-button" aria-expanded={open} aria-controls={open?panelId:undefined} onClick={()=>setOpen(value=>!value)}>
   <CircleHelp data-icon="inline-start" aria-hidden="true"/>{label}
  </Button>
  {open&&<Suspense fallback={<span role="status">Abrindo ajuda…</span>}><HelpPanel key={topicId} id={panelId} topicId={topicId} pageId={pageId} allowedTabs={allowedTabs} onClose={()=>{setOpen(false);trigger.current?.focus();}}/></Suspense>}
 </>;
}
