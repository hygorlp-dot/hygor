// Regras puras do motor de aprovação configurável. Sem React, DOM ou
// persistência. Este motor é genérico: não presume cargos, quantidade de
// aprovadores ou número de etapas - tudo isso é dado configurado por
// política (ver domains/aprovacoes/policies.js).

// Operadores suportados nas condições de política (§2.1 da especificação).
export const OPERADORES = Object.freeze([
  "igual", "diferente", "maior", "maior_igual", "menor", "menor_igual",
  "entre", "contem", "pertence_lista", "nao_pertence_lista",
]);

const normalizar = v => (typeof v === "string" ? v.trim().toLowerCase() : v);

// Avalia UMA condição contra o contexto da entidade (solicitação/pedido/...).
// `condicao.campo` é uma chave do contexto (ex.: "valorTotal", "obraId",
// "urgencia"); `condicao.valor` é o valor de comparação (ou [de,ate] p/ "entre",
// ou array p/ "pertence_lista"/"nao_pertence_lista").
export const avaliarCondicao = (condicao, contexto) => {
  const atual = contexto?.[condicao.campo];
  const alvo = condicao.valor;
  switch (condicao.operador) {
    case "igual": return normalizar(atual) === normalizar(alvo);
    case "diferente": return normalizar(atual) !== normalizar(alvo);
    case "maior": return Number(atual) > Number(alvo);
    case "maior_igual": return Number(atual) >= Number(alvo);
    case "menor": return Number(atual) < Number(alvo);
    case "menor_igual": return Number(atual) <= Number(alvo);
    case "entre": {
      const [de, ate] = Array.isArray(alvo) ? alvo : [0, 0];
      return Number(atual) >= Number(de) && Number(atual) <= Number(ate);
    }
    case "contem": return String(atual ?? "").toLowerCase().includes(String(alvo ?? "").toLowerCase());
    case "pertence_lista": return Array.isArray(alvo) && alvo.some(v => normalizar(v) === normalizar(atual));
    case "nao_pertence_lista": return !(Array.isArray(alvo) && alvo.some(v => normalizar(v) === normalizar(atual)));
    default: return false;
  }
};

// Uma lista de condições é avaliada em grupos lógicos: condições do MESMO
// grupoLogico são combinadas com OU; grupos diferentes são combinados com E.
// Condição sem grupoLogico cai no grupo "default" (todas em E entre si).
export const avaliarCondicoes = (condicoes, contexto) => {
  if (!Array.isArray(condicoes) || condicoes.length === 0) return true; // sem condição = sempre aplica
  const grupos = new Map();
  condicoes.forEach(c => {
    const g = c.grupoLogico || "default";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(c);
  });
  for (const lista of grupos.values()) {
    const algumaVerdadeira = lista.some(c => avaliarCondicao(c, contexto));
    if (!algumaVerdadeira) return false; // este grupo (E) falhou
  }
  return true;
};

// Prazo em horas ou dias úteis, a partir de uma data-base ISO.
export const calcularVencimento = (dataBaseISO, prazoValor, prazoUnidade) => {
  const base = new Date(dataBaseISO);
  if (isNaN(base.getTime()) || !prazoValor) return null;
  if (prazoUnidade === "horas") {
    return new Date(base.getTime() + prazoValor * 3600 * 1000).toISOString();
  }
  // dias úteis: avança pulando sáb/dom
  let restantes = prazoValor;
  const d = new Date(base.getTime());
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const diaSemana = d.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) restantes--;
  }
  return d.toISOString();
};

export const prazoVencido = (vencimentoISO, agoraISO) => {
  if (!vencimentoISO) return false;
  return new Date(agoraISO || Date.now()).getTime() > new Date(vencimentoISO).getTime();
};
