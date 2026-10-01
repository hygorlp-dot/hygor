// Estabelecimento fiscal do REP-P (Portaria MTP 671/2021). Puro.
//
// O NSR é contado POR ESTABELECIMENTO - FAQ oficial do MTE sobre a Portaria
// 671, pergunta 41: "cada estabelecimento (CNPJ com 14 posições ou CPF com 11
// posições) terá sua própria sequência de NSR ... iniciando-se em 1".
//
// Estabelecimento NÃO é obra: várias obras (e seus aparelhos) podem pertencer
// ao mesmo estabelecimento e compartilham UMA sequência de NSR. Obra nunca vira
// estabelecimento automaticamente - o vínculo é cadastrado no ARCD.
//
// Nenhum dado fiscal é inventado: inscrição, CNO e CAEPF são opcionais até
// alguém cadastrá-los; o que for informado precisa ser válido.

export const TIPOS_INSCRICAO = Object.freeze({ cnpj: 14, cpf: 11 });
export const FUSO_PADRAO = "America/Recife";

const soDigitos = v => String(v ?? "").replace(/\D/g, "");
const texto = v => String(v ?? "").trim();
const vazio = v => v === null || v === undefined || texto(v) === "";

// Dígitos verificadores (módulo 11).
export function cnpjValido(valor) {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = base => {
    let soma = 0, peso = base.length - 7;
    for (const c of base) { soma += Number(c) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(d.slice(0, 12));
  return d1 === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

export function cpfValido(valor) {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = base => { let soma = 0; for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i); const r = (soma * 10) % 11; return r === 10 ? 0 : r; };
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10]);
}

export function fusoValido(fuso) {
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: texto(fuso) }).format(0); return !!texto(fuso); } catch { return false; }
}

// Normaliza o que vem do formulário/banco para o formato canônico.
export function normalizarEstabelecimento(e = {}) {
  const opcional = v => (vazio(v) ? null : soDigitos(v));
  return {
    id: vazio(e.id) ? null : texto(e.id),
    nome: texto(e.nome),
    tipoInscricao: vazio(e.tipoInscricao) ? null : texto(e.tipoInscricao).toLowerCase(),
    numeroInscricao: opcional(e.numeroInscricao),
    cno: opcional(e.cno),
    caepf: opcional(e.caepf),
    // CEI foi substituído pelo CNO; fica só para dado histórico já existente.
    cei: opcional(e.cei),
    timezone: texto(e.timezone) || FUSO_PADRAO,
    ativo: e.ativo !== false,
    obras: [...new Set((e.obras || []).map(o => texto(o)).filter(Boolean))],
  };
}

export function validarEstabelecimento(bruto) {
  const e = normalizarEstabelecimento(bruto);
  const erros = [];
  if (!e.nome) erros.push("informe o nome do estabelecimento");
  if (e.nome.length > 150) erros.push("nome com mais de 150 caracteres");
  if (e.tipoInscricao !== null || e.numeroInscricao !== null) {
    if (!TIPOS_INSCRICAO[e.tipoInscricao]) erros.push("tipo de inscrição deve ser CNPJ ou CPF");
    else if (!e.numeroInscricao) erros.push("informe o número da inscrição");
    else if (e.numeroInscricao.length !== TIPOS_INSCRICAO[e.tipoInscricao]) erros.push(`${e.tipoInscricao.toUpperCase()} deve ter ${TIPOS_INSCRICAO[e.tipoInscricao]} dígitos`);
    else if (e.tipoInscricao === "cnpj" && !cnpjValido(e.numeroInscricao)) erros.push("CNPJ com dígito verificador inválido");
    else if (e.tipoInscricao === "cpf" && !cpfValido(e.numeroInscricao)) erros.push("CPF com dígito verificador inválido");
  }
  if (e.cno !== null && e.cno.length !== 12) erros.push("CNO deve ter 12 dígitos");
  if (e.caepf !== null && e.caepf.length !== 14) erros.push("CAEPF deve ter 14 dígitos");
  if (e.cei !== null && e.cei.length !== 12) erros.push("CEI deve ter 12 dígitos");
  if (!fusoValido(e.timezone)) erros.push("fuso horário inválido (use o nome IANA, ex.: America/Recife)");
  return { ok: erros.length === 0, erros, estabelecimento: e };
}

// O que ainda falta para este estabelecimento poder constar de um AFD
// (Fase 2). Não bloqueia o registro de ponto: é só uma lista de pendências.
export function pendenciasFiscais(e) {
  const n = normalizarEstabelecimento(e);
  const p = [];
  if (!n.tipoInscricao || !n.numeroInscricao) p.push("inscrição (CNPJ/CPF) não cadastrada");
  if (!n.obras.length) p.push("nenhuma obra vinculada");
  return p;
}
