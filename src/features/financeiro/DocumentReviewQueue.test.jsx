import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import DocumentReviewQueue from './DocumentReviewQueue.jsx';
const rows=[1,2].map(n=>({id:`n${n}`,type:'nota_fiscal',label:'Nota fiscal',period:'2026-11',entry:{description:`Nota ${n}`,date:'2026-11-10'},record:{id:`n${n}`,numero:String(n),obraId:'a',status:'recebida',emissao:'2026-11-10'}}));
it('conserva a sequência ao remontar, distingue abertura de salvamento e revalida bloqueios',()=>{
 const el=document.createElement('div');document.body.append(el);let root=createRoot(el),view,opened=[];
 const props={rows,user:{role:'admin'},scope:'a',onChange:value=>{view=value;},onReview:id=>opened.push(id)};
 const render=(data={})=>act(()=>root.render(<DocumentReviewQueue {...props} data={data} view={view}/>));
 const click=text=>act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent===text).click());
 try{
  render();click('Selecionar notas disponíveis');render();click('Revisar seleção · 2');render();click('Abrir próxima ficha fiscal');expect(opened).toEqual(['n1']);
  act(()=>root.unmount());root=createRoot(el);render();expect(el.textContent).toContain('1 ficha(s) por abrir');expect(el.textContent).toContain('não significa que foi salva');
  render({fechamentosFinanceiros:[{status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30'}]});
  expect([...el.querySelectorAll('button')].find(b=>b.textContent==='Abrir próxima ficha fiscal').disabled).toBe(true);expect(el.textContent).toContain('2 bloqueado(s)');expect(opened).toEqual(['n1']);
  render();click('Abrir próxima ficha fiscal');expect(opened).toEqual(['n1','n2']);render();expect([...el.querySelectorAll('button')].find(b=>b.textContent==='Abrir próxima ficha fiscal').disabled).toBe(true);
 }finally{act(()=>root.unmount());el.remove();}
});
it('mantém identidades após reordenação, explica remoção/bloqueio e continua nos demais',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);let view,opened=[];
 const props={data:{},user:{role:'admin'},scope:'a',onChange:value=>{view=value;},onReview:id=>opened.push(id)};
 const render=(items=rows,scope='a')=>act(()=>root.render(<DocumentReviewQueue {...props} scope={scope} rows={items} view={view}/>));
 const click=text=>act(()=>[...el.querySelectorAll('button')].find(button=>button.textContent===text).click());
 try{
  render();click('Selecionar notas disponíveis');render();click('Revisar seleção · 2');render();click('Abrir próxima ficha fiscal');render([...rows].reverse());
  expect(view.ids).toEqual(['n1','n2']);expect(el.textContent).toContain('1 ficha(s) por abrir');
  render([{...rows[1],record:{...rows[1].record,status:'aprovada'}},{...rows[0],record:{...rows[0].record,version:1}}]);expect(el.textContent).toContain('Registro atualizado desde a abertura');expect(el.textContent).toContain('Fora da fila de conferência');
  render([rows[1]]);expect(el.textContent).toContain('Registro indisponível');click('Abrir próxima ficha fiscal');expect(opened).toEqual(['n1','n2']);
  render(rows,'b');expect(el.querySelectorAll('input:checked')).toHaveLength(0);expect(el.textContent).not.toContain('Prévia da conferência em sequência');
 }finally{act(()=>root.unmount());el.remove();}
});
it('pagina a seleção de 1.000 registros e conserva a seleção de todas as páginas',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);let view;
 const items=Array.from({length:1000},(_,i)=>({...rows[0],id:`v${i}`,record:{...rows[0].record,id:`v${i}`,numero:`V${i}`}}));
 const render=()=>act(()=>root.render(<DocumentReviewQueue rows={items} data={{}} user={{role:'admin'}} scope="volume" view={view} onChange={value=>{view=value;}} onReview={()=>{}}/>));
 const click=text=>act(()=>[...el.querySelectorAll('button')].find(button=>button.textContent===text).click());
 try{render();expect(el.querySelectorAll('input')).toHaveLength(25);click('Selecionar notas disponíveis');render();expect(view.ids).toHaveLength(1000);click('Próxima página');render();expect(el.textContent).toContain('Página 2 de 40');expect(el.querySelectorAll('input:checked')).toHaveLength(25);click('Revisar seleção · 1000');render();expect(el.textContent).toContain('1000 ficha(s) por abrir');expect(el.querySelectorAll('li')).toHaveLength(25);}finally{act(()=>root.unmount());el.remove();}
});
it('erro em uma ficha permite abrir a próxima sem marcar a sequência como concluída',async()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);let view,opened=[];
 const render=()=>act(()=>root.render(<DocumentReviewQueue rows={rows} data={{}} user={{role:'admin'}} scope="failure" view={view} onChange={value=>{view=value;}} onReview={async id=>{opened.push(id);if(id==='n1')throw new Error('offline');}}/>));
 const click=text=>act(()=>[...el.querySelectorAll('button')].find(button=>button.textContent===text).click());
 try{render();click('Selecionar notas disponíveis');render();click('Revisar seleção · 2');render();await act(async()=>{[...el.querySelectorAll('button')].find(button=>button.textContent==='Abrir próxima ficha fiscal').click();});render();expect(el.querySelector('[role=alert]').textContent).toContain('Não foi possível abrir');click('Abrir próxima ficha fiscal');render();expect(opened).toEqual(['n1','n2']);expect(el.textContent).toContain('sem nova versão confirmada');expect(el.querySelector('[role=alert]')).not.toBeNull();}finally{act(()=>root.unmount());el.remove();}
});
