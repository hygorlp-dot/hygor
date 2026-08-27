// Extrai sapatas da Fundação a partir do texto puro de um projeto estrutural
// em PDF (mesmo gerador usado pelo usuário - confirmado em campo real,
// Estrutural.pdf, folha E-02/13: "QUADRO DE ELEMENTOS DE FUNDAÇÃO"). O texto
// já deve vir extraído (ex.: `pdf-parse`, no servidor) - este módulo é puro,
// sem nenhuma dependência de PDF, para ficar testável com uma string comum.
//
// O símbolo de diâmetro (∅) do desenho original não sobrevive à extração de
// texto do PDF - vira um caractere de substituição diferente conforme a
// biblioteca usada (confirmado: poppler devolve U+FFFD; pdf-parse/pdfjs pode
// devolver outro). Por isso nenhum regex aqui trava nesse caractere - todos
// tratam a posição do símbolo como "0 a 2 caracteres quaisquer".

const RE_REFERENCIA = /^P\d+(?:\s*,\s*P\d+)*(?:\s*e\s*P\d+)?$/;
const RE_DIMENSOES = /^(\d+)x(\d+)$/;
const RE_ALTURA = /^(\d+)\s*\/\s*(\d+)$/;
const RE_ARMADURA_QUADRO = /^(\d+)\D{0,2}(\d+(?:[.,]\d+)?)c\/(\d+(?:[.,]\d+)?)$/;
// Anotação de uma barra específica no desenho, ex.: "4N17∅10c/25 C=123" ou
// "43N3∅5c/20 C=60-70" (comprimento em faixa - vira a média das duas pontas).
const RE_ANOTACAO_POSICAO = /(\d+)N(\d+)\D{0,2}(\d+(?:[.,]\d+)?)c\/(\d+(?:[.,]\d+)?)\s*C=(\d+)(?:-(\d+))?/g;

const paraNumero = texto => Number(String(texto).replace(",", "."));

// Conta quantos pilares uma string de referência representa
// ("P1, P4, P5, P6, P10, P11 e P14" -> 7), para virar a quantidade de peças
// do tipo.
export function contarPilares(referencia) {
  return (String(referencia).match(/P\d+/g) || []).length;
}

// Lê o "QUADRO DE ELEMENTOS DE FUNDAÇÃO": um grupo de 5 linhas se repete -
// referência, dimensões (LxC), altura (base/tronco), armadura X, armadura Y.
// Para de ler no primeiro grupo que não fechar as 5 linhas esperadas (fim da
// tabela / início da próxima seção do desenho).
export function extrairQuadroSapatas(texto) {
  const linhas = String(texto || "").split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
  const inicio = linhas.findIndex(l => /QUADRO DE ELEMENTOS DE FUNDA/i.test(l));
  if (inicio === -1) return [];
  let i = inicio + 1;
  while (i < linhas.length && !RE_REFERENCIA.test(linhas[i])) i++;

  const grupos = [];
  while (i + 4 < linhas.length) {
    const [referencia, dimensoes, altura, armX, armY] = linhas.slice(i, i + 5);
    const dimMatch = RE_DIMENSOES.exec(dimensoes);
    const altMatch = RE_ALTURA.exec(altura);
    const armXMatch = RE_ARMADURA_QUADRO.exec(armX);
    const armYMatch = RE_ARMADURA_QUADRO.exec(armY);
    if (!RE_REFERENCIA.test(referencia) || !dimMatch || !altMatch || !armXMatch || !armYMatch) break;
    grupos.push({
      referencia,
      larguraCm: Number(dimMatch[1]), comprimentoCm: Number(dimMatch[2]),
      alturaBaseCm: Number(altMatch[1]), alturaTroncoCm: Number(altMatch[2]),
      armaduraX: { quantidade: Number(armXMatch[1]), bitola: paraNumero(armXMatch[2]), espacamento: Number(armXMatch[3]) },
      armaduraY: { quantidade: Number(armYMatch[1]), bitola: paraNumero(armYMatch[2]), espacamento: Number(armYMatch[3]) },
    });
    i += 5;
  }
  return grupos;
}

// Cada barra desenhada individualmente traz seu próprio comprimento (ex.:
// "4N17∅10c/25 C=123"). O quadro não tem comprimento - só bitola/espaçamento/
// quantidade. Cruza os dois: para cada direção (X ou Y) de um grupo, procura
// no documento inteiro uma anotação com a MESMA quantidade+bitola+espaçamento.
// Só usa o comprimento se todas as anotações encontradas concordarem no valor
// - essa combinação repete entre tipos diferentes (ex.: "4∅10c/25" é a
// armadura mínima e aparece em várias sapatas de tamanhos diferentes), e
// nunca é melhor arriscar um comprimento errado do que deixar em branco para
// completar à mão.
export function extrairAnotacoesPosicao(texto) {
  const resultado = [];
  const re = new RegExp(RE_ANOTACAO_POSICAO.source, "g");
  let m;
  while ((m = re.exec(String(texto || "")))) {
    const [, quantidade, posicao, bitola, espacamento, compA, compB] = m;
    resultado.push({
      quantidade: Number(quantidade), posicao: Number(posicao), bitola: paraNumero(bitola),
      espacamento: Number(espacamento),
      comprimentoCm: compB ? (Number(compA) + Number(compB)) / 2 : Number(compA),
    });
  }
  return resultado;
}

function comprimentoDaDirecao(direcao, anotacoes) {
  const candidatos = anotacoes.filter(a => a.quantidade === direcao.quantidade && a.bitola === direcao.bitola);
  if (!candidatos.length) return 0;
  const valores = new Set(candidatos.map(a => a.comprimentoCm));
  if (valores.size > 1) return 0; // ambíguo - várias barras diferentes com a mesma quantidade/bitola
  return candidatos[0].comprimentoCm / 100; // cm -> m
}

// Junta o quadro + as anotações de barra num array pronto para
// `novaSapataTipo` (memoria-calculo-estrutural.js): tipo (rótulo = a própria
// referência), qtd (nº de pilares), dimensões em metro, e armadura X/Y com
// comprimento já resolvido quando não for ambíguo.
export function extrairSapatasFundacao(texto) {
  const grupos = extrairQuadroSapatas(texto);
  const anotacoes = extrairAnotacoesPosicao(texto);
  return grupos.map(grupo => ({
    tipo: grupo.referencia,
    qtd: contarPilares(grupo.referencia),
    largura: grupo.larguraCm / 100,
    comprimento: grupo.comprimentoCm / 100,
    alturaBase: grupo.alturaBaseCm / 100,
    alturaTronco: grupo.alturaTroncoCm / 100,
    armaduraX: { bitola: String(grupo.armaduraX.bitola), quantidade: grupo.armaduraX.quantidade, comprimento: comprimentoDaDirecao(grupo.armaduraX, anotacoes) },
    armaduraY: { bitola: String(grupo.armaduraY.bitola), quantidade: grupo.armaduraY.quantidade, comprimento: comprimentoDaDirecao(grupo.armaduraY, anotacoes) },
  }));
}
