import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import AprovacoesPendentes from './AprovacoesPendentesView.jsx';
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=null;container=null;});
function render(props){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(<AprovacoesPendentes {...props}/>));}
function fill(input,value){act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('mantém justificativas independentes quando duas solicitações usam a mesma etapa da política',async()=>{
 const user={id:'admin',role:'admin',active:true},sent=[];
 const instance=(id,entityId)=>({id,entidadeTipo:'solicitacaoCompra',entidadeId:entityId,status:'em_andamento',snapshotPolitica:{etapas:[{id:'admin',nome:'Administrador'}]},resultadosEtapas:[{status:'em_andamento',aprovadoresElegiveis:[user]}]});
 const data={obras:[{id:'a',name:'Obra A'}],solicitacoesCompra:[{id:'one',numero:'SC-1',obraId:'a',status:'em_analise',aprovacaoInstanciaId:'i1'},{id:'two',numero:'SC-2',obraId:'a',status:'em_analise',aprovacaoInstanciaId:'i2'}],instanciasAprovacao:[instance('i1','one'),instance('i2','two')]};
 render({data,currentUser:user,showToast:vi.fn(),dispatchCommand:async factory=>{sent.push(factory());return {ok:true};}});
 const fields=container.querySelectorAll('textarea');fill(fields[0],'Corrigir primeiro documento');expect(fields[1].value).toBe('');fill(fields[1],'Conferir segundo documento');
 await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reprovar').click());
 expect(sent).toHaveLength(1);expect(sent[0].payload).toMatchObject({instanciaId:'i1',etapaId:'admin',decisao:'reprovado',justificativa:'Corrigir primeiro documento'});expect(fields[1].value).toBe('Conferir segundo documento');
});
it('não oferece decisão para diagnóstico sem fluxo de aprovação',()=>{
 render({data:{solicitacoesCompra:[{id:'legacy',numero:'SC-0005',status:'enviada',obraId:'a'}]},currentUser:{id:'admin',role:'admin'},showToast:vi.fn()});
 expect(container.textContent).toContain('Solicitações sem fluxo de aprovação compatível');expect([...container.querySelectorAll('button')].some(b=>['Aprovar','Reprovar'].includes(b.textContent.trim()))).toBe(false);
});
