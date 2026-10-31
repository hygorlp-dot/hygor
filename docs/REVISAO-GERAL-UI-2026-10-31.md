# Revisão geral de interface — MARCELL

Data: 31/10/2026. Refinamento posterior às quatro ondas do roadmap, com foco em Financeiro e Compras. Marca, logo, tipografia local e componentes existentes preservados. Skills aplicadas: Impeccable, shadcn, práticas React e verificação antes da conclusão.

## Escopo da inspeção

A sessão da aba integrada não estava disponível para a ferramenta de controle. A inspeção foi feita em Chromium isolado, sobre build estático local em 4199, com dados sintéticos e APIs interceptadas. A prévia compartilhada em 4198 não foi reiniciada. Não houve push, PR, deploy, migração ou gravação em serviços externos.

Foram capturadas 25 superfícies em 1440, 768, 390 e 320 px:

- Financeiro: Hoje, Caixa por conta, Documentos, Pagamentos, Notas fiscais, Fechamento, Visão financeira, Custos por etapa e Relatórios financeiros.
- Compras: Fila de trabalho, Solicitar, Cotar, Aprovações, Pedidos, Receber e Pagamentos.
- Demais áreas: Dashboard, Obras, Orçamento, Planejamento, Equipes, Estoque, Equipamentos, Fornecedores e Patrimônio da empresa.

A inspeção dos recortes foi complementada por jornadas de consulta, abertura de formulários, retorno, filtros e evidências. A revisão é ampla, mas não cobre todas as telas, perfis, volumes e combinações da aplicação. Não houve certificação de acessibilidade, desempenho da base real ou integrações autenticadas de produção.

## Refinamentos implementados

### Financeiro

- Pagamentos usa cabeçalho de seção e descrição curta, com “Ver notas fiscais” e “Receber documento fiscal”. O resumo financeiro virou uma faixa compacta, com valores e memoriais preservados, sem faixas laterais decorativas ou alerta vermelho em valor vencido zerado.
- No celular, os atalhos de etapas cedem lugar à seleção de situação que já existe junto da fila. Desktop conserva os atalhos com seus filtros e contagens. Não houve alteração dos totais, regras de aprovação ou registro de pagamentos.
- Busca, obra e situação ficam juntos. “Conferir documento” abre a nota específica do registro; o retorno indica “Voltar à fila de pagamentos” e conserva obra, situação, pesquisa e posição de consulta durante a sessão.
- Anexos e ações ocupam linhas próprias no rodapé móvel do registro, evitando botões comprimidos e palavras quebradas. Os controles expansíveis identificados em fechamento, custos e consultas receberam alvo de toque de 44 px.

### Compras

- Em Pedidos, “Novo pedido” passou para o cabeçalho, usando exatamente o formulário e os valores iniciais existentes. A ação duplicada no corpo foi removida; “Nova solicitação” permanece no menu.
- Busca e filtros compartilham a linha no desktop. No celular, busca permanece visível e filtros complementares usam o padrão expansível já adotado em Cotações. A contagem indica filtros ativos, e recolher mantém seus valores.
- O aviso de entregas atrasadas usa caixa de frase, resumo compacto e ação próxima. O registro aparece mais cedo, mantendo situação, fornecedor, atraso, valor, dossiê e recebimento acessíveis.
- Permissões, alçadas, comandos e cálculos de Compras permanecem os existentes. A regressão exercitou decisões, formulários, recebimentos, exportações e acesso por perfil.

### Interação compartilhada

O atalho da comunicação da equipe passou para o cabeçalho no celular, liberando a área dos botões dos registros. O mesmo painel, indicação de mensagens não lidas e acesso por teclado foram mantidos. O acionador informa seu estado de expansão e tem foco visível. Desktop conserva a posição existente. Abrir e fechar o painel foi verificado sem enviar mensagens.

## Validação final

| Verificação | Resultado |
|---|---|
| Varredura visual geral | 25 superfícies × quatro larguras = 100 capturas; sem erros de página ou transbordamento horizontal verificado |
| Jornadas focadas | 28 capturas em quatro larguras; abertura/retorno, filtros, dossiê, memorial e acesso ao chat; zero comandos operacionais |
| Regressão de Compras | 41 cenários aprovados |
| Regressão financeira desktop/celular | 14 cenários aprovados |
| Continuidade financeira | Dez verificações aprovadas |
| Testes direcionados | 33 testes aprovados em seis arquivos |
| Lint, TypeScript e build direto do Vite | Aprovados; permanece aviso conhecido de chunks grandes |
| Detector de layout nos componentes e estilos locais revisados | Sem ocorrências; resultados também inspecionados visualmente |

Nas jornadas focadas, uma nota em conferência abre a ficha com seu número exato e retorna à mesma pesquisa, situação e obra. O memorial mantém a consulta. “Novo pedido” tem uma única ocorrência e abre o formulário existente. Filtros de pedidos conservam valores ao recolher; limpar os filtros mantém a busca. O dossiê retorna ao pedido pesquisado. As fixtures financeiras dessas jornadas permanecem inalteradas.

As suítes de regressão podem exercitar gravações explícitas em APIs simuladas. Nenhum desses testes escreve no serviço real.

### Ajustes da validação

A fixture inicial da varredura ampla não tinha `budgetVersionId` nos planos nem a coleção de condomínios. Ao abrir Planejamento, a sincronização existente tentou completar os dados; as requisições foram bloqueadas pelo ambiente de revisão. A fixture foi completada, sem alterar a regra do aplicativo. A execução final das 100 capturas não enviou solicitações de gravação.

Um teste antigo do dossiê ainda esperava iframe e servia HTML como se fosse PDF. Foi atualizado para fornecer um PDF válido e conferir o canvas do leitor compartilhado e o link do original dentro da região de evidências. A execução final completa dos 41 cenários passou, sem retries.

## Nota final

Avaliação manual do design nas superfícies verificadas, com cinco critérios de igual peso. Não é uma métrica de produtividade ou estudo com usuários.

| Critério | Nota |
|---|---:|
| Hierarquia e próxima ação | 9,0 |
| Padronização de componentes e textos | 9,0 |
| Aproveitamento de espaço | 8,5 |
| Adaptação a desktop e celular | 9,0 |
| Continuidade e clareza dos fluxos | 8,5 |
| **Nota final** | **8,8/10** |

As consultas de fechamento, análise de custos e conciliação ainda exigem leitura e conferência de bases distintas. Parte das telas conserva componentes legados e formatos de data compactos. A revisão não torna esses fluxos automaticamente equivalentes nem elimina a necessidade de validação com dados, volumes e perfis reais.

## Evidências e reprodução

Artefatos em `artifacts/app-polish-review`: `after/verification.json`, 100 capturas em `after`, 28 capturas e relatório em `journeys`, logs `after.log`, `journeys.log`, `purchases-regression.log`, `finance-regression.log`, `navigation.log` e `unit.log`. Build em `build`; log em `artifacts/app-polish-review-build.log`. As capturas iniciais em `before` registram o ponto de partida e não são a execução final.

Reprodução: build direto do Vite para `artifacts/app-polish-review/build`; servir essa pasta em 4199; executar `POLISH_PHASE=after node scripts/app-polish-review.mjs` e `node scripts/app-polish-journeys.mjs` com a sintaxe de variável de ambiente do shell utilizado. Não usar o prebuild npm, que executa migrações.

O [roadmap](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md) permanece em quatro ondas e oito entregas do piloto local. Este relatório registra o refinamento geral posterior, sem publicação.
