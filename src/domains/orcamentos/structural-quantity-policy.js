import { novaLajePavimento } from './memoria-calculo-estrutural';
import { memoryFloors } from './budget-floors';

// Critério de medição: quadro-resumo prevalece; vigotas usam apenas tela.
// Projeção pura, compartilhada pela importação, tela e aplicação no orçamento.
export function aplicarCriterioEstrutural(memory = {}) {
  const next = { ...memory };
  for (const {id:pav} of memoryFloors(memory)) {
    const summary = memory.resumosProjeto?.[pav];
    const current = memory[pav];
    if (!summary && !current) continue;
    const floor = { ...current };
    for (const kind of ['pilar', 'viga']) {
      const source = summary?.[kind];
      if (!source) continue;
      const element = { ...floor[kind] };
      for (const key of ['concretoM3', 'formaM2']) {
        if (source[key] != null && Number.isFinite(Number(source[key]))) element[key] = Number(source[key]);
      }
      if (source.concretoM3 != null && source.formaM2 != null) element.precisaRevisar = false;
      if (kind === 'viga' && source.concretoM3 != null) element.avisoConcretoIncorreto = false;
      floor[kind] = element;
    }
    const laje = novaLajePavimento(floor.laje);
    if (summary?.laje) {
      if (summary.laje.concretoM3 != null) laje.volumeM3 = Number(summary.laje.concretoM3);
      if (summary.laje.areaM2 != null) laje.areaVigotaM2 = Number(summary.laje.areaM2);
    }
    const soVigotas = (summary?.laje || Number(laje.areaVigotaM2) > 0 || Number(laje.volumeVigotasM3) > 0)
      && !(Number(laje.areaMacicaM2) > 0 || Number(laje.volumeMacicasM3) > 0);
    laje.somenteTelaSoldada = !!soVigotas;
    if (soVigotas) {
      if (summary?.laje?.concretoM3 != null) laje.volumeVigotasM3 = Number(summary.laje.concretoM3);
      laje.acoPorBitola = [];
      laje.acoSemBitolas = false;
      laje.precisaRevisar = false;
      // Vínculos antigos de barras deixam de ser fontes válidas. Mantemos o
      // destino anterior para recalculá-lo ao aplicar, sem deixar peso residual.
      for (const [source, target] of Object.entries(next.vinculosEstruturais || {})) {
        if (!source.startsWith(`${pav}-laje.aco-`) || source === `${pav}-laje.aco-vigota`) continue;
        next.vinculosEstruturais = { ...next.vinculosEstruturais };
        delete next.vinculosEstruturais[source];
        if (target) next.aplicacoesEstruturais = { ...next.aplicacoesEstruturais, [source]: target };
      }
    }
    if (floor.laje || summary?.laje) floor.laje = laje;
    next[pav] = floor;
  }
  return next;
}
