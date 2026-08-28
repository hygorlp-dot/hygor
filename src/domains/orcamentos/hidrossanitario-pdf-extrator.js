// Extrator do projeto hidrossanitário (puro, sem Worker - mesmo padrão de
// estrutural-pdf-extrator.js). Lê a folha "Tabelas e Detalhes" (a última do
// projeto, com o quantitativo consolidado da obra inteira - as folhas por
// pavimento só repetem as mesmas duas tabelas de conexões como legenda,
// sempre com os mesmos números) e devolve as 8 tabelas que ela imprime.
//
// Formato real (pdfjs-dist, um item de texto por linha): cada tabela tem um
// título, os rótulos de coluna, e depois as linhas de dado - mas a ORDEM
// das colunas (quantidade primeiro ou por último) varia de tabela pra
// tabela, e pelo menos uma descrição real quebra em duas linhas de PDF
// ("Sifão para cozinha 1.1⁄2”x 1.1⁄2” c/ adaptador 2” e tubo de" + "300
// mm"). Por isso o parser não conta linhas fixas por registro - ele varre
// e fecha um registro sempre que encontra uma linha que bate o padrão do
// ÚLTIMO campo daquela tabela (código, tipo de sistema ou número), e junta
// tudo que sobrou no meio como descrição. Robusto à descrição quebrada,
// já que "quantas linhas" nunca importa, só "onde termina".

const paraNumero = texto => Number(String(texto || "").replace(/\./g, "").replace(",", "."));

const linhasNaoVazias = texto => String(texto || "").split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);

// Corta o texto entre `titulo` e o próximo título conhecido (ou o fim).
function blocoDaTabela(texto, titulo, outrosTitulos) {
  const inicio = texto.indexOf(titulo);
  if (inicio === -1) return null;
  const resto = texto.slice(inicio + titulo.length);
  let fim = resto.length;
  for (const outro of outrosTitulos) {
    const i = resto.indexOf(outro);
    if (i !== -1 && i < fim) fim = i;
  }
  return resto.slice(0, fim);
}

// Agrupa linhas em registros que sempre TERMINAM quando uma linha bate
// `padraoFim` - não assume quantas linhas cada registro tem.
function registrosPorFim(linhas, padraoFim) {
  const registros = [];
  let atual = [];
  for (const linha of linhas) {
    atual.push(linha);
    if (padraoFim.test(linha)) { registros.push(atual); atual = []; }
  }
  return registros;
}

const TITULOS_TABELAS = [
  "Conexões - Água fria (Tubos Rígidos)", "Conexões - Esgoto",
  "Caixas - Ralos - Complementos", "Peças hidráulicas e sanitárias",
  "Registros e acessórios", "Tubos Flexíveis", "Calhas Pluviais", "Tubos Rigidos",
];

// Quantidade primeiro, código por último (F1..F21 / E1..E19) - tabelas de
// conexões de água fria e esgoto.
function extrairConexoes(texto, titulo, padraoCodigo) {
  const bloco = blocoDaTabela(texto, titulo, TITULOS_TABELAS);
  if (!bloco) return [];
  const linhas = linhasNaoVazias(bloco).filter(l => !["Quantidade", "Descrição", "Código"].includes(l));
  return registrosPorFim(linhas, padraoCodigo).map(registro => ({
    quantidade: paraNumero(registro[0]),
    descricao: registro.slice(1, -1).join(" "),
    codigo: registro[registro.length - 1],
  })).filter(l => l.codigo && l.descricao);
}

// Quantidade primeiro, tipo de sistema por último - "Caixas - Ralos -
// Complementos" (Inspeção/Esgoto, Inspeção/Pluvial, Inspeção/Água Fria).
function extrairCaixasRalosComplementos(texto) {
  const bloco = blocoDaTabela(texto, "Caixas - Ralos - Complementos", TITULOS_TABELAS);
  if (!bloco) return [];
  const linhas = linhasNaoVazias(bloco).filter(l => !["Quantidade", "Descrição", "Tipo de sistema"].includes(l));
  return registrosPorFim(linhas, /^Inspeção\//).map(registro => ({
    quantidade: paraNumero(registro[0]),
    descricao: registro.slice(1, -1).join(" "),
    tipoSistema: registro[registro.length - 1],
  })).filter(l => l.tipoSistema && l.descricao);
}

// Quantidade primeiro, abreviatura penúltima, tipo de sistema por último -
// "Peças hidráulicas e sanitárias" (Utilização, Utilização/Esgoto, Água
// Fria). Achado real: as duas primeiras linhas logo abaixo do cabeçalho
// desta tabela são, na verdade, uma repetição das duas últimas linhas de
// "Caixas - Ralos - Complementos" (mesmo vocabulário "Inspeção/...", não
// "Utilização"/"Água Fria") - vazamento de paginação do PDF, mesmos dados
// já capturados em extrairCaixasRalosComplementos. Sem reconhecer também
// "Inspeção/..." como fim de registro aqui, essas duas linhas nunca
// fechavam e contaminavam a descrição do registro seguinte (Bacia
// Sanitária) inteiro - por isso o padrão de fim reconhece as duas formas,
// e os registros "Inspeção/..." são descartados depois por não pertencerem
// a esta tabela.
function extrairPecasHidraulicasSanitarias(texto) {
  const bloco = blocoDaTabela(texto, "Peças hidráulicas e sanitárias", TITULOS_TABELAS);
  if (!bloco) return [];
  const linhas = linhasNaoVazias(bloco).filter(l => !["Quantidade", "Descrição", "Abreviatura", "Tipo de sistema"].includes(l));
  return registrosPorFim(linhas, /^(Utilização(\/Esgoto)?|Água Fria|Inspeção\/(Esgoto|Pluvial|Água Fria))$/).map(registro => ({
    quantidade: paraNumero(registro[0]),
    descricao: registro.slice(1, -2).join(" "),
    abreviatura: registro[registro.length - 2],
    tipoSistema: registro[registro.length - 1],
  })).filter(l => l.descricao && l.abreviatura && !l.tipoSistema.startsWith("Inspeção/"));
}

// Descrição primeiro, quantidade/contagem por último - "Registros e
// acessórios" e "Calhas Pluviais" (mesma forma, título de coluna diferente).
function extrairPorContagem(texto, titulo, rotulosColuna) {
  const bloco = blocoDaTabela(texto, titulo, TITULOS_TABELAS);
  if (!bloco) return [];
  const linhas = linhasNaoVazias(bloco).filter(l => !rotulosColuna.includes(l));
  return registrosPorFim(linhas, /^\d+$/).map(registro => ({
    descricao: registro.slice(0, -1).join(" "),
    quantidade: paraNumero(registro[registro.length - 1]),
  })).filter(l => l.descricao);
}

// Descrição, abreviatura, diâmetro (termina em "mm"), comprimento (decimal)
// - "Tubos Rigidos". Tem um marcador de sistema solto no meio ("Esgoto"/
// "Água fria", sem número/mm) que não é linha de dado - só atualiza o
// sistema corrente das linhas seguintes.
function extrairTubosRigidos(texto) {
  const bloco = blocoDaTabela(texto, "Tubos Rigidos", TITULOS_TABELAS);
  if (!bloco) return [];
  const linhas = linhasNaoVazias(bloco).filter(l => !["Descrição", "Abreviatura", "Diâmetro", "Comprimento (m)"].includes(l));
  const resultado = [];
  let sistemaAtual = "";
  let registro = [];
  for (const linha of linhas) {
    if (linha === "Esgoto" || linha === "Água fria") { sistemaAtual = linha; continue; }
    registro.push(linha);
    if (/^[\d.,]+$/.test(linha) && !linha.includes("mm")) {
      // fechou em "comprimento" (decimal puro, sem "mm" - o diâmetro sempre
      // tem "mm" junto, o que evita confundir os dois campos numéricos).
      const [descricao, abreviatura, diametro, comprimento] = registro;
      if (descricao && abreviatura && diametro && comprimento) {
        resultado.push({
          descricao, abreviatura, sistema: sistemaAtual,
          diametroMm: paraNumero(diametro.replace(/\s*mm$/, "")),
          comprimentoM: paraNumero(comprimento),
        });
      }
      registro = [];
    }
  }
  return resultado;
}

// Tabela de uma linha só - o texto real duplica o rótulo da descrição
// (achado real: "Tubo PEAD Corrugado Perfurado Flexível" aparece inteiro E
// quebrado em duas linhas, intercalado com o comprimento - artefato do PDF,
// não duas peças diferentes) - por isso não tenta separar por linha, só
// procura o primeiro decimal (comprimento) e o primeiro "número mm"
// (diâmetro) dentro do bloco.
function extrairTubosFlexiveis(texto) {
  const bloco = blocoDaTabela(texto, "Tubos Flexíveis", TITULOS_TABELAS);
  if (!bloco) return [];
  const comprimento = bloco.match(/(\d+[.,]\d+)/);
  const diametro = bloco.match(/([\d.,]+)\s*mm/);
  if (!comprimento) return [];
  return [{
    descricao: "Tubo PEAD Corrugado Perfurado Flexível",
    diametroMm: diametro ? paraNumero(diametro[1]) : 0,
    comprimentoM: paraNumero(comprimento[1]),
  }];
}

export function extrairTabelasHidrossanitario(texto) {
  const t = String(texto || "");
  // Página "Tabelas e Detalhes" (a última) - as mesmas duas tabelas de
  // conexões também aparecem em cada folha por pavimento como legenda, com
  // os mesmos números; ancorar aqui evita pegar a versão errada por engano.
  const marcador = t.indexOf("Tabelas e Detalhes");
  const escopo = marcador === -1 ? t : t.slice(marcador);
  return {
    conexoesAguaFria: extrairConexoes(escopo, "Conexões - Água fria (Tubos Rígidos)", /^F\d+$/),
    conexoesEsgoto: extrairConexoes(escopo, "Conexões - Esgoto", /^E\d+$/),
    caixasRalosComplementos: extrairCaixasRalosComplementos(escopo),
    pecasHidraulicasSanitarias: extrairPecasHidraulicasSanitarias(escopo),
    registrosAcessorios: extrairPorContagem(escopo, "Registros e acessórios", ["Descrição", "Contagem"]),
    calhasPluviais: extrairPorContagem(escopo, "Calhas Pluviais", ["Tigre: Descrição", "Contagem"]),
    tubosRigidos: extrairTubosRigidos(escopo),
    tubosFlexiveis: extrairTubosFlexiveis(escopo),
  };
}
