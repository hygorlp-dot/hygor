// Navegação local pelos controles existentes. Não abre editores nem salva dados.
import {temSessao} from '../src/api.js';
if(import.meta.env.DEV&&location.origin==='http://127.0.0.1:4192'&&new URLSearchParams(location.search).get('local-review')==='users'){
 const visible=el=>el&&el.getClientRects().length>0;
 const findButton=name=>[...document.querySelectorAll('button')].find(el=>visible(el)&&(el.getAttribute('aria-label')||el.textContent).trim()===name);
 const adminGroup=()=>[...document.querySelectorAll('.nav-grp-hd')].find(el=>visible(el)&&el.textContent.trim().startsWith('Administração'));
 const settingsSelect=()=>[...document.querySelectorAll('select')].find(el=>visible(el)&&el.getAttribute('aria-label')==='Telas de Administração');
 const wait=async condition=>{const end=Date.now()+600000;while(Date.now()<end){const result=condition();if(result)return result;await new Promise(resolve=>setTimeout(resolve,200));}return null;};
 (async()=>{
  if(!await wait(()=>temSessao()))return;
  if(!await wait(()=>document.querySelector('.user-directory')||findButton('Ajustes')||adminGroup()||findButton('Abrir Administração')||findButton('Abrir mais módulos')||settingsSelect()))return;
  if(!document.querySelector('.user-directory')){
   const group=adminGroup()||findButton('Abrir Administração');
   if(!findButton('Ajustes')&&!settingsSelect()){
    if(group)group.click();else{findButton('Abrir mais módulos')?.click();(await wait(()=>findButton('Administração')))?.click();}
   }
   if(!await wait(()=>findButton('Ajustes')||settingsSelect()||document.querySelector('.user-directory')))return;
   if(!document.querySelector('.user-directory')){
    const select=settingsSelect();if(select){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'config');select.dispatchEvent(new Event('change',{bubbles:true}));}else findButton('Ajustes')?.click();
   }
  }
  const directory=await wait(()=>document.querySelector('.user-directory'));directory?.scrollIntoView({block:'start',behavior:'instant'});
  if(directory&&new URLSearchParams(location.search).get('layout-review')==='1'){
   await document.fonts.ready;
   const rows=[...directory.querySelectorAll('tbody tr')];
   const overlaps=rows.filter(row=>{const member=row.querySelector('.user-directory__member'),cell=row.querySelector('td');return member&&cell&&getComputedStyle(cell).display==='block'&&member.getBoundingClientRect().bottom>cell.getBoundingClientRect().top+1;}).length;
   const result={visible:visible(directory),viewportWidth:innerWidth,directoryWidth:Math.round(directory.getBoundingClientRect().width),rows:rows.length,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,directoryOverflow:directory.scrollWidth>directory.clientWidth+1,overlappingMembers:overlaps};
   try{await fetch('http://127.0.0.1:4204/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result),signal:AbortSignal.timeout(1500)});}catch{/* Verificador local opcional. */}
  }
 })();
}
