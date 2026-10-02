---
target: aba Locações da Central de locação de equipamentos (src/domains/equipamentos/components/RentalOperationsPanel.jsx)
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-10-02T21-00-00Z
slug: src-domains-equipamentos-components-rentaloperationspanel-jsx
---
# Revisão Impeccable — Central operacional de locações (2ª passada, fechamento)

**Método**: (a) scanner determinístico do hook do Impeccable em cada arquivo alterado (sem achados); (b) revisão manual das 10 heurísticas sobre capturas reais em Chromium a 1440, 1280 e 1024px (48 locações, nomes longos, valores na casa dos milhões); (c) `.impeccable/config.json` e as críticas de 17/08/2026 (Equipamentos) usadas como régua; (d) testes de comportamento. Continua sendo uma autoavaliação, não uma crítica independente em duas passadas.

**1ª passada (02/10/2026, mesmo dia)**: 31/40 · P0 0 · P1 1 · P2 5 · P3 3.

## Design Health Score

| # | Heurística | 1ª | 2ª | O que mudou / por quê |
|---|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3 | 3 | Resumo agora diz a situação ("3 locações em andamento"); legenda dos indicadores diz "todas as situações". Ainda sem feedback de "salvando" por linha. |
| 2 | Correspondência com o mundo real | 4 | 4 | "Receita contratual", "Faturas a receber", "Ciclo encerrado" falam a língua do financeiro. |
| 3 | Controle e liberdade do usuário | 3 | 3 | Chips, limpar, Esc; foco volta à linha ao fechar o detalhe. Sem desfazer exclusão. |
| 4 | Consistência e padrões | 3 | 3 | Colunas "Situação da locação" e "Situação da cobrança" sem rótulos repetidos entre si (teste trava). Cabeçalho/abas continuam os legados. |
| 5 | Prevenção de erros | 3 | 3 | Permissões da tela e do servidor saem da mesma tabela; teste compara ação × papel × obra. |
| 6 | Reconhecimento vs. memorização | 4 | 4 | — |
| 7 | Flexibilidade e eficiência | 3 | 3 | — |
| 8 | Estética e minimalismo | 3 | 3 | Cabeçalhos quebram linha em vez de alargar a tabela; nota de ciclo é texto secundário, não alerta. |
| 9 | Recuperação de erros | 3 | 3 | — |
| 10 | Ajuda e documentação | 2 | 3 | Cada indicador financeiro diz de onde vem o número (nota visível + explicação no rótulo); locação "em andamento" sem ação de ciclo explica o motivo na linha, no menu e no detalhe. |

**Total: 32/40.** A única nota que subiu (10) subiu porque a explicação passou a existir na tela, não para fechar um número.

## Problemas

**[P0]** nenhum.

**[P1]** nenhum. *O P1 da 1ª passada ("duas bases de valor na mesma tela") caiu para P2, justificativa abaixo.*

**[P2] As duas bases de valor continuam coexistindo** (rebaixado de P1). Antes: "Receita no período" × "A receber", nomes que sugeriam a mesma grandeza. Agora: "Receita contratual no período — Conforme tarifas das locações" × "Faturas a receber — N faturas pendentes · Controle interno, ainda fora do DRE", com explicação no rótulo de cada um. O risco de ler os dois como a mesma coisa deixou de ser provável; o que resta é a lacuna de produto (cobrança por ciclo fora do DRE), que não é de interface e não pode ser resolvida nesta rodada.
**[P2]** Cabeçalho (PageHero) com 3 botões secundários de peso igual — compartilhado com as outras abas.
**[P2]** Sem reordenação no layout empilhado (< 640px; fora do escopo desktop/notebook/tablet).
**[P2]** "Tentar novamente" só recalcula (a aba não faz requisição própria).

**[P3]** Explicação dos indicadores via `title` não é alcançável por teclado (a nota visível cobre o essencial).
**[P3]** Cabeçalho `sticky` sem efeito dentro do contêiner de rolagem horizontal.
**[P3]** Badge da aba "Mapa de ocupação" quebra linha a 1024px (pré-existente).
**[P3]** Sem virtualização (paginação de 25 cobre o volume atual).

**Encerrado nesta passada**: cobrança "Encerrada" confundível com a situação "Encerrada" (agora "Ciclo encerrado"); contagem da aba ativa invisível; valor de R$ 1 diária mostrado para locação programada em "Todo o período" (agora "—" com "inicia em dd/mm").

## Critérios Impeccable

- Card overload / cartões aninhados: 4 cartões de resumo; detalhe usa divisores, sem cartões (teste trava).
- Side-tabs, border accents, gradientes, sombras decorativas: nenhum nesta aba.
- Texto minúsculo: mínimo `--arcd-type-caption` (10px) só no título de grupo do menu.
- `danger` em tarefa não destrutiva: nenhum; uma ação `danger` por linha, isolada no fim do menu e do detalhe.
- Filtros duplicados: nenhum. Estado só por cor: nenhum. Valores soltos fora de token: nenhum no CSS novo.
- Responsividade: só container query no CSS da Central (teste garante ausência de `@media` por largura de janela); proprietário e período sempre recolocados quando a coluna sai.
