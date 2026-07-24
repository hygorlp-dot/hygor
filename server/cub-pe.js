export const CUB_PE_PROJECTS = [
  { id: "R1-B", label: "R-1", description: "Residência unifamiliar", group: "Residencial · padrão baixo" },
  { id: "PP-4-B", label: "PP-4", description: "Prédio popular · 4 pavimentos", group: "Residencial · padrão baixo" },
  { id: "R8-B", label: "R-8", description: "Residencial · 8 pavimentos", group: "Residencial · padrão baixo" },
  { id: "PIS", label: "PIS", description: "Projeto de interesse social", group: "Residencial · padrão baixo" },
  { id: "R1-N", label: "R-1", description: "Residência unifamiliar", group: "Residencial · padrão normal" },
  { id: "PP-4-N", label: "PP-4", description: "Prédio popular · 4 pavimentos", group: "Residencial · padrão normal" },
  { id: "R8-N", label: "R-8", description: "Residencial · 8 pavimentos", group: "Residencial · padrão normal" },
  { id: "R16-N", label: "R-16", description: "Residencial · 16 pavimentos", group: "Residencial · padrão normal" },
  { id: "R1-A", label: "R-1", description: "Residência unifamiliar", group: "Residencial · padrão alto" },
  { id: "R8-A", label: "R-8", description: "Residencial · 8 pavimentos", group: "Residencial · padrão alto" },
  { id: "R16-A", label: "R-16", description: "Residencial · 16 pavimentos", group: "Residencial · padrão alto" },
  { id: "CAL-8-N", label: "CAL-8", description: "Comercial com andares livres", group: "Comercial · padrão normal" },
  { id: "CSL-8-N", label: "CSL-8", description: "Comercial com salas e lojas", group: "Comercial · padrão normal" },
  { id: "CSL-16-N", label: "CSL-16", description: "Comercial com salas e lojas", group: "Comercial · padrão normal" },
  { id: "CAL-8-A", label: "CAL-8", description: "Comercial com andares livres", group: "Comercial · padrão alto" },
  { id: "CSL-8-A", label: "CSL-8", description: "Comercial com salas e lojas", group: "Comercial · padrão alto" },
  { id: "CSL-16-A", label: "CSL-16", description: "Comercial com salas e lojas", group: "Comercial · padrão alto" },
  { id: "RP1Q", label: "RP1Q", description: "Residência popular", group: "Projetos especiais" },
  { id: "GI", label: "GI", description: "Galpão industrial", group: "Projetos especiais" },
];

const GROUPS = [
  { start: "Projetos-Padrão Residenciais - Baixo", end: "Projetos-Padrão Residenciais - Normal", ids: ["R1-B", "PP-4-B", "R8-B", "PIS"] },
  { start: "Projetos-Padrão Residenciais - Normal", end: "Projetos-Padrão Residenciais - Alto", ids: ["R1-N", "PP-4-N", "R8-N", "R16-N"] },
  { start: "Projetos-Padrão Residenciais - Alto", end: "Projetos-Padrão Comerciais - Normal", ids: ["R1-A", "R8-A", "R16-A"] },
  { start: "Projetos-Padrão Comerciais - Normal", end: "Projetos-Padrão Comerciais - Alto", ids: ["CAL-8-N", "CSL-8-N", "CSL-16-N"] },
  { start: "Projetos-Padrão Comerciais - Alto", end: "Projeto-Padrão Residência Popular", ids: ["CAL-8-A", "CSL-8-A", "CSL-16-A"] },
  { start: "Projeto-Padrão Residência Popular", end: "Projeto-Padrão Galpão Industrial", ids: ["RP1Q"] },
  { start: "Projeto-Padrão Galpão Industrial", end: null, ids: ["GI"] },
];

const numeroBR = texto => Number(String(texto || "").trim().replace(/\./g, "").replace(",", "."));

export const parseCubPeComposition = text => {
  const values = {};
  for (const group of GROUPS) {
    const start = text.indexOf(group.start);
    if (start < 0) continue;
    const end = group.end ? text.indexOf(group.end, start + group.start.length) : text.length;
    const section = text.slice(start, end > start ? end : text.length);
    const totalLine = (section.match(/Total([^\n]*)/) || [])[1] || "";
    const totals = [...totalLine.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map(match => numeroBR(match[0]));
    group.ids.forEach((id, index) => {
      if (Number.isFinite(totals[index])) values[id] = totals[index];
    });
  }
  return values;
};
