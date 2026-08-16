# Matriz de qualidade por módulo — ARCD Obras

> Atualizada em 16/08/2026, segunda rodada do dia (rodada anterior no mesmo
> dia: extração parcial de 4/8 módulos; rodada anterior a essa: 26/07/2026).
> Esta é uma leitura técnica do repositório e da automação disponível; não
> substitui homologação por operador, obra, perfil e dispositivo reais. Por
> essa razão, nenhum módulo recebe nota 10 nesta versão.
>
> **Escopo desta rodada**: conclusão da fila de extração de UI do
> `LegacyApp.jsx` (`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`) — os 4 itens
> restantes (Planejamento, CentralAdministrador, Comercial, Folha/Medições)
> foram extraídos, fechando os 8/8 itens da fila. Em seguida, uma auditoria
> de depuração dirigida (3 investigações independentes em paralelo) varreu
> os 8 módulos extraídos em busca de bugs e falhas de interação entre
> módulos; 3 achados reais foram corrigidos nesta rodada (ver seção
> "Achados da depuração pós-extração"), e 2 achados que exigem decisão de
> produto/arquitetura foram registrados como tarefas separadas em vez de
> corrigidos às cegas. Notas re-julgadas com evidência nova apenas para os
> módulos tocados (Planejamento, Administração, Comercial, Folha,
> Terceirizados, Conciliação, Compras, Medições). As demais notas da rodada
> anterior foram mantidas — não foram reconferidas linha a linha nesta
> rodada; tratá-las como desatualizadas, não como reafirmadas.

## Critério de nota

A nota combina implementação observável, testes automatizados, isolamento de
dados, comportamento responsivo e evidência de operação. A nota **10** exige
todos esses pontos, inclusive homologação registrada. Uma suíte verde apenas
prova os cenários que ela cobre.

| Nota | Significado |
| --- | --- |
| 8–9 | Implementado e bem coberto; falta homologação operacional ou uma lacuna limitada. |
| 6–7 | Há domínio e testes, porém há risco de integração, UX, cobertura ou arquitetura. |
| 4–5 | Base funcional parcial; faltam fluxos críticos, cobertura ou integração. |
| 0–3 | Protótipo, placeholder ou ausência de evidência suficiente. |

## Linha de base verificável

| Verificação | Resultado (26/07) | Resultado (16/08, fila completa) |
| --- | --- | --- |
| Branch | `feat/integrated-production-platform` | `main`, commit `91f08ec` |
| Árvore de trabalho | 466 entradas alteradas/não rastreadas antes daquela matriz. | Working tree limpo; todo avanço desta sessão está em commits próprios. |
| Dependências | `npm audit --omit=dev`: 0 vulnerabilidades. | `npm audit --omit=dev`: **1 alerta alto** (`brace-expansion`, correção automática disponível via `npm audit fix` — não aplicada nesta sessão, sem relação com o trabalho de extração/depuração). |
| Testes | 91 arquivos, 423 testes aprovados. | **215 arquivos, 1.010 testes aprovados** (execuções seguidas sem flake, incluindo após a extração dos 4 últimos módulos e após as correções de bug). |
| Cobertura global | statements 78,97%; branches 60,84%; functions 79,02%; lines 87,63%. | statements **83,43%**; branches **65,95%**; functions **85,87%**; lines **91,29%** — estável frente à rodada anterior do mesmo dia (relocação de código, não mudança de comportamento). |
| Fronteiras financeiras | `npm run lint` aprovado. | `npm run lint` aprovado (script ajustado para ler a fronteira canônica de `MedicoesView` do arquivo extraído). |
| Build | `npm run build` aprovado; aviso conhecido: chunk `LegacyApp` grande. | `npm run build` aprovado; mesmo aviso, chunk bem menor (ver linha Bundle). |
| Bundle | gzip total 1.110,86 kB; `LegacyApp` concentra 596,87 kB gzip. | gzip total **1.250,26 kB** (orçamento de 1.220 kB **excedido** — overage pré-existente a esta sessão, ~28 kB antes de qualquer extração; as 8 extrações do dia somaram poucos kB ao total, esperado como overhead de code-splitting); `LegacyApp` caiu para **462,95 kB gzip** (era 672,44 kB no início do dia — queda de **31,2%** em 8 extrações completas). |
| API | `node --check api/data.js` aprovado. | `node --check api/data.js` aprovado. |
| Integridade do diff | `git diff --check` aprovado. | `git diff --check` aprovado. |
| `src/LegacyApp.jsx` | 33.175 linhas (era `src/App.jsx` monolítico). | **24.572 linhas** (era 40.311 no início do dia — extração de UI reduziu **39%** desde então, com os 8 itens da fila de `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` concluídos). |

## Visão executiva

| Prioridade | Gate | Motivo objetivo | Condição de saída |
| --- | --- | --- | --- |
| P0 | FIN-003 / DRE-001 / REC-001 | O motor financeiro está deliberadamente em modo sombra; ativá-lo sem paridade seria risco de DRE. | Carga idempotente, divergência zero por obra/empresa e homologação de baixa/estorno. |
| P0 | Segurança de dados | **Avançado em 16/08**: a fronteira de papel para os ~90 `OPERATIONAL_COMMAND` e 4 comandos financeiros agora tem cobertura negativa exaustiva no servidor (`server/operational-command-authorization.test.js`, 100 testes — testa cada comando contra todo o universo de papéis conhecidos, não uma amostra). Escopo por obra já era bem coberto (`server/operational-command-policy.test.js`, ~54 asserções). | Falta cobrir a rota HTTP `/api/data` ponta a ponta (a checagem de papel foi extraída para função pura testável, mas a rota completa com Supabase real ainda não tem teste de integração) e auditoria verificável por ação. |
| P1 | Portal do Cliente | `progress`, `decisions` e `financial` ainda exibem placeholder, embora a projeção segura exista. | Publicação interna, rotas reais e testes de visibilidade por obra. |
| P1 | Design System | Há fundação semântica, mas o legado ainda tem extensa estilização inline. | Migração por telas críticas, regressão visual e acessibilidade. |
| P1 | Campo/offline | Fila e shell existem, mas falta ensaio completo de captura, anexos, conflito e sincronização. | E2E em rede intermitente e telemetria de falhas. |
| P2 | Performance | A maior parte do bundle ainda está no `LegacyApp`. | Cortes lazy por domínio com orçamento de bundle no CI. |

## Matriz por módulo

| Módulo | Nota | Evidência no repositório | Lacuna para 10 | Próximo teste / responsável |
| --- | ---: | --- | --- | --- |
| Dashboard | 6 | Dashboard e testes mobile existem. | Sem homologação por perfil e sem regressão visual abrangente. | Fluxos admin/obra; Produto + Frontend. |
| Obras | 7 | Regras e projeções de dados presentes. | Escopo por obra precisa de prova E2E em toda ação. | Matriz de permissões por papel; Backend. |
| Contratos | 6 | Fluxos estão concentrados no legado. | Sem domínio isolado e sem suíte específica de ciclo contratual. | Criar testes de aditivo, medição e cancelamento; Engenharia. |
| Comercial | 6 | `domains/comercial` (funil, jornada do cliente, motor de indicação, imobiliário) com testes. UI extraída de `LegacyApp.jsx` para `domains/comercial/components/ComercialView.jsx` em 16/08 (chunk lazy próprio, 25,3 kB gzip) — corretamente consome `buildFinancialLedger`/`selectCashFlow` de `domains/financeiro/ledger` para figuras de caixa, em vez de recalcular por conta própria (confirmado por auditoria de convergência numérica desta rodada). Nota não sobe pela extração em si. | Falta suíte de aceite/rejeição de proposta e homologação do funil imobiliário ponta a ponta. | Cenário completo lead→proposta→contrato; Comercial. |
| Orçamento | 7 | `domains/orcamentos/calculations.test.js` e baseline existem. UI extraída de `LegacyApp.jsx` para `domains/orcamentos/components/OrcamentoView.jsx` em 16/08 (chunk lazy próprio, 46 kB gzip) — sem mudança de comportamento, nota não sobe por isso. | Exportação, ABC e versão aprovada precisam de prova conjunta. | Golden master PDF/Excel/tela; Orçamento. |
| Planejamento | 7 | `domains/planejamento`, `planning-engine` e testes. UI extraída de `LegacyApp.jsx` para `domains/planejamento/components/PlanejamentoView.jsx` em 16/08 (chunk lazy próprio, 26,5 kB gzip; montado de dois trechos não-contíguos porque `MiniKpi` — usado também por Compras/Medição/Equipamentos — ficou como export compartilhado em `LegacyApp.jsx`) — sem mudança de comportamento, nota não sobe por isso. | Arrastar barras, datas e baseline necessitam E2E. | E2E de edição e persistência; Planejamento. |
| Lookahead | 7 | Domínio e testes unitários presentes. | Sem validação de uso no campo e conflitos de sincronização. | Cenário de restrição/PPC offline; Produção. |
| Produção | 7 | `domains/producao/producao.test.js`. | Falta prova de integração com medição, qualidade e segurança. | Integração avanço físico bloqueado; Produção. |
| Diário de obra | 7 | `domains/diario-obra/diario-obra.test.js`. | Anexos, autoria e operação mobile sem E2E. | Captura com rede ruim; Campo. |
| Segurança | 6 | Regras de APR/PT e testes de domínio. | Cobertura de mutações é insuficiente e não há E2E de bloqueio. | Aprovar/revogar PT e bloquear avanço; SST. |
| Qualidade / conferências | 7 | `domains/qualidade/qualidade.test.js` e padrão de cancelamento. | Fotos mobile e reinspeção precisam homologação. | E2E foto, pendência e reinspeção; Qualidade. |
| Medições | 7 | Domínio e permissões possuem testes. UI extraída de `LegacyApp.jsx` para `domains/medicoes/components/MedicoesView.jsx` em 16/08 (chunk lazy próprio, 8,8 kB gzip) — sem mudança de comportamento, nota não sobe por isso. Uma auditoria de convergência numérica desta rodada confirmou que a tela consome apenas `totalRecebidoMedicao`/`statusRecebimentoMedicao` de `domains/conciliacao`, sem cálculo financeiro paralelo próprio — nenhum achado aqui. | Faturamento incremental e cancelamento precisam prova ponta a ponta. | Medir, faturar, estornar e auditar; Financeiro. |
| Compras | 7 | Cálculos, cadeia e políticas testados. UI extraída de `LegacyApp.jsx` para `domains/compras/components/ComprasView.jsx` em 16/08 (chunk lazy próprio, 40 kB gzip), junto com os 4 modais exclusivos (solicitação, pedido, cotação, recebimento). Nesta rodada, corrigido: `decidirAprovacao` agora aguarda `update()` e só mostra "registrada" se o servidor confirmou (antes reportava sucesso mesmo com decisão rejeitada). Não muda comportamento no caminho feliz, nota não sobe por isso. | `resumoFinanceiro` soma `pedidos[].pagamentos` por origem, enquanto o `comprasCost` canônico do DRE vem de notas fiscais — podem divergir em recebimento parcial/timing. Achado registrado como tarefa separada (decisão de produto), não corrigido às cegas. | Decidir e, se for bug, corrigir consumindo o ledger canônico; Compras. |
| Estoque | 5 | Regras espalhadas no legado e compras. | Não há domínio/teste próprio suficiente para rastreabilidade. | Inventariar movimentos e criar testes de saldo; Suprimentos. |
| Suprimentos | 6 | `domains/suprimentos/calculations` testado. | Integração estoque/SINAPI/equipamentos não está homologada. | Teste de substituição e custo de referência; Suprimentos. |
| Equipamentos | 5 | Diretório de domínio existe. | Cobertura de cálculo baixa e integração SINAPI não comprovada. | Testes de locação, apropriação e comparação; Engenharia. |
| Financeiro | 7 | Ledger, workflows, shadow e políticas com testes; snapshot preserva obra quando a empresa paga terceiro. | Motor canônico ainda não é fonte oficial em produção. | FIN-002/003 com paridade zero; Controladoria. |
| Conciliação | 7 | Engine, matching, PIX card e comando servidor testados. UI extraída de `LegacyApp.jsx` para `src/features/conciliacao/ConciliacaoView.jsx` em 16/08 (chunk lazy próprio, 20,5 kB gzip — vive em `src/features/`, não em `src/domains/conciliacao/`, porque esse caminho é agrupado no chunk manual "financial-domain" pelo `vite.config.mjs` e criava um ciclo com o `LegacyApp.jsx`). Nesta rodada, extraído `recebidoEntradaContrato()` em `domains/conciliacao/selectors.js` como fonte única do saldo de entrada de contrato — antes calculado duas vezes de forma idêntica (uma em `criarIndicesFinanceiros`, outra inline na tela); não havia divergência ativa, mas o risco de deriva futura foi eliminado. Nota não sobe por isso. | Importação real, baixa parcial e estorno precisam homologação. | Extrato real anonimizado; Financeiro. |
| DRE | 7 | Cálculos, mutações e projeção servidor testados. | Ainda coexiste com legado enquanto o motor está em sombra. | DRE só do razão com rastreio de evento; Controladoria. |
| Controladoria | 7 | `domains/controladoria/controladoria.test.js`. | Painéis dependem da consolidação financeira pendente. | Fechamento mensal com trilha de evidência; CFO. |
| Ponto | 6 | Arquivamento/restauração e integrações existem. | Necessita prova de idempotência operacional e vínculo à MO. | Arquivar/restaurar sem alterar DRE; RH. |
| Equipe | 6 | Regras estão em módulos e legado. | Sem suíte independente de jornada, alocação e desligamento. | Cenário de admissão/transferência; RH. |
| Folha | 6 | Integração financeira de permissões existe. UI extraída de `LegacyApp.jsx` para `domains/ponto/components/FolhaView.jsx` em 16/08 (chunk lazy próprio, 12,3 kB gzip — todas as dependências já eram imports/exports de nível de módulo em `LegacyApp.jsx`/`domains/ponto`/`domains/rh`, nenhum novo `export` foi necessário) — sem mudança de comportamento, nota não sobe por isso. | Há risco de semântica entre pagamento e custo reconhecido. | Golden master de MO por quinzena; RH + Financeiro. |
| Rescisões | 5 | Fluxo identificado no legado. | Falta domínio e testes específicos. | Regras legais/cálculo/auditoria; RH. |
| Terceirizados | 7 | Mutações de pagamento e ledger testadas. UI extraída de `LegacyApp.jsx` para `domains/terceirizados/components/TerceirosView.jsx` em 15/08 (chunk lazy próprio, 20 kB gzip). Nesta rodada, corrigidos: `saveTerc`/`confirmRemoveTerc`/`toggleActive` agora aguardam `update()` e só reportam sucesso se o servidor confirmar (antes mostravam sucesso mesmo com gravação rejeitada); `obraPago` por obra passou a aplicar o mesmo filtro `registroTerceiroAtivo` do resto da tela. Nenhuma dessas correções muda comportamento no caminho feliz, nota não sobe por isso. | A tela nunca consome `calcVisaoFinanceira`/DRE — soma `pagsTerceiros` sem filtro de competência em 4 pontos, enquanto o `tercCost`/`tercPago` canônico usa janela de período. Achado registrado como tarefa separada (decisão de produto: fluxo de caixa vs. custo reconhecido), não corrigido às cegas nesta rodada. | Decidir e, se for bug, corrigir consumindo o ledger canônico com teste de paridade; Financeiro. |
| Documentos | 7 | `domains/documentos/documentos.test.js`. | Permissões de arquivo e links externos requerem E2E. | Upload, visualização e revogação por obra; Documentação. |
| Comunicação | 4 | Há interfaces no legado. | Sem domínio, fila, auditoria e testes de entrega suficientes. | Definir eventos, destinatários e testes; Produto. |
| Portal do Cliente | 5 | Login, sessão, projeções seguras e rotas de progresso, decisões e financeiro de dados publicados. | Migration não foi homologada; falta painel interno de publicação e aceite de cliente real. | Publicar conteúdo e testar isolamento por cliente/obra; Portal. |
| Assistência técnica | 5 | Domínio e teste básico existem. | Cobertura de mutações é nula. | Abrir/atender/reabrir e anexar evidência; Pós-obra. |
| Ambiental | 5 | Domínio e teste básico existem. | Cobertura de mutações é nula. | Licença, condicionante e alerta de vencimento; Engenharia. |
| Encerramento | 6 | `domains/encerramento/encerramento.test.js`. | Checklist, documentos e aceite precisam fluxo E2E. | Fechar/reabrir com permissões; Pós-obra. |
| Mobile | 7 | Shell, dashboard, filtros e editor em tela cheia testados. | Falta matriz de dispositivos e tarefas de campo reais. | Chrome Android/iOS e acessibilidade; Frontend. |
| Offline | 6 | Fila de comandos e conectividade possuem testes. | Anexos, conflitos e recuperação de rede não estão homologados. | E2E offline/online idempotente; Campo. |
| Design System | 6 | Primitivos, padrões, dados e touch targets com testes. | Legado visual ainda usa estilos inline em larga escala. | Migrar páginas de maior uso; Design + Frontend. |
| Theme Engine | 6 | Tokens, tema e testes de provider. | Apenas base Carbon está pronta; falta aplicação completa e contraste real. | Auditoria WCAG por tela/tema; Design. |
| Administração | 6 | Gestão de usuários e seções no legado; API de auth. O orquestrador `CentralAdministrador` foi extraído de `LegacyApp.jsx` para `domains/administracao/components/CentralAdministradorView.jsx` em 16/08 (chunk lazy próprio, 3,6 kB gzip — só o orquestrador, 56 linhas; `GestaoUsuarios`/`GestaoAprovacoes` ficaram em `LegacyApp.jsx` de propósito, pois são renderizados por outras telas também) — sem mudança de comportamento, nota não sobe por isso. | Exige E2E de papéis, delegação e recuperação. | Ações críticas por perfil; Administração. |
| Usuários e permissões | 7 | Autorizações de seção, projeção e integração testadas. Nesta rodada: cobertura negativa exaustiva por papel para todo comando operacional/financeiro (`server/operational-command-authorization.test.js`) somada à cobertura de escopo por obra já existente — a matriz 403/escopo pedida na lacuna abaixo está fechada no nível de função pura. Nota não sobe por isso: falta o teste de integração HTTP real (rota `/api/data` com Supabase) e auditoria verificável por ação, que é o que a nota 8+ exigiria. | Falta teste de integração ponta a ponta da rota `/api/data` (não só da função de autorização isolada) e trilha de auditoria verificável por ação. | Integração HTTP real com Supabase de teste; Segurança. |
| Auditoria | 7 | Migration, trilha e testes de integração presentes. | Auditoria append-only precisa homologação com Supabase real. | Mutação + leitura imutável; Segurança. |
| Backup e recuperação | 6 | `backup.test.js` e documentos de operação. | Restauração completa e RPO/RTO não foram ensaiados. | Simulado de restore e relatório; Operações. |
| Relatórios / Excel / PDF | 6 | Exportadores e leitores seletivos existem. | Sem golden masters visuais/cálculos por todos os módulos. | Comparar saída com dados de referência; Dados. |
| IA | 4 | Interface e configuração existem. | Não há avaliação determinística, guardrails nem evidência de decisão auditável. | Fixtures e revisão humana obrigatória; Produto. |
| Landing / Login | 7 | Parallax de login e testes de layout existem. | Necessita validação de acessibilidade, movimento reduzido e login real. | E2E de autenticação e WCAG; Frontend. |

## Achados objetivos de placeholder e acoplamento

1. O Portal do Cliente já renderiza Progresso, Decisões e Financeiro a partir
   de projeções publicadas. Ainda falta o painel interno de publicação e a
   homologação da migration, por isso ele não está pronto para abertura geral.
2. `FINANCIAL_ENGINE_ENFORCE` é lido em `api/data.js`, porém a documentação do
   projeto preserva-o em modo sombra até a paridade ser demonstrada. Este é um
   bloqueio correto, não um defeito a ser contornado.
3. `src/LegacyApp.jsx` continua sendo o maior ponto de acoplamento técnico e
   também o maior chunk do bundle, mas encolheu de 40.311 para **24.572
   linhas (-39%)** e de 672,44 para **462,95 kB gzip (-31,2%)** em 15-16/08,
   com a **fila completa de 8 módulos** extraída para chunks lazy próprios
   (Terceiros, Orçamento, Conciliação, Compras, Planejamento,
   CentralAdministrador, Comercial, Folha/Medições) — exatamente pela
   fronteira-com-teste que este achado pedia, sem reescrita ampla (suíte de
   1.010 testes ficou verde em cada uma das 8 etapas). A fila de
   `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` está fechada; o que resta em
   `LegacyApp.jsx` é o casco de app (roteamento de abas, autenticação,
   `update()`/fila de sincronização, componentes primitivos como `Btn`/
   `Modal`/`Sel`, e telas menores que nunca entraram nessa fila como
   Dashboard/Obras/Financeiro/DRE) — reduzir mais exigiria decompor esse
   casco, não mais extrações de tela isoladas.
4. A cobertura de branches é 65,95% (era 60,84% em 26/07, 65,96% na rodada
   anterior do mesmo dia); módulos com mutações pouco cobertas não devem
   receber homologação tácita apenas por build verde.
5. O orçamento de bundle (`scripts/bundle-budgets.mjs`, teto de 1.220 kB
   gzip total) está reprovado — mas por crescimento orgânico anterior a
   15/08, confirmado testando a árvore de antes de qualquer extração desta
   sessão (que já reprovava por ~18 kB). As 8 extrações do dia mudaram o
   total em poucos kB no acumulado; não são a causa da reprovação, mas
   também não a resolveram.

## Achados da depuração pós-extração (16/08, segunda rodada)

Após fechar a fila de extração, uma auditoria dirigida (3 investigações
independentes e paralelas: leftovers de extração, convergência numérica
entre módulos, falha silenciosa/tratamento de erro) varreu os 8 módulos
extraídos e os pontos de interação entre eles.

**Corrigidos nesta rodada** (mecânicos, sem mudança de comportamento no
caminho feliz, cobertos pela suíte de 1.010 testes):

1. `ComprasView.jsx` (`decidirAprovacao`) e `TerceirosView.jsx` (`saveTerc`,
   `confirmRemoveTerc`, `toggleActive`) mostravam sucesso e fechavam o modal
   sem aguardar a confirmação do servidor via `update()` — uma decisão de
   aprovação, cadastro ou cancelamento rejeitada pelo servidor (permissão,
   conflito de versão) ainda era relatada ao operador como salva. Todos os
   quatro agora aguardam o resultado e só declaram sucesso se `ok!==false`.
2. `TerceirosView.jsx`: `obraPago` (card por obra) somava pagamentos sem o
   filtro `registroTerceiroAtivo` que o resto da tela usa — o total por obra
   podia divergir do total por contrato na mesma página.
3. `domains/conciliacao/selectors.js`/`ConciliacaoView.jsx`: o saldo de
   entrada de contrato comercial era calculado duas vezes com a mesma
   fórmula (uma vez em `criarIndicesFinanceiros`, outra inline na tela).
   Extraído `recebidoEntradaContrato()` como fonte única; não havia
   divergência ativa, mas o risco de deriva futura foi eliminado.

**Registrados como tarefas separadas, não corrigidos às cegas** (exigem
decisão de produto/arquitetura, fora do escopo de uma depuração mecânica):

4. **(mais severo)** `update()` em `LegacyApp.jsx` aplica o estado otimista
   antes da resposta do servidor e nunca faz rollback quando a fila de
   salvamento resolve como `FAILED`/`CONFLICT` — a tela continua mostrando a
   edição rejeitada como válida, e uma gravação bem-sucedida posterior pode
   reenviar essa edição rejeitada sem o usuário reconfirmá-la. Afeta toda
   tela que usa `update()`, não um módulo isolado; corrigir sem supervisão
   teria raio de mudança e risco de regressão grandes demais para esta
   rodada.
5. `TerceirosView.jsx` e `ComprasView.jsx` calculam totais financeiros
   (pago a terceiros; split de pagamentos de compras por origem) direto
   sobre `pagsTerceiros`/`pedidos[].pagamentos`, sem filtro de competência,
   em vez de consumir `calcVisaoFinanceira`/o ledger canônico do DRE (que
   filtra por período e, no caso de compras, reconhece custo por nota
   fiscal, não por pagamento). Pode ser divergência real ou diferença
   semântica intencional entre "pago" (caixa) e "custo reconhecido"
   (competência) — decisão de domínio, não bug óbvio.

## Ordem de execução aprovada por risco

1. Decidir e implementar o rollback de `update()` em falha/conflito
   permanente (achado #4 da depuração pós-extração) — maior risco de
   integridade de dados identificado nesta rodada;
2. Decidir a fonte de dados financeira de Terceirizados/Compras (achado #5)
   e, se for bug, corrigir com teste de paridade contra o DRE;
3. **Parcialmente fechado em 16/08**: testes negativos de autorização por
   papel e por obra para comandos operacionais/financeiros — feito
   (`server/operational-command-authorization.test.js` +
   `server/operational-command-policy.test.js`). Falta ainda: teste de
   integração HTTP real da rota `/api/data` (não só a função de
   autorização isolada) e testes negativos de mutações críticas
   (regras de negócio rejeitadas, não só papel/escopo);
4. Homologar dados financeiros em sombra e só então decidir FIN-003;
5. Completar o conteúdo publicado do Portal do Cliente e o painel interno de publicação;
6. Transformar cada placeholder restante em fluxo funcional ou removê-lo do menu;
7. Migrar as telas de maior uso para primitives/tokens, com regressão visual e de contraste;
8. Executar ensaios mobile/offline e anexos de campo;
9. Trazer o orçamento de bundle para dentro do teto (a fila de extração de
   `LegacyApp.jsx` está fechada; o próximo corte precisa vir de outra
   fronteira — code-splitting dentro dos domínios maiores ou revisão do
   próprio teto) e torná-lo um gate no CI.

## Regra de atualização

Cada avanço deve adicionar: link para teste, cenário homologado, responsável,
data e evidência de execução. Nota só sobe quando a lacuna descrita na mesma
linha estiver fechada; nota 10 exige aceite operacional documentado.
