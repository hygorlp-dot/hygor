# Roadmap de projetos e Kanban

Escopo autorizado em 31/10/2026: evoluir a proposta apresentada neste chat e implementá-la localmente. Preservar dados existentes, cronômetro, links, revisões, permissões e identidade MARCELL. Sem publicação ou alterações em banco real.

| Etapa | Entrega | Aceite | Situação |
| --- | --- | --- | --- |
| 1 — Carteira visual | Quadro de projetos pelas etapas existentes; alternância quadro/lista; arraste e reordenação; filtros preservados | Movimento persiste no servidor, com versão e autoria; não transfere obra nem altera horas  Concluída e validada localmente |
| 2 — Produção por projeto | Quadro de atividades: A fazer, Em produção, Revisão técnica, Aguardando cliente, Concluído | Mouse e toque pelo puxador; seletor e botões de ordem para teclado; dados legados continuam disponíveis  Concluída e validada localmente |
| 3 — Cartões operacionais | Responsável, prazo, prioridade, estimativa, horas realizadas, checklist, bloqueio, dependências, link de entrega e comentários | Edição sem perda de histórico; ciclos e referências inválidas recusados; filtros por responsável, prioridade e texto  Concluída e validada localmente |
| 4 — Revisão e capacidade | Cronômetro no cartão, limites de produção/revisão, conclusão condicionada a checklist/dependências/parecer quando configurado | Uma sessão por usuário; limites verificados no servidor; arraste não fabrica aprovação; falha mantém a posição confirmada  Concluída e validada localmente |
| 5 — Conferência local | Testes de comandos e API, arraste e recuperação no navegador, desktop/mobile, revisão visual e atualização do manual | Build direto, lint e typecheck; exemplo local aberto e preservado  Concluída e validada localmente |

## Desenho de implementação

- Reutilizar `engineeringProjects` e os comandos operacionais autenticados. Movimentos e comentários são novos comandos; formulário não substitui sessões, revisões ou comentários.
- Carteira: cada cartão representa um projeto. Etapas existentes são preservadas. Projeto encerrado só reabre por movimento explícito ou edição; projeto arquivado exige reabertura pelo cadastro.
- Atividades: cada cartão representa uma tarefa. Estados antigos `pendente`, `em_andamento` e `concluida` são mantidos; adicionar `em_revisao` e `aguardando_cliente`.
- A ordem é persistida e os movimentos usam a versão lida ao iniciar o gesto. Sem alteração otimista de posição antes da confirmação. Conflitos pedem atualização dos dados.
- Pendências e bloqueios permanecem visíveis no cartão. Uma tarefa só conclui com checklist completo, dependências concluídas e cronômetro pausado. Se vinculada a uma entrega que exige revisão, a última versão deve estar aprovada.
- A exigência de parecer na conclusão do projeto é configurável. Quando ativa, deve haver revisões e a última versão de cada entrega submetida precisa estar aprovada.
- Limites por coluna são configuráveis por projeto; zero significa sem limite. Reduzir o limite sinaliza excesso existente, mas não move nem remove tarefas automaticamente.
- Manter componentes shadcn/primitivos existentes. No celular, os quadros rolam internamente; o puxador aceita toque, e o seletor nativo oferece alternativa ao arraste. O restante da página não ganha rolagem horizontal.

## Extensões que exigem outro escopo

Comparação visual de PDF/DWG/RVT, conectores OAuth do OneDrive/Autodesk, notificações externas e automações com serviços contratados não fazem parte desta entrega. Dependem de decisões sobre provedores, permissões, formatos e armazenamento. Os recursos locais acima não dependem dessas integrações.

## Referências da pesquisa

- ClickUp: quadros e horas — https://clickup.com/features/project-time-tracking
- ClickUp: pareceres visuais — https://help.clickup.com/hc/en-us/articles/6325985679383-Annotate-images-videos-and-PDFs-with-Proofing
- monday.com: conteúdo dos cartões — https://support.monday.com/hc/en-us/articles/360000661379-The-Kanban-View
- Asana: dependências e prazos — https://help.asana.com/s/article/all-asana-features
- Kanboard: arraste e limites por coluna — https://kanboard.org/

## Resultado verificado — 31/10/2026

- 332 testes aprovados em 12 arquivos selecionados: comandos, política de acesso, API e regressões do módulo.
- 9 cenários de navegador aprovados: desktop/mobile, arraste por mouse e toque, ordem após recarga, checklist, comentários, horas, falha de gravação, concorrência de cronômetros e restrição por obra.
- Lint, typecheck, build direto isolado e verificação de whitespace aprovados. O build mantém os avisos de tamanho dos chunks maiores já presentes no ERP.
- Revisão visual independente: `ship` após corrigir o mínimo de 44 px nos alvos móveis do checklist e dos comentários. Tokens e identidade existentes preservados.
- Exemplo Casa Alameda preservado em arquivo local, com quatro atividades, duas revisões e comentário de orientação. O arquivo foi conferido após uma gravação feita pela interface.
- Instância de demonstração estável em `http://127.0.0.1:4202`, sem HMR, banco real, push, PR ou deployment.
