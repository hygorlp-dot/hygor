import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,afterEach} from 'vitest';
import {ClientDashboard} from '../pages/ClientDashboard.jsx';
import {ClientFinancialPage} from '../pages/ClientFinancialPage.jsx';
const mounted=[];
function render(ui){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);act(()=>root.render(ui));mounted.push([root,host]);return host;}
afterEach(()=>{for(const [root,host]of mounted.splice(0)){act(()=>root.unmount());host.remove();}});
it('não mostra zero nem barra de progresso quando falta a informação',()=>{
 const host=render(<ClientDashboard data={{project:{progress:null}}}/>);
 expect(host.textContent).toContain('Avanço ainda não informado');expect(host.querySelector('[role="progressbar"]')).toBeNull();
});
it('identifica estimativa do cronograma e preserva a precisão do avanço',()=>{
 const host=render(<ClientDashboard data={{project:{progress:42.75,progressSource:'cronograma'}}}/>);
 expect(host.textContent).toContain('42,75%');expect(host.textContent).toContain('Estimativa pelo cronograma');
});
it('explica contrato por valor, destaca parcela sem vencimento e rotula a data do recebimento',()=>{
 const host=render(<ClientFinancialPage data={{contractPositions:[{measurementKind:'valor',accumulatedPercentage:null,accumulatedAmount:null,contractCurrent:1000,openInstallments:[{id:'p',description:'Parcela sem data',balance:100,amount:100,paid:0,dueDate:'',periodPercentage:null}]}],measurements:[{id:'m',percentage:null,amount:100}],payments:[{id:'r',amount:20,dueDate:'2026-11-12'}]}}/>);
 expect(host.textContent).toContain('Contrato por valor');expect(host.textContent).toContain('vencimento A confirmar');expect(host.textContent).toContain('Medição por valor, sem percentual informado');expect(host.textContent).toContain('Data do recebimento:');expect(host.textContent).not.toContain('Aguardando medição');
});
