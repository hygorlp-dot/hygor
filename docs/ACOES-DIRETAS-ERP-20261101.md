# Ações diretas e menos duplicação — 01/11/2026

Continuação local do desligamento direto, na branch `codex/rh-direct-dismissal-20261101`, checkout `C:/dev/releases/marcell-dismissal-local-20261101`. Base desta etapa: `bca86af9`. Sem push, dados reais ou deploy. A prévia desta entrega permanece em http://127.0.0.1:4257/ (usuário fictício `piloto@local.test`, senha `piloto-local`). O checkout compartilhado de Compras não foi modificado por esta etapa.

## Critério aplicado

Impeccable (Operate, distill e craft floor), shadcn e revisão de práticas React. Foram usados RecordAction e os botões, campos, diálogos e tokens já existentes. Nomes abrem cadastros; ações operacionais frequentes ficam junto ao registro; detalhes secundários continuam recolhidos; operações destrutivas mantêm sua confirmação. Não foram criados outro tema, biblioteca ou sistema de menus.

## Entrega por área

| Área | Antes | Agora |
| --- | --- | --- |
| Ponto por obra | Transferir e Demitir dependiam de Mais opções | Transferir e Desligar ficam no cartão, com as permissões e o bloqueio existentes |
| Ponto por obra | Seis situações disputavam a ação de presença | Presente, Meio dia e Falta continuam diretos; Férias, Atestado e Folga ficam em Mais opções; a situação excepcional escolhida aparece no cartão |
| Resumo do ponto | Atestado, férias e folga também entravam em Sem registro | O contador de lançados reconhece todas as situações válidas; Sem registro conta apenas o restante |
| Frota de equipamentos | Nome sem ação e cinco comandos por cartão | Nome abre cadastro; Locar, Transferir e Manutenção ficam diretos; Excluir equipamento permanece dentro do cadastro, com confirmação |
| Patrimônio | Editar na linha e Mover no menu | Nome abre cadastro e Mover fica na linha; o menu conserva consulta de histórico, foto quando disponível e alteração de situação |
| Licenciamento | Lápis sem nome e texto comprimido no celular | Editar visível, com exigência identificada no título e no nome acessível; no celular, o conteúdo recebe a largura da linha |

Os comandos de movimentação, locação, manutenção, gravação e desligamento são os existentes. Cancelar não salva. Em Ponto por obra, Último dia trabalhado e Confirmar desligamento seguem a terminologia de Equipes. Os fatores da folha e os fatos de presença não foram alterados pela correção do contador.

## Rastreio além das áreas alteradas

As 65 entradas do catálogo foram percorridas nos dois tamanhos de tela. A revisão de código conferiu recolhimentos e ações de Compras, Financeiro, Obras, Orçamento, Planejamento e Terceirizados. Abrir uma obra e editar seu cadastro são tarefas distintas; abrir o detalhe de um contrato de terceiro e editar seus dados também. Esses acessos foram preservados. Histórico de condições comerciais e memória de cálculo continuam em consultas secundárias, sem esconder a operação principal.

A auditoria anterior continua em `docs/RASTREIO-INTERFACE-20261101.md`. R02 foi corrigido. R06 e R07 receberam o tratamento operacional acima; não foi criada uma lista alternativa de equipamentos. R01 (paleta de anotação), R03 (diálogo do editor de fotos), R04 (proteção ao limpar rascunhos) e R08 (carregamentos internos) permanecem pendentes. Não há alegação de eliminação de toda redundância da ERP.

## Ajuda e manual

Revisados os tópicos Ponto por obra, Equipamentos, Locação de equipamentos, Patrimônio e Licenciamento. As variantes administrativas e de pessoal de obra herdam a orientação de ponto. A data continua 01/11/2026. Manual regenerado: 98 guias cobrem 65 abas. Foram removidas duas definições antigas de ajuda que eram sobrescritas pelos guias completos publicados de Arquivos e Licenciamento; os guias finais foram preservados.

## Verificação

- 10 cenários novos de navegação e ação, desktop/celular: cadastro pelo nome, operações diretas, confirmação de exclusão, cancelamento, histórico e foco do menu, legibilidade de exigências, afastamento no resumo e restrição de Engenharia. Arquivo versionado `e2e/direct-record-actions.spec.js`; projetos `record-actions-desktop` e `record-actions-mobile` no Playwright.
- 10 cenários de regressão do ponto: PIN, compatibilidade de dados, salvamento em trânsito, recarga e finalização.
- 20 cenários do fluxo do funcionário: cadastro, desligamento, agendamento, erro e acesso por perfil.
- 136 verificações de layout/navegação: 65 telas desktop/celular e verificações adicionais de cabeçalho/Compras. A correção final de Licenciamento foi verificada novamente pelos cenários específicos, incluindo largura do conteúdo acima de 250 px no celular de 390 px.
- 85 testes de código em oito arquivos: entrada do app, Patrimônio, situações/registros/permissões do ponto, painel de locações e controles/tokens compartilhados.
- Lint, TypeScript, design:check, manual:check e diff sem erros; grafo de importação sem ciclos.
- Build local direto pelo Vite, sem executar o prebuild de migrações. Bundle: 1.789.919 bytes gzip (1.747,97 KiB), dentro do teto existente de 1.789.952 bytes, sem aumentar limites.

Houve uma tentativa ampla de Vitest interrompida; ela abrangia 597 arquivos e não foi usada como evidência de aprovação da suíte completa. Um resultado intermediário de entrada foi repetido na execução focada, onde os quatro testes de App passaram. As aprovações acima são somente das execuções concluídas. Os testes de navegador usam API interceptada e dados fictícios; emulação não substitui testes com operadores e aparelho físico.

Logs e capturas em `artifacts/dismissal-direct/`: `actions-final.log`, `ponto-new.log`, `flows-new.log`, `whole-erp-new.log`, `unit-focused.log`, `lint-final.log`, `types-final.log`, `bundle-new.log` e `cycles-new.log`. As capturas finais foram inspecionadas para Frota, Patrimônio, Ponto e Licenciamento. Artefatos de execução não são incluídos no commit.
