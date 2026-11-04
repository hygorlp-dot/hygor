import {MARCELL_LOGO} from '../brand/identity.js';
import arcdAsset from './assets/arcd-original.png?url';

export const MARCELL_REPORT_IDENTITY=Object.freeze({id:'marcell',name:'MARCELL',logo:MARCELL_LOGO});
let arcdLoading;
export function loadReportIdentity(id) {
  if(id!=='arcd')return Promise.resolve(MARCELL_REPORT_IDENTITY);
  if(!arcdLoading)arcdLoading=fetch(arcdAsset).then(async response=>{
    if(!response.ok)throw new Error('Não foi possível carregar a logomarca ARCD. Tente novamente.');
    const blob=await response.blob();
    const logo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível preparar a logomarca ARCD.'));reader.readAsDataURL(blob);});
    if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logo))throw new Error('A logomarca ARCD não pôde ser lida. Tente novamente.');
    return {id:'arcd',name:'ARCD',logo};
  }).catch(error=>{arcdLoading=undefined;throw error;});
  return arcdLoading;
}
