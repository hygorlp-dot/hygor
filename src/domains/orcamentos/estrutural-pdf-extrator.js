// Extrai sapatas da Fundação a partir do texto puro de um projeto estrutural
// em PDF (mesmo gerador usado pelo usuário - confirmado em campo real,
// Estrutural.pdf, folha E-02/13: "QUADRO DE ELEMENTOS DE FUNDAÇÃO"). O texto
// já deve vir extraído (ex.: pdfjs-dist, no navegador) - este módulo é puro,
// sem nenhuma dependência de PDF, para ficar testável com uma string comum.
//
// O símbolo de diâmetro (∅) do desenho original não sobrevive à extração de
// texto do PDF - vira um caractere de substituição diferente conforme a
// biblioteca usada (confirmado: poppler devolve U+FFFD; pdfjs-dist pode
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
const linhasNaoVazias = texto => String(texto || "").split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);

// Lê UM bloco "Resumo Aço" (a partir da linha em que ele começa) - Ø10:
// 164kg, Ø12.5: 14kg, Total: 178kg - um total pronto pelo próprio projeto,
// útil como conferência (bate o total somado por tipo em
// memoria-calculo-estrutural.js contra este número) e, agora, como a
// própria fonte do aço por bitola de pilares/vigas/lajes (que não têm um
// jeito confiável de recalcular por elemento - só o resumo da folha
// inteira dá isso pronto).
//
// Achado real (27/08/2026): a extração de produção (pdfjs-dist, "um item
// de texto do PDF por linha" - ver ler-estrutural-pdf.js) NÃO junta as
// bitolas numa linha só como os fixtures antigos (estilo poppler)
// assumiam - cada bitola vira sua própria linha, seguida da linha de
// comprimento e da linha de peso, cada uma separada. Essa função ficava
// silenciosamente quebrada (sempre null) contra o texto real - confirmado
// rodando contra as 8 folhas reais de resumo do Estrutural.pdf do usuário
// (Fundação, Pilares x3, Vigas x3, Laje x2 blocos por página) antes de
// reescrever. A nova leitura é por posição: para cada linha "Ø<bitola>",
// as duas linhas seguintes são comprimento e peso - funciona mesmo com um
// número extra de subtotal sobrando depois (o comprimento/peso da PRÓXIMA
// bitola nunca é lido a partir desse subtotal, só das duas linhas logo
// após o próprio "Ø<bitola>").
//
// O total geral aparece de duas formas diferentes conforme a folha (ambas
// confirmadas em campo): "<total> Total" (Fundação/sapatas, só uma vez) ou
// "Total <total> Total" (Pilares/Vigas/Laje, sanduichado) - checa a forma
// mais específica (sanduichada) primeiro.
function lerUmBlocoResumoAco(linhas, inicioResumo) {
  const inicioTotal = linhas.findIndex((l, i) => i > inicioResumo && l === "Total");
  let totalKg = null, fim = linhas.length;
  if (inicioTotal > -1) {
    if (/^[\d.,]+$/.test(linhas[inicioTotal + 1] || "") && linhas[inicioTotal + 2] === "Total") {
      totalKg = paraNumero(linhas[inicioTotal + 1]); fim = inicioTotal + 3;
    } else if (/^[\d.,]+$/.test(linhas[inicioTotal - 1] || "")) {
      totalKg = paraNumero(linhas[inicioTotal - 1]); fim = inicioTotal + 1;
    }
  }
  const bloco = linhas.slice(inicioResumo, fim);
  const porBitola = [];
  for (let i = 0; i < bloco.length; i++) {
    const bitola = /^Ø(\d+(?:[.,]\d+)?)$/.exec(bloco[i])?.[1];
    if (!bitola) continue;
    const comprimento = bloco[i + 1], peso = bloco[i + 2];
    if (!/^[\d.,]+$/.test(comprimento || "") || !/^[\d.,]+$/.test(peso || "")) continue;
    porBitola.push({ bitola: bitola.replace(",", "."), comprimentoM: paraNumero(comprimento), pesoKg: paraNumero(peso) });
  }
  return { porBitola, totalKg, fim };
}

// Uma folha pode ter mais de um "Resumo Aço" (laje: um pra armadura
// transversal, outro pra longitudinal) - soma todos os blocos encontrados
// por bitola e no total geral.
export function extrairResumoAco(texto) {
  const linhas = linhasNaoVazias(texto);
  const porBitola = new Map();
  let totalKg = 0, encontrouAlgum = false, cursor = 0;
  while (true) {
    const inicioResumo = linhas.findIndex((l, i) => i >= cursor && /Resumo A.o/i.test(l));
    if (inicioResumo === -1) break;
    encontrouAlgum = true;
    const bloco = lerUmBlocoResumoAco(linhas, inicioResumo);
    bloco.porBitola.forEach(({ bitola, pesoKg }) => porBitola.set(bitola, (porBitola.get(bitola) || 0) + pesoKg));
    if (bloco.totalKg) totalKg += bloco.totalKg;
    cursor = bloco.fim;
  }
  if (!encontrouAlgum) return null;
  return {
    porBitola: [...porBitola.entries()].map(([bitola, pesoKg]) => ({ bitola, pesoKg })).sort((a, b) => Number(a.bitola) - Number(b.bitola)),
    totalKg,
  };
}

// Conta quantos pilares uma string de referência representa
// ("P1, P4, P5, P6, P10, P11 e P14" -> 7), para virar a quantidade de peças
// do tipo.
export function contarPilares(referencia) {
  return (String(referencia).match(/P\d+/g) || []).length;
}

// Lê o "QUADRO DE ELEMENTOS DE FUNDAÇÃO": um grupo de 5 linhas se repete -
// referência, dimensões (LxC), altura (base/tronco), armadura X, armadura Y.
// Para de ler no primeiro grupo que não fechar as 5 linhas esperadas (fim da
// tabela / início da próxima seção do desenho). Devolve também o texto que
// vem DEPOIS da tabela (o desenho em si) - é lá que cada sapata individual
// tem sua própria anotação de barra com o comprimento, que o quadro não tem.
function lerQuadroComRestante(texto) {
  const linhas = linhasNaoVazias(texto);
  const inicio = linhas.findIndex(l => /QUADRO DE ELEMENTOS DE FUNDA/i.test(l));
  if (inicio === -1) return { grupos: [], textoRestante: "" };
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
  return { grupos, textoRestante: linhas.slice(i).join("\n") };
}

export function extrairQuadroSapatas(texto) {
  return lerQuadroComRestante(texto).grupos;
}

// Cada barra desenhada individualmente traz seu próprio comprimento (ex.:
// "4N17∅10c/25 C=123"). O quadro não tem comprimento - só bitola/espaçamento/
// quantidade.
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

// Onde a referência de um grupo (ou qualquer pilar dela) reaparece no
// desenho, depois do quadro - o desenho às vezes repete o grupo inteiro
// ("P1, P4, P5, P6, P10, P11 e P14"), às vezes rotula só um pilar sozinho
// ("P18"), às vezes um par adjacente ("P7 e P8"). Qualquer um serve de
// âncora - a mais próxima do início do texto restante.
function posicaoAncora(textoRestante, referencia) {
  const candidatos = [referencia, ...(referencia.match(/P\d+/g) || [])];
  let melhor = -1;
  for (const candidato of candidatos) {
    const escapado = candidato.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\b${escapado}\\b`).exec(textoRestante);
    if (match && (melhor === -1 || match.index < melhor)) melhor = match.index;
  }
  return melhor;
}

// Para cada grupo, a janela de texto que "pertence" a ele vai da sua própria
// âncora até a âncora do próximo grupo (em ordem de aparição no desenho, não
// na ordem do quadro) - assim as anotações de um pilar não vazam para o
// grupo vizinho. Dentro da janela, a PRIMEIRA anotação encontrada é a
// armadura X e a segunda é a armadura Y (mesma ordem em que o quadro lista
// X antes de Y) - validado em campo contra várias sapatas reais do projeto
// do usuário (P12, P17, P18, P7/P8), inclusive um caso em que a mesma
// especificação (bitola+quantidade+espaçamento) se repete em sapatas de
// tamanhos diferentes com comprimentos realmente diferentes - a âncora por
// posição resolve isso corretamente onde uma correlação só por
// especificação (ambígua) teria que desistir.
function anotacoesPorGrupo(grupos, textoRestante) {
  const ancoras = grupos
    .map(grupo => ({ referencia: grupo.referencia, posicao: posicaoAncora(textoRestante, grupo.referencia) }))
    .filter(a => a.posicao >= 0)
    .sort((a, b) => a.posicao - b.posicao);

  const porReferencia = new Map();
  ancoras.forEach((ancora, indice) => {
    const fim = indice + 1 < ancoras.length ? ancoras[indice + 1].posicao : textoRestante.length;
    const trecho = textoRestante.slice(ancora.posicao, fim);
    porReferencia.set(ancora.referencia, extrairAnotacoesPosicao(trecho));
  });
  return porReferencia;
}

// Junta o quadro + as anotações de barra num array pronto para
// `novaSapataTipo` (memoria-calculo-estrutural.js): tipo (rótulo = a própria
// referência), qtd (nº de pilares), dimensões em metro, e armadura X/Y com
// comprimento resolvido pela âncora de posição (ou 0 se o grupo não foi
// encontrado desenhado em separado em algum lugar do texto).
export function extrairSapatasFundacao(texto) {
  const { grupos, textoRestante } = lerQuadroComRestante(texto);
  const porGrupo = anotacoesPorGrupo(grupos, textoRestante);

  return grupos.map(grupo => {
    const anotacoes = porGrupo.get(grupo.referencia) || [];
    const comprimento = indice => (anotacoes[indice] ? anotacoes[indice].comprimentoCm / 100 : 0);
    return {
      tipo: grupo.referencia,
      qtd: contarPilares(grupo.referencia),
      largura: grupo.larguraCm / 100,
      comprimento: grupo.comprimentoCm / 100,
      alturaBase: grupo.alturaBaseCm / 100,
      alturaTronco: grupo.alturaTroncoCm / 100,
  armaduraX: { bitola: String(grupo.armaduraX.bitola), quantidade: grupo.armaduraX.quantidade, comprimento: comprimento(0) },
      armaduraY: { bitola: String(grupo.armaduraY.bitola), quantidade: grupo.armaduraY.quantidade, comprimento: comprimento(1) },
    };
  });
}

// Cada folha "Pilares do <pavimento>" traz, para cada pilar (ou grupo de
// pilares idênticos, ex.: "P1=P3=P4=P5=P6=P9=P11=P21=P22"), um bloco de
// detalhamento que já termina com o resumo pronto do próprio projeto:
// "Aço: CA-50 e CA-60 (X kg). Taxa: Y kg/m3   Planta: <pavimentos>
// Concreto: C25, usina.rigor (Z m3) ... Fôrmas: W m2" - concreto/fôrma/aço
// aqui são valores JÁ CALCULADOS pelo projeto (não uma fórmula L x C x
// altura que este módulo teria que re-derivar), validado campo a campo
// contra os três pavimentos reais do usuário (Térreo, 1º Pavimento,
// Cobertura - 15/14/14 grupos encontrados, batendo com a contagem "(x9)"
// etc. da tabela de armadura da mesma folha).
//
// O campo "Planta" pode ser o próprio nome de um pavimento sozinho
// ("Cobertura") - por isso o terminador do valor de Planta não pode ser
// "primeiro caractere que não seja C" (quebra exatamente quando o valor É
// "Cobertura"); em vez disso o corte usa a âncora fixa "Concreto: C25" que
// sempre segue o campo Planta no documento.
const RE_DETALHE_PILAR = /(P\d+(?:=P\d+)*)\s+(?:Fundação|Térreo|1º Pavimento|Cobertura)[\s\S]{0,900}?Aço:\s*CA-50 e CA-60\s*\(([\d.,]+)\s*kg\)\.\s*Taxa:\s*[\d.,]+\s*kg\/m3\s+Planta:\s*(.+?)\s*Concreto:\s*C25[\s\S]{0,40}?\(([\d.,]+)\s*m3\)[\s\S]{0,80}?Fôrmas:\s*([\d.,]+)\s*m2/g;

// Junta os blocos de detalhamento num array pronto para `novaPilarTipo`
// (memoria-calculo-estrutural.js): tipo (rótulo = a referência), qtd (nº de
// pilares do grupo), e concreto/fôrma/aço JÁ POR PILAR (unitário) - o
// projeto imprime um único bloco de detalhamento por grupo de pilares
// idênticos, e esse bloco descreve UM pilar típico do grupo (confirmado
// comparando "P10" sozinho com "P1=P3=...=P22" - mesma seção, os dois
// blocos trazem exatamente os mesmos 0.07 m3/1.35 m2/1.6 kg, não um valor 9x
// maior para o grupo de 9). Multiplicar por qtd fica a cargo de
// `calcularPilarTipo`, igual às sapatas.
export function extrairPilares(texto) {
  const resultado = [];
  const re = new RegExp(RE_DETALHE_PILAR.source, "g");
  let m;
  while ((m = re.exec(String(texto || "")))) {
    const [, referencia, acoKg, planta, concretoM3, formaM2] = m;
    const qtd = contarPilares(referencia);
    if (!qtd) continue;
    resultado.push({
      tipo: referencia,
      qtd,
      planta: planta.trim(),
concretoUnit: paraNumero(concretoM3),
      formaUnit: paraNumero(formaM2),
      acoUnit: paraNumero(acoKg),
    });
  }
  return resultado;
}

// Segunda fonte, INDEPENDENTE, do aço de vigas: soma os dois números que
// terminam CADA bloco individual de viga (ex.: "69.6   9.6 Total+10%:" =
// 69.6kg de CA-50 e 9.6kg de CA-60 daquela viga), sem depender do "Resumo
// Aço" da folha inteira. Só dá CA-50/CA-60 (não por bitola) - para o
// detalhe por bitola use `extrairResumoAco` (agora corrigido para ler o
// resumo da folha certo, ver seu comentário). Mantida como conferência
// cruzada independente (mesmo espírito do "pdfResumoAco" das sapatas):
// os dois totais devem bater; se não baterem, algo na extração ficou
// incompleto. Validado contra a folha real "Vigas do 1º Pavimento"
// (E-08/13): 28 blocos somam 781.5kg CA-50 e 155.5kg CA-60, batendo
// (dentro de arredondamento) com o "Total 937" do resumo da própria folha.
const RE_TOTAL_VIGA = /([\d.,]+)\s+([\d.,]+)\s*Total\+10%:/g;

export function extrairAcoVigasPavimento(texto) {
  const re = new RegExp(RE_TOTAL_VIGA.source, "g");
  let m, ca50Kg = 0, ca60Kg = 0;
  while ((m = re.exec(String(texto || "")))) {
    ca50Kg += paraNumero(m[1]);
    ca60Kg += paraNumero(m[2]);
  }
  return { ca50Kg, ca60Kg, totalKg: ca50Kg + ca60Kg };
}

// O PDF "Quantitativos de superfícies e volumes" (gerado à parte pelo
// mesmo software CAD) já entrega, por pavimento, o concreto e a fôrma
// (área lateral) das vigas, e o volume de laje - totais prontos que o
// Estrutural.pdf sozinho não dá pra vigas/lajes (só dá o desenho
// detalhado, sem um resumo volumétrico por elemento). Exclui de propósito
// a Fundação ("Não medidos: Elementos de fundação", primeira linha do
// PDF) - por isso não tenta ler nada de sapata aqui.
//
// O próprio PDF avisa, só para alguns grupos, que o volume de vigas pode
// estar errado ("Valor incorreto do volume de vigas por não dispor dos
// dados necessários...") - `avisoConcretoIncorreto` carrega esse aviso
// para a tela mostrar, nunca escondido.
export function extrairQuantitativosPavimentos(texto) {
  const t = String(texto || "");
  const marcadores = [...t.matchAll(/Grupo de Pisos Número \d+:\s*(.+?)\s*Número Pisos Iguais/g)]
    .map(m => ({ nome: m[1].trim(), inicio: m.index }));
  const fimGeral = t.search(/Resumo total obra/);
  return marcadores.map((grupo, i) => {
    const fim = i + 1 < marcadores.length ? marcadores[i + 1].inicio : (fimGeral > -1 ? fimGeral : t.length);
    const bloco = t.slice(grupo.inicio, fim);
    const num = re => { const m = re.exec(bloco); return m ? paraNumero(m[1]) : null; };
    return {
      pavimento: grupo.nome,
      concretoVigasM3: num(/Concreto total em vigas:\s*([\d.,]+)\s*m3/),
      formaVigasM2: num(/Superfície lateral de vigas, vigas de borda e cortinas:\s*([\d.,]+)\s*m2/),
      // Área em PLANTA (vista de cima) = comprimento total x largura da
      // viga - dá pra derivar o comprimento total das vigas sem precisar
      // perguntar (achado real, 28/08/2026: usuário percebeu que já
      // tínhamos esse dado pronto, só faltava extrair). Diferente da
      // "Superfície lateral" acima (essa é comprimento x altura x 2 lados).
      areaPlantaVigasM2: num(/Superfície em planta de vigas, vigas de borda e cortinas:\s*([\d.,]+)\s*m2/),
      avisoConcretoIncorreto: /Valor incorreto do volume de vigas/.test(bloco),
      volumeLajesM3: num(/Volume total lajes:\s*([\d.,]+)\s*m3/),
      lajeMacicasM3: num(/Volume total lajes:[\s\S]*?Maci[çc]as:\s*([\d.,]+)\s*m3/),
      lajeVigotasM3: num(/Volume total lajes:[\s\S]*?Vigotas:\s*([\d.,]+)\s*m3/),
      // A ÁREA de maciça/vigota (m2) vem ANTES da parte de vigas do mesmo
      // bloco, logo depois de "Superfície total pavto" - texto igual ao do
      // volume ("Maciças"/"Vigotas"), mas em m2 em vez de m3, então a
      // unidade no regex é o que evita pegar o par errado (achado do
      // usuário, 28/08/2026: "não está sendo preenchida as áreas das
      // lajes" - a área nunca tinha sido extraída, só o volume).
      areaMacicaLajeM2: num(/Superfície total pavto:[\s\S]*?Maci[çc]as:\s*([\d.,]+)\s*m2/),
      areaVigotaLajeM2: num(/Superfície total pavto:[\s\S]*?Vigotas:\s*([\d.,]+)\s*m2/),
    };
  });
}

// Chave interna do app (mesma de `pavimentoMemoria` em OrcamentoView.jsx)
// para cada nome de pavimento como aparece nos dois PDFs.
export const CHAVE_PAVIMENTO = { "Térreo": "terreo", "1º Pavimento": "pavimento1", "Cobertura": "cobertura" };

// O Estrutural.pdf inteiro (lerTextoPdf) junta as páginas com "\f" (mesmo
// separador que o próprio pdf.js usa por página) - cada folha "Pilares do
// <pavimento>"/"Vigas do <pavimento>" só existe em UMA página, então
// dividir por página e rotear pelo título da própria folha (em vez de
// tentar ler o documento inteiro de uma vez, ou assumir um número de
// página fixo) funciona pra qualquer PDF gerado pelo mesmo software,
// mesmo que a ordem das folhas mude de um projeto pro outro.
const MARCADORES_PAGINA = [
  { chave: "pilares", pavimento: "terreo", re: /Pilares do Térreo/i },
  { chave: "pilares", pavimento: "pavimento1", re: /Pilares do 1º Pavimento/i },
  { chave: "pilares", pavimento: "cobertura", re: /Pilares da Cobertura/i },
  { chave: "vigas", pavimento: "terreo", re: /Vigas do Térreo/i },
  { chave: "vigas", pavimento: "pavimento1", re: /Vigas do 1º Pavimento/i },
  { chave: "vigas", pavimento: "cobertura", re: /Vigas da Cobertura/i },
  { chave: "lajes", pavimento: "pavimento1", re: /Lajes do 1º Pavimento/i },
  { chave: "lajes", pavimento: "cobertura", re: /Lajes da Cobertura/i },
];

const pavimentosVazios = () => ({ terreo: null, pavimento1: null, cobertura: null });

// Lê o Estrutural.pdf inteiro e devolve, por pavimento: pilares (lista por
// tipo, com concreto/fôrma/aço já prontos do projeto), e o aço por bitola
// de pilares/vigas/lajes (`extrairResumoAco`, lido do "Resumo Aço" de cada
// folha - é a única fonte confiável de aço por bitola para vigas/lajes,
// já que elas não têm um detalhamento por elemento como os pilares).
// Vigas também levam um segundo total (`vigasAcoCruzado`), independente,
// só para conferência (ver `extrairAcoVigasPavimento`).
export function extrairElementosEstruturais(textoCompleto) {
  const paginas = String(textoCompleto || "").split("\f");
  const resultado = {
    pilares: { terreo: [], pavimento1: [], cobertura: [] },
    pilaresAcoPorBitola: pavimentosVazios(),
    vigasAcoPorBitola: pavimentosVazios(),
    vigasAcoCruzado: pavimentosVazios(),
    lajesAcoPorBitola: pavimentosVazios(),
  };
  for (const pagina of paginas) {
    const marcador = MARCADORES_PAGINA.find(m => m.re.test(pagina));
    if (!marcador) continue;
    if (marcador.chave === "pilares") {
      resultado.pilares[marcador.pavimento] = extrairPilares(pagina);
      resultado.pilaresAcoPorBitola[marcador.pavimento] = extrairResumoAco(pagina);
    } else if (marcador.chave === "vigas") {
      resultado.vigasAcoPorBitola[marcador.pavimento] = extrairResumoAco(pagina);
      resultado.vigasAcoCruzado[marcador.pavimento] = extrairAcoVigasPavimento(pagina);
    } else {
      resultado.lajesAcoPorBitola[marcador.pavimento] = extrairResumoAco(pagina);
    }
  }
  return resultado;
}
