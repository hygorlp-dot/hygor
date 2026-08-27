// Memória de cálculo estrutural - quantitativos por pavimento, editáveis,
// que servem de referência para conferir as quantidades lançadas no
// orçamento (painel de referência - não escreve no orçamento sozinho,
// decisão tomada com o usuário nesta rodada). Começa pela Fundação
// (sapatas), agrupadas por tipo repetido - mesma convenção que o próprio
// projeto estrutural já usa (ex.: "P1, P4, P5, P6, P10, P11 e P14"
// compartilham uma única sapata 85x100).

// Massa nominal por metro linear (kg/m) de barra de aço CA-50/CA-60,
// bitolas usuais em armadura de sapata/viga no Brasil (NBR 7480 - massa =
// área da seção nominal x densidade do aço, 7850 kg/m3).
export const PESO_ACO_KG_M = {
  "4.2": 0.109, "5": 0.154, "6.3": 0.245, "8": 0.395,
  "10": 0.617, "12.5": 0.963, "16": 1.578, "20": 2.466, "25": 3.853,
};

export const BITOLAS_ACO = Object.keys(PESO_ACO_KG_M).sort((a, b) => Number(a) - Number(b));

export const pesoUnitarioAco = bitola => PESO_ACO_KG_M[String(bitola).replace(",", ".")] || 0;

// 10% de perda fixo, mesma convenção do "peso+10%" que já aparece pronta no
// projeto estrutural (resumo de aço por bitola).
const PERDA_ACO = 0.10;

// Folga padrão de escavação: quanto a cova é maior que a sapata em cada
// lado (não é decisão do projeto estrutural, é convenção de execução da
// obra - por isso é editável por tipo, com este valor só como ponto de
// partida). Profundidade também parte de um padrão (1,5m) pelo mesmo
// motivo - ambos ajustáveis livremente por sapata.
export const FOLGA_ESCAVACAO_PADRAO_M = 0.20;
export const PROFUNDIDADE_ESCAVACAO_PADRAO_M = 1.5;

export function novaSapataTipo(extra = {}) {
  return {
    id: "", tipo: "", qtd: 1, precisaRevisar: false,
    largura: 0, comprimento: 0, alturaBase: 0, alturaTronco: 0,
    folgaEscavacao: FOLGA_ESCAVACAO_PADRAO_M, profundidadeEscavacao: PROFUNDIDADE_ESCAVACAO_PADRAO_M,
    armaduraX: { bitola: "10", quantidade: 0, comprimento: 0 },
    armaduraY: { bitola: "10", quantidade: 0, comprimento: 0 },
    ...extra,
  };
}

// Todos os campos "Unit" são por UMA peça; os "Total" já multiplicam pela
// quantidade de peças do tipo (tipoRow.qtd).
export function calcularSapataTipo(tipoRow) {
  const largura = Number(tipoRow?.largura || 0);
  const comprimento = Number(tipoRow?.comprimento || 0);
  const alturaBase = Number(tipoRow?.alturaBase || 0);
  const alturaTronco = Number(tipoRow?.alturaTronco || 0);
  const qtd = Math.max(0, Number(tipoRow?.qtd || 0));
  const folga = Number(tipoRow?.folgaEscavacao || 0);
  const profundidade = Number(tipoRow?.profundidadeEscavacao || 0);

  // A cova é a sapata + a folga de trabalho de cada lado (2x a folga por
  // dimensão) - convenção de obra confirmada com o usuário, não algo que o
  // projeto estrutural diz.
  const larguraEscavacaoUnit = largura > 0 ? largura + 2 * folga : 0;
  const comprimentoEscavacaoUnit = comprimento > 0 ? comprimento + 2 * folga : 0;
  const volumeEscavacaoUnit = larguraEscavacaoUnit * comprimentoEscavacaoUnit * profundidade;
  const areaConcretoMagroUnit = largura * comprimento;
  const volumeBaseUnit = largura * comprimento * alturaBase;
  const volumeTroncoUnit = largura * comprimento * alturaTronco;
  const volumeSapataUnit = volumeBaseUnit + volumeTroncoUnit;
  // Achado da crítica Impeccable (27/08/2026): zerar o reaterro negativo
  // escondia silenciosamente uma inconsistência geométrica real (a sapata
  // não cabe na própria cova) - agora fica marcada para a tela avisar.
  const escavacaoInsuficiente = volumeSapataUnit > 0 && volumeEscavacaoUnit < volumeSapataUnit;
  const reaterroUnit = Math.max(0, volumeEscavacaoUnit - volumeSapataUnit);
  // Fôrmas = perímetro da base x altura da base (convenção confirmada com o
  // usuário) - só a base leva fôrma; o tronco fica coberto pela cova.
  const formaAreaUnit = 2 * (largura + comprimento) * alturaBase;

  const pesoArmadura = direcao => pesoUnitarioAco(direcao?.bitola) * Number(direcao?.quantidade || 0) * Number(direcao?.comprimento || 0) * (1 + PERDA_ACO);
  const pesoXUnit = pesoArmadura(tipoRow?.armaduraX);
  const pesoYUnit = pesoArmadura(tipoRow?.armaduraY);

  return {
    larguraEscavacaoUnit, comprimentoEscavacaoUnit,
    volumeEscavacaoUnit, areaConcretoMagroUnit, volumeBaseUnit, volumeTroncoUnit, volumeSapataUnit, reaterroUnit, formaAreaUnit,
    escavacaoInsuficiente,
    pesoXUnit, pesoYUnit, pesoAcoUnit: pesoXUnit + pesoYUnit,
    volumeEscavacaoTotal: volumeEscavacaoUnit * qtd,
    areaConcretoMagroTotal: areaConcretoMagroUnit * qtd,
    volumeBaseTotal: volumeBaseUnit * qtd,
    volumeTroncoTotal: volumeTroncoUnit * qtd,
    volumeSapataTotal: volumeSapataUnit * qtd,
    reaterroTotal: reaterroUnit * qtd,
    formaAreaTotal: formaAreaUnit * qtd,
    pesoXTotal: pesoXUnit * qtd,
    pesoYTotal: pesoYUnit * qtd,
    pesoAcoTotal: (pesoXUnit + pesoYUnit) * qtd,
  };
}

// Consolida todos os tipos de sapata da fundação: uma linha calculada por
// tipo, os totais gerais (mesmo formato da linha "TOTAIS" da planilha) e o
// resumo de aço por bitola (mesmo formato do "Resumo Aço" do projeto).
export function resumoSapatas(tipos) {
  const linhas = (tipos || []).map(tipo => ({ tipo, calc: calcularSapataTipo(tipo) }));
  const somar = campo => linhas.reduce((soma, linha) => soma + linha.calc[campo], 0);

  const porBitola = new Map();
  linhas.forEach(({ tipo, calc }) => {
    [[tipo?.armaduraX, calc.pesoXTotal], [tipo?.armaduraY, calc.pesoYTotal]].forEach(([direcao, peso]) => {
      if (!direcao || !(peso > 0)) return;
      const chave = String(direcao.bitola);
      porBitola.set(chave, (porBitola.get(chave) || 0) + peso);
    });
  });

  return {
    linhas,
    totais: {
      volumeEscavacao: somar("volumeEscavacaoTotal"),
      areaConcretoMagro: somar("areaConcretoMagroTotal"),
      volumeBase: somar("volumeBaseTotal"),
      volumeTronco: somar("volumeTroncoTotal"),
      volumeSapata: somar("volumeSapataTotal"),
      reaterro: somar("reaterroTotal"),
      formaArea: somar("formaAreaTotal"),
      pesoAco: somar("pesoAcoTotal"),
    },
    acoPorBitola: [...porBitola.entries()]
      .map(([bitola, kg]) => ({ bitola, kg }))
      .sort((a, b) => Number(a.bitola) - Number(b.bitola)),
  };
}

// Pilares (Térreo/1º Pavimento/Cobertura) não seguem o mesmo caminho de
// cálculo das sapatas: o próprio projeto estrutural já entrega concreto,
// fôrma e aço PRONTOS por pilar (detalhamento completo, incluindo taxa de
// aço real da armadura) - tentar re-derivar esses valores a partir só da
// seção (LxC) e da altura reintroduziria erro onde o projeto já é exato.
// Por isso aqui os três campos são diretamente editáveis (não fórmulas).
export function novaPilarTipo(extra = {}) {
  return {
    id: "", tipo: "", qtd: 1, precisaRevisar: false,
    // Pavimentos que este pilar atravessa (informativo - ex.: um pilar que
    // nasce na Fundação e só termina no 1º Pavimento aparece com
    // "Térreo, 1º Pavimento" e seu concreto/fôrma/aço já cobre o trecho
    // inteiro, não só o pavimento onde a linha está sendo editada).
    planta: "",
    concretoUnit: 0, formaUnit: 0, acoUnit: 0,
    ...extra,
  };
}

export function calcularPilarTipo(tipoRow) {
  const qtd = Math.max(0, Number(tipoRow?.qtd || 0));
  const concretoUnit = Number(tipoRow?.concretoUnit || 0);
  const formaUnit = Number(tipoRow?.formaUnit || 0);
  const acoUnit = Number(tipoRow?.acoUnit || 0);
  return {
    concretoTotal: concretoUnit * qtd,
    formaTotal: formaUnit * qtd,
    acoTotal: acoUnit * qtd,
  };
}

export function resumoPilares(tipos) {
  const linhas = (tipos || []).map(tipo => ({ tipo, calc: calcularPilarTipo(tipo) }));
  const somar = campo => linhas.reduce((soma, linha) => soma + linha.calc[campo], 0);
  return {
    linhas,
    totais: {
      concreto: somar("concretoTotal"),
      forma: somar("formaTotal"),
      aco: somar("acoTotal"),
    },
  };
}

// Vigas e lajes, diferente de sapatas/pilares, não têm um "tipo" repetido
// por pilar/elemento individual - o próprio projeto só entrega um total
// JÁ PRONTO por pavimento inteiro (ver extrairAcoVigasPavimento e
// extrairQuantitativosPavimentos em estrutural-pdf-extrator.js: o
// Estrutural.pdf detalha viga a viga mas não resume concreto/fôrma por
// viga, e o "Quantitativos de superfícies e volumes.pdf" resume por
// pavimento, não por viga/laje). Por isso são um objeto único por
// pavimento, sem lista de tipos nem soma - os campos JÁ SÃO o total.
export function novaVigaPavimento(extra = {}) {
  return {
    concretoM3: 0, formaM2: 0, acoKg: 0,
    // Achado real (Quantitativos de superfícies e volumes.pdf, 27/08/2026):
    // o próprio projeto às vezes avisa que não conseguiu calcular o volume
    // de vigas daquele pavimento com segurança - a tela precisa mostrar
    // esse aviso, nunca escondê-lo atrás de um número que parece confiável.
    avisoConcretoIncorreto: false,
    precisaRevisar: false,
    ...extra,
  };
}

export function novaLajePavimento(extra = {}) {
  return {
    volumeM3: 0, volumeMacicasM3: 0, volumeVigotasM3: 0, acoKg: 0,
    precisaRevisar: false,
    ...extra,
  };
}
