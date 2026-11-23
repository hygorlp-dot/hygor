import { expect, it } from 'vitest';
import { dashboardPriorities, priorityContext } from './priority-context.js';

it('mantém uma obra no atalho só quando todos os registros pertencem a ela e mostra o vencimento mais antigo', () => {
  const works = new Map([['a', 'Alameda']]);
  const first = { obraId:'a', date:'2026-11-20' };
  const second = { obraId:'a', date:'2026-11-18' };
  expect(priorityContext([first, second], works, item=>item.date, 'Vencimento')).toMatchObject({ obraId:'a', date:'2026-11-18', names:['Alameda'] });
  expect(priorityContext([first, { obraId:'fora-do-acesso' }], works)).toMatchObject({ obraId:'', names:['Alameda'], hasOtherRecords:true });
});

it('prioriza gravidade, evita repetir o Ponto e limita a três destaques', () => {
  const item = (id, severidade, quantidade = 1) => ({ id, severidade, quantidade });
  const queue = [item('cadastro', 1, 90), item('diario', 2), item('ponto-hoje', 3, 4), item('rh-ponto', 3, 6), item('medicoes', 3), item('compra', 2)];
  expect(dashboardPriorities(queue).map(item=>item.id)).toEqual(['rh-ponto', 'medicoes', 'diario']);
});
