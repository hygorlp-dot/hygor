import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {BookOpen, X} from 'lucide-react';
import {Button} from '../../design-system/primitives/Button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {HELP_BY_ID, HELP_GUIDES, HELP_GLOSSARY, HELP_INTERRUPTION_GUIDE, HELP_REVIEWED_AT, searchHelp} from './help-content.js';

function topicOwner(id){if(id.startsWith('arquivos_'))return 'arquivos';return id.startsWith('obra_')?'obras':id.startsWith('cmp_')?'cmp':id.startsWith('fin_')?'fin':id;}

export default function HelpPanel({id,topicId,pageId,allowedTabs=[],onClose}){
 const panel=useRef(null),title=useRef(null),articleTitle=useRef(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const [manual,setManual]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState(topicId);
 const available=HELP_GUIDES.filter(item=>allowedTabs.includes(topicOwner(item.id))||item.id===topicId||item.id===pageId);
 const results=searchHelp(available,query);
 const current=HELP_BY_ID[manual?selected:topicId];
 useLayoutEffect(()=>{
  const node=panel.current;
  node?.showPopover?.();title.current?.focus();
  return ()=>node?.hidePopover?.();
 },[]);
 useEffect(()=>{
  const escape=event=>{
   // Não fecha outro diálogo que o usuário abriu enquanto consultava a ajuda.
   if(event.key==='Escape'&&panel.current?.contains(document.activeElement)){event.preventDefault();event.stopPropagation();closeRef.current();}
  };
  const node=panel.current;node?.addEventListener('keydown',escape);
  return ()=>node?.removeEventListener('keydown',escape);
 },[]);
 const selectGuide=id=>{setSelected(id);requestAnimationFrame(()=>articleTitle.current?.focus());};
 return <aside ref={panel} id={id} popover="manual" className="app-help-panel" aria-label="Central de ajuda">
  <header className="app-help-panel__header"><div><h2 ref={title} tabIndex={-1}>Ajuda e manual</h2><p>Orientações para usar o sistema, passo a passo.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar ajuda"><X aria-hidden="true"/></Button></header>
  <div className="app-help-panel__body">
   <nav aria-label="Conteúdo da ajuda" className="app-help-modes"><Button variant={manual?'outline':'primary'} aria-pressed={!manual} onClick={()=>setManual(false)}>Esta página</Button><Button variant={manual?'primary':'outline'} aria-pressed={manual} onClick={()=>setManual(true)}><BookOpen data-icon="inline-start" aria-hidden="true"/>Manual completo</Button></nav>
   {manual&&<section aria-label="Buscar no manual" className="app-help-search">
    <Input label="O que você precisa fazer?" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ex.: receber material, ponto, nota fiscal" type="search"/>
    <p role="status">{results.length} {results.length===1?'guia encontrado':'guias encontrados'} nas suas áreas de acesso.</p>
    {results.length>0?<nav className="app-help-index" aria-label="Guias do manual">{results.map(item=><Button key={item.id} variant="ghost" aria-current={selected===item.id?'true':undefined} onClick={()=>selectGuide(item.id)}>{item.title}</Button>)}</nav>:<div><p>Nenhum guia encontrado. Tente o nome de uma tela ou uma palavra mais curta.</p><Button variant="outline" onClick={()=>setQuery('')}>Limpar busca</Button></div>}
   </section>}
   {current?<article className="app-help-article" aria-labelledby={`${id}-article`}>
    <h3 id={`${id}-article`} ref={articleTitle} tabIndex={-1}>{current.title}</h3><p>{current.purpose}</p>
    <h4>Antes de começar</h4><p>{current.before}</p>
    <h4>Como fazer</h4><ol>{current.steps.map(step=><li key={step}>{step}</li>)}</ol>
    <h4>Como conferir se deu certo</h4><p>{current.result}</p>
    <h4>O que merece atenção</h4><p>{current.attention}</p>
    {current.example&&<><h4>Exemplo ilustrativo</h4><p>{current.example}</p></>}
    {current.responsibilities&&<><h4>Quem cuida de cada parte</h4><dl>{current.responsibilities.map(([owner,task])=><div key={owner}><dt><strong>{owner}</strong></dt><dd>{task}</dd></div>)}</dl></>}
    {current.exceptions&&<><h4>Quando o fluxo acontece de outro jeito</h4>{current.exceptions.map(([situation,action])=><details className="app-help-details" key={situation}><summary>{situation}</summary><p>{action}</p></details>)}</>}
   </article>:<p>Esta tela ainda não tem um guia específico. Consulte o manual e informe ao responsável pelo sistema qual orientação está faltando.</p>}
   <details className="app-help-details"><summary>Não encontrei um botão ou meu registro</summary><p>Algumas ações dependem do seu perfil e da situação do registro. Confira a obra, o período, a busca e os filtros. Se a função continuar indisponível, peça ao administrador para conferir seu acesso.</p></details>
   <details className="app-help-details"><summary>Não sei se minha alteração foi salva</summary><p>Confira o indicador de salvamento no cabeçalho e a mensagem da ação. Se houver erro ou conflito, leia a orientação antes de repetir. Abra o registro novamente para conferir o resultado e evitar duplicidade.</p></details>
   <details className="app-help-details"><summary>Celular, interrupções e recuperação</summary><dl>{HELP_INTERRUPTION_GUIDE.map(([situation,action])=><div key={situation}><dt>{situation}</dt><dd>{action}</dd></div>)}</dl></details>
   <details className="app-help-details"><summary>Aparência e navegação</summary><p>Use o ícone de paleta no cabeçalho para escolher MARCELL Claro ou MARCELL Institucional e ajustar a densidade. A preferência fica neste navegador. No computador, Mais áreas reúne as consultas complementares do Financeiro; no celular, use o seletor Áreas do financeiro. O botão Filtros mostra as opções adicionais sem apagar os valores ao recolher.</p></details>
   <details className="app-help-details"><summary>Entenda os termos do sistema</summary><dl>{HELP_GLOSSARY.map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></details>
   <p className="app-help-revision">Revisão do conteúdo: {HELP_REVIEWED_AT}. Os botões disponíveis respeitam seu perfil e a situação do registro.</p>
  </div>
 </aside>;
}
