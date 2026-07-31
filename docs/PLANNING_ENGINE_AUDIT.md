# Auditoria — Planning Engine ARCD

## Linha de base

- Branch: `feat/integrated-production-platform`.
- Testes antes da etapa: 390 aprovados.
- Build: aprovado; `LegacyApp` ainda concentra 596,79 kB gzip.
- Prebuild financeiro: inativo fora de produção; nenhuma migration executada.
- Persistência atual: blob `arced_ponto_v1`, comandos operacionais e projeções server-side.

## Inventário

| Função | Situação atual | Limitação | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Fases e tarefas legadas | Existente e reutilizável | Estrutura no plano legado, sem EAP canônica | `planos.tarefas` | Alta |
| Atividades de cronograma | Existente e reutilizável | Campos ainda não normalizados para todos os métodos físicos | `scheduleActivities` | Alta |
| Dependências | Existente e reutilizável | Sem adaptador único e sem calendário de trabalho | `scheduleDependencies` | Alta |
| CPM | Existente, mas insuficiente | Dias numéricos; não calcula folga livre nem datas de calendário | `calculateCPM` | Alta |
| Baseline | Existente e reutilizável | Há baseline do plano e baseline de cronograma em coleções distintas | `planos.baseline`, `scheduleBaselines` | Alta |
| Progresso | Existente e reutilizável | Origem e método não estão uniformes | `progressRecords` | Alta |
| Lookahead e restrições | Existente e reutilizável | Restrição fica aninhada na janela; falta visão canônica por atividade | `lookaheadWindows` | Alta |
| PPC semanal | Existente e reutilizável | Sem vínculo obrigatório com EAP canônica | `weeklyCommitments` | Média |
| Linha de balanço | Existente e reutilizável | Usa campos explícitos, sem integração com calendário | `calculateLineOfBalance` | Média |
| Produção e produtividade | Existente, mas insuficiente | Cálculo puro existe, sem agregação de diário e recurso | `progressRecords`, ponto/RDO | Média |
| Orçamento | Existente, alto risco | Baseline já é protegida; leitura deve ser adaptada sem mutação | `budgetBaselines` | Crítica |
| Compras e estoque | Existente, alto risco | Não alterar a cadeia canônica de compras | pedidos, estoque, suprimentos | Crítica |
| Recursos e histogramas | Ausente | Sem capacidade/alocação canônica | equipe e equipamentos | Média |
| Curva S e valor agregado | Existente, mas insuficiente | EVM puro existe; não há fonte de planejamento por período | atividades e orçamento | Média |

## Decisão de arquitetura

O domínio novo ficará em `src/domains/planning/`, sem substituir `src/domains/planejamento/`. A primeira entrega é um motor puro e um adaptador de leitura do formato legado; não há gravação, migration, troca de baseline nem alteração de comandos operacionais. A migração só poderá começar após comparação de resultados em uma obra piloto.

## Rollback

O Planejamento atual continua sendo a única interface operacional. O novo motor fica sem importação no `LegacyApp` até a validação do piloto; removê-lo não altera o blob ou o cronograma vigente.

## Progresso físico — gate P0.2

- O motor paralelo agora exige método de avanço explícito: quantidade, peso físico, marco, medição aprovada, checklist ou percentual manual controlado.
- Pesos físicos são validados por pacote EAP e precisam de origem declarada; vínculos atividade→orçamento são apenas projetados e bloqueiam sobrealocação.
- A curva adicionada é estritamente física. Ela não lê pagamentos, pedidos, medições financeiras ou DRE; o cruzamento financeiro ficará condicionado ao razão canônico no gate de valor agregado.
- Nenhum comando, baseline, orçamento ou coleção persistida foi modificado nesta etapa.

## Comparação de piloto — gate P0.3

`comparePlanningPilot` lê `planos`/`scheduleActivities`, aplica o novo calendário e a rede de dependências em memória e entrega, por atividade, as diferenças de início, término e duração. A saída não atualiza datas, não cria baseline e não altera a obra: a migração exige comparação explícita e resultado aprovado para a obra piloto.
