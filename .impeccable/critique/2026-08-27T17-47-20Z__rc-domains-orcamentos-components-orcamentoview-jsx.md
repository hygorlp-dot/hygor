---
target: OrcamentoView.jsx (aba Memória de Cálculo - Fundação/Sapatas)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-27T17-47-20Z
slug: rc-domains-orcamentos-components-orcamentoview-jsx
---
# Crítica Impeccable — Memória de Cálculo (Sapatas/Fundação)

Method: dual-agent (A: general-purpose isolated worktree agent · B: general-purpose agent) + verificação suplementar ao vivo (parcial).

## Design Health Score

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status | 4 | Conferência do peso de aço contra o total do PDF já implementada (`pdfResumoAco`). |
| 2 | Compatibilidade com o mundo real | 4 | Vocabulário e agrupamento espelham o desenho estrutural real. |
| 3 | Controle e liberdade do usuário | 3 | Preview descartável; sem desfazer após aplicar. |
| 4 | Consistência e padrões | 4 | Reusa tema/componentes; vírgula decimal tratada uniformemente. |
| 5 | Prevenção de erros | 2 | Nenhum input com min="0"; reaterro negativo zerado silenciosamente. |
| 6 | Reconhecimento em vez de memorização | 3 | Só 2 de ~15 colunas calculadas têm tooltip (hover-only). |
| 7 | Flexibilidade e eficiência de uso | 2 | Sem duplicar linha, colar em lote, navegação por teclado. |
| 8 | Estética e design minimalista | 2 | Fonte 8.3-9.5px, 23 colunas, 1900px de largura mínima. |
| 9 | Ajuda a reconhecer/diagnosticar erros | 3 | Mensagens de PDF específicas; fallback genérico pode vazar texto técnico. |
| 10 | Ajuda e documentação | 2 | Sem glossário para jargão; "(em breve)" sem detalhe. |
| **Total** | | **29/40** | **Bom** |

## Veredito de especificidade de design

Passa: vocabulário de domínio real (sapata, tronco, folga de escavação, bitola CA-50/CA-60, NBR 7480), agrupamento fiel ao desenho estrutural, `comprimentoDaDirecao` encarna decisão de engenharia real (nunca arriscar comprimento ambíguo).

Scan determinístico (Assessment B, detect.mjs, exit 2): 9 achados — 8x side-tab + 1x overused-font, todos nas linhas 2141-3658 (fora da aba Memória de Cálculo, débito pré-existente de outras telas do mesmo arquivo).

## Pontos fortes

1. Tratamento uniforme de vírgula decimal brasileira em todo input numérico.
2. Correlação por âncora de posição no extrator de PDF: nunca arrisca um comprimento errado quando duas leituras conflitam.
3. Conferência do peso de aço (calculado vs. total do PDF) na pré-visualização antes de aplicar.

## Problemas prioritários

- **[P1] Padrão de escavação não é salvo.** `padraoFolgaEscavacao`/`padraoProfundidadeEscavacao` são useState local, nunca persistidos em `orc.memoriaCalculo`. Fix: persistir junto com `fundacao.sapatas`.
- **[P1] Nenhum limite contra valor fisicamente impossível.** Zero `min="0"` em qualquer input; reaterro negativo zerado sem aviso de inconsistência geométrica. Fix: min="0" + destaque visual quando escavação < volume da sapata.
- **[P2] Densidade da tela.** 23 colunas, 1900px, fonte pequena, tooltip só no hover em 2 colunas. Fix: congelar TIPO/QTD, agrupar colunas em dois níveis de cabeçalho, ícone de info sempre visível.
- **[P3] Instrução pós-importação só num toast passageiro.** Fix: selo/borda leve em linhas recém-importadas até serem revisadas.

## Alertas por persona

**Alex**: sem duplicar linha, colar em lote ou navegação por teclado; "aplicar padrão" é tudo-ou-nada.
**Sam**: zero scope="col"/aria-label no arquivo inteiro; tooltips só em hover, inacessíveis por teclado.
**Jordan**: sem glossário para jargão; "(em breve)" sem detalhe; orientação de qual PDF enviar só aparece após erro.

## Observações menores

- Botão "x" de excluir sem confirmação, colado à célula de peso.
- Linha de TOTAIS usa o mesmo fundo do cabeçalho.
- Sem reordenar linha manualmente.

## Perguntas provocativas

1. O padrão de tabela larga de 23 colunas deve generalizar para os próximos pavimentos (paredes/lajes/vigas) ou cada um precisa de estrutura própria?
2. A conferência PDF-vs-calculado deveria bloquear "APLICAR" quando a diferença é grande, não só colorir de laranja?
3. Vale um glossário fixo (não hover) para folga/tronco/conc. magro acima da tabela?
