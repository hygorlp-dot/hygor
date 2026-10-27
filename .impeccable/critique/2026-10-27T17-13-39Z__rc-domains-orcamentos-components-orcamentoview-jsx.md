---
target: aba Orçamento (densidade estilo Excel)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-10-27T17-13-39Z
slug: rc-domains-orcamentos-components-orcamentoview-jsx
---
Method: dual-agent (A: revisão de design · B: detector e medições)

# Critique: aba Orçamento (OrcamentoView.jsx)

Nota: 22/40 (Aceitável, com problemas graves de densidade). Carga cognitiva: 6 falhas em 8.

Heurísticas: 1=3, 2=3, 3=3, 4=2, 5=2, 6=2, 7=1, 8=1, 9=3, 10=2.

Veredito: formulário repetido, não planilha. 5 a 7 inputs com borda 1,5px por linha; etapa como cartão com sombra.

## Problemas prioritários
- [P0] Linha de item é pilha de campos com moldura (4108-4170, index.css:5023-5034). Corrigir: células sem borda, foco dourado, linha ~24px, total e ações na mesma linha.
- [P0] Sem cabeçalho de colunas. Corrigir: cabeçalho sticky de 24px (top 48px) com a mesma constante de colunas.
- [P1] Cabeçalho sobrecarregado (3604-3714): barra única, abas compactas, painéis como chips.
- [P1] Ações demais por nível: etapa como faixa de planilha, ações secundárias em menu.
- [P2] Tipografia sem tokens: escala única de 11px.

## Detector
8 achados side-tab; 2 falsos positivos no bloco morto false&&; 6 reais (3451, 3769, 3804, 3848, 4891, 5019).

## Personas
Alex: ~12 linhas por tela, sem teclado entre células, Descrição é busca. Sam: alvos 14x11, texto 9-10px, estado só por cor, sem aria-label/role=grid.
