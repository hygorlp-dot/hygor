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
const FOLGA_ESCAVACAO_PADRAO_M = 0.20;
const PROFUNDIDADE_ESCAVACAO_PADRAO_M = 1.5;

export function novaSapataTipo(extra = {}) {
  return {
    id: "", tipo: "", qtd: 1,
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
