---
target: Memória de Cálculo (OrcamentoView.jsx)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
timestamp: 2026-08-27T23-12-33Z
slug: os-components-orcamentoview-jsx-mem-ria-de-c-lculo
---
Method: dual-agent (A: general-purpose · B: general-purpose)

**Nota de atualidade**: entre o Assessment A rodar e este relatório ser escrito, a tabela de Pilares (um pilar por linha) foi substituída por um cartão único por pavimento (pedido direto do usuário, "não preciso de pilar unitariamente"). Os achados do Assessment A sobre a tabela de Pilares especificamente (coluna "pavimentos que atravessa", `window.confirm()` ao remover tipo, densidade compacto/normal/confortável aplicada a uma tabela de 8 colunas) estão desatualizados e foram removidos deste relatório. Os achados sobre Sapatas, o painel de importação de PDF e a ausência de "Vincular ao Orçamento" nos outros pavimentos continuam válidos.

## Design Health Score

| # | Heurística | Nota | Achado principal |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | Toast, ponto laranja `precisaRevisar`, undo com banner - mas a importação de PDF só deixa um toast passageiro como registro. |
| 2 | Correspondência com o mundo real | 4 | Terminologia certa (sapata/tronco/fôrma/bitola/magro), pavimentos nomeados como a obra nomeia, glossário sempre visível. |
| 3 | Controle e liberdade do usuário | 2 | Sapata tem undo de 8s; a sobrescrita por PDF (ação de maior risco da tela) não tem desfazer nenhum depois de aplicada. |
| 4 | Consistência e padrões | 3 | Editor de aço por bitola reaproveitado identicamente nas 4 seções; "Vincular ao Orçamento" existe só na Fundação. |
| 5 | Prevenção de erros | 2 | Boas defesas pontuais (normalização de vírgula, `min="0"`, aviso de escavação insuficiente) - mas sobrescrever um pavimento inteiro não passa por nenhum modal de confirmação. |
| 6 | Reconhecimento em vez de memorização | 3 | Glossário fixo, tooltips nos campos ambíguos, larguras de coluna e densidade lembradas. |
| 7 | Flexibilidade e eficiência | 3 | Importação em massa via PDF, preferências persistidas por empresa. |
| 8 | Estética e design minimalista | 3 | Denso mas organizado; código novo usa `fontSize` numérico solto em vez dos tokens `--arcd-type-*` do DESIGN.md. |
| 9 | Ajudar a reconhecer/diagnosticar/recuperar erros | 3 | Aviso de escavação insuficiente é exemplar: linha vermelha, medidas exatas no tooltip. |
| 10 | Ajuda e documentação | 2 | Sem central de ajuda (esperado, ferramenta interna) - glossário fixo conta como ajuda contextual real. |

**Total: 28/40 - Bom, na fronteira inferior.**

## Veredito de especificidade de design

**Autoral.** A conferência automática do aço extraído contra o "Resumo Aço" impresso do próprio projeto (com tolerância de 2%), o aviso de escavação insuficiente com as medidas exatas da cova, e agora o cálculo do magro da viga baldrame com a mesma lógica de folga da escavação de sapata - nada disso é genérico, é conhecimento de engenharia civil traduzido em UI. O ponto de atenção não é genericidade, é que a tela ainda mistura dois momentos de construção (Sapatas com o sistema robusto de "Vincular ao Orçamento"; Pilares/Vigas/Laje sem ele).

**Scan determinístico (Assessment B)**: 0 achados do detector dentro da seção Memória de Cálculo (linhas 4465-4774). 10 achados fora dela (6x `side-tab`, 2x `overused-font`) - débito técnico pré-existente, fora de escopo.

**Visualização em navegador**: indisponível - o app depende de credenciais de produção não configuradas localmente (login trava em "Não foi possível carregar o acesso ao banco").

## O que está funcionando

1. **Conciliação do aço contra o total impresso do projeto**: compara a extração linha a linha com o total que a própria folha do projeto imprime, com tolerância de 2% e texto explicando a causa provável da diferença.
2. **Aviso de escavação insuficiente**: linha vermelha + tooltip com as duas medidas reais (cova vs. sapata) no lugar exato do erro.
3. **Editor de aço por bitola reaproveitado**: mesmo padrão pixel a pixel em Sapatas, Pilares, Vigas e Laje - é o elemento que faz as quatro seções parecerem parte do mesmo sistema.

## Problemas prioritários

**[P0] Reimportar PDF sobrescreve com um clique, sem confirmação, e o aviso de sobrescrita está numa caixa verde de "sucesso".**
Por quê importa: o app já usa verde = positivo/sucesso (DESIGN.md). A frase em negrito "Reimportar substitui a versão anterior de cada pavimento" fica dentro de uma caixa `border:C.green` - a cor diz "pode seguir" bem no meio do único aviso que devia soar como alerta. Apagar uma etapa do orçamento já usa `ConfirmDialog` com descrição do impacto; sobrescrever a memória de cálculo de até 4 pavimentos inteiros não passa por nenhum modal.
Fix: `ConfirmDialog` antes de `aplicarPdfPreviewCompleto` mostrando o que será perdido, e separar visualmente o aviso de sobrescrita (âmbar) do resto do card verde de "encontrado".
Comando sugerido: `/impeccable harden`

**[P1] "Vincular ao Orçamento" existe só na Fundação.**
Por quê importa: o propósito central do produto é "extrair do PDF → vincular à linha do orçamento" - Térreo, 1º Pavimento e Cobertura (75% das abas construídas nesta sessão) não têm esse fechamento. O usuário tem que decorar os totais de concreto/fôrma/aço e digitar na mão na aba Orçamento.
Fix: generalizar `TOTAIS_VINCULAVEIS_FUNDACAO`/`sincronizarVinculosFundacao` por pavimento, reaproveitando para os cartões de Pilares/Viga/Laje.
Comando sugerido: `/impeccable shape`

**[P2] Botões de pavimento/densidade sem `aria-pressed`.**
Por quê importa: FUNDAÇÃO/TÉRREO/1ºPAV/COBERTURA e COMPACTO/NORMAL/CONFORTÁVEL comunicam o estado ativo só por cor - leitor de tela não anuncia qual está selecionado.
Fix: `aria-pressed={pavimentoMemoria===valor}` nos botões de pavimento.
Comando sugerido: `/impeccable audit`

**[P2] Remover uma linha do editor de aço por bitola não tem confirmação nem desfazer.**
Por quê importa: é o único "x" vermelho da seção sem nenhuma rede de segurança - some na hora, sem banner de undo como Sapatas tem.
Fix: aplicar o mesmo padrão de undo estilizado (8s) que Sapatas já usa.
Comando sugerido: `/impeccable polish`

## Carga cognitiva (aba Fundação)

4 de 8 itens da checklist falham: foco único (7+ blocos simultâneos ativos), agrupamento em blocos de até 4 (grupo "CONCRETO" da tabela reúne 6 colunas), uma decisão por vez (6 decisões diferentes visíveis ao mesmo tempo), exigência de memória de trabalho (decorar total de Pilares/Vigas/Laje pra digitar noutra aba - efeito direto do P1 acima).

## Red flags de persona

**Alex (usuário avançado, usa quase todo dia)**: sem atalho pra levar o total de Pilares/Vigas/Laje até o orçamento - troca de aba e digita na mão toda vez. Reimportar não mostra "o que mudou desde a última vez".

**Riley (testa casos de borda)**: um clique em "APLICAR" é irreversível - sem diff antes, sem desfazer depois. Adicionar a mesma bitola duas vezes no editor não é bloqueado nem mesclado (soma certo, mas pode parecer erro de digitação).

## Observações menores

- `fontSize` numérico solto na área nova, em vez dos tokens `--arcd-type-*` do DESIGN.md.
- O card de preview do PDF acumula sapatas + pilares + aço de até 4 pavimentos numa lista com rolagem interna - para um projeto maior isso vira rolagem dentro de rolagem antes de uma ação irreversível.
