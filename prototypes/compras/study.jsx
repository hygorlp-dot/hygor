import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {profile} from '../../scripts/fixtures/workflow-priorities-data.mjs';
import './study.css';
import {themeRegistry} from '../../src/design-system/themes/themeRegistry.js';

const directions = [
  {id:'precision',name:'Precisão',description:'Hierarquia compacta, navegação discreta e registros em primeiro plano.',cost:'Menos expressiva; privilegia a leitura contínua.'},
  {id:'construction',name:'Obra',description:'Navegação grafite, ações em petróleo e prioridades ao lado dos registros.',cost:'A coluna de prioridades reduz a largura da tabela no desktop.'},
  {id:'focus',name:'Foco',description:'Prioridades em faixa compacta e cada registro com mais espaço para decidir.',cost:'Mostra menos registros por tela.'},
  {id:'workbench',name:'Mesa de trabalho',description:'Referência Outlook: lista contínua, comandos compactos e mais registros à vista.',cost:'A densidade pede leitura atenta; formulários e celular preservam alvos maiores.'},
];
const initial = Number(new URLSearchParams(location.search).get('v'))-1;
// This page exists only in the Vite source tree. No production entry imports it.
sessionStorage.setItem(`arcd-section:${profile.id}`,'cmp');

function Study(){
  const [index,setIndex]=useState(Number.isInteger(initial)&&initial>=0&&initial<directions.length?initial:0);
  const [light,setLight]=useState(new URLSearchParams(location.search).get('menu')==='claro');
  const frame=useRef(null),picker=useRef(null),highlight=useRef(null);
  const current=directions[index];
  function apply(){
    const doc=frame.current?.contentDocument;
    if(!doc?.head)return;
    if(!doc.getElementById('purchase-study-css')){
      const link=doc.createElement('link');link.id='purchase-study-css';link.rel='stylesheet';doc.head.append(link);
    }
    const link=doc.getElementById('purchase-study-css');link.href=current.id==='workbench'?'/prototypes/compras/workbench.css':'/prototypes/compras/variants.css';
    for(const name of Object.keys(themeRegistry.marcell.tokens))doc.documentElement.style.removeProperty(name);
    if(current.id==='workbench')for(const [name,value] of Object.entries(themeRegistry[light?'saas':'marcell'].tokens))doc.documentElement.style.setProperty(name,value,'important');
    doc.documentElement.dataset.designStudy=current.id;
  }
  useLayoutEffect(()=>{
    apply();
    const item=picker.current?.querySelectorAll('button')[index];
    if(item&&highlight.current){highlight.current.style.width=`${item.offsetWidth}px`;highlight.current.style.transform=`translateX(${item.offsetLeft}px)`;}
    const url=new URL(location.href);url.searchParams.set('v',index+1);url.searchParams.set('menu',light?'claro':'marinho');history.replaceState(null,'',url);
  },[index,light]);
  useEffect(()=>{
    const onKey=event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.defaultPrevented||event.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      // Let the app's own dialogs, menus and controls own their keyboard events.
      if(frame.current?.contentDocument?.querySelector('[role="dialog"],.app-help-panel:popover-open'))return;
      const number=Number(event.key);
      if(number>=1&&number<=directions.length)setIndex(number-1);
      else if(event.key==='ArrowRight'){event.preventDefault();setIndex(i=>(i+1)%directions.length);}
      else if(event.key==='ArrowLeft'){event.preventDefault();setIndex(i=>(i+directions.length-1)%directions.length);}
    };
    window.addEventListener('keydown',onKey);
    const first=requestAnimationFrame(()=>requestAnimationFrame(()=>picker.current?.setAttribute('data-ready','')));
    return()=>{window.removeEventListener('keydown',onKey);cancelAnimationFrame(first);};
  },[]);
  return <>
    <header className="study-heading"><div><strong>MARCELL · Estudo de Compras</strong><p aria-live="polite"><b>{current.name}</b> — {current.description}</p></div>
      <div className="study-options">{current.id==='workbench'&&<label>Menu<select aria-label="Aparência do menu" value={light?'claro':'marinho'} onChange={event=>setLight(event.target.value==='claro')}><option value="marinho">Azul-marinho MARCELL</option><option value="claro">Claro, como a referência</option></select></label>}<details><summary>Como comparar</summary><div><p>Mesmos dados fictícios, filtros e ações. Trocar a proposta preserva a tela aberta. Nenhuma proposta foi aplicada como tema definitivo.</p><p>Use os botões abaixo ou as teclas 1 a 4 quando o foco estiver fora do ERP.</p><p><b>Custo desta direção:</b> {current.cost}</p><p>Teste busca, Filtros, Nova solicitação e a próxima ação de um registro. A prévia local guarda apenas dados de demonstração.</p><a href="/" target="_blank" rel="noreferrer">Abrir o ERP atual</a></div></details></div>
    </header>
    <iframe ref={frame} title="Compras · proposta visual interativa" src="/" onLoad={apply}/>
    <nav ref={picker} className="proto-picker" aria-label="Propostas visuais">
      <span ref={highlight} className="proto-picker-highlight" aria-hidden="true"/>
      {directions.map((direction,i)=><button key={direction.id} type="button" className="proto-picker-item" data-active={i===index?'':undefined} aria-current={i===index?'true':undefined} onClick={()=>setIndex(i)}>{direction.name}</button>)}
    </nav>
  </>;
}
createRoot(document.getElementById('study-root')).render(<Study/>);
