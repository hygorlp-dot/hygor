// Parâmetros de calibração do reconhecimento facial - TODOS num lugar só,
// para a homologação de campo ajustar e registrar sem caçar números pelo
// código. Valores atuais = os da primeira versão do app (out/2026), ainda
// NÃO homologados em campo. Mudar qualquer um muda a taxa de falso aceite /
// falsa rejeição: medir antes e depois com src/logica/relatorio-calibracao.js
// e registrar em docs/calibracao-facial.md.
//
// Escalas:
// - score de detecção: probabilidade do BlazeFace (0..1);
// - similaridade: cosseno entre vetores MobileFaceNet normalizados (-1..1);
// - giro: deslocamento do nariz em relação ao meio dos olhos, dividido pela
//   distância entre os olhos (sem unidade; ~0 = de frente);
// - largura do rosto: fração do lado do quadrado central da foto (0..1).
export const PARAMETROS_FACIAIS = Object.freeze({
  // Detecção (BlazeFace)
  scoreMinimoDeteccao: 0.5,        // candidato abaixo disso é ignorado
  segundoRostoScoreMaximo: 0.75,   // outro rosto acima disso = "uma pessoa por vez"
  larguraMinimaRosto: 0.22,        // rosto menor = "chegue mais perto"
  inclinacaoMaximaGraus: 15,       // olhos fora da horizontal = "cabeça reta"
  limiarIouMesmoRosto: 0.3,        // candidatos sobrepostos = mesmo rosto

  // Identificação 1:N (MobileFaceNet)
  limiarReconhecimento: 0.6,       // similaridade mínima do 1º candidato
  margemSobreSegundo: 0.08,        // 1º precisa passar o 2º por pelo menos isto

  // Prova de vida por mudança de pose (ver aviso em docs/calibracao-facial.md:
  // NÃO é anti-spoofing; precisa de homologação de campo)
  giroMaximoDeFrente: 0.15,        // 1ª foto precisa estar de frente
  giroMinimoVirado: 0.2,           // 2ª foto precisa estar virada pelo menos isto
  similaridadeMinimaVirado: 0.35,  // 2ª foto ainda precisa parecer a mesma pessoa
  esperaAntesDaViradaMs: 1300,

  // Cadastro
  capturasCadastro: 3,
});
