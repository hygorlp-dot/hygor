import {useEffect,useRef} from 'react';
import {Modal} from '../../legacy/ui.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import './record-panel.css';

// Consulta e formulários curtos compartilham a pilha de foco do app.
export function RecordPanel({title,pageId,recordKey,onClose,children}){
 useHelpTopic(pageId,`${pageId}_ficha`,10);
 const origin=useRef(null);
 useEffect(()=>{
  const opener=[...document.querySelectorAll('[data-record]')].find(node=>node.dataset.record===recordKey)?.querySelector('.mrc-record-action')||document.activeElement;
  origin.current={opener,positions:[...document.querySelectorAll('main,[role="region"],html,body')].map(node=>({node,top:node.scrollTop,left:node.scrollLeft}))};
  const frame=requestAnimationFrame(()=>{origin.current.positions=origin.current.positions.map(pos=>({...pos,top:pos.node.scrollTop,left:pos.node.scrollLeft}));});
  return()=>{cancelAnimationFrame(frame);const saved=origin.current;requestAnimationFrame(()=>{if(!saved.opener?.isConnected)return;for(const {node,top,left} of saved.positions)if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}if(saved.opener?.isConnected)saved.opener.focus({preventScroll:true});});};
 },[]);
 return <Modal title={title} onClose={onClose} panelClass="mrc-record-panel">
  <div className="mrc-record-panel__tools"><HelpButton pageId={pageId} allowedTabs={[pageId]}/></div>
  <div className="mrc-record-panel__content">{children}</div>
 </Modal>;
}
