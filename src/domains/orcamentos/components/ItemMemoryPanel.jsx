import { useEffect, useMemo, useRef, useState } from 'react';
import { ITEM_MEMORY_MODELS, newMeasurementRow, measurementUnit } from '../item-memory-models';
import { compatibleItemModels, evaluateItemMemory, itemMemoryRows, itemMemorySignature, reusableItemModel, startItemMemory } from '../item-memory';
import './item-memory.css';

const number = value => value == null ? '—' : Number(value).toLocaleString('pt-BR',{maximumFractionDigits:4});
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ItemMeasurementEditor({item,budget,models,onSave,onSaveModel,onNavigate,readOnly,drafts}){
  const [draft,setDraft]=useState(()=>structuredClone(drafts.current.get(item.id) || item.memorialMedicao || startItemMemory(item)));
  const stored=useRef(item.memorialMedicao);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[modelName,setModelName]=useState('');
  useEffect(()=>{if(stored.current!==item.memorialMedicao){stored.current=item.memorialMedicao;drafts.current.delete(item.id);setDraft(structuredClone(item.memorialMedicao || startItemMemory(item)));}},[item.memorialMedicao]);
  const model=ITEM_MEMORY_MODELS[draft.model] || ITEM_MEMORY_MODELS.direct;
  const preview=evaluateItemMemory({...item,memorialMedicao:{...draft,signature:itemMemorySignature(item)}},budget);
  const library=compatibleItemModels(item,models);
  const change=patch=>{const next={...draft,...patch};drafts.current.set(item.id,next);setDraft(next);setError('');setMessage('');};
  const editRow=(id,patch)=>change({rows:draft.rows.map(r=>r.id===id?{...r,...patch}:r)});
  const setModel=key=>change({...startItemMemory(item,key),source:draft.source,note:draft.note});
  const save=async isDraft=>{
    setBusy(true);setError('');setMessage('');
    try{
      const result=await onSave(item.id,draft,{draft:isDraft});
      if(!result?.ok)throw new Error(result?.reason || 'Falha ao salvar. Suas medidas permanecem na tela; tente novamente.');
      setMessage(isDraft?'Rascunho salvo. A quantidade do orçamento foi preservada.':'Memorial salvo e quantidade do orçamento atualizada.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <form className="item-memory-editor" onSubmit={e=>{e.preventDefault();save(false);}}>
    <header>
      <span className="item-memory-eyebrow">{item.stagePath}</span>
      <h3>Item {item.codigoItem} · {item.descricao || 'Sem descrição'}</h3>
      <p>{item.fonte} {item.codigo} · Unidade do orçamento: <strong>{item.unidade}</strong></p>
      <button type="button" onClick={()=>onNavigate(item)}>Ver item na planilha ↗</button>
    </header>
    {item.suggestion.warning && <p className="item-memory-warning">{item.suggestion.warning}</p>}
    {item.memorialMedicao?.signature && item.memorialMedicao.signature!==itemMemorySignature(item) && <p className="item-memory-warning">A composição mudou desde o último cálculo. O modelo e a unidade precisam corresponder ao novo serviço antes de salvar.</p>}
    <fieldset disabled={readOnly || busy}>
      <div className="item-memory-fields">
        <label>Como medir este serviço
          <select value={draft.model} onChange={e=>setModel(e.target.value)}>
            {Object.entries(ITEM_MEMORY_MODELS).filter(([,m])=>!m.unit || m.unit===measurementUnit(item.unidade)).map(([key,m])=><option key={key} value={key}>{m.name}</option>)}
          </select>
        </label>
        {library.length>0 && <label>Modelo salvo para esta composição
          <select aria-label="Usar modelo salvo" value="" onChange={e=>{const m=library.find(x=>x.id===e.target.value);if(m)setModel(m.model);}}>
            <option value="">Escolher modelo com medidas em branco</option>{library.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>}
      </div>
      <div className="item-memory-guide"><strong>{model.formula}</strong><p>{model.help}</p><small>Exemplo: {model.example}</small></div>
      <p className="item-memory-hint">Preencha as medidas reais em metros; espessuras indicadas em cm. Use vírgula ou ponto decimal, sem separador de milhar. Campos em branco não valem zero.</p>
      <div className="item-memory-measures">
        {draft.rows.map((row,index)=><section key={row.id} className={`item-memory-measure ${row.operation==='subtract'?'is-deduction':''}`} aria-label={`Medição ${index+1}`}>
          <div className="item-memory-row-heading"><strong>{row.operation==='subtract'?'− Desconto / vão':'+ Área, local ou trecho'} {index+1}</strong><button type="button" onClick={()=>change({rows:draft.rows.filter(r=>r.id!==row.id)})} aria-label={`Remover medição ${index+1}`}>Remover</button></div>
          <label>Local / identificação<input value={row.local} onChange={e=>editRow(row.id,{local:e.target.value})} placeholder="Ex.: térreo · sala · parede norte"/></label>
          <div className="item-memory-fields">
            {model.fields.map(f=><label key={f.key}>{f.label} {f.unit?`(${f.unit})`:`(${item.unidade})`}
              <input inputMode="decimal" autoComplete="off" aria-label={`${f.label} da medição ${index+1}`} value={row.values?.[f.key] ?? ''} onChange={e=>editRow(row.id,{values:{...row.values,[f.key]:e.target.value}})} placeholder="Preencher"/>
              <small>{f.help}</small>
            </label>)}
          </div>
          <div className="item-memory-subtotal">Subtotal: <strong>{row.operation==='subtract'?'− ':''}{number(preview.rows[index]?.total)} {item.unidade}</strong></div>
        </section>)}
      </div>
      <div className="item-memory-actions">
        <button type="button" onClick={()=>change({rows:[...draft.rows,newMeasurementRow(draft.model,uid())]})}>+ Adicionar local / trecho</button>
        <button type="button" onClick={()=>change({rows:[...draft.rows,{...newMeasurementRow(draft.model,uid()),operation:'subtract'}]})}>− Adicionar desconto / vão</button>
      </div>
      <div className="item-memory-fields">
        <label>Origem das medidas<input value={draft.source || ''} onChange={e=>change({source:e.target.value})} placeholder="Ex.: planta arquitetônica, folha 02, revisão 03"/><small>Obrigatório para quantidade medida diretamente; recomendado nos demais modelos.</small></label>
        <label>Observações / critério de medição<textarea value={draft.note || ''} onChange={e=>change({note:e.target.value})} placeholder="Ex.: apenas face interna; vãos descontados; trecho sem revestimento" rows={2}/></label>
      </div>
      <div className="item-memory-result" aria-live="polite">
        <div><small>No orçamento agora</small><strong>{number(item.quantidade)} {item.unidade}</strong></div>
        <span aria-hidden="true">→</span>
        <div><small>Resultado do memorial</small><strong>{preview.valid?`${number(preview.total)} ${item.unidade}`:'Preencha as medidas'}</strong></div>
        <p>Destino fixo: item {item.codigoItem} · coluna Quantidade. Ao salvar, o resultado substitui a quantidade anterior e recalcula o valor do serviço.</p>
      </div>
      {!preview.valid && <details className="item-memory-pending"><summary>Faltam {preview.errors.length} ajuste(s) para aplicar</summary><ul>{preview.errors.map((e,i)=><li key={i}>{e}</li>)}</ul></details>}
      <div className="item-memory-actions">
        <button type="submit" className="item-memory-primary" disabled={!preview.valid}>{busy?'Salvando…':'Salvar e atualizar orçamento'}</button>
        <button type="button" onClick={()=>save(true)}>Salvar rascunho</button>
      </div>
      {drafts.current.has(item.id) && <small>Alterações ainda não salvas. Salve o cálculo ou o rascunho antes de sair desta aba.</small>}
      <details className="item-memory-library"><summary>Reutilizar este modelo em outros orçamentos</summary>
        <p>Salva a forma de calcular para esta mesma composição. Medidas, locais, origem e quantidades ficam em branco ao reutilizar.</p>
        <label>Nome do modelo<input value={modelName} onChange={e=>setModelName(e.target.value)} placeholder="Ex.: alvenaria por parede com desconto de vãos"/></label>
        <button type="button" onClick={async()=>{
          setBusy(true);setError('');
          try{const result=await onSaveModel(reusableItemModel(item,draft,modelName,uid()));if(!result?.ok)throw new Error(result?.reason || 'Falha ao salvar modelo.');setModelName('');setMessage('Modelo salvo para reutilizar com medidas em branco.');}
          catch(e){setError(e.message);}finally{setBusy(false);}
        }}>Salvar modelo</button>
      </details>
    </fieldset>
    {readOnly && <p>Orçamento aprovado: crie uma revisão para editar o memorial.</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="item-memory-warning">{error}</p>}
  </form>;
}

export default function ItemMemoryPanel({budget,budgets=[],onSave,onSaveModel,onNavigate,onOpenOwner,readOnly,focusItemId}){
  const drafts=useRef(new Map());
  const rows=useMemo(()=>itemMemoryRows(budget),[budget]);
  const [search,setSearch]=useState(''),[stage,setStage]=useState(''),[filter,setFilter]=useState('editable'),[selected,setSelected]=useState(focusItemId || rows.find(i=>!i.owner)?.id);
  useEffect(()=>{if(focusItemId){setSelected(focusItemId);setFilter('all');setStage('');setSearch('');}},[focusItemId]);
  const models=budgets.flatMap(b=>b.modelosMemorial || []);
  const terms=normalize(search).split(/\s+/).filter(Boolean);
  const shown=rows.filter(i=>(!stage || i.etapaId===stage) && (filter==='all' || (filter==='editable'?!i.owner:!i.owner&&!i.memorialMedicao?.active)) && terms.every(t=>normalize(`${i.codigoItem} ${i.codigo} ${i.descricao} ${i.stagePath}`).includes(t)));
  const item=rows.find(i=>i.id===selected);
  const editable=rows.filter(i=>!i.owner),completed=editable.filter(i=>i.memorialMedicao?.active && evaluateItemMemory(i,budget).valid).length;
  return <section className="item-memory">
    <header className="item-memory-intro"><div><h2>Memorial item a item</h2><p>Escolha um serviço, informe os locais e preencha as medidas. Cada formulário já está vinculado ao seu item na planilha.</p></div><strong>{completed} de {editable.length} preenchidos</strong></header>
    <p className="item-memory-hint">{rows.length-editable.length} itens de disciplinas ou vínculos existentes preservados. Modelos geométricos são sugestões; a unidade e o serviço contratado definem o que medir.</p>
    <div className="item-memory-filters">
      <label>Buscar item<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Número, serviço, ambiente ou pavimento"/></label>
      <label>Etapa<select value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas as etapas</option>{[...new Map(rows.map(i=>[i.etapaId,i.stagePath])).entries()].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Mostrar<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="editable">Serviços para medir aqui</option><option value="pending">Ainda não aplicados</option><option value="all">Todos, incluindo disciplinas existentes</option></select></label>
    </div>
    <div className="item-memory-layout">
      <nav aria-label="Itens do memorial" className="item-memory-list">
        <small>{shown.length} item(ns) encontrado(s)</small>
        {shown.map(i=><button key={i.id} type="button" aria-current={i.id===selected?'true':undefined} onClick={()=>setSelected(i.id)}>
          <span>Item {i.codigoItem} · {i.unidade}</span><strong>{i.descricao || 'Sem descrição'}</strong><small>{i.stagePath}</small>
          <span>{i.owner?'Memorial da disciplina':!i.memorialMedicao?'A preencher':i.memorialMedicao.active&&evaluateItemMemory(i,budget).valid?'Aplicado':'Rascunho / ajustar'}</span>
        </button>)}
        {!shown.length && <p>Nenhum item com estes filtros.</p>}
      </nav>
      {item?item.owner?<article className="item-memory-editor"><h3>Item {item.codigoItem} · {item.descricao || 'Sem descrição'}</h3><p>{item.owner.name}: utilize o levantamento e os vínculos desta disciplina. Este formulário não modifica esses dados.</p><p>Quantidade atual: {number(item.quantidade)} {item.unidade}</p><button onClick={()=>onNavigate(item)}>Ver item na planilha</button>{item.owner.discipline&&<button onClick={()=>onOpenOwner(item.owner)}>Abrir memorial da disciplina</button>}</article>:
        <ItemMeasurementEditor key={`${budget.id}:${item.id}`} {...{item,budget,models,onSave,onSaveModel,onNavigate,readOnly,drafts}}/>:<p>Selecione um item para começar.</p>}
    </div>
  </section>;
}
