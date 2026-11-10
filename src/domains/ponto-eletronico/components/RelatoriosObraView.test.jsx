import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { chamarPontoEletronico } from '../../../api.js';
import { exportarExcelPontoObras,exportarPdfPontoObras } from '../../../reports/ponto-obras.js';
import RelatoriosObraView from './RelatoriosObraView.jsx';
vi.mock('../../../api.js',()=>({chamarPontoEletronico:vi.fn()}));
vi.mock('../../../reports/ponto-obras.js',()=>({exportarExcelPontoObras:vi.fn().mockResolvedValue(),exportarPdfPontoObras:vi.fn()}));
const data={employees:[{id:'p',name:'Pessoa sintética',workdayHours:8}],obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}]};
const resposta={ok:true,apropriacoes:[],cobertura:{completa:true},marcacoes:['07:00','16:00'].map(h=>({id:h,employeeId:'p',obraCapturaId:'a',marcadoEm:`2026-11-03T${h}:00-03:00`,horaConfiavel:true}))};
let root,container;
const botao=texto=>[...container.querySelectorAll('button')].find(b=>b.textContent===texto);
const controle=label=>[...container.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===label)?.querySelector('select,input');
const mudar=async(el,value)=>act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});
beforeEach(async()=>{vi.clearAllMocks();vi.mocked(chamarPontoEletronico).mockResolvedValue(resposta);container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<RelatoriosObraView data={data} obraId="a" dia="2026-11-03" currentUser={{id:'rh',role:'rh'}}/>));});
afterEach(()=>{act(()=>root.unmount());container.remove();});
it('filtra e exporta a consulta sem chamar comandos de gravação',async()=>{
 expect(container.textContent).toContain('Pessoa sintética');
 await act(async()=>botao('Exportar Excel').click());await act(async()=>botao('Exportar PDF').click());
 expect(exportarExcelPontoObras).toHaveBeenCalledOnce();expect(exportarPdfPontoObras).toHaveBeenCalledOnce();
 expect(exportarPdfPontoObras.mock.calls[0][0]).toMatchObject({obra:'Obra A',coberturaCompleta:true});
 await mudar(controle('Obra do relatório'),'b');expect(container.textContent).toContain('Nenhum registro neste filtro');
 expect(chamarPontoEletronico.mock.calls.every(([a])=>a==='ponto-banco-horas')).toBe(true);
});
it('bloqueia exportação até consultar as datas alteradas',async()=>{
 await mudar(controle('Início do período'),'2026-11-02');expect(botao('Exportar Excel').disabled).toBe(true);
 await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(chamarPontoEletronico).toHaveBeenLastCalledWith('ponto-banco-horas',expect.objectContaining({de:'2026-11-02'}));
 expect(botao('Exportar Excel').disabled).toBe(false);
});
it('não exporta resultado antigo depois de falhar uma atualização',async()=>{
 vi.mocked(chamarPontoEletronico).mockResolvedValue({ok:false,error:'Sem acesso'});
 await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(container.textContent).toContain('Sem acesso');expect(botao('Exportar PDF').disabled).toBe(true);
});
it('pagina a tabela mas exporta todos os registros do filtro',async()=>{
 const muitas=Array.from({length:120},(_,i)=>({...resposta.marcacoes[0],id:`evento-${i}`,marcadoEm:new Date(Date.parse('2026-11-03T07:00:00-03:00')+i*60000).toISOString()}));
 vi.mocked(chamarPontoEletronico).mockResolvedValue({...resposta,marcacoes:muitas});
 await act(async()=>container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(container.querySelectorAll('tbody tr')).toHaveLength(100);
 await act(async()=>botao('Próxima').click());expect(container.querySelectorAll('tbody tr')).toHaveLength(20);
 await act(async()=>botao('Exportar Excel').click());expect(exportarExcelPontoObras.mock.calls[0][0].batidas).toHaveLength(120);
});
