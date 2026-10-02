---
target: aba Locações da Central de locação de equipamentos (src/domains/equipamentos/components/RentalOperationsPanel.jsx)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-10-02T18-30-00Z
slug: src-domains-equipamentos-components-rentaloperationspanel-jsx
---
# Revisão Impeccable — Central operacional de locações

**Método**: autoavaliação após a implementação, com (a) o scanner determinístico do hook do Impeccable em cada arquivo escrito (sem achados), (b) capturas reais em Chromium a 1440, 1280 e 1024px com massa de 48 locações, nomes longos e valores grandes, (c) testes de comportamento. Não substitui uma crítica independente em duas passadas como as de agosto; a nota é conservadora por isso.

## Design Health Score

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3 | Resumo com `aria-live`, contagens por situação, KPIs com escopo explícito, esqueleto que reserva a altura. Falta feedback de "salvando" por linha (o `busy` só desabilita). |
| 2 | Correspondência com o mundo real | 4 | Equipamento → obra → período → situação → cobrança, com "K1-04 — Terras Alpha", "vence em 3 dias", "medido a faturar". |
| 3 | Controle e liberdade do usuário | 3 | Chips removíveis, "Limpar filtros", ‹ › de mês, Esc fecha menu/detalhe. Exclusão tem confirmação, mas não há desfazer. |
| 4 | Consistência e padrões | 3 | Só tokens `--arcd-*`, primitivos do design system, fonte mono em números/códigos. Cabeçalho e abas continuam os legados compartilhados pelas 6 abas. |
| 5 | Prevenção de erros | 3 | Ação destrutiva isolada no fim do menu e com confirmação; ações que o servidor recusaria nem aparecem (espelho de papéis testado). |
| 6 | Reconhecimento vs. memorização | 4 | Estado sempre por ícone + texto + tom; obra por nome e código; filtros ativos visíveis como chips. |
| 7 | Flexibilidade e eficiência | 3 | Busca, 7 ordenações, agrupamento, atalhos de período, ação principal na linha. Sem visões salvas nem ações em lote. |
| 8 | Estética e minimalismo | 3 | 1 ação visível + `⋯` por linha, sem gradiente/sombra/faixa lateral. Densa por natureza (8 colunas em ≥ 1200px). |
| 9 | Recuperação de erros | 3 | Erro com mensagem clara e "Tentar novamente"; vazio e "sem resultado" distintos. O erro hoje só ocorre com dado malformado (não há requisição própria). |
| 10 | Ajuda e documentação | 2 | Aviso do DRE recolhido e notas nos cartões; faltam dicas para "taxa de ocupação" e "unidades-dia". |

**Total: 31/40 (78%).** A tela de Equipamentos como um todo estava em 24/40 em 17/08.

## Veredito de especificidade

Desenhada para locação entre obras: a unidade da conversa é equipamento × obra × período, com vencimento e saldo à vista — não um CRUD genérico. O que ainda a aproxima de um dashboard genérico: os quatro cartões de KPI (necessários, mas de peso igual).

## Problemas

**[P0]** nenhum.

**[P1] Duas bases de valor na mesma tela.** "Receita no período" vem do contrato; "A receber" vem de faturas/medições que ainda não alimentam o DRE. Justificativa para não corrigir agora: é a regra financeira vigente (Fase 5 inacabada), e o pedido proíbe alterá-la. Mitigação: nota em cada cartão e aviso recolhido. Ação: decisão de produto sobre integrar a cobrança por ciclo ao DRE.

**[P2]** Cabeçalho (PageHero) com 3 botões secundários de peso igual abaixo do primário — compartilhado com as outras abas.
**[P2]** Sem tooltip para "taxa de ocupação" / "unidades-dia" / "Sem medição".
**[P2]** Sem reordenação no layout empilhado (< 640px).
**[P2]** Cobrança "Encerrada" também rotula locações excluídas (sem cobrança futura) — pode confundir com a situação "Encerrada".
**[P2]** O erro "Tentar novamente" só recalcula; não refaz requisição (não existe nenhuma nesta aba).

**[P3]** Cabeçalho de tabela `sticky` sem efeito prático dentro do contêiner de rolagem horizontal.
**[P3]** Contagem do badge da aba "Mapa de ocupação" quebra de linha a 1024px (pré-existente).
**[P3]** Sem virtualização (paginação de 25 cobre o volume atual).

## Checagens dos critérios Impeccable

- Card overload: 4 cartões de resumo (de 4 + um bloco de aviso + lista de cartões antes). Cartões dentro de cartões: nenhum.
- Side-tabs / border accents / gradientes / sombras decorativas: nenhum nesta aba (o menu e a tabela usam só borda de 1px; o detalhe reutiliza o `Drawer` do design system).
- Texto minúsculo: mínimo `--arcd-type-caption` (10px) só no título de grupo do menu; metadados em `--arcd-type-label` (11px).
- Ações `danger` para tarefa não destrutiva: nenhuma. Uma única ação `danger` por linha, no fim do menu, e no fim do detalhe.
- Filtros duplicados: nenhum (situação só no controle segmentado; chips apenas refletem o estado).
- Estado crítico só por cor: nenhum (ícone + texto + tom).
- Valores soltos fora de token: nenhum no CSS novo.
