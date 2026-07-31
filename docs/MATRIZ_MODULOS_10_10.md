# Matriz de qualidade por módulo — ARCD Obras

> Atualizada em 26/07/2026. Esta é uma leitura técnica do repositório e da
> automação disponível; não substitui homologação por operador, obra, perfil e
> dispositivo reais. Por essa razão, nenhum módulo recebe nota 10 nesta versão.

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

| Verificação | Resultado |
| --- | --- |
| Branch | `feat/integrated-production-platform` |
| Árvore de trabalho | 466 entradas alteradas/não rastreadas antes desta matriz; não foram descartadas nem reescritas. |
| Dependências | `npm install` concluído; `npm audit --omit=dev`: 0 vulnerabilidades. |
| Testes | 91 arquivos, 423 testes aprovados. |
| Cobertura global | statements 78,97%; branches 60,84%; functions 79,02%; lines 87,63%. |
| Fronteiras financeiras | `npm run lint` aprovado. |
| Build | `npm run build` aprovado; aviso conhecido: chunk `LegacyApp` grande. |
| Bundle | gzip total 1.110,86 kB; `LegacyApp` concentra 596,87 kB gzip. |
| API | `node --check api/data.js` aprovado. |
| Integridade do diff | `git diff --check` aprovado. |

## Visão executiva

| Prioridade | Gate | Motivo objetivo | Condição de saída |
| --- | --- | --- | --- |
| P0 | FIN-003 / DRE-001 / REC-001 | O motor financeiro está deliberadamente em modo sombra; ativá-lo sem paridade seria risco de DRE. | Carga idempotente, divergência zero por obra/empresa e homologação de baixa/estorno. |
| P0 | Segurança de dados | O app ainda preserva uma superfície operacional ampla no `LegacyApp.jsx` e precisa de prova por perfil/obra. | Testes negativos por ação e escopo, com 403 no servidor e auditoria verificável. |
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
| Orçamento | 7 | `domains/orcamentos/calculations.test.js` e baseline existem. | Exportação, ABC e versão aprovada precisam de prova conjunta. | Golden master PDF/Excel/tela; Orçamento. |
| Planejamento | 7 | `domains/planejamento`, `planning-engine` e testes. | Arrastar barras, datas e baseline necessitam E2E. | E2E de edição e persistência; Planejamento. |
| Lookahead | 7 | Domínio e testes unitários presentes. | Sem validação de uso no campo e conflitos de sincronização. | Cenário de restrição/PPC offline; Produção. |
| Produção | 7 | `domains/producao/producao.test.js`. | Falta prova de integração com medição, qualidade e segurança. | Integração avanço físico bloqueado; Produção. |
| Diário de obra | 7 | `domains/diario-obra/diario-obra.test.js`. | Anexos, autoria e operação mobile sem E2E. | Captura com rede ruim; Campo. |
| Segurança | 6 | Regras de APR/PT e testes de domínio. | Cobertura de mutações é insuficiente e não há E2E de bloqueio. | Aprovar/revogar PT e bloquear avanço; SST. |
| Qualidade / conferências | 7 | `domains/qualidade/qualidade.test.js` e padrão de cancelamento. | Fotos mobile e reinspeção precisam homologação. | E2E foto, pendência e reinspeção; Qualidade. |
| Medições | 7 | Domínio e permissões possuem testes. | Faturamento incremental e cancelamento precisam prova ponta a ponta. | Medir, faturar, estornar e auditar; Financeiro. |
| Compras | 7 | Cálculos, cadeia e políticas testados. | Cadeia completa e cancelamento com impactos financeiros ainda exigem E2E. | Solicitação→NF→pagamento→cancelamento; Compras. |
| Estoque | 5 | Regras espalhadas no legado e compras. | Não há domínio/teste próprio suficiente para rastreabilidade. | Inventariar movimentos e criar testes de saldo; Suprimentos. |
| Suprimentos | 6 | `domains/suprimentos/calculations` testado. | Integração estoque/SINAPI/equipamentos não está homologada. | Teste de substituição e custo de referência; Suprimentos. |
| Equipamentos | 5 | Diretório de domínio existe. | Cobertura de cálculo baixa e integração SINAPI não comprovada. | Testes de locação, apropriação e comparação; Engenharia. |
| Financeiro | 7 | Ledger, workflows, shadow e políticas com testes; snapshot preserva obra quando a empresa paga terceiro. | Motor canônico ainda não é fonte oficial em produção. | FIN-002/003 com paridade zero; Controladoria. |
| Conciliação | 7 | Engine, matching, PIX card e comando servidor testados. | Importação real, baixa parcial e estorno precisam homologação. | Extrato real anonimizado; Financeiro. |
| DRE | 7 | Cálculos, mutações e projeção servidor testados. | Ainda coexiste com legado enquanto o motor está em sombra. | DRE só do razão com rastreio de evento; Controladoria. |
| Controladoria | 7 | `domains/controladoria/controladoria.test.js`. | Painéis dependem da consolidação financeira pendente. | Fechamento mensal com trilha de evidência; CFO. |
| Ponto | 6 | Arquivamento/restauração e integrações existem. | Necessita prova de idempotência operacional e vínculo à MO. | Arquivar/restaurar sem alterar DRE; RH. |
| Equipe | 6 | Regras estão em módulos e legado. | Sem suíte independente de jornada, alocação e desligamento. | Cenário de admissão/transferência; RH. |
| Folha | 6 | Integração financeira de permissões existe. | Há risco de semântica entre pagamento e custo reconhecido. | Golden master de MO por quinzena; RH + Financeiro. |
| Rescisões | 5 | Fluxo identificado no legado. | Falta domínio e testes específicos. | Regras legais/cálculo/auditoria; RH. |
| Terceirizados | 7 | Mutações de pagamento e ledger testadas. | Precisa prova de retenções, contratos e estorno. | Cenário completo com retenção; Financeiro. |
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
| Administração | 6 | Gestão de usuários e seções no legado; API de auth. | Exige E2E de papéis, delegação e recuperação. | Ações críticas por perfil; Administração. |
| Usuários e permissões | 7 | Autorizações de seção, projeção e integração testadas. | Falta cobertura negativa completa de cada rota/ação. | Matriz 403/escopo por obra; Segurança. |
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
   também o maior chunk do bundle. A extração deve ocorrer por fronteiras com
   testes, nunca por uma reescrita ampla.
4. A cobertura de branches é 60,84%; módulos com mutações pouco cobertas não
   devem receber homologação tácita apenas por build verde.

## Ordem de execução aprovada por risco

1. Completar testes negativos de autorização e de mutações críticas;
2. Homologar dados financeiros em sombra e só então decidir FIN-003;
3. Completar o conteúdo publicado do Portal do Cliente e o painel interno de publicação;
4. Transformar cada placeholder restante em fluxo funcional ou removê-lo do menu;
5. Migrar as telas de maior uso para primitives/tokens, com regressão visual e de contraste;
6. Executar ensaios mobile/offline e anexos de campo;
7. Reduzir o bundle por fronteiras lazy e tornar o orçamento um gate no CI.

## Regra de atualização

Cada avanço deve adicionar: link para teste, cenário homologado, responsável,
data e evidência de execução. Nota só sobe quando a lacuna descrita na mesma
linha estiver fechada; nota 10 exige aceite operacional documentado.
