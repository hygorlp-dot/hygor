import { afterEach, expect, it, vi } from 'vitest';
import { budgetPrintSettingsScript } from './budget-print-settings.js';
import { budgetOwnCompositionRows, budgetOwnCompositionPrintHtml } from '../domains/orcamentos/budget-own-compositions-export.js';

const render = () => {
  const component = {fonte:'SINAPI',codigo:'001',descricao:'Material',coeficiente:2,precoUnit:5};
  const budget = {itens:['a','b'].map(id=>({id,fonte:'PRÓPRIA',codigo:`CP-${id}`,unidade:'M2',quantidade:1,precoUnit:10,composicao:[component]}))};
  const rows = budgetOwnCompositionRows(budget,new Map(),String);
  const parsed = new DOMParser().parseFromString(budgetOwnCompositionPrintHtml({name:'Teste',version:1,rows}),'text/html');
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.replaceWith(document.importNode(parsed.body,true));
  HTMLDialogElement.prototype.showModal=vi.fn(function(){this.open=true;});
  HTMLDialogElement.prototype.close=vi.fn(function(){this.open=false;});
  new Function(budgetPrintSettingsScript())();
  return document.querySelector('form');
};
const submit = form => form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
afterEach(()=>{vi.restoreAllMocks();document.head.innerHTML='';document.body.innerHTML='';});

it('offers the budget settings for compositions and defaults to continuous landscape pages',()=>{
  const form=render();
  expect(document.querySelector('dialog').open).toBe(true);
  expect(form.querySelector('h2').textContent).toBe('Configurar PDF das composições');
  expect(form.elements.orientation.value).toBe('landscape');
  expect(form.elements.newPage.checked).toBe(false);
  expect([...form.elements.column.options].map(option=>option.text)).toContain('Custo parcial');
  submit(form);
  expect(document.head.lastElementChild.textContent).toContain('size:A4 landscape');
  expect(document.body.dataset.compositionNewPage).toBe('false');
});

it('applies page, text, column visibility and width to every composition table',()=>{
  const form=render();
  form.elements.paper.value='A3';form.elements.orientation.value='portrait';
  form.elements.margin.value='8mm';form.elements.font.value='11';form.elements.newPage.checked=true;
  form.elements.namedItem('0').checked=false;
  form.dispatchEvent(new Event('change',{bubbles:true}));
  const slider=form.elements.width;
  slider.value='15';slider.dispatchEvent(new Event('input',{bubbles:true}));
  submit(form);
  expect(document.head.lastElementChild.textContent).toContain('size:A3 portrait;margin:8mm');
  expect(document.body.dataset.compositionNewPage).toBe('true');
  document.querySelectorAll('.composition-sheet table').forEach(table=>{
    expect(table.style.getPropertyValue('--mrc-budget-table-font')).toBe('11px');
    expect(table.querySelectorAll('col')[0].style.display).toBe('none');
    expect(table.querySelectorAll('col')[1].style.width).toBe('15%');
    expect(table.tBodies[0].rows[0].cells[0].hidden).toBe(true);
    expect(table.tHead.rows[0].cells[0].colSpan).toBe(6);
  });
});

it('keeps applied settings on cancel and restores the default on request',()=>{
  const form=render();form.elements.newPage.checked=true;submit(form);
  const trigger=document.querySelector('[data-budget-print-settings]');trigger.click();
  form.elements.orientation.value='portrait';form.querySelector('button[type=button]').click();
  trigger.click();expect(form.elements.orientation.value).toBe('landscape');
  form.dispatchEvent(new Event('reset',{cancelable:true}));submit(form);
  expect(document.body.dataset.compositionNewPage).toBe('false');
});

it('preserves the original budget dialog and adjusts its single table',()=>{
  render();document.body.removeAttribute('data-own-compositions');
  document.body.innerHTML='<button data-budget-print-settings>Configurar PDF</button><table class="planilha-detalhada"><colgroup>'+Array.from({length:8},()=>'<col style="width:12.5%">').join('')+'</colgroup><thead><tr>'+['Item','Código','Fonte','Descrição','Unidade','Quantidade','Preço unitário','Total'].map(h=>`<th>${h}</th>`).join('')+'</tr></thead></table>';
  new Function(budgetPrintSettingsScript())();
  const form=document.querySelector('form');
  expect(form.querySelector('h2').textContent).toBe('Configurar PDF do orçamento');
  expect(form.elements.orientation.value).toBe('portrait');
  expect(form.elements.newPage).toBeUndefined();submit(form);
  expect(document.head.lastElementChild.textContent).toContain('size:A4 portrait');
});
