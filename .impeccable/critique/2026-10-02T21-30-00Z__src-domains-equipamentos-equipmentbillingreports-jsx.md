---
target: aba Cobrança por obra — Central de cobranças (src/domains/equipamentos/EquipmentBillingReports.jsx)
total_score: 31
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-10-02T21-30-00Z
slug: src-domains-equipamentos-equipmentbillingreports-jsx
---
# Revisão Impeccable — Central de cobranças

**Método**: revisão manual das 10 heurísticas sobre capturas reais em Chromium (1440, 1280, 1024px; estados normal, margem negativa, várias pendências, sem pendência, sem dados, filtro de uma obra, memória da obra), com `.impeccable/config.json` e a crítica da Central de Locações como régua; testes de domínio, de componente e e2e. É autoavaliação, não crítica independente.

## Design Health Score

| # | Heurística | Nota | Por quê |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 3 | Bloco de fechamento diz o estado da competência a partir dos lançamentos; cada seção traz o escopo ("Setembro 2026 · todas as obras"). Sem conferência formal registrada (lacuna de produto, dita na tela). |
| 2 | Correspondência com o mundo real | 4 | Equação contratual → descontos → líquida → custo → resultado → margem, na ordem que o financeiro lê. |
| 3 | Controle e liberdade | 3 | Chips removíveis, "Limpar filtros", voltar ao ranking. Filtros não persistem entre sessões. |
| 4 | Consistência e padrões | 3 | Primitivos do design system (Select, Input, Checkbox, EmptyState, ErrorState); abas com role="tab". Cabeçalho do módulo ainda é o legado. |
| 5 | Prevenção de erros | 3 | Faturamento separado e marcado "fora do DRE" evita somar fatura com receita; custo em recorte avisa "só repasses". |
| 6 | Reconhecimento vs. memorização | 3 | Pendências viram filtro com um clique; ranking ordena por qualquer coluna. |
| 7 | Flexibilidade e eficiência | 3 | Busca livre, "Somente com pendência", exportação e PDFs a partir do próprio painel. |
| 8 | Estética e minimalismo | 3 | Bloco de marca e excesso de dourado removidos; cores semânticas só para negativo/alerta. Página ainda é longa na visão geral. |
| 9 | Recuperação de erros | 3 | ErrorState se o cálculo falhar; estado vazio explica e aponta a competência. |
| 10 | Ajuda e documentação | 3 | Tooltip em cada KPI com a origem do número; doc `docs/EQUIPAMENTOS_CENTRAL_COBRANCAS.md`. |

**Total: 31/40.**

## Problemas

**[P0]** nenhum.

**[P1]** nenhum.

**[P2] Visão geral longa.** Fechamento + atenção + resultado + composição + próprios×terceiros + faturamento + operação + 2 gráficos numa rolagem. Mitigado por abas (Visão geral / Por obra / Mapa) e por ordem de prioridade; dividir mais exigiria nova navegação.

**[P2] Fechamento é inferido, não registrado.** A tela é honesta sobre isso; resolver exige fluxo de governança (fora de escopo).

**[P2] Resultado por obra sem manutenção.** Limitação do domínio (manutenção por equipamento), explicada na memória da obra.

**[P3] Contagens com "(s)"** ("1 desconto(s) elevado(s)") — pluralização genérica herdada do padrão do módulo.

**[P3] Classes `equipment-report-*` ociosas em `src/index.css`.**

**Corrigido nesta rodada**: cabeçalhos de linha da tabela Próprios × Terceiros herdavam fundo cinza e caixa-alta do CSS global; chip/select mostravam id cru ("ob-a") ou "Todas as obras" quando a obra filtrada não tinha locação na competência; marcador lateral dourado na seleção do mapa (antipadrão) removido.
