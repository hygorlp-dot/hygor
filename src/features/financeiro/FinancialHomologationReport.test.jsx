import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import FinancialHomologationReport from './FinancialHomologationReport.jsx';
let root,el;
afterEach(()=>{act(()=>root?.unmount());el?.remove();});
const mount=report=>{el=document.createElement('div');document.body.append(el);root=createRoot(el);act(()=>root.render(<FinancialHomologationReport report={report} works={[{id:'a',name:'Obra Alameda'}]}/>));};
it('mostra motor ativo, 678 diferenças, filtro e segunda página sem editar o relatório',()=>{
 const report={engineEnforced:true,prontoParaAtivar:false,activationGate:{ready:false,checks:[{code:'dre_divergence',ok:false,detail:'678 diferenças para conferir.'}]},divergenciasDRE:Array.from({length:678},(_,i)=>({sourceId:'2026-11:mes:a',path:`campo-${i}`,expected:i,canonical:i+1,difference:1}))};
 const before=JSON.stringify(report);mount(report);
 expect(el.textContent).toContain('Motor financeiro ativo');expect(el.textContent).not.toContain('Motor permanece em sombra');expect(el.textContent).not.toContain('Todos os totais homologados coincidem');
 expect(el.textContent).toContain('1–12 de 678');expect(el.querySelectorAll('article h3')).toHaveLength(12);
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Próxima').click());expect(el.textContent).toContain('13–24 de 678');expect(el.textContent).toContain('campo-12');
 const search=el.querySelector('input');act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'campo-677');search.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(el.textContent).toContain('1–1 de 1');expect(el.querySelectorAll('article h3')).toHaveLength(1);expect(el.textContent).toContain('Obra Alameda');
 expect(JSON.stringify(report)).toBe(before);
});
it('relatório incompleto não aparece como homologado e diagnóstico fica recolhido',()=>{
 mount({engineEnforced:false,divergenciasDRE:[{sourceId:'2026-11:mes:a',path:'total',expected:100,canonical:120,difference:20}]});
 expect(el.textContent).toContain('Motor financeiro em observação');expect(el.textContent).toContain('O relatório não informou');
 expect(el.querySelectorAll('details[open]')).toHaveLength(0);
});
