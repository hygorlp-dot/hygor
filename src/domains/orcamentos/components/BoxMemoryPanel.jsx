import { useMemo, useRef, useState } from 'react';
import {
  BOX_DIMENSIONS, BOX_MEASURES, BOX_MEASURE_GROUPS, boxGeometry, boxMeasureValue, boxWarnings,
  describeBoxMeasure, evaluateBoxLink, isBoxLinkable, measuresForUnit, suggestBoxMeasure, telaNominal, unitLabel,
} from '../box-memory';
import { calculateBudget } from '../calculations';
import { memoryBudgetItems, normalizeStructuralText } from '../structural-budget-matching';
import { budgetSubtreeIds } from '../tree';
import './item-memory.css';
import './box-memory.css';

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dec = (value, digits = 2) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('pt-BR', {minimumFractionDigits:digits, maximumFractionDigits:digits});
const brl = value => Number(value || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const stagePath = (stages, id) => {
  const names = [], seen = new Set();
  while (id && !seen.has(id)) { seen.add(id); const s = stages.find(x => x.id === id); if (!s) break; names.unshift(s.nome); id = s.parentId; }
  return names.join(' › ');
};

// Valor do serviço pelo mesmo motor da planilha (preço unitário e BDI do item).
const itemValue = (budget, item, quantidade) => calculateBudget({bdi:budget?.bdi, itens:[{...item, quantidade}]}).total;

export const newBoxElement = budget => ({
  id:uid(), nome:'Reservatório', comprimento:'', largura:'', altura:'', espessuraCm:'', sobraCm:'0', quantidade:'1', fonte:'',
  etapaId:(budget?.etapas || []).find(s => /reservat|caixa d.?agua|cisterna/.test(normalizeStructuralText(s.nome)))?.id || '',
});

function initialLinks(budget, element, items) {
  const links = {};
  for (const item of items) {
    const saved = item.memorialMedicao;
    if (saved?.model === 'element' && saved.elementId === element.id) { links[item.id] = {include:true, measure:saved.measure, factor:saved.factor || '', suggested:false}; continue; }
    const suggestion = suggestBoxMeasure(item);
    // Um item já medido em outro lugar nunca entra marcado sozinho.
    links[item.id] = {include:!saved && !!suggestion.measure && isBoxLinkable(item, budget), ...suggestion, suggested:!!suggestion.measure};
  }
  return links;
}

const itemsOfStage = (allItems, stages, etapaId) => {
  if (!etapaId) return [];
  const ids = new Set(budgetSubtreeIds(stages, etapaId));
  return allItems.filter(i => ids.has(i.etapaId));
};

// ----- Desenho: planta e corte em escala, com a face medida em destaque -----
const PLAN_AREA = {x:22, y:18, w:150, h:96};
const SECTION_AREA = {x:218, y:18, w:88, h:96};
const HOT = {
  fundo_externo:['sobra-fill','bottom'], fundo_espessura:['sobra-fill','bottom'], tela_fundo:['sobra-fill','bottom'],
  fundo_interno:['inner-fill','inner-bottom'], volume_util:['inner-fill','inner-volume'], tampa:['outer-fill','top'],
  paredes_internas:['inner-stroke','inner-faces'], paredes_externas:['outer-stroke','outer-faces'], perimetro_externo:['outer-stroke'],
  paredes_ambas:['inner-stroke','outer-stroke','inner-faces','outer-faces'], paredes_eixo:['axis','axis-faces'], perimetro_eixo:['axis'],
  interno_total:['inner-fill','inner-stroke','inner-faces','inner-bottom'],
};

function BoxDrawing({geometry, active}) {
  const ok = geometry.valid;
  const g = ok ? geometry : {C:2, L:1.5, H:1.2, e:0.14, s:0, Ce:2.28, Le:1.78, Cf:2.28, Lf:1.78};
  const hot = new Set(HOT[active] || []);
  const cls = (base, key) => `${base}${hot.has(key) ? ' is-hot' : ''}`;
  const k = Math.min(PLAN_AREA.w / g.Cf, PLAN_AREA.h / g.Lf);
  const sob = {x:PLAN_AREA.x + (PLAN_AREA.w - g.Cf * k) / 2, y:PLAN_AREA.y + (PLAN_AREA.h - g.Lf * k) / 2, w:g.Cf * k, h:g.Lf * k};
  const inset = (r, d) => ({x:r.x + d * k, y:r.y + d * k, w:r.w - 2 * d * k, h:r.h - 2 * d * k});
  const out = inset(sob, g.s), inn = inset(sob, g.s + g.e), axis = inset(sob, g.s + g.e / 2);
  const R = r => ({x:r.x, y:r.y, width:Math.max(r.w, 0), height:Math.max(r.h, 0)});
  const ks = Math.min(SECTION_AREA.w / g.Cf, (SECTION_AREA.h - 14) / g.H);
  const sw = g.Cf * ks, sx = SECTION_AREA.x + (SECTION_AREA.w - sw) / 2, slab = 5;
  const baseY = SECTION_AREA.y + 7 + g.H * ks, topY = baseY - g.H * ks;
  const wallX = sx + g.s * ks, wallW = Math.max(g.e * ks, 2.5), innerX = wallX + wallW, innerW = g.C * ks;
  const label = ok ? `Planta e corte: interno ${dec(g.C)} × ${dec(g.L)} m, altura ${dec(g.H)} m, parede de ${dec(g.e * 100, 0)} cm${g.s ? `, sobra de ${dec(g.s * 100, 0)} cm no fundo` : ''}${active ? `. Em destaque: ${BOX_MEASURES[active]?.label}` : ''}.` : 'Planta e corte ilustrativos: preencha as medidas para desenhar em escala.';
  return <svg className="box-drawing" data-ready={ok} viewBox="0 0 320 150" role="img" aria-label={label}>
    <text x={PLAN_AREA.x} y="147" className="box-drawing__caption">Planta</text>
    {g.s > 0 && <rect {...R(sob)} className="box-drawing__sobra"/>}
    <rect {...R(out)} className="box-drawing__wall"/>
    <rect {...R(inn)} className="box-drawing__inner"/>
    <rect {...R(axis)} className={cls('box-drawing__axis', 'axis')}/>
    <rect {...R(g.s > 0 ? sob : out)} className={cls('box-drawing__hot-fill', 'sobra-fill')}/>
    <rect {...R(out)} className={cls('box-drawing__hot-fill', 'outer-fill')}/>
    <rect {...R(inn)} className={cls('box-drawing__hot-fill', 'inner-fill')}/>
    <rect {...R(out)} className={cls('box-drawing__hot-stroke', 'outer-stroke')}/>
    <rect {...R(inn)} className={cls('box-drawing__hot-stroke', 'inner-stroke')}/>
    <g className="box-drawing__dim">
      <line x1={inn.x} y1={sob.y + sob.h + 9} x2={inn.x + inn.w} y2={sob.y + sob.h + 9}/>
      <line x1={inn.x} y1={sob.y + sob.h + 6} x2={inn.x} y2={sob.y + sob.h + 12}/>
      <line x1={inn.x + inn.w} y1={sob.y + sob.h + 6} x2={inn.x + inn.w} y2={sob.y + sob.h + 12}/>
      <line x1={sob.x + sob.w + 8} y1={inn.y} x2={sob.x + sob.w + 8} y2={inn.y + inn.h}/>
      <line x1={sob.x + sob.w + 5} y1={inn.y} x2={sob.x + sob.w + 11} y2={inn.y}/>
      <line x1={sob.x + sob.w + 5} y1={inn.y + inn.h} x2={sob.x + sob.w + 11} y2={inn.y + inn.h}/>
      <line x1={out.x + out.w * 0.3} y1={out.y + (g.e * k) / 2} x2={out.x + out.w * 0.3} y2={11}/>
    </g>
    <text x={inn.x + inn.w / 2} y={sob.y + sob.h + 21} textAnchor="middle">C {ok ? dec(g.C) : ''}</text>
    <text transform={`translate(${sob.x + sob.w + 20} ${inn.y + inn.h / 2}) rotate(-90)`} textAnchor="middle">L {ok ? dec(g.L) : ''}</text>
    <text x={out.x + out.w * 0.3 + 3} y="9" textAnchor="start">e {ok ? `${dec(g.e * 100, 0)} cm` : ''}</text>

    <text x={SECTION_AREA.x} y="147" className="box-drawing__caption">Corte</text>
    <rect x={sx} y={baseY} width={sw} height={slab} className={cls('box-drawing__slab', 'bottom')}/>
    <rect x={innerX} y={baseY} width={innerW} height={1.6} className={cls('box-drawing__line', 'inner-bottom')}/>
    <rect x={innerX} y={topY} width={innerW} height={g.H * ks} className={cls('box-drawing__water', 'inner-volume')}/>
    <rect x={wallX} y={topY} width={wallW} height={g.H * ks} className="box-drawing__wall"/>
    <rect x={innerX + innerW} y={topY} width={wallW} height={g.H * ks} className="box-drawing__wall"/>
    <rect x={wallX} y={topY - slab} width={wallW * 2 + innerW} height={slab} className={cls('box-drawing__slab box-drawing__slab--top', 'top')}/>
    {[innerX, innerX + innerW].map(x => <line key={`i${x}`} x1={x} y1={topY} x2={x} y2={baseY} className={cls('box-drawing__face', 'inner-faces')}/>)}
    {[wallX, innerX + innerW + wallW].map(x => <line key={`o${x}`} x1={x} y1={topY} x2={x} y2={baseY} className={cls('box-drawing__face', 'outer-faces')}/>)}
    {[wallX + wallW / 2, innerX + innerW + wallW / 2].map(x => <line key={`a${x}`} x1={x} y1={topY} x2={x} y2={baseY} className={cls('box-drawing__face box-drawing__face--axis', 'axis-faces')}/>)}
    <g className="box-drawing__dim">
      <line x1={sx - 7} y1={topY} x2={sx - 7} y2={baseY}/>
      <line x1={sx - 10} y1={topY} x2={sx - 4} y2={topY}/>
      <line x1={sx - 10} y1={baseY} x2={sx - 4} y2={baseY}/>
    </g>
    <text transform={`translate(${sx - 12} ${(topY + baseY) / 2}) rotate(-90)`} textAnchor="middle">H {ok ? dec(g.H) : ''}</text>
  </svg>;
}

// ----- Editor de um reservatório -----
function BoxEditor({budget, element, isSaved, drafts, onSave, onRemove, onDuplicate, onUndo, canUndo, onOpenItemMemory, readOnly}) {
  const stages = budget?.etapas || [];
  const allItems = useMemo(() => memoryBudgetItems(budget), [budget]);
  const stored = drafts.current.get(element.id);
  const [draft, setDraftState] = useState(() => stored?.draft || element);
  const [links, setLinksState] = useState(() => stored?.links || initialLinks(budget, element, itemsOfStage(allItems, stages, element.etapaId)));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState(null);
  const [active, setActive] = useState(null), [confirmDelete, setConfirmDelete] = useState(false);

  const remember = (nextDraft, nextLinks) => drafts.current.set(element.id, {draft:nextDraft, links:nextLinks});
  const setDraft = patch => { const next = {...draft, ...patch}; setDraftState(next); remember(next, links); setError(''); setReview(false); };
  const setLinks = next => { setLinksState(next); remember(draft, next); setError(''); setReview(false); };
  const editLink = (id, patch) => setLinks({...links, [id]:{...links[id], ...patch, suggested:false}});

  const items = useMemo(() => itemsOfStage(allItems, stages, draft.etapaId), [allItems, stages, draft.etapaId]);
  const setStage = etapaId => {
    const next = itemsOfStage(allItems, stages, etapaId);
    const kept = Object.fromEntries(Object.entries(links).filter(([id]) => next.some(i => i.id === id)));
    const nextDraft = {...draft, etapaId};
    setDraftState(nextDraft);
    const nextLinks = {...initialLinks(budget, nextDraft, next), ...kept};
    setLinksState(nextLinks); remember(nextDraft, nextLinks); setReview(false);
  };

  const geometry = boxGeometry(draft);
  const warnings = boxWarnings(geometry);
  const preview = {elementosMemoria:[draft]};
  const rows = items.map(item => {
    const link = links[item.id] || {include:false, measure:'', factor:''};
    const linkable = isBoxLinkable(item, budget);
    const memorial = item.memorialMedicao;
    const otherBox = memorial?.model === 'element' && memorial.elementId !== draft.id
      ? (budget.elementosMemoria || []).find(e => e.id === memorial.elementId)?.nome || 'outro reservatório' : '';
    const itemMemorial = memorial && memorial.model !== 'element';
    const result = link.include && link.measure && geometry.valid ? evaluateBoxLink({elementId:draft.id, measure:link.measure, factor:link.factor}, item, preview) : null;
    const wasLinkedHere = memorial?.model === 'element' && memorial.elementId === draft.id;
    return {item, link, linkable, otherBox, itemMemorial, result, wasLinkedHere};
  });
  const included = rows.filter(r => r.link.include);
  const eligible = rows.filter(r => r.linkable && measuresForUnit(r.item.unidade).length);
  const allOn = eligible.length > 0 && eligible.every(r => r.link.include);
  const pending = included.filter(r => !r.result?.valid);
  const unlinking = rows.filter(r => r.wasLinkedHere && !r.link.include);
  const changes = included.filter(r => r.result?.valid).map(r => ({
    item:r.item, measure:r.link.measure, before:Number(r.item.quantidade || 0), after:r.result.total,
    valueBefore:itemValue(budget, r.item, Number(r.item.quantidade || 0)), valueAfter:itemValue(budget, r.item, r.result.total),
  }));
  const totalBefore = changes.reduce((s, c) => s + c.valueBefore, 0), totalAfter = changes.reduce((s, c) => s + c.valueAfter, 0);
  const blocker = readOnly ? 'Orçamento aprovado: crie uma revisão para editar.'
    : !String(draft.nome).trim() ? 'Dê um nome ao reservatório.'
    : !draft.etapaId ? 'Escolha a etapa com os serviços da caixa.'
    : !geometry.valid ? 'Preencha as medidas da caixa.'
    : !included.length && !unlinking.length ? 'Marque ao menos um serviço.'
    : pending.length ? `${plural(pending.length, 'serviço marcado precisa', 'serviços marcados precisam')} de ajuste.` : '';

  const apply = async () => {
    setBusy(true); setError('');
    try {
      const result = await onSave(draft, included.map(r => ({itemId:r.item.id, measure:r.link.measure, factor:r.link.factor})));
      if (!result?.ok) throw new Error(result?.reason || 'Falha ao salvar. As medidas continuam na tela; tente novamente.');
      drafts.current.delete(element.id);
      setReceipt({changes, totalBefore, totalAfter, unlinked:unlinking.length});
      setReview(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const fieldError = key => geometry.invalid?.includes(key) && String(draft[key] ?? '').trim() !== '' ? geometry.errors[geometry.invalid.indexOf(key)] : '';
  const nominal = item => telaNominal(item.descricao);

  return <form className="box-editor" onSubmit={e => e.preventDefault()} noValidate>
    {readOnly && <p className="box-note box-note--warning" role="note">Orçamento aprovado: as medidas são só para consulta. Crie uma revisão para editar.</p>}
    <fieldset disabled={readOnly || busy} className="box-editor__body">
      <div className="box-editor__identity">
        <label>Nome<input value={draft.nome} onChange={e => setDraft({nome:e.target.value})} placeholder="Ex.: reservatório inferior"/></label>
        <label>Etapa do orçamento
          <select value={draft.etapaId} onChange={e => setStage(e.target.value)}>
            <option value="">Escolha a etapa com os serviços da caixa</option>
            {stages.map(s => <option key={s.id} value={s.id}>{stagePath(stages, s.id)}</option>)}
          </select>
        </label>
        <label>Origem das medidas<input value={draft.fonte} onChange={e => setDraft({fonte:e.target.value})} placeholder="Ex.: planta A-02, rev. 01"/></label>
      </div>

      <section className="box-editor__geometry" aria-labelledby={`dims-${element.id}`}>
        <div className="box-editor__dims">
          <h3 id={`dims-${element.id}`}>Medidas da caixa</h3>
          <div className="box-editor__dim-grid">
            {BOX_DIMENSIONS.map(d => {
              const err = fieldError(d.key), id = `${element.id}-${d.key}`;
              return <label key={d.key} htmlFor={id}>{d.label}{d.optional ? ' (opcional)' : ''}
                <span className="box-field" data-invalid={!!err}>
                  <input id={id} inputMode="decimal" autoComplete="off" value={draft[d.key] ?? ''} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}
                    onChange={e => setDraft({[d.key]:e.target.value})} placeholder={d.key === 'quantidade' ? '1' : d.optional ? '0' : 'Preencher'}/>
                  <span className="box-field__unit" aria-hidden="true">{d.unit}</span>
                </span>
                {err && <small id={`${id}-err`} className="box-field__error">{err}</small>}
              </label>;
            })}
          </div>
          <p className="box-hint">Medidas internas (úteis) em metros. A espessura gera as medidas externas; a sobra estende só o fundo (radier, lastro, compactação, tela).</p>
          {warnings.length > 0 && <ul className="box-note box-note--warning" aria-label="Confira as medidas">{warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
        <figure className="box-editor__drawing">
          <BoxDrawing geometry={geometry} active={active}/>
          <figcaption>{active ? `Em destaque: ${BOX_MEASURES[active]?.label}` : 'Passe o mouse ou o foco num serviço para ver a área medida.'}</figcaption>
        </figure>
        <dl className="box-editor__derived">
          <div><dt>Externo da parede</dt><dd>{geometry.valid ? `${dec(geometry.Ce)} × ${dec(geometry.Le)} m` : '—'}</dd></div>
          <div><dt>Fundo com sobra</dt><dd>{geometry.valid ? `${dec(boxMeasureValue('fundo_externo', geometry))} m²` : '—'}</dd></div>
          <div><dt>Paredes pelo eixo</dt><dd>{geometry.valid ? `${dec(boxMeasureValue('paredes_eixo', geometry))} m²` : '—'}</dd></div>
          <div><dt>Volume interno</dt><dd>{geometry.valid ? `${dec(boxMeasureValue('volume_util', geometry))} m³ · ${dec(boxMeasureValue('volume_util', geometry) * 1000, 0)} L` : '—'}</dd></div>
        </dl>
      </section>

      <section className="box-items" aria-labelledby={`svc-${element.id}`}>
        <header className="box-items__head">
          <h3 id={`svc-${element.id}`}>Serviços da etapa</h3>
          {rows.length > 0 && <span className="box-items__count">{included.length} de {plural(rows.length, 'serviço marcado', 'serviços marcados')}</span>}
          {eligible.length > 0 && <button type="button" className="box-link-button" onClick={() =>
            setLinks({...links, ...Object.fromEntries(eligible.map(r => [r.item.id, {...r.link, include:!allOn}]))})
          }>{allOn ? 'Desmarcar todos' : 'Marcar todos'}</button>}
        </header>
        {!draft.etapaId && <p className="box-hint">Escolha a etapa para listar os serviços.</p>}
        {draft.etapaId && !rows.length && <p className="box-hint">Esta etapa não tem serviços cadastrados.</p>}
        {draft.etapaId && included.length > 0 && !geometry.valid && <p className="box-note">Preencha as medidas da caixa para calcular {included.length === 1 ? 'o serviço marcado' : `os ${included.length} serviços marcados`}.</p>}
        {rows.map(({item, link, linkable, otherBox, itemMemorial, result}) => {
          const options = measuresForUnit(item.unidade);
          const measure = BOX_MEASURES[link.measure];
          const chk = `${element.id}-chk-${item.id}`;
          const tela = link.measure === 'tela_fundo' ? nominal(item) : null;
          const delta = result?.valid && Number(item.quantidade) ? (result.total - Number(item.quantidade)) / Number(item.quantidade) : null;
          return <div key={item.id} className="box-item" data-included={link.include} data-blocked={!linkable || !options.length}
            onMouseEnter={() => link.include && setActive(link.measure || null)} onMouseLeave={() => setActive(null)}
            onFocus={() => link.include && setActive(link.measure || null)} onBlur={() => setActive(null)}>
            <input id={chk} type="checkbox" className="box-item__check" checked={link.include} disabled={!linkable || !options.length} onChange={e => editLink(item.id, {include:e.target.checked})}/>
            <label htmlFor={chk} className="box-item__desc">
              <span className="box-item__meta">{item.codigoItem} · {item.fonte} {item.codigo} · {unitLabel(item.unidade)}</span>
              <span className="box-item__text" title={item.descricao}>{item.descricao}</span>
              {!linkable && <span className="box-item__flag">Controlado por um vínculo do memorial estrutural.</span>}
              {linkable && !options.length && <span className="box-item__flag">Sem medida da caixa em {unitLabel(item.unidade)}.</span>}
              {otherBox && <span className="box-item__flag">Hoje calculado por “{otherBox}”. Marcar transfere o vínculo.</span>}
              {itemMemorial && <span className="box-item__flag">Hoje medido no memorial item a item. Marcar substitui essa medição.</span>}
            </label>
            <div className="box-item__measure">
              {options.length > 0 && <select aria-label={`Medida do item ${item.codigoItem}`} value={link.measure} disabled={!link.include} onChange={e => { editLink(item.id, {measure:e.target.value}); setActive(e.target.value || null); }}>
                <option value="">Escolha a medida</option>
                {BOX_MEASURE_GROUPS.map(group => {
                  const inGroup = options.filter(([, m]) => m.group === group);
                  if (!inGroup.length) return null;
                  return <optgroup key={group} label={group}>{inGroup.map(([key, m]) => {
                    const v = boxMeasureValue(key, geometry, key === link.measure ? link.factor : '');
                    return <option key={key} value={key}>{m.label}{v != null ? ` · ${dec(v)} ${unitLabel(m.unit)}` : ''}</option>;
                  })}</optgroup>;
                })}
              </select>}
              {measure?.factor && link.include && <label className="box-item__factor">{measure.factor.label}
                <span className="box-field"><input inputMode="decimal" value={link.factor} onChange={e => editLink(item.id, {factor:e.target.value})} placeholder="Preencher"/><span className="box-field__unit" aria-hidden="true">{measure.factor.unit}</span></span>
              </label>}
              {tela && link.include && <small className="box-hint">{tela.tela}: {dec(tela.kgM2)} kg/m² nominal, sem traspasse. Ajuste se o projeto pedir.</small>}
              {link.include && link.measure && <code className="box-item__math">{geometry.valid ? describeBoxMeasure(link.measure, geometry, link.factor, item.unidade) : measure?.formula}</code>}
              {link.include && link.suggested && link.measure && <small className="box-hint">Sugerido pela descrição do serviço.</small>}
              {(itemMemorial || (linkable && !options.length)) && <button type="button" className="box-link-button" onClick={() => onOpenItemMemory?.(item.id)}>Abrir memorial item a item</button>}
            </div>
            <div className="box-item__result">
              {link.include
                ? geometry.valid
                  ? result?.valid ? <strong className="box-num">{dec(result.total)} {unitLabel(item.unidade)}</strong> : <span className="box-item__pending">{result?.errors[0] || 'Escolha a medida'}</span>
                  : <strong className="box-num box-num--empty">—</strong>
                : <span className="box-item__off">Fora do cálculo</span>}
              <small>Hoje: <span className="box-num">{dec(item.quantidade)}</span>{delta != null && Math.abs(delta) >= 0.0005 ? <span className="box-num"> ({delta > 0 ? '+' : ''}{dec(delta * 100, 0)}%)</span> : null}</small>
            </div>
          </div>;
        })}
      </section>
    </fieldset>

    {review && !blocker && <section className="box-review" aria-labelledby={`rev-${element.id}`}>
      <h3 id={`rev-${element.id}`}>Confira antes de gravar</h3>
      <p className="box-hint">A quantidade de cada serviço abaixo será substituída na planilha. Preço unitário e BDI não mudam.</p>
      <div className="box-review__table">
        <table>
          <thead><tr><th scope="col">Serviço</th><th scope="col">Hoje</th><th scope="col">Novo</th><th scope="col">Valor hoje</th><th scope="col">Valor novo</th></tr></thead>
          <tbody>{changes.map(c => <tr key={c.item.id}>
            <th scope="row"><span className="box-item__meta">{c.item.codigoItem}</span> {c.item.descricao}</th>
            <td className="box-num">{dec(c.before)}</td><td className="box-num">{dec(c.after)} {unitLabel(c.item.unidade)}</td>
            <td className="box-num">{brl(c.valueBefore)}</td><td className="box-num">{brl(c.valueAfter)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={3}>Total dos serviços marcados</th><td className="box-num">{brl(totalBefore)}</td><td className="box-num"><strong>{brl(totalAfter)}</strong></td></tr></tfoot>
        </table>
      </div>
      {unlinking.length > 0 && <p className="box-hint">{plural(unlinking.length, 'serviço deixa', 'serviços deixam')} de ser calculado por este reservatório e {unlinking.length === 1 ? 'mantém' : 'mantêm'} a quantidade atual.</p>}
    </section>}

    {receipt && <section className="box-receipt" role="status">
      <strong>Aplicado em {plural(receipt.changes.length, 'serviço', 'serviços')}.</strong>
      <span>Total dos serviços: <span className="box-num">{brl(receipt.totalBefore)}</span> → <span className="box-num">{brl(receipt.totalAfter)}</span>. Novas mudanças nas medidas recalculam todos eles.</span>
      {canUndo && <button type="button" className="box-link-button" onClick={async () => { await onUndo?.(); setReceipt(null); }}>Desfazer esta aplicação</button>}
    </section>}
    {error && <p role="alert" className="box-note box-note--danger">{error}</p>}

    {!readOnly && <div className="box-actions">
      <p className="box-actions__summary" aria-live="polite">
        {blocker || (review ? `Confirme para gravar ${plural(changes.length, 'serviço', 'serviços')}.` : `${plural(included.length, 'serviço marcado', 'serviços marcados')} · ${brl(totalBefore)} → ${brl(totalAfter)}`)}
      </p>
      <div className="box-actions__buttons">
        {review
          ? <><button type="button" onClick={() => setReview(false)}>Voltar e ajustar</button>
              <button type="button" className="box-primary" disabled={busy || !!blocker} onClick={apply}>{busy ? 'Gravando…' : 'Confirmar e aplicar'}</button></>
          : <button type="button" className="box-primary" disabled={!!blocker} onClick={() => { setReceipt(null); setReview(true); }}>Revisar e aplicar</button>}
      </div>
      <div className="box-actions__secondary">
        <button type="button" className="box-link-button" disabled={!geometry.valid} onClick={() => onDuplicate(draft)}>Duplicar medidas</button>
        {isSaved && !confirmDelete && <button type="button" className="box-link-button box-link-button--danger" onClick={() => setConfirmDelete(true)}>Excluir reservatório</button>}
        {confirmDelete && <span className="box-confirm" role="group" aria-label="Confirmar exclusão">
          Excluir “{draft.nome}”? As quantidades atuais ficam como estão.
          <button type="button" className="box-link-button box-link-button--danger" onClick={async () => {
            setBusy(true);
            try { const r = await onRemove(draft.id); if (!r?.ok) throw new Error(r?.reason || 'Falha ao excluir.'); drafts.current.delete(element.id); }
            catch (e) { setError(e.message); setBusy(false); setConfirmDelete(false); }
          }}>Excluir</button>
          <button type="button" className="box-link-button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
        </span>}
      </div>
    </div>}
  </form>;
}

export default function BoxMemoryPanel({budget, onSave, onRemove, onUndo, canUndo, onOpenItemMemory, readOnly}) {
  const saved = budget?.elementosMemoria || [];
  const drafts = useRef(new Map());
  const [selected, setSelected] = useState(saved[0]?.id || null);
  const [creating, setCreating] = useState(null);
  const current = (creating && creating.id === selected) ? creating : saved.find(e => e.id === selected) || creating;

  const startNew = element => { setCreating(element); setSelected(element.id); };
  const save = async (element, links) => {
    const result = await onSave(element, links);
    if (result?.ok && creating?.id === element.id) setCreating(null);
    return result;
  };
  const remove = async id => {
    const result = await onRemove(id);
    if (result?.ok) setSelected(saved.find(e => e.id !== id)?.id || null);
    return result;
  };
  const dirty = id => drafts.current.has(id);

  return <section className="item-memory box-memory">
    <header className="box-memory__intro">
      <div>
        <h2>Caixas e reservatórios</h2>
        <p>Informe as medidas da caixa uma vez. Cada serviço da etapa usa a área, o volume ou a quantidade correspondente, e o orçamento é recalculado sempre que as medidas mudarem.</p>
      </div>
      {!readOnly && saved.length > 0 && <button type="button" onClick={() => startNew(newBoxElement(budget))}>Novo reservatório</button>}
    </header>
    {(saved.length > 0 || creating) && <nav className="box-memory__tabs" aria-label="Reservatórios deste orçamento">
      {saved.map(e => <button key={e.id} type="button" aria-current={current?.id === e.id ? 'true' : undefined} onClick={() => setSelected(e.id)}>
        {e.nome}{dirty(e.id) ? <span className="box-memory__dirty" title="Alterações não aplicadas"> · não aplicado</span> : null}
      </button>)}
      {creating && !saved.some(e => e.id === creating.id) && <button type="button" aria-current={current?.id === creating.id ? 'true' : undefined} onClick={() => setSelected(creating.id)}>
        {creating.nome || 'Novo'}<span className="box-memory__dirty"> · não salvo</span>
      </button>}
    </nav>}
    {current
      ? <BoxEditor key={current.id} budget={budget} element={current} isSaved={saved.some(e => e.id === current.id)} drafts={drafts}
          onSave={save} onRemove={remove} onUndo={onUndo} canUndo={canUndo} onOpenItemMemory={onOpenItemMemory} readOnly={readOnly}
          onDuplicate={d => startNew({...newBoxElement(budget), ...Object.fromEntries(BOX_DIMENSIONS.map(x => [x.key, d[x.key]])), fonte:d.fonte, nome:`${d.nome} (cópia)`, etapaId:''})}/>
      : <div className="box-memory__empty">
          <p>Nenhum reservatório medido neste orçamento.</p>
          {!readOnly && <button type="button" className="box-primary" onClick={() => startNew(newBoxElement(budget))}>Medir um reservatório</button>}
        </div>}
  </section>;
}
