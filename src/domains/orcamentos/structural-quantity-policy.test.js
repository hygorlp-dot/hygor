import { expect, it } from 'vitest';
import { aplicarCriterioEstrutural } from './structural-quantity-policy';
import { aplicarQuantitativosEstruturais } from './structural-import';
import { applyStructuralBudgetLinks, structuralBudgetRows } from './structural-budget-apply';

const memory = () => ({
  resumosProjeto: { pavimento1: { pilar: { concretoM3: 2.4, formaM2: 46.91 }, viga: { concretoM3: 12.09, formaM2: 120.58 }, laje: { concretoM3: 7.95, areaM2: 90.38, acoKg: 164 } } },
  pavimento1: { pilar: { concretoM3: 2.8, precisaRevisar: true }, viga: { concretoM3: 0, avisoConcretoIncorreto: true }, laje: { acoSemBitolas: true, acoTotalProjetoKg: 164, acoPorBitola: [{ bitola: 10, kg: 164 }] } },
});
it('prioriza resumos em dados legados sem alterar a origem e é idempotente', () => {
  const original = memory();
  const next = aplicarCriterioEstrutural(original);
  expect(next.pavimento1.pilar).toMatchObject({ concretoM3: 2.4, formaM2: 46.91, precisaRevisar: false });
  expect(next.pavimento1.viga).toMatchObject({ concretoM3: 12.09, avisoConcretoIncorreto: false });
  expect(next.pavimento1.laje).toMatchObject({ volumeM3: 7.95, areaVigotaM2: 90.38, acoPorBitola: [], acoSemBitolas: false });
  expect(aplicarCriterioEstrutural(next)).toEqual(next);
  expect(original.pavimento1.laje.acoSemBitolas).toBe(true);
});
it('mantém o quadro-resumo após importar quantitativos divergentes', () => {
  const next = aplicarQuantitativosEstruturais(memory(), [{ pavimento: '1º Pavimento', concretoVigasM3: 15, formaVigasM2: 130, volumeLajesM3: 10, avisoConcretoIncorreto: true }]);
  expect(next.pavimento1.viga.concretoM3).toBe(12.09);
  expect(next.pavimento1.laje.volumeM3).toBe(7.95);
});
it('aplica tela e concreto sem pendências artificiais e sem duplicar o aço', () => {
  const budget = { itens: [{ id: 'tela', descricao: 'Tela soldada para laje', unidade: 'KG', quantidade: 0 }], memoriaCalculo: { ...memory(), vinculosEstruturais: { 'pavimento1-laje.aco-vigota': 'tela' } } };
  const rows = structuralBudgetRows(budget);
  expect(rows['pavimento1-laje'].filter(r => r.key.startsWith('aco-'))).toEqual([{ key: 'aco-vigota', label: 'Tela das vigotas', unit: 'kg', value: 90.38 * .96, pending: false }]);
  expect(rows['pavimento1-pilares'].some(r => r.pending)).toBe(false);
  const result = applyStructuralBudgetLinks(budget, 'pavimento1-laje');
  expect(result.ok).toBe(true);
  expect(result.budget.itens[0].quantidade).toBeCloseTo(86.7648);
});
it('preserva armaduras de lajes maciças e a malha escolhida', () => {
  const m = { pavimento1: { laje: { areaMacicaM2: 10, areaVigotaM2: 20, acoPorBitola: [{ bitola: 8, kg: 12 }], pesoMalhaVigotaKgM2: 1.45 } } };
  expect(aplicarCriterioEstrutural(m).pavimento1.laje).toMatchObject(m.pavimento1.laje);
});
it('retira o vínculo legado de barras e limpa seu destino ao reaplicar a laje', () => {
  const budget = { itens: [{ id: 'barras', descricao: 'Armação de laje', unidade: 'KG', quantidade: 164 }], memoriaCalculo: { ...memory(), vinculosEstruturais: { 'pavimento1-laje.aco-projeto': 'barras' } } };
  const result = applyStructuralBudgetLinks(budget, 'pavimento1-laje');
  expect(result.ok).toBe(true);
  expect(result.budget.itens[0].quantidade).toBe(0);
  expect(result.budget.memoriaCalculo.vinculosEstruturais).toEqual({});
});
