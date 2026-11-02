import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
let sequence=0;
export async function instrumentWorkflowPage(page){
 const directory=process.env.WF_EVIDENCE_DIR;if(!directory)return;
 const started=performance.now(),events=[],requests=[],pending=new Map();
 await page.exposeBinding('__wfEvidence',(_,event)=>events.push(event));
 await page.addInitScript(()=>{
  const send=event=>window.__wfEvidence?.({...event,atMs:Math.round(performance.now())});
  const module=()=>document.querySelector('.arcd-app-shell')?.getAttribute('data-tab')||'';
  const label=el=>el.getAttribute('aria-label')||el.labels?.[0]?.textContent?.trim().slice(0,80)||el.getAttribute('name')||el.textContent?.trim().slice(0,80)||el.tagName;
  document.addEventListener('click',event=>{const el=event.target.closest('button,a,summary');if(el&&module())send({type:'activate',module:module(),label:label(el)});},true);
  const edits=new Map();
  document.addEventListener('change',event=>{const el=event.target;if(!module()||!el.matches('input,textarea,select')||el.type==='password')return;const key=module()+':'+label(el);send({type:'fieldChange',module:module(),label:label(el),changedAgain:edits.has(key)});edits.set(key,true);},true);
  let previous='';new MutationObserver(()=>{const current=module();if(current&&current!==previous){send({type:'module',from:previous,to:current});previous=current;}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-tab']});
 });
 page.on('request',request=>{if(!new URL(request.url()).pathname.startsWith('/api/'))return;let body={};try{body=request.postDataJSON()||{};}catch{}pending.set(request,{started:performance.now(),action:body.action||request.method()});});
 const finish=request=>{const info=pending.get(request);if(info){requests.push({action:info.action,durationMs:Math.round(performance.now()-info.started)});pending.delete(request);}};
 page.on('requestfinished',finish);page.on('requestfailed',finish);
 const id=++sequence,width=page.viewportSize()?.width;
 page.once('close',()=>{mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`session-${id}-${width}.json`),JSON.stringify({journey:process.env.WF_JOURNEY,width,elapsedMs:Math.round(performance.now()-started),kind:'automated-session-including-setup-and-assertions',activations:events.filter(e=>e.type==='activate').length,fieldChanges:events.filter(e=>e.type==='fieldChange').length,fieldsChangedAgain:events.filter(e=>e.type==='fieldChange'&&e.changedAgain).length,moduleTransitions:events.filter(e=>e.type==='module'&&e.from).length,events,requests},null,2));});
}
