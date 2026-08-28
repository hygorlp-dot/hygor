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

// Pilares (Térreo/1º Pavimento/Cobertura), igual vigas/lajes: achado real,
// pedido direto do usuário (27/08/2026) depois de ver a tabela "um pilar
// por linha" em produção - "não preciso de pilar unitariamente... cruze
// as informações necessitadas do orçamento". Conferido contra o orçamento
// real: o SINAPI orça fôrma e concretagem de pilares como UMA composição
// por pavimento inteiro (ex.: "MONTAGEM E DESMONTAGEM DE FÔRMA DE
// PILARES", "CONCRETAGEM DE PILARES"), nunca por pilar - exatamente o
// mesmo formato que vigas/lajes já usavam. Um pilar tipo por linha existia
// só porque o Estrutural.pdf detalha assim, mas essa granularidade nunca
// era usada pelo orçamento - por isso virou um objeto único por
// pavimento, como novaVigaPavimento/novaLajePavimento (o array por tipo
// que o PDF entrega ainda existe no extrator, só que agora a extração
// SOMA os tipos direto na hora de aplicar, em vez de guardar cada um).
export function novaPilarPavimento(extra = {}) {
  return {
    concretoM3: 0, formaM2: 0, acoPorBitola: [],
    precisaRevisar: false,
    ...extra,
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
// Achado real (27/08/2026, pedido direto do usuário): aço precisa vir
// separado por bitola (cada bitola é um insumo/composição diferente no
// orçamento - CA-50 10mm e CA-50 12,5mm são duas linhas SINAPI distintas,
// não uma só) - por isso `acoPorBitola` é uma lista `{bitola,kg}`, não um
// número só. Vem do "Resumo Aço" da própria folha (ver `extrairResumoAco`
// em estrutural-pdf-extrator.js) - não tem como derivar por bitola a
// partir de concreto/fôrma, então é sempre editável/importado à parte.
export function novaVigaPavimento(extra = {}) {
  return {
    concretoM3: 0, formaM2: 0, acoPorBitola: [],
    // Achado real (Quantitativos de superfícies e volumes.pdf, 27/08/2026):
    // o próprio projeto às vezes avisa que não conseguiu calcular o volume
    // de vigas daquele pavimento com segurança - a tela precisa mostrar
    // esse aviso, nunca escondê-lo atrás de um número que parece confiável.
    avisoConcretoIncorreto: false,
    // Achado real (27/08/2026, pedido direto do usuário): a viga
    // baldrame/Térreo assenta sobre um lastro de concreto magro (igual às
    // sapatas) - só que o magro corre pelo COMPRIMENTO da viga, não pela
    // área da peça. Área do magro = comprimento total x (largura da viga +
    // 2x a largura acrescida de cada lado) - mesma lógica de folga que a
    // escavação das sapatas já usa. Só usado no Térreo (só lá a viga toca
    // o solo); nos outros pavimentos fica zerado e sem efeito.
    //
    // Comprimento não é digitado à mão: o usuário percebeu (28/08/2026) que
    // já temos a área em PLANTA das vigas pronta do Quantitativos.pdf
    // (`areaPlantaVigasM2` - vista de cima, comprimento x largura da viga,
    // diferente da "Superfície lateral" que já virava `formaM2`) - dividir
    // essa área pela largura da viga já dá o comprimento total, sem
    // precisar de outro campo manual. Só a largura e o acréscimo continuam
    // sendo pedidos ao usuário.
    areaPlantaVigasM2: 0, larguraVigaM: 0, magroLarguraAcrescidaM: 0,
    precisaRevisar: false,
    ...extra,
  };
}

export function calcularConcretoMagroViga(viga) {
  const areaPlanta = Number(viga?.areaPlantaVigasM2 || 0);
  const largura = Number(viga?.larguraVigaM || 0);
  const acrescimo = Number(viga?.magroLarguraAcrescidaM || 0);
  if (!areaPlanta || !largura) return 0;
  const comprimento = areaPlanta / largura;
  return comprimento * (largura + 2 * acrescimo);
}

// Peso nominal (kg/m²) de tela soldada nervurada CA-60, por bitola de malha
// (NBR 7481) - valores usuais de catálogo de fabricante (Gerdau/ArcelorMittal).
// Ponto de partida editável, não um valor travado: cada fornecedor pode
// arredondar ligeiramente diferente, então o campo na tela sempre permite
// corrigir para o que a nota fiscal/catálogo do fornecedor realmente traz.
export const PESO_TELA_SOLDADA_KG_M2 = {
  "Q-61": 0.96, "Q-75": 1.21, "Q-92": 1.45, "Q-113": 1.79,
  "Q-138": 2.19, "Q-159": 2.51, "Q-196": 3.09, "Q-246": 3.78,
  "Q-283": 4.48, "Q-335": 5.30, "Q-386": 6.10, "Q-450": 7.10,
  "Q-503": 7.95, "Q-636": 10.05,
};
export const MALHAS_TELA_SOLDADA = Object.keys(PESO_TELA_SOLDADA_KG_M2);

export function novaLajePavimento(extra = {}) {
  return {
    volumeM3: 0, volumeMacicasM3: 0, volumeVigotasM3: 0, acoPorBitola: [],
    // Área é separada do volume porque o aço da vigota não vem de
    // armadura por bitola (a treliça pré-moldada não entra no Resumo Aço
    // do projeto) - vem da tela soldada lançada sobre a vigota, calculada
    // por área x peso/m² da malha (achado do usuário, 28/08/2026: "não
    // contabilize aço de lajes de vigotas [na lista por bitola]... calcule
    // o peso por área").
    areaMacicaM2: 0, areaVigotaM2: 0,
    malhaVigota: "Q-61", pesoMalhaVigotaKgM2: PESO_TELA_SOLDADA_KG_M2["Q-61"],
    precisaRevisar: false,
    ...extra,
  };
}

// Soma simples de uma lista {bitola,kg} - usado nos cartões de vigas/laje
// e no resumo de pilares para mostrar o total ao lado do detalhamento por
// bitola, sem duplicar essa conta em cada lugar que precisa dela.
export const somaAcoPorBitola = lista => (lista || []).reduce((soma, item) => soma + Number(item?.kg || 0), 0);

// Aço da vigota = área da vigota x peso/m² da malha escolhida - nunca soma
// com acoPorBitola (esse é só da maciça, que tem armadura de verdade
// detalhada no projeto).
export const calcularAcoVigotaLaje = laje =>
  Number(laje?.areaVigotaM2 || 0) * Number(laje?.pesoMalhaVigotaKgM2 || 0);
