import {marcellReportHtml} from './marcell-report.js';

let presenter;
let pending;

// One request at a time; cancelling does not open a window or change records.
export function registerReportIdentityPresenter(present) {
  presenter=present;
  return ()=>{if(presenter===present){presenter=undefined;pending?.cancel();}};
}

export function openReportPreview(html, {autoPrint=false,adjustableTables=false,printPreferenceScope=''}={}) {
  if(typeof html!=='string'||!/<body\b/i.test(html))throw new Error('Confira os dados do relatório e tente novamente.');
  if(!presenter)throw new Error('Aguarde a logomarca e tente novamente.');
  if(pending)return Promise.resolve(null);
  const trigger=document.activeElement;
  let finish;
  const promise=new Promise(resolve=>{finish=resolve;});
  const request={trigger,cancel(){if(pending!==request)return;pending=undefined;finish(null);},generate(){
    if(pending!==request)return null;
    // Called synchronously by the confirmation click, retaining popup permission.
    const preview=window.open('','_blank');
    if(!preview)throw new Error('Permita abrir janelas para este site e use Gerar relatório novamente.');
    try{
      preview.opener=null;
      preview.document.open();
      preview.document.write(marcellReportHtml(html,{adjustableTables,requireFonts:true,printPreferenceScope}));
      preview.document.close();
      preview.focus();
      if(autoPrint)window.setTimeout(()=>{if(!preview.closed)preview.print();},300);
      pending=undefined;finish(preview);
      return preview;
    }catch(error){preview.close();throw error;}
  }};
  pending=request;presenter(request);
  return promise;
}
