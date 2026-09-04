// Trava de segurança #2 (04/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md,
// seção "Backfill de attendanceSyncedAt para dado legado"): a trava de
// código em mergeAttendanceObjects (server/attendance-obra-routing.js)
// impede que um tombstone alheio apague um valor real quando nenhum dos
// dois lados tem carimbo - mas quando os DOIS lados têm um valor REAL
// conflitante (a mesma célula com dois registros diferentes em duas linhas
// de obra distintas, nenhuma carimbada), a ordem física da linha ainda
// decide, porque não há informação nenhuma para desempatar de verdade.
//
// Este módulo é só DETECÇÃO (lógica pura, sem I/O) - varre um conjunto de
// linhas já decodificadas em busca dessas células e devolve um resumo, para
// virar um alerta operacional antes que vire sintoma visível na tela (ver
// scripts/check-attendance-synced-at-gaps.mjs para o uso contra produção).

export const findAttendanceSyncedAtGaps = (sources) => {
  const cellMap = new Map(); // "employeeId|date" -> [{label, hasSyncedAt, hasValue}]
  for (const { label, attendance, syncedAt } of sources || []) {
    for (const [employeeId, days] of Object.entries(attendance || {})) {
      for (const [date, record] of Object.entries(days || {})) {
        const hasSyncedAt = !!(syncedAt?.[employeeId]?.[date]);
        const key = `${employeeId}|${date}`;
        if (!cellMap.has(key)) cellMap.set(key, []);
        cellMap.get(key).push({ label, hasSyncedAt, hasValue: record != null });
      }
    }
  }

  const gaps = [];
  for (const [key, entries] of cellMap) {
    const untimestamped = entries.filter(e => !e.hasSyncedAt);
    if (untimestamped.length <= 1) continue; // sem risco: no máximo uma linha física contribui
    const [employeeId, date] = key.split("|");
    // "conflicting": 2+ linhas SEM carimbo têm um valor real (não tombstone)
    // para a mesma célula - esse é o único caso que ainda depende da ordem
    // física da linha mesmo com a trava de código (ver comentário acima).
    const conflicting = untimestamped.filter(e => e.hasValue).length >= 2;
    gaps.push({ employeeId, date, sources: untimestamped.map(e => e.label), conflicting });
  }
  gaps.sort((a, b) => (Number(b.conflicting) - Number(a.conflicting)) || a.employeeId.localeCompare(b.employeeId));

  return {
    totalGapCells: gaps.length,
    conflictingCells: gaps.filter(g => g.conflicting).length,
    gaps,
  };
};

export const formatAttendanceSyncedAtGapsReport = summary => {
  const lines = [];
  lines.push(`Células sem carimbo com mais de uma linha física contribuindo: ${summary.totalGapCells}`);
  lines.push(`  Das quais com valores REALMENTE conflitantes (2+ registros distintos, ainda dependem da ordem da linha): ${summary.conflictingCells}`);
  if (summary.conflictingCells > 0) {
    lines.push("");
    lines.push("ATENÇÃO: as células abaixo ainda podem mudar sozinhas se uma gravação alheia tocar numa das linhas envolvidas.");
    for (const g of summary.gaps.filter(x => x.conflicting).slice(0, 30)) {
      lines.push(`  - funcionário ${g.employeeId} em ${g.date}: ${g.sources.join(", ")}`);
    }
    if (summary.conflictingCells > 30) lines.push(`  ... e mais ${summary.conflictingCells - 30}.`);
  } else if (summary.totalGapCells > 0) {
    lines.push("");
    lines.push("Sem risco real no momento: nenhuma célula tem valores conflitantes (a trava de código já protege as demais).");
  } else {
    lines.push("");
    lines.push("Nenhuma lacuna encontrada - todo dado atual já tem carimbo por célula.");
  }
  return lines;
};
