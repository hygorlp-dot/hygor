import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {profile} from '../../scripts/fixtures/workflow-priorities-data.mjs';
import './study.css';

const directions = [
  {id:'precision',name:'Precisão',description:'Hierarquia compacta, navegação discreta e registros em primeiro plano.',cost:'Menos expressiva; privilegia a leitura contínua.'},
  {id:'construction',name:'Obra',description:'Navegação grafite, ações em petróleo e prioridades ao lado dos registros.',cost:'A coluna de prioridades reduz a largura da tabela no desktop.'},
  {id:'focus',name:'Foco',description:'Prioridades em faixa compacta e cada registro com mais espaço para decidir.',cost:'Mostra menos registros por tela.'},
];
const initial = Number(new URLSearchParams(location.search).get('v'))-1;
// This page exists only in the Vite source tree. No production entry imports it.
sessionStorage.setItem(`arcd-section:${profile.id}`,'cmp');

function Study(){
  const [index,setIndex]=useState(Number.isInteger(initial)&&initial>=0&&initial<3?initial:0);
  const frame=useRef(null),picker=useRef(null),highlight=useRef(null);
  const current=directions[index];
  function apply(){
    const doc=frame.current?.contentDocument;
    if(!doc?.head)return;
    if(!doc.getElementById('purchase-study-css')){
      const link=doc.createElement('link');link.id='purchase-study-css';link.rel='stylesheet';link.href='/prototypes/compras/variants.css';doc.head.append(link);
    }
    doc.documentElement.dataset.designStudy=current.id;
  }
  useLayoutEffect(()=>{
    apply();
    const item=picker.current?.querySelectorAll('button')[index];
    if(item&&highlight.current){highlight.current.style.width=`${item.offsetWidth}px`;highlight.current.style.transform=`translateX(${item.offsetLeft}px)`;}
    const url=new URL(location.href);url.searchParams.set('v',index+1);history.replaceState(null,'',url);
  },[index]);
  useEffect(()=>{
    const onKey=event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.defaultPrevented||event.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      // Let the app's own dialogs, menus and controls own their keyboard events.
      if(frame.current?.contentDocument?.querySelector('[role="dialog"],.app-help-panel:popover-open'))return;
      const number=Number(event.key);
      if(number>=1&&number<=3)setIndex(number-1);
      else if(event.key==='ArrowRight'){event.preventDefault();setIndex(i=>(i+1)%3);}
      else if(event.key==='ArrowLeft'){event.preventDefault();setIndex(i=>(i+2)%3);}
    };
    window.addEventListener('keydown',onKey);
    const first=requestAnimationFrame(()=>requestAnimationFrame(()=>picker.current?.setAttribute('data-ready','')));
    return()=>{window.removeEventListener('keydown',onKey);cancelAnimationFrame(first);};
  },[]);
  return <>
    <header className="study-heading"><div><strong>MARCELL · Estudo de Compras</strong><p aria-live="polite"><b>{current.name}</b> — {current.description}</p></div>
      <details><summary>Como comparar</summary><div><p>Mesmos dados fictícios, filtros e ações. Trocar a proposta preserva a tela aberta. Nenhuma proposta foi aplicada como tema definitivo.</p><p>Use os botões abaixo ou as teclas 1, 2 e 3 quando o foco estiver fora do ERP.</p><p><b>Custo desta direção:</b> {current.cost}</p><p>Teste busca, Filtros, Nova solicitação e a próxima ação de um registro. A prévia local guarda apenas dados de demonstração.</p><a href="/" target="_blank" rel="noreferrer">Abrir o ERP atual</a></div></details>
    </header>
    <iframe ref={frame} title="Compras · proposta visual interativa" src="/" onLoad={apply}/>
    <nav ref={picker} className="proto-picker" aria-label="Propostas visuais">
      <span ref={highlight} className="proto-picker-highlight" aria-hidden="true"/>
      {directions.map((direction,i)=><button key={direction.id} type="button" className="proto-picker-item" data-active={i===index?'':undefined} aria-current={i===index?'true':undefined} onClick={()=>setIndex(i)}>{direction.name}</button>)}
    </nav>
  </>;
}
createRoot(document.getElementById('study-root')).render(<Study/>);
