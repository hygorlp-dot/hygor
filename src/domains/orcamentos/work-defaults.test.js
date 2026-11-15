import {expect, it} from 'vitest';
import {budgetWorkDefaults} from './work-defaults.js';
const works = [
  {id:'a', cliente:'Cliente A', address:'Rua A', areaM2:120},
  {id:'b', cliente:'Cliente B', address:'Rua B', areaM2:0},
  {id:'empty'},
];
it('reaproveita os dados da obra selecionada por ID', () => {
  expect(budgetWorkDefaults({obraId:'', cliente:'', local:'', areaM2:''}, 'a', works))
    .toEqual({obraId:'a', cliente:'Cliente A', local:'Rua A', areaM2:'120'});
});
it('troca os valores herdados sem apagar uma edição explícita', () => {
  expect(budgetWorkDefaults({obraId:'a', cliente:'Outro contratante', local:'Rua A', areaM2:'120'}, 'b', works))
    .toEqual({obraId:'b', cliente:'Outro contratante', local:'Rua B', areaM2:'0'});
});
it('remove valores herdados da obra anterior quando a nova origem não os possui', () => {
  expect(budgetWorkDefaults({obraId:'a', cliente:'Cliente A', local:'Rua A', areaM2:'120'}, 'empty', works))
    .toEqual({obraId:'empty', cliente:'', local:'', areaM2:''});
});
it('não liga obras por nome nem altera a origem ou o formulário recebido', () => {
  const form = {obraId:'', cliente:'Manual', local:'', areaM2:''};
  expect(budgetWorkDefaults(form, 'Cliente A', works).cliente).toBe('Manual');
  expect(form.obraId).toBe('');
  expect(works[0].areaM2).toBe(120);
});
