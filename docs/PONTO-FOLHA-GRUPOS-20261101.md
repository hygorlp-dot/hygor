# Ponto e Folha por grupo — 01/11/2026

## Comportamento

Ponto por obra, Gestão do ponto e Folha da quinzena passam a oferecer Pessoal de obra, Administrativo e Todos. As três opções permanecem como abas visíveis no desktop e no celular; não há seletor duplicado. Todos mantém a consulta completa inicial. O grupo fica lembrado por tela durante a sessão do usuário, sem gravação na API. Trocar de grupo preserva obra e período.

O usuário confirmou manter a classificação atual: equipe marcada como administrativa, engenheiros e mestres pertencem ao Administrativo. A consulta não modifica cadastro, lotação ou histórico. Os filtros de obra existentes continuam se aplicando aos dois grupos.

Na Folha quinzenal, linhas, totais, pendências e relatórios respeitam o grupo. O cabeçalho da consulta, o PDF, a primeira planilha e o resumo textual identificam grupo e obra. Holerites CLT oferece apenas as pessoas do grupo; descartar uma edição antes de trocar exige confirmação. Recusar mantém a pessoa e os valores digitados.

As áreas gerais da Folha (projeção, encargos, custos, provisões e demais ferramentas) mantêm seus escopos próprios, com o seletor de grupo oculto. Não houve mudança em fórmulas, limites, cálculos de salário, regras sindicais ou alocação histórica de custos.

## Finalizações

Fechamento e reabertura da Folha são operações da empresa, exigindo Todos e Todas as obras. A comparação com pagamentos já fechados só roda na visão completa; filtrar uma equipe não deve produzir um falso alerta de divergência. O arquivamento da quinzena do ponto também exige Todos e Todas as obras. Finalizar o ponto diário de uma obra exige Todos. As verificações existem tanto nos controles quanto nos comandos da tela.

## Ajuda e validação

Adicionados seis guias específicos na fonte única `src/features/help/help-content.js`, com seleção contextual por grupo. O manual foi regenerado: 96 guias para as 65 abas principais. Ajuda mantém filtros e contexto.

- 6 cenários Playwright aprovados em desktop e celular, cobrindo as três telas, grupos disjuntos, engenheiro no Administrativo, preservação de período, ajuda contextual e controles de finalização.
- Cenários de Folha verificam também a lista de Holerites CLT, recusa de descarte e confirmação de troca.
- 16 testes de domínio e componente aprovados, incluindo agrupamento, folha, distribuição histórica de custos e fechamento.
- Lint, manual sincronizado, TypeScript e build Vite aprovados. Permanecem os avisos preexistentes de tamanho de chunks e módulos do ExcelJS.
- Inspeção das capturas encontrou o seletor móvel duplicado; corrigido antes da captura final. Detector de layout no componente das abas sem ocorrências.

Validação com dados fictícios locais, sem fechar folhas reais nem modificar dados de produção. Capturas em `artifacts/labor-groups`. Trabalho mantido na árvore local de revisão, sem push ou deploy.
