# Calibração e homologação do reconhecimento facial

## O que roda no aparelho

1. **Detecção** — BlazeFace "front" (128×128) acha o rosto e 6 pontos
   (olhos, nariz, boca, orelhas) no quadrado central da foto.
2. **Alinhamento** — recorte quadrado de 2,5× a distância entre os olhos,
   centro 15% abaixo do meio dos olhos. O recorte **não é girado**: a cabeça
   inclinada é recusada acima de `inclinacaoMaximaGraus`.
3. **Identidade** — MobileFaceNet (112×112) gera um vetor de 192 números,
   normalizado (L2).
4. **Identificação 1:N** — o vetor é comparado (cosseno) com os cadastros de
   todos os funcionários ativos da empresa (funcionário global). A batida só é aceita se o 1º candidato passar de
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
diferentes, mais tentativas de pessoas não cadastradas. O rótulo (quem
estava na frente da câmera) é anotado à mão, fora do app.

## Modo de calibração de campo (no aparelho)

Encarregado → Diagnóstico → **Calibração de campo**. Ligado, cada tentativa
na tela de ponto vira uma linha **só de números** (`calibracao-campo.js`):
score do 1º e do 2º candidato, margem, confiança do detector, largura do
rosto, luminância média do recorte (0-255), resultado e duração. A sessão
tem lista fechada de campos: vetor, foto, nome, id e CPF não entram nem se
forem passados. Fica só na memória (até 500 tentativas) e some ao fechar o
app. O resumo anônimo mostra contagens por resultado, distribuições e
quantas aceitas ficaram **perto do limiar** (sinal de calibração apertada).

MEDIÇÃO DE CAMPO: pendente. Enquanto não houver FAR/FRR medidos com rostos
reais em pelo menos uma obra piloto, a nota de reconhecimento facial do
scorecard fica limitada (teto 8,7).

## Avaliação sintética (lógica de decisão)

`src/logica/avaliacao-facial.js` gera "rostos" sintéticos por semente fixa
(componente comum da população + individual + ruído de captura) e roda a
regra real (`identificar`) com os parâmetros atuais (limiar 0,60, margem
0,08). **Mede a regra de decisão, não o MobileFaceNet com rostos reais.**
Resultado (200 pessoas × 5 tentativas + 300 impostores):

| Cenário | Genuíno (mediana) | Impostor (mediana) | Falso aceite | Falsa rejeição |
| --- | ---: | ---: | ---: | ---: |
| Favorável (luz boa) | 0,84 | 0,45 | 0 | 0 % |
| Obra (luz variando) | 0,73 | 0,41 | 0 | 0 % |
| Adverso (contraluz, rosto pequeno) | 0,61 | 0,38 | 0 | **35 %** |

- Em condição adversa a regra **recusa** em vez de errar: 35% vão para o
  encarregado. É o custo honesto do limiar seguro; em campo, a resposta é
  luz, distância e enquadramento (o app já pede "chegue mais perto").
- **Gêmeos / muito parecidos** (40 pessoas, 10 pares): com a margem sobre o
  2º, 0 falso aceite (os pares vão para o encarregado); **sem a margem, 15%
  das tentativas seriam atribuídas à pessoa errada**. A margem fica.
- Varredura de limiar: subir o limiar nunca aumenta o falso aceite nem
  diminui a falsa rejeição (testado); o limiar atual está do lado seguro.

Os números acima são do teste `avaliacao-facial.test.js` e mudam só se os
cenários mudarem. Escala 1:N: ver `escala-reconhecimento.test.js` (0,15 ms
por identificação com 500 funcionários no Node).

## Nada de dado biométrico em log

O app não tem `console.*`, e há teste que impede isso. Diagnóstico e
relatório de calibração não carregam vetor nem foto.
