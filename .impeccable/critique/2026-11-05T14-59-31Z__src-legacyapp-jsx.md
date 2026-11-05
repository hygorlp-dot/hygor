---
target: ERP inteiro (shell e telas principais) após Etapas 0 e 1
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-11-05T14-59-31Z
slug: src-legacyapp-jsx
---
Method: dual-agent (A: revisão de design · B: detector + navegador)

# Critique — ERP ARCD/MARCELL (main após Etapas 0 e 1), 05/11/2026

## Nota: 21/40 — Aceitável (faixa baixa)

| # | Heurística | Nota | Problema-chave |
|---|---|---|---|
| 1 | Visibilidade do status | 2 | Carimbo "Todas as obras" enquanto a tela de uma obra mostra Residencial Alameda; Dashboard "3 críticas" × KPI "Pendências críticas 0"; no celular o salvamento é só um ponto verde |
| 2 | Correspondência com o mundo real | 3 | Vocabulário de obra excelente (SINAPI, BDI, quinzena, RDO); deslizes: "Telas antigas", botão "ok" em medição vencida, "1 meses", "A:0 S:0" |
| 3 | Controle e liberdade | 2 | "Desligar" com o mesmo peso de "Detalhes"; lixeira colada em "Aprovar baseline" e "Abrir obra"; quase nenhum desfazer visível |
| 4 | Consistência e padrões | 1 | 5 estilos de aba, 3–4 faixas de KPI, cabeçalhos que variam (abas acima do H1 na Folha/Ponto, H1 = valor do filtro no Ponto por obra); detector: h1→h3 em home, obras e Compras |
| 5 | Prevenção de erros | 2 | Bom: fechar quinzena bloqueado com motivo. Ruim: ações destrutivas com peso de rotina, "Todos presentes" sem obra |
| 6 | Reconhecer em vez de lembrar | 2 | 65 entradas de menu; o ponto tem 4 portas; muito conteúdo importante em details fechado |
| 7 | Flexibilidade e eficiência | 2 | Ctrl+K existe mas o rótulo mostra ⌘K no Windows; sem ação em lote na fila; período por 3 selects na Folha e por setas no Dashboard |
| 8 | Estética e minimalismo | 2 | Paleta calma; ruído do seletor de obra duplicado, prosa explicativa em toda seção, KPIs em R$ 0,00 na área nobre |
| 9 | Recuperação de erros | 2 | Aviso do OneDrive sem ação; Diário vazio manda "ajustar filtros" quando não há registro; "Ver como corrigir" em Obras é exemplar |
| 10 | Ajuda e documentação | 3 | Ajuda contextual no topo, guias por tela; prosa às vezes compensa layout que não se explica |

## Veredito de especificidade
Conteúdo de construtora, forma de qualquer ERP. Vocabulário e regras são de casa; a casca (sidebar marinho, cartões brancos, 4 KPIs, tabela) serve a qualquer setor. DESIGN.md declara referência SAP e o resultado é neutralidade de SAP. A única tela com identidade é o Modo TV. A obra nunca aparece como objeto (foto, etapa, clima).

Detector: 249 achados no CLI em 10 lotes (170 cor fora do sistema, 55 tamanho de fonte, 7 raio, 6 transição de layout, 5 fonte mono, 4 Arial, 2 side-tab); 149 (60%) são templates de impressão e não contam. Em tela, 100, concentrados no LegacyApp (TV, chat, portal) e Orçamento. Navegador (detect.js injetado em home, obras, cmp, fin, orc, ponto_geral): layout-transition em todas (padding do shell, largura do menu), h1→h3 em 3 telas, botões com 0 px de respiro vertical em Compras/Financeiro/Ponto, contraste 2,6:1 no avatar da obra em Obras, linhas de 92–170 caracteres. ~20 occlusion são etiquetas do próprio overlay (falso positivo).

## Comparação com 02/11 (docs/CRITIQUE-ROADMAP-REDESIGN-ERP-20261102.md)
O 02/11 não deu nota; esta é a primeira medida. Métricas: style={{ 5.772 → 5.770; hex em JSX ~183 em tela + ~266 em impressos; menu 65 → 65; temas 6 camadas → 7 CSS importados + 3 órfãos; PageHeader em 15 telas; seletor "Obra" próprio: 27 em 23 telas (16 sincronizadas com o topo, 11 não). O que melhorou: fluxo (carimbo em ~17 telas), plurais/acentos parciais, chat no topo. O que não mudou: tudo o que é Etapa 2 (caixas, densidade, KPIs) e a inconsistência de padrões.

## Pontos fortes
1. Fila de Compras com "Próxima ação" e atraso por linha.
2. Grade da quinzena na Gestão do ponto: feriado na coluna, fechamento bloqueado com motivo.
3. Central de obras: "1 obra precisa de decisão agora", "Ver como corrigir".

## Problemas prioritários
- [P1] Carimbo diz "Todas as obras" enquanto a tela de uma obra só mostra uma obra; e ~17 telas mantêm o próprio seletor "Obra". Carimbo aparece também onde não se aplica (Comercial, Minhas aprovações, TV). Correção: carimbo mostra a obra efetiva; tirar o seletor local das telas que seguem; esconder ou desativar o carimbo onde não vale. → clarify + harden
- [P1] Números que se contradizem: "3 críticas" × "0"; avanço da Alameda 0% / 39% / 42%; obras ativas 2 × 3. Correção: nome que diga a fonte e definição única. → clarify
- [P1] Ações de risco com peso de rotina: Desligar em cada cartão, lixeira ao lado de Aprovar baseline, "ok" em medição vencida. Correção: menu "⋯", diálogo de consequência, "Registrar recebimento". → harden
- [P2] Padrões de cabeçalho, abas e KPI inconsistentes; h1→h3. Correção: um padrão de abas e uma faixa de KPI no design system. → layout + polish
- [P2] Celular: shell e filtros comem a tela (primeiro registro de Compras em y≈690/844), ícones sem rótulo, nomes cortados. Correção: filtros em sheet, lista primeiro. → adapt

## Personas
Alex: ⌘K no Windows; grade do ponto por cliques cíclicos, sem digitar P/M/F; sem lote nem recentes.
Sam: legenda do ponto só por cor e "·"; botão sair com nome "x"; contraste 2,6:1 no avatar; foco visível só sob .arcd-main[data-workspace].
Casey: Presente/Falta pequenos sendo a ação mais frequente; Desligar na zona do polegar; Caixa vazia sem link; filtros antes dos dados.

## Observações menores
"120.00 KG"; "1 meses"; "(s)" ainda frequente; valores do Orçamento em mono azul; Gantt com rótulos cortados; "Equipe hoje" sempre 0; "Mais indicadores" não parece botão; "Diário de Obra" × "Novo relatório"; Modo TV caindo para Arial.

## Perguntas
1. Quando o topo e a tela discordam, em qual o engenheiro deve acreditar antes de dar baixa no estoque?
2. Qual é o único número que o dono precisa às 7h?
3. Por que a tela com mais identidade (TV) é a que ninguém toca, e as de risco são as mais anônimas?
