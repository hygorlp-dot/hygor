import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import ForecastReviewHistory from './ForecastReviewHistory.jsx';

let root,container;
const mount=work=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<ForecastReviewHistory work={work}/>));};
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
const row=(version,id='a')=>({version,amendmentId:id,amendmentNumber:id==='a'?1:2,description:'Piso da sala',stageId:'s',stageLabel:'Acabamentos',mode:'separate',amountCents:800000,remainingCents:7800000,by:'Eng. Ana',at:'2026-10-31T15:00:00Z',justification:`Piso separado dos serviços — revisão ${version}`,legacy:false});

it('mostra responsável, data, decisão, justificativa e valores salvos',()=>{
 mount({costPlanning:{amendmentReviewHistory:[row(1)]}});
 const text=container.textContent;
 for(const expected of ['Eng. Ana','31/10/2026','Custo separado do restante','Piso separado dos serviços','8.000,00','78.000,00'])expect(text).toContain(expected);
 expect(container.querySelector('section').getAttribute('aria-label')).toBe('Histórico de conferência das duplicidades');
});
it('distingue dados antigos e ausentes das premissas originais sem inventar conferência',()=>{
 mount({costPlanning:{history:[{version:1,stageId:'s',asOf:'2026-10-31',note:'Premissa antiga',amendmentCoverage:{a:{mode:'included',amountCents:800000,remainingCents:7800000}}}]}});
 expect(container.textContent).toContain('ResponsávelNão registrado');expect(container.textContent).toContain('Data da conferênciaNão registrada');expect(container.textContent).toContain('Justificativa: Não registrada.');expect(container.textContent).toContain('Premissas da revisão: Premissa antiga');expect(container.textContent).toContain('Registro antigo');
});
it('filtra e pagina somente a consulta sem modificar o histórico',()=>{
 const work={costPlanning:{amendmentReviewHistory:Array.from({length:13},(_,i)=>row(i+1,i<2?'b':'a'))}},before=structuredClone(work);mount(work);
 expect(container.querySelectorAll('ol>li')).toHaveLength(10);
 act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Próximas conferências').click());expect(container.querySelectorAll('ol>li')).toHaveLength(3);
 const select=container.querySelector('select');act(()=>{select.value='b';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(container.querySelectorAll('ol>li')).toHaveLength(2);expect(work).toEqual(before);
});
it('orienta a registrar uma conferência quando o histórico está vazio',()=>{
 mount({id:'empty'});expect(container.textContent).toContain('Nenhuma conferência salva');expect(container.querySelectorAll('button')).toHaveLength(0);
});
