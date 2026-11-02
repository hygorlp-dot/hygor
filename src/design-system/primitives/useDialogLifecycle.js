import {useVisualViewportBounds} from '../../lib/useVisualViewportBounds.js';
import {useEffect,useRef} from 'react';
const layers=[];
let previousOverflow='',previousLock=false;
const focusable='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function useDialogLifecycle(open,ref,onClose,triggerRef,overlayRef=ref){
 useVisualViewportBounds(overlayRef,open);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const node=ref.current;
  if(!open||!node)return;
  const entry={node,previous:document.activeElement,parent:layers.at(-1),triggerRef};
  if(!layers.length){previousOverflow=document.body.style.overflow;previousLock=document.body.classList.contains('no-scroll');}
  layers.push(entry);document.body.style.overflow='hidden';document.body.classList.add('no-scroll');
  const timer=window.setTimeout(()=>{if(layers.at(-1)===entry&&!node.contains(document.activeElement))node.focus({preventScroll:true});},0);
  const keydown=event=>{
   if(event.defaultPrevented||layers.at(-1)!==entry||document.activeElement?.closest('.app-help-panel,dialog[open]'))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current?.();return;}
   if(event.key!=='Tab')return;
   const targets=[...node.querySelectorAll(focusable)].filter(el=>el.tabIndex>=0&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&el.getAttribute('aria-disabled')!=='true');
   if(!targets.length){event.preventDefault();node.focus();return;}
   const active=document.activeElement,first=targets[0],last=targets.at(-1);
   if(event.shiftKey&&(active===first||active===node||!node.contains(active))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(active===last||active===node||!node.contains(active))){event.preventDefault();first.focus();}
  };
  window.addEventListener('keydown',keydown);
  return()=>{
   window.clearTimeout(timer);window.removeEventListener('keydown',keydown);
   const wasTop=layers.at(-1)===entry,index=layers.indexOf(entry);if(index>=0)layers.splice(index,1);
   if(!layers.length){document.body.style.overflow=previousOverflow;if(!previousLock)document.body.classList.remove('no-scroll');}
   if(!wasTop)return;
   // A parent may unmount in the same commit as its confirmation. Walk the
   // opening chain to recover the nearest trigger that still belongs to a live layer.
   const parent=layers.findLast(layer=>layer.node.isConnected)?.node;
   let target;
   for(let owner=entry;owner&&!target;owner=owner.parent){
    target=[owner.triggerRef?.current,owner.previous].find(el=>el?.isConnected&&el!==document.body&&el!==document.documentElement&&!el.matches(':disabled,[aria-disabled="true"]')&&(!parent||parent.contains(el)));
   }
   if(target)target.focus({preventScroll:true});
   else{
    const fallback=parent||document.querySelector('.arcd-main h1,.arcd-main h2');
    if(fallback){if(!fallback.hasAttribute('tabindex'))fallback.setAttribute('tabindex','-1');fallback.focus({preventScroll:true});}
   }
  };
 },[open,ref,triggerRef]);
}
