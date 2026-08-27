// Motor de importação do ORSE (CEHOP/Sergipe) - lê os TXT relacionais
// entregues pelo administrador e devolve o mesmo formato que o
// importador do SINAPI já produz ({itens, insumos, componentes,
// dataBase}), para reusar o pipeline de gravação em /api/references sem
// mudar sua forma. Ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md.
//
// Achados que moldam este parser (decifrados sem dicionário oficial,
// cruzando os arquivos entre si e validando contra o preço já usado em
// produção via raspagem ao vivo do ORSE - código 4 bateu R$ 6,74 nos
// dois lados):
// - Os arquivos são ISO-8859-1 (latin1), não UTF-8.
// - ORSE não distingue onerado/desonerado nem tem UF (é o preço único de
//   referência de Sergipe) - por isso todo item ORSE grava o mesmo valor
//   em precoDes e precoNao: qualquer que seja orc.desonerado, o preço
//   final é o mesmo.
// - TB_SERVICO vem com blocos de RTF binário embutidos em parte dos
//   registros (aparenta ser um campo de memorial/observação despejado
//   como texto bruto), sempre GRUDADO no fim de uma linha-âncora que já
//   contém os campos úteis inteiros (fonte;código;descrição;unidade;...)
//   antes do RTF começar. As linhas de continuação do RTF (que não batem
//   o início "ORSE;<dígitos>;") são só lixo e são descartadas.
// - TB_COMPOSICAO (detalhamento analítico) não fecha uma soma simples
//   para reconstruir o preço da composição (linhas de equipamento usam
//   uma fórmula que depende das tabelas de detalhamento de equipamento,
//   fora do escopo desta versão) - por isso nunca é usada para calcular
//   preço, só para exibição no "Ver composição analítica". O preço de
//   verdade sempre vem de TB_SERVICO_PRECO/TB_INSUMO_PRECO.

const linhasDoTexto = texto => String(texto ?? "").split(/\r\n|\n/).filter(linha => linha.length > 0);

// Os TXT do ORSE vêm em ISO-8859-1 (confirmado por hexdump - "m³" é o
// byte 0xB3), não UTF-8. Decodificar como UTF-8 corromperia acentos.
export const decodificarLatin1 = bytes => new TextDecoder("iso-8859-1").decode(bytes);

export const numeroBR = valor => {
  const texto = String(valor ?? "").trim();
  if (!texto) return 0;
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};

// TB_INSUMO: ORSE;codigo;descricaoCompleta;descricaoResumida;unidade;unidade2;...
export function parseCatalogoInsumo(texto) {
  const catalogo = new Map();
  for (const linha of linhasDoTexto(texto)) {
    const campos = linha.split(";");
    const codigo = String(campos[1] ?? "").trim();
    const descricao = String(campos[2] ?? "").trim();
    if (!codigo || !descricao) continue;
    catalogo.set(codigo, { codigo, descricao, unidade: String(campos[4] ?? "UN").trim() || "UN" });
  }
  return catalogo;
}

// TB_INSUMO_PRECO: ORSE;codigo;ano;mes;seq;...;precoSem;precoCom;data;...
// As colunas 10 e 11 (precoSem/precoCom) são idênticas em 100% dos casos
// observados - ORSE não distingue onerado/desonerado no insumo.
export function parsePrecoInsumo(texto) {
  const precos = new Map();
  let competencia = "";
  for (const linha of linhasDoTexto(texto)) {
    const campos = linha.split(";");
    const codigo = String(campos[1] ?? "").trim();
    const preco = numeroBR(campos[9]);
    if (!competencia && campos[2] && campos[3]) {
      competencia = `${campos[2]}-${String(campos[3]).padStart(2, "0")}`;
    }
    if (!codigo || preco <= 0) continue;
    precos.set(codigo, preco);
  }
  return { precos, competencia };
}

// TB_SERVICO: catálogo de composições/serviços. Poluído com RTF binário -
// só captura os campos do início da linha via regex ancorada; qualquer
// linha que não comece com "ORSE;<código>;" é lixo de continuação e é
// ignorada.
const ANCORA_SERVICO = /^ORSE;(\d+);([^;]*);([^;]*)/;
export function parseCatalogoServico(texto) {
  const catalogo = new Map();
  for (const linha of linhasDoTexto(texto)) {
    const match = ANCORA_SERVICO.exec(linha);
    if (!match) continue;
    const [, codigo, descricao, unidade] = match;
    const descricaoLimpa = descricao.trim();
    if (!descricaoLimpa) continue;
    catalogo.set(codigo, { codigo, descricao: descricaoLimpa, unidade: (unidade || "UN").trim() || "UN" });
  }
  return catalogo;
}

// TB_SERVICO_PRECO: ORSE;codigo;ano;mes;seq;preco;...  (1 linha por
// composição - validado ao vivo contra a raspagem em produção)
export function parsePrecoServico(texto) {
  const precos = new Map();
  let competencia = "";
  for (const linha of linhasDoTexto(texto)) {
    const campos = linha.split(";");
    const codigo = String(campos[1] ?? "").trim();
    const preco = numeroBR(campos[5]);
    if (!competencia && campos[2] && campos[3]) {
      competencia = `${campos[2]}-${String(campos[3]).padStart(2, "0")}`;
    }
    if (!codigo || preco <= 0) continue;
    precos.set(codigo, preco);
  }
  return { precos, competencia };
}

// TB_COMPOSICAO: codigoComposicao\tano\tmes\tseq\ttipo(I|S)\tfonteFilho\t
// codigoFilho\tcoeficiente\t...\tcategoria\tvalorSem\tvalorCom\t...
// Único dos cinco arquivos separado por TAB, não ";" (confirmado por
// hexdump - byte 0x09 entre os campos, contra 0x3b nos outros quatro).
// Só para exibição (Ver composição analítica) - nunca para calcular preço.
export function parseComposicoes(texto) {
  const linhas = [];
  for (const linha of linhasDoTexto(texto)) {
    const campos = linha.split("\t");
    const compositionCode = String(campos[1] ?? "").trim();
    const itemCode = String(campos[7] ?? "").trim();
    if (!compositionCode || !itemCode) continue;
    linhas.push({
      compositionCode,
      itemType: campos[5] === "S" ? "COMPOSICAO" : "INSUMO",
      fonte: String(campos[6] ?? "ORSE").trim().toUpperCase() || "ORSE",
      itemCode,
      coeficiente: numeroBR(campos[8]),
      valorSem: numeroBR(campos[12]),
      valorCom: numeroBR(campos[13]),
    });
  }
  return linhas;
}

// Junta os cinco arquivos num único resultado no formato que o pipeline
// de /api/references já espera (o mesmo que sinapi-parser.worker.js
// produz). Os dois arquivos de detalhamento de equipamento
// (TB_INSUMO_PRECO_EQUIPAMENTO e _MAODEOBRA) ficam de fora desta versão -
// o preço final de um insumo de equipamento já está em TB_INSUMO_PRECO.
export function montarExtracaoOrse({ insumoTxt, insumoPrecoTxt, servicoTxt, servicoPrecoTxt, composicaoTxt }) {
  const catalogoInsumo = parseCatalogoInsumo(insumoTxt);
  const { precos: precoInsumo, competencia: competenciaInsumo } = parsePrecoInsumo(insumoPrecoTxt);
  const catalogoServico = parseCatalogoServico(servicoTxt);
  const { precos: precoServico, competencia: competenciaServico } = parsePrecoServico(servicoPrecoTxt);

  const insumos = [];
  for (const [codigo, preco] of precoInsumo) {
    const item = catalogoInsumo.get(codigo);
    if (!item) continue;
    insumos.push({ fonte: "ORSE", codigo, descricao: item.descricao, unidade: item.unidade, precoDes: preco, precoNao: preco });
  }

  const itens = [];
  for (const [codigo, preco] of precoServico) {
    const item = catalogoServico.get(codigo);
    if (!item) continue;
    itens.push({ fonte: "ORSE", codigo, descricao: item.descricao, unidade: item.unidade, precoDes: preco, precoNao: preco });
  }

  // ~36% dos filhos de composições ORSE apontam para o catálogo do
  // SINAPI (confirmado nos arquivos reais), que este motor não carrega.
  // Sem uma descrição própria, a linha some do lote de gravação (o
  // component-chunk de /api/references exige descrição não vazia) -
  // por isso um filho de outra fonte ganha um rótulo mínimo em vez de
  // ficar em branco, para não desaparecer silenciosamente do "Ver
  // composição analítica".
  const componentes = parseComposicoes(composicaoTxt).map(linha => {
    const catalogo = linha.fonte === "ORSE" ? (linha.itemType === "COMPOSICAO" ? catalogoServico : catalogoInsumo) : null;
    const referencia = catalogo?.get(linha.itemCode);
    return {
      compositionCode: linha.compositionCode,
      itemType: linha.itemType,
      fonte: linha.fonte,
      itemCode: linha.itemCode,
      descricao: referencia?.descricao || `Item ${linha.fonte} ${linha.itemCode} (ver base ${linha.fonte})`,
      unidade: referencia?.unidade || "UN",
      coeficiente: linha.coeficiente,
      precoUnit: linha.valorSem,
    };
  });

  return { itens, insumos, componentes, dataBase: competenciaServico || competenciaInsumo || "" };
}

// O CEHOP entrega 7 arquivos (nomeados TB_<TABELA> .TXT); o administrador
// seleciona todos de uma vez e este classificador encaixa cada um no
// slot certo pelo nome, na ordem mais específica primeiro. Os dois
// arquivos de detalhamento de equipamento ficam fora desta versão do
// motor - reconhecidos aqui só para serem ignorados de propósito, não
// por engano. Vive neste módulo (não em orse-import.js) porque é puro,
// sem Worker - importar direto não força o bundle a incluir o motor
// inteiro fora do chunk dinâmico do worker.
export function classificarArquivoOrse(nomeArquivo) {
  const nome = String(nomeArquivo || "").toUpperCase();
  if (nome.includes("EQUIPAMENTO")) return null;
  if (nome.includes("SERVICO") && nome.includes("PRECO")) return "servicoPreco";
  if (nome.includes("SERVICO")) return "servico";
  if (nome.includes("INSUMO") && nome.includes("PRECO")) return "insumoPreco";
  if (nome.includes("INSUMO")) return "insumo";
  if (nome.includes("COMPOSICAO")) return "composicao";
  return null;
}
