# Anti-spoof: o que a prova de vida faz e o que ela não faz

**Virar o rosto não é liveness forte.** A prova de vida do Ponto de Obra
(`avaliarProvaDeVida` em `src/logica/rosto.js`) pede uma segunda foto com a
cabeça virada (`giroMinimoVirado`) que ainda pareça a mesma pessoa
(`similaridadeMinimaVirado`). Isso dificulta o ataque mais barato (foto
parada), mas **não** impede vídeo, replay nem máscara. A evidência que vale
continua sendo a **foto da batida**, guardada com a marcação e auditável no
ARCD, e o reconhecimento só **identifica**: quem não for reconhecido vai para
o encarregado, nunca é atribuído a outra pessoa.

## Avaliação por tipo de ataque

| Ataque | Resultado da regra (teste) | Teste físico | Situação |
| --- | --- | --- | --- |
| Pessoa real virando o rosto | passa | pendente (piloto) | esperado |
| Foto impressa parada | **recusada** (não virou) | pendente | barrado pela regra |
| Foto impressa movida/inclinada pelo atacante | não medido (perspectiva de papel não reproduz o giro do nariz, mas não foi testado) | pendente | **risco não avaliado** |
| Foto na tela (celular/tablet) parada | **recusada** (não virou) | pendente | barrado pela regra |
| Vídeo / replay da pessoa virando o rosto | **PASSA** | pendente | **vulnerável - limitação conhecida** |
| Troca de pessoa entre as duas fotos | **recusada** (identidade diferente) | pendente | barrado pela regra |
| Rosto parcialmente coberto (máscara, mão, capacete) | recusada sem rosto detectado; se detectado com similaridade baixa, não reconhece e vai para o encarregado | pendente | sem falso aceite pela regra |
| Máscara 3D / rosto impresso em volume | não avaliado | não planejado | **fora do alcance desta solução** |

Os resultados da coluna "regra" vêm de `src/logica/anti-spoof.test.js`, que
alimenta a regra com as saídas que `analisarFoto()` daria em cada situação.
**Não substituem o teste físico.**

## Protocolo de teste físico (homologação)

Com o modo **Calibração de campo** ligado (Encarregado → Diagnóstico) e um
funcionário de teste cadastrado:

1. 10 tentativas reais (controle).
2. 10 com a foto dele impressa em A4, segurada de frente.
3. 10 com a foto dele na tela de outro celular, brilho máximo.
4. 10 com um vídeo dele virando o rosto, na tela de outro celular.
5. 10 com o rosto parcialmente coberto (máscara cirúrgica, mão).

Anote, por linha, se a batida foi registrada. O resumo anônimo da calibração
dá os scores e a duração. Registre o resultado na tabela acima, com data e
aparelho, e **não** troque a regra nem adicione modelo anti-spoof sem esse
benchmark.

## Se o risco de vídeo não for aceitável

Opções, todas com custo e que exigem decisão e benchmark antes:
- modelo de anti-spoof passivo (textura/moiré) - nova dependência, latência
  e falsa rejeição a medir no aparelho mais fraco;
- desafio aleatório (virar para um lado sorteado, piscar);
- auditoria por amostragem das fotos de batida no ARCD.

Nenhuma delas está implementada nesta rodada.
