// Local review only. Navigate through the same controls used by the operator;
// never read authentication storage, fill balances, or change business records.
import {temSessao,statusOneDrive} from '../src/api.js';

if(import.meta.env.DEV&&location.origin==='http://127.0.0.1:4192'&&new URLSearchParams(location.search).get('local-review')==='account-cash'){
 const report=async state=>{
  try{await fetch('http://127.0.0.1:4203/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(state),signal:AbortSignal.timeout(1500)});}catch{/* The optional local verifier need not be running. */}
 };
 const visible=element=>element&&element.getClientRects().length>0;
 const normalize=value=>String(value||'').replace(/\s+/g,'');
 const button=label=>[...document.querySelectorAll('button')].find(element=>visible(element)&&normalize(element.getAttribute('aria-label')||element.textContent)===normalize(label));
 const select=label=>[...document.querySelectorAll('select')].find(element=>visible(element)&&(element.getAttribute('aria-label')===label||[...(element.labels||[])].some(item=>item.textContent.trim()===label)));
 const wait=async condition=>{
  const end=Date.now()+600_000;
  while(Date.now()<end){const value=condition();if(value)return value;await new Promise(resolve=>setTimeout(resolve,200));}
  throw new Error('A tela de revisão ainda aguarda login ou carregamento.');
 };
 const choose=(element,value)=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('change',{bubbles:true}));};
 (async()=>{
  await report({phase:'waiting-company-session'});
  await wait(()=>temSessao());
  await report({phase:'company-session-ready'});
  await wait(()=>button('Gestão financeira')||button('Financeiro ›')||button('Abrir Financeiro')||select('Telas de Financeiro'));
  if(!button('Gestão financeira')&&!select('Telas de Financeiro'))(button('Financeiro ›')||button('Abrir Financeiro'))?.click();
  await wait(()=>button('Gestão financeira')||select('Telas de Financeiro'));
  if(select('Telas de Financeiro')){
   const element=select('Telas de Financeiro');choose(element,[...element.options].find(option=>option.textContent==='Gestão financeira').value);
  }else button('Gestão financeira').click();
  await wait(()=>button('Caixa por conta')||select('Áreas do financeiro'));
  if(select('Áreas do financeiro')){
   const element=select('Áreas do financeiro');choose(element,[...element.options].find(option=>option.textContent==='Caixa por conta').value);
  }else button('Caixa por conta').click();
  // Wait for the committed destination before using its account controls.
  await wait(()=>document.querySelector('.financial-navigation button[aria-label="Caixa por conta"][aria-current="page"]'));
  const isPreview=new URLSearchParams(location.search).get('account-preview')==='9896';
  const accounts=isPreview?null:await wait(()=>select('Conta bancária do caixa'));
  const options=accounts?[...accounts.options].filter(option=>option.value):[];
  if(accounts&&!accounts.value&&options.length){
   const target=options.find(option=>!option.textContent.includes('(inativa)'))?.value||options[0].value;
   choose(accounts,target);
   await wait(()=>select('Conta bancária do caixa')?.value===target&&document.querySelector('.account-cash input'));
  }
  const panel=await wait(()=>document.querySelector('.account-cash'));
  (document.querySelector('.cash-workspace')||panel).scrollIntoView({block:'start',behavior:'instant'});
  const status=await statusOneDrive();
  const preview=document.querySelector('.local-account-preview');
  const unconfirmed=preview?[...preview.querySelectorAll('input[readonly]')].slice(2):[];
  if(new URLSearchParams(location.search).get('assisted-review')==='1'){
   (await wait(()=>button('Abrir fila de revisão assistida'))).click();
   const queue=await wait(()=>document.querySelector('.assisted-review'));
   queue.scrollIntoView({block:'start',behavior:'instant'});
  }
  await report({phase:'account-cash-open',assistedQueueLoaded:Boolean(document.querySelector('.assisted-review')),assistedCaseCount:Number(document.querySelector('.assisted-review')?.dataset.caseCount||0),accountsAvailable:options.length,accountSelected:Boolean(accounts?.value),panelVisible:visible(panel),cashAreaReady:Boolean(document.querySelector(".cash-workspace")),latestMovementShown:document.querySelector(".bank-freshness dd")?.textContent||null,previewLoaded:Boolean(preview),previewMovements:Number(preview?.dataset.movementCount||0),previewOpeningBlank:preview?[...preview.querySelectorAll('.account-cash input')].every(input=>input.value===''):null,previewUnconfirmedBlank:preview?unconfirmed.length===6&&unconfirmed.every(input=>input.value===''):null,oneDriveConnected:status.connected===true,oneDriveLocalReadOnly:status.localReview===true&&status.readOnly===true});
 })().catch(()=>report({phase:'review-navigation-unavailable'}));
}
