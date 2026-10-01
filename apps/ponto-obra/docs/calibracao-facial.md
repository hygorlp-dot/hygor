# Calibração e homologação do reconhecimento facial

## O que roda no aparelho

1. **Detecção** — BlazeFace "front" (128×128) acha o rosto e 6 pontos
   (olhos, nariz, boca, orelhas) no quadrado central da foto.
2. **Alinhamento** — recorte quadrado de 2,5× a distância entre os olhos,
   centro 15% abaixo do meio dos olhos. O recorte **não é girado**: a cabeça
   inclinada é recusada acima de `inclinacaoMaximaGraus`.
3. **Identidade** — MobileFaceNet (112×112) gera um vetor de 192 números,
   normalizado (L2).
4. **Identificação 1:N** — o vetor é comparado (cosseno) com os cadastros da
   obra. A batida só é aceita se o 1º candidato passar de
   `limiarReconhecimento` **e** ficar pelo menos `margemSobreSegundo` à frente
   do 2º. Caso contrário, vai para o encarregado — nunca se chuta.
5. **Prova de vida** — o app pede para a pessoa virar o rosto. A 2ª foto
   precisa estar virada (`giroMinimoVirado`) e ainda parecer a mesma pessoa
   (`similaridadeMinimaVirado`).

Todos os parâmetros estão em `src/logica/calibracao.js`
(`PARAMETROS_FACIAIS`). Os valores atuais são os da primeira versão e **ainda
não foram homologados em campo**. Existe um teste que trava esses valores: para
mudar um deles, é preciso alterar o teste de propósito e registrar a medição
que justifica a mudança.

## Aviso sobre a prova de vida

A prova de vida por **mudança de pose** (virar o rosto) **não é anti-spoofing
e não é infalível**. Ela dificulta o uso de uma foto impressa parada. Não
impede vídeo, tela de celular com a pessoa virando o rosto, máscara nem
outros ataques de apresentação. Antes de ser tratada como controle, ela
**precisa de homologação de campo**, e a evidência que vale continua sendo a
foto da batida guardada com a marcação.

## Como medir em campo (homologação)

O relatório fica em `src/logica/relatorio-calibracao.js` e trabalha **só com
números e ids**: `amostraDeCalibracao` descarta vetor e foto.

Para cada tentativa, registre:
- `esperado`: quem realmente estava na frente da câmera (`employeeId`), ou
  `null` quando for uma pessoa não cadastrada (teste de impostor);
- `resultado`: a saída de `identificar()`, que já traz o 1º e o 2º
  candidato;
- `deteccao`: `{ score, larguraRosto, giro }` de `analisarFoto()`.

`relatorioCalibracao(amostras)` devolve:
- **falso aceite**: o app aceitou e atribuiu a batida a outra pessoa
  (inclusive um impostor aceito como alguém) — taxa sobre todas as
  tentativas;
- **falsa rejeição**: pessoa cadastrada não reconhecida — taxa sobre as
  tentativas genuínas;
- distribuição (mín, p05, mediana, p95, máx) do **score do 1º candidato**,
  da **diferença para o 2º** e da **qualidade da detecção**, separada entre
  genuínas e impostoras.

`varrerLimiares(amostras, [{ limiar, margem }, ...])` recalcula as taxas
com outros limiares sobre as mesmas tentativas. Serve para escolher a
calibração e nunca muda o app sozinho.

Sugestão de roteiro, que também precisa de decisão do responsável: em cada
obra piloto, várias tentativas por funcionário em horários e luzes
diferentes, mais tentativas de pessoas não cadastradas. A coleta é manual
(planilha ou script fora do app). O app não grava amostras de calibração.

## Nada de dado biométrico em log

O app não tem `console.*`, e há teste que impede isso. Diagnóstico e
relatório de calibração não carregam vetor nem foto.
