// Motor de associação item→composição do Hidrossanitário (29/08/2026).
//
// Achado do teste real com as 94 linhas do PDF: rodar a IA para TODO item
// era desperdício - em 5 dos 5 casos que ela associou, havia exatamente 1
// candidato real encontrado (compatível em categoria/diâmetro), então a IA
// só estava CONFIRMANDO uma escolha que uma regra determinística já dava
// com a mesma segurança, sem custo de API/latência/dependência de chave
// Gemini configurada. O único caso onde ela agregou algo (a "Bacia
// Sanitária com Caixa Acoplada", 4 candidatos plausíveis, sem padrão/
// engate especificado no item) é exatamente o tipo de desempate que só
// faz sentido levar à IA.
//
// Também descobrimos a causa raiz de por que a busca (`pesquisarBasesReferencia`
// → `/api/references`) não achava candidato pra maioria dos itens: o
// servidor usa `terms.slice(0, QUERY_TERMS_MAX=6)` (api/references.js) -
// só as 6 primeiras palavras da consulta viram filtro `ilike` (E lógico,
// todas precisam bater). Mandar a descrição inteira do PDF ("Adaptador
// Soldável Curto com Bolsa e Rosca para Registro 25 x 3/4'', PVC Marrom,
// Água Fria") gasta as 6 vagas em "adaptador soldavel curto com bolsa e" -
// o diâmetro e o substantivo que realmente distingue a peça ("registro")
// nunca chegam a ser usados. `termosBuscaParaItem` resolve isso do lado
// do cliente, sem precisar mudar o servidor: sempre preserva o núcleo
// (primeira palavra não-genérica) e os números/frações (diâmetro), e só
// preenche o resto do orçamento de 6 palavras com os modificadores
// seguintes - descartando por último as palavras de sistema/cor/marca
// (que agora são responsabilidade do filtro de categoria, não da busca).
//
// Este módulo é intencionalmente conservador: toda função aqui só REJEITA
// um candidato quando há um CONFLITO CONFIRMADO (categoria oposta,
// diâmetro numérico diferente) - na dúvida (informação ausente de um dos
// lados), deixa passar e confia no desempate seguinte (mais candidatos
// sobreviventes → vai para a IA; exatamente 1 → associação automática;
// nenhum → pendente). Nunca inventa, nunca força uma escolha.

const PALAVRAS_IGNORAR = new Set([
  "com", "e", "para", "de", "da", "do", "das", "dos", "em", "na", "no",
  "por", "ou", "um", "uma", "x", "a", "o",
]);

// Palavras de sistema/cor/marca/instalação: úteis para o OLHO humano, mas
// não para a busca (o filtro de categoria abaixo já cuida de sistema) -
// são as primeiras a sair quando o orçamento de 6 palavras aperta.
const PALAVRAS_BAIXA_PRIORIDADE = new Set([
  "pvc", "marrom", "branco", "agua", "fria", "esgoto", "pluvial",
  "serie", "normal", "tigre", "fortlev", "aquapluv", "style",
  "instalado", "instalacao", "instalada", "fornecimento", "ramal",
  "sub-ramal", "subramal", "acessorio", "acessório",
]);

const REGEX_DIACRITICOS = new RegExp("[̀-ͯ]", "g");
const semAcentoMinusculo = texto => String(texto || "")
  .normalize("NFD").replace(REGEX_DIACRITICOS, "")
  .toLowerCase();

const tokenizar = texto => semAcentoMinusculo(texto)
  .replace(/['"’]/g, "")
  .split(/[^a-z0-9/]+/)
  .filter(Boolean);

// Devolve 1-2 termos de busca (cada um com no máximo 6 palavras, o limite
// real do servidor) para uma descrição de item. O primeiro termo prioriza
// substantivo-núcleo + diâmetro + os modificadores seguintes; quando a
// descrição é longa demais para caber num só termo, um segundo termo
// cobre os modificadores que sobraram (ex.: "registro", "rosca") - a busca
// tenta os dois e o resultado é somado (pooled) antes do filtro de
// categoria/diâmetro decidir o que é realmente compatível.
export function termosBuscaParaItem(descricao) {
  const brutas = tokenizar(descricao).filter(p => !PALAVRAS_IGNORAR.has(p));
  if (!brutas.length) return [];
  const numeros = brutas.filter(p => /^[0-9]/.test(p));
  const naoNumeros = brutas.filter(p => !/^[0-9]/.test(p));
  const essenciais = naoNumeros.filter(p => !PALAVRAS_BAIXA_PRIORIDADE.has(p));
  const nucleo = essenciais[0] ? [essenciais[0]] : naoNumeros.slice(0, 1);
  const resto = essenciais.slice(1);
  const base = [...nucleo, ...numeros];
  const primeiro = [...base, ...resto].slice(0, 6).join(" ");
  const termos = [primeiro];
  const vagas = Math.max(0, 6 - base.length);
  if (resto.length > vagas) {
    const cauda = resto.slice(vagas);
    const segundo = [...base, ...cauda].slice(0, 6).join(" ");
    termos.push(segundo);
  }
  return [...new Set(termos)].filter(Boolean);
}

// Último recurso (29/08/2026, pedido do usuário: só considerar o
// levantamento fechado quando TODO item tiver, no mínimo, uma tentativa
// real de correspondência - não um "sem candidato" silencioso): um termo
// de UMA palavra só (o núcleo, sem diâmetro nem modificador nenhum) para
// os itens que não acharam nada nem no termo principal nem na cauda. É
// deliberadamente permissivo - pode trazer candidatos de diâmetro ou
// função diferente, mas o filtro de categoria/diâmetro (candidatoCompativel)
// continua protegendo: se sobrar mais de um depois do filtro, vai para a
// IA desempatar; nunca associa sozinho um candidato que não bateu.
export function termoNucleoApenas(descricao) {
  const brutas = tokenizar(descricao).filter(p => !PALAVRAS_IGNORAR.has(p));
  const essenciais = brutas.filter(p => !PALAVRAS_BAIXA_PRIORIDADE.has(p) && !/^[0-9]/.test(p));
  const nucleo = essenciais[0] || brutas.find(p => !/^[0-9]/.test(p)) || brutas[0];
  return nucleo || "";
}

// Categorias reconhecidas. "indefinido" nunca é motivo de rejeição - só
// bloqueia quando os DOIS lados (item e candidato) têm categoria conhecida
// e ela conflita.
const SISTEMAS = ["agua-fria", "esgoto", "pluvial"];

const categoriaPorPalavraChave = texto => {
  const t = semAcentoMinusculo(texto);
  if (/esgoto/.test(t)) return "esgoto";
  if (/pluvial/.test(t)) return "pluvial";
  if (/agua/.test(t)) return "agua-fria";
  return "";
};

// Deriva a categoria/sistema de uma linha das 8 tabelas do hidrossanitário
// - cada tabela tem sua própria forma de indicar o sistema (fixo pela
// própria tabela, um campo tipoSistema/sistema, ou nenhum campo - nesse
// caso cai para uma tentativa por palavra-chave na própria descrição, e se
// nada bater, "indefinido").
export function categoriaDoItem(chave, linha) {
  if (chave === "conexoesAguaFria") return "agua-fria";
  if (chave === "conexoesEsgoto") return "esgoto";
  if (chave === "calhasPluviais") return "pluvial";
  if (chave === "tubosRigidos") return categoriaPorPalavraChave(linha?.sistema) || "indefinido";
  if (chave === "caixasRalosComplementos" || chave === "pecasHidraulicasSanitarias") {
    return categoriaPorPalavraChave(linha?.tipoSistema) || "indefinido";
  }
  // registrosAcessorios e tubosFlexiveis não têm campo de sistema no
  // modelo de dados - só resta tentar por palavra-chave na descrição.
  return categoriaPorPalavraChave(linha?.descricao) || "indefinido";
}

// Categoria "lida" na descrição de um candidato SINAPI/ORSE (texto oficial
// da base) - mesma lógica por palavra-chave, aplicada ao lado da base.
export function categoriaDaDescricaoCandidato(descricao) {
  return categoriaPorPalavraChave(descricao) || "indefinido";
}

// Números de diâmetro em mm mencionados no texto: só extrai um número
// quando ele vem com sufixo "mm" explícito ("25mm", "25 mm"), ou quando
// vem imediatamente antes de "x" + uma fração ("25 x 3/4", a convenção
// real das peças de redução/adaptador do PDF). Não tenta interpretar
// polegadas (1/2", 3/4") como mm - ficam numa lista à parte, comparadas
// separado.
//
// Achado do audit de 30/08/2026: a versão anterior também extraía QUALQUER
// número antes de "x" (sem exigir fração depois) e QUALQUER número antes
// de vírgula/fim de string - o que fazia dimensões de calha como
// "132 x 89" (largura x altura do perfil, não diâmetro nenhum - ex. real:
// "Suporte PVC, Branco, 132 x 89, Aquapluv Style - TIGRE") virarem [132,89]
// e rejeitar por "diâmetro incompatível" qualquer candidato genérico de
// calha/condutor que não citasse esses mesmos números - provavelmente a
// causa raiz de todos os 13 itens de calha pluvial terem dado "Nenhum
// candidato" nos testes ao vivo desta sessão.
const extrairNumeros = texto => {
  const t = semAcentoMinusculo(texto);
  const comSufixoMm = t.match(/\d+(?:[.,]\d+)?\s*mm\b/g) || [];
  const antesDeFracao = t.match(/\d+(?:[.,]\d+)?(?=\s*x\s*\d\/\d)/g) || [];
  return [...comSufixoMm, ...antesDeFracao]
    .map(s => parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n > 0 && n < 1000); // descarta ex. "2000" de "2000 litros".
};

const extrairPolegadas = texto => (semAcentoMinusculo(texto).match(/\d\/\d\s*(?:''|"|pol)?/g) || [])
  .map(s => s.replace(/[''"]|pol/g, "").trim());

// Só rejeita quando os dois lados têm diâmetro extraído E não têm nenhum
// valor em comum - quando falta informação de um lado, considera
// compatível (deixa a decisão pra frente: desempate por IA se sobrar mais
// de 1 candidato, ou aceitação automática se sobrar só esse).
export function diametrosCompativeis(textoItem, textoCandidato) {
  const mmItem = extrairNumeros(textoItem);
  const mmCand = extrairNumeros(textoCandidato);
  if (mmItem.length && mmCand.length && !mmItem.some(n => mmCand.includes(n))) return false;
  const polItem = extrairPolegadas(textoItem);
  const polCand = extrairPolegadas(textoCandidato);
  if (polItem.length && polCand.length && !polItem.some(p => polCand.includes(p))) return false;
  return true;
}

// Decisão final: um candidato é compatível com um item quando não há
// conflito confirmado de categoria (sistema) nem de diâmetro.
export function candidatoCompativel(item, candidato) {
  const catItem = item.categoria || "indefinido";
  const catCand = categoriaDaDescricaoCandidato(candidato.descricao);
  if (SISTEMAS.includes(catItem) && SISTEMAS.includes(catCand) && catItem !== catCand) return false;
  return diametrosCompativeis(item.descricao, candidato.descricao);
}

// "Mínimo de IA" (audit de 30/08/2026): quando os candidatos sobreviventes
// só diferem pelo LOCAL de instalação (ramal, sub-ramal, prumada,
// reservação, distribuição, descarga, ventilação) ou pelo TIPO DE JUNTA
// (soldável x elástica) - informação que o PDF de origem nunca especifica
// item a item -, a IA não tem como resolver isso de verdade: nos testes ao
// vivo desta sessão, chamada exatamente nesses casos, ela mesma respondeu
// "pendente". Então esse desempate pode ser feito por regra, sem gastar
// uma chamada de IA que já sabemos (pelo teste real) que terminaria em
// "pendente" de qualquer forma - é uma downgrade estritamente segura:
// nunca associa sozinho, só evita uma chamada de IA cujo resultado já é
// previsível.
const PADRAO_SO_LOCAL_OU_JUNTA = /\b(ramal|sub-?ramal|prumada|reservacao|distribuicao|descarga|ventilacao|soldavel|elastica)\b/;

export function candidatosDivergemSoPorInstalacao(candidatos) {
  if (!candidatos || candidatos.length < 2) return false;
  const nucleoDe = descricao => semAcentoMinusculo(descricao)
    .replace(/af[_ ]?\d+\/\d+/g, "")
    .split(/[,.]/)
    .filter(trecho => !PADRAO_SO_LOCAL_OU_JUNTA.test(trecho))
    .join("|")
    .replace(/\s+/g, " ")
    .trim();
  const nucleos = candidatos.map(c => nucleoDe(c.descricao));
  return nucleos[0].length > 0 && nucleos.every(n => n === nucleos[0]);
}

// Classifica um item já com sua lista de candidatos SOBREVIVENTES (depois
// de `candidatoCompativel`): 0 → pendente sem custo de IA; exatamente 1 →
// associação automática (determinística, sem IA); 2+ diferindo só por
// instalação/junta → pendente sem custo de IA (ver acima); 2+ de verdade
// diferentes → ambíguo, só esses vão para a chamada de IA.
export function classificarItem(item, sobreviventes) {
  if (!sobreviventes.length) {
    return { itemId: item.id, status: "pendente", origem: "regra", confianca: 0, justificativa: "Nenhum candidato compatível encontrado (sistema/diâmetro considerados)." };
  }
  if (sobreviventes.length === 1) {
    const c = sobreviventes[0];
    return { itemId: item.id, status: "associado", origem: "regra", fonte: c.fonte, codigo: c.codigo, descricao: c.descricao, unidade: c.unidade, precoUnit: c.precoUnit, confianca: 1, justificativa: "Único candidato compatível por sistema e diâmetro - sem outra opção para comparar." };
  }
  if (candidatosDivergemSoPorInstalacao(sobreviventes)) {
    return { itemId: item.id, status: "pendente", origem: "regra", confianca: 0, justificativa: "Candidatos equivalentes entre si, diferindo só pelo local de instalação ou tipo de junta - informação que o projeto não especifica item a item. Pendente sem custo de IA." };
  }
  return null; // ambíguo de verdade - decide a IA
}
