const SERVICE_FAMILIES = [
  { key:"pintura_teto", terms:["pintura de teto","pintura forro","massa corrida teto"], factor:1, tolerance:.2, note:"Pintura de teto segue a area construida." },
  { key:"contrapiso", terms:["contrapiso","regularizacao de piso"], factor:1, tolerance:.15, note:"Contrapiso segue a area construida." },
  { key:"piso", terms:["piso","porcelanato","ceramica piso","revestimento de piso"], factor:1, tolerance:.15, note:"Piso segue a area construida." },
  { key:"forro", terms:["forro","gesso"], factor:1, tolerance:.15, note:"Forro segue de perto a area construida (menos vazios)." },
  { key:"laje", terms:["laje"], factor:1, tolerance:.2, note:"Laje se aproxima da area construida por pavimento." },
  { key:"cobertura", terms:["telha","cobertura","telhado"], factor:1.2, tolerance:.25, note:"Cobertura costuma ser um pouco maior que a area (beirais, caimento)." },
  { key:"reboco", terms:["reboco","emboco","massa unica","chapisco"], factor:2.5, tolerance:.35, note:"Paredes tem 2 faces e pe-direito: costuma ser ~2,5x a area." },
  { key:"alvenaria", terms:["alvenaria","vedacao","tijolo","bloco ceramico","bloco de concreto"], factor:2.2, tolerance:.4, note:"Alvenaria acompanha o perimetro e o pe-direito." },
  { key:"pintura_par", terms:["pintura","massa corrida","textura"], factor:2.5, tolerance:.4, note:"Pintura de parede: 2 faces e pe-direito." },
];

const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function familyOf(item) {
  const unit = normalize(item?.unidade).replace(/²/g, "2").replace(/[^a-z0-9]/g, "");
  if (unit !== "m2") return null;
  const description = normalize(item?.descricao);
  return SERVICE_FAMILIES.find(family => family.terms.some(term => description.includes(normalize(term)))) || null;
}

export function auditBudgetDimensions(budget, builtArea) {
  const area = Number(builtArea || 0);
  const groups = new Map();
  (budget?.itens || [])
    .filter(item => item.tipo !== "titulo" && Number(item.quantidade || 0) > 0)
    .forEach(item => {
      const family = familyOf(item);
      if (!family) return;
      const group = groups.get(family.key) || { family, quantity:0, items:[] };
      group.quantity += Number(item.quantidade || 0);
      group.items.push(item.descricao);
      groups.set(family.key, group);
    });

  const linhas = [...groups.values()].map(({ family, quantity, items }) => {
    const esperado = area * family.factor;
    const dif = quantity - esperado;
    const ratio = esperado ? dif / esperado : 0;
    const status = area <= 0 ? "sem_area" : ratio > family.tolerance ? "alto" : ratio < -family.tolerance ? "baixo" : "ok";
    return {
      chave:family.key, nome:family.key.replace(/_/g, " "), qtd:quantity,
      esperado, dif, difPct:ratio * 100, status, obs:family.note, exemplos:items.slice(0, 3),
    };
  }).sort((a, b) => Math.abs(b.difPct) - Math.abs(a.difPct));

  return { area, linhas, alertas:linhas.filter(line => line.status === "alto" || line.status === "baixo"), temArea:area > 0 };
}

