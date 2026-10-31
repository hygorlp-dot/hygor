# Projetos de engenharia e arquitetura

O módulo está na aba **Projetos**, no grupo **Obras e projetos**. O código e as verificações desta entrega são locais; não exigem migração de banco, publicação ou contratação de SaaS.

## Uso

1. Clique em **Novo projeto** e informe nome, cliente, responsável, disciplina, etapa, prazo e horas previstas. Vincule uma obra ou mantenha como projeto de escritório. O vínculo da obra é preservado depois do cadastro.
2. Em **Visão geral**, organize atividades com responsável, situação e prazo. O histórico identifica quem realizou cada operação e quando.
3. Em **Links e entregas**, cadastre pastas, arquivos ou modelos do OneDrive, Drive, Autodesk ou outro serviço. São aceitos links HTTP e HTTPS sem credenciais na URL. O sistema não transfere arquivos nem altera as permissões do serviço de origem.
4. Ao começar o trabalho, escolha uma atividade opcional, registre uma nota e clique em **Iniciar cronômetro**. Clique em **Pausar cronômetro** ao terminar ou interromper o trabalho.
5. Em **Horas**, consulte sessões e totais por pessoa. Uma sessão encerrada pode ser ajustada pelo próprio usuário ou pelo administrador, com justificativa. A duração anterior permanece no histórico.
6. Em **Revisões**, escolha uma entrega, informe o link específico da versão e descreva as mudanças. O parecer exige justificativa e registra aprovação ou solicitação de ajustes. Só a versão mais recente ainda pendente pode receber parecer. Uma nova revisão nasce pendente; os pareceres anteriores permanecem preservados.

No celular, um seletor nativo alterna entre as quatro áreas. Em desktop, a navegação interna usa abas. A carteira permite buscar por nome, cliente e disciplina e filtrar situação, obra e responsável.

## Quadros Kanban

A carteira abre no quadro de projetos pelas etapas Levantamento, Estudo preliminar, Anteprojeto, Executivo e Concluído. O seletor **Visualização da carteira** permite voltar à lista. A posição do cartão é persistida; a obra vinculada, as horas e as revisões são preservadas. Projetos arquivados precisam ser reabertos no cadastro antes de serem movidos.

Dentro do projeto, **Visão geral** mostra o quadro de atividades com as colunas A fazer, Em produção, Revisão técnica, Aguardando cliente e Concluído. A lista continua disponível em **Visualização das atividades**. Texto, responsável e prioridade filtram os cartões. Quando há filtro, a capacidade considera todas as tarefas da coluna, não apenas as visíveis.

Para mover ou reordenar, arraste pelo puxador **Mover cartão**, usando mouse, caneta ou toque. Também é possível usar o seletor **Mover para** e os botões **Subir/Descer**, acessíveis pelo teclado. O quadro rola internamente na horizontal, inclusive no celular; aproximar o puxador das bordas permite avançar durante o gesto. Após a confirmação, a coluna de destino fica visível. Uma falha ou conflito mantém a posição confirmada anteriormente e exibe o motivo.

### Conteúdo dos cartões

As atividades possuem prioridade, horas previstas, descrição, checklist, predecessoras, motivo de bloqueio, entrega vinculada e comentários. Os cartões mostram responsável, prazo, horas realizadas e previstas, progresso do checklist e estado da revisão vinculada. **Iniciar/Pausar** no cartão usa o mesmo cronômetro do projeto, atribuindo a sessão à atividade; continua valendo uma sessão ativa por pessoa.

O formulário aceita até 50 itens de checklist, um por linha. A marcação é feita no cartão e registra auditoria; durante a gravação, o item mostra o estado pendente e reverte se o servidor recusar. Os comentários preservam autoria e data e não são substituídos pela edição do cadastro da tarefa.

### Regras de avanço

- Uma atividade com bloqueio ou predecessoras incompletas não pode avançar nem iniciar uma nova sessão de trabalho. Relações com tarefas de outro projeto, autorreferências e ciclos são recusados.
- Para concluir, a atividade deve ter todos os itens do checklist marcados e o cronômetro pausado. Quando **Exigir aprovação da última revisão da entrega** estiver marcado, é necessário vincular uma entrega e aprovar sua versão mais recente.
- Reabrir uma predecessora que tenha dependentes concluídas exige reabrir essas dependentes primeiro.
- Para concluir o projeto, todas as atividades e sessões precisam estar encerradas. A opção **Exigir aprovação da última revisão das entregas submetidas** também exige ao menos uma revisão e o parecer favorável da versão mais recente de cada entrega submetida.
- Os limites de **Em produção** e **Revisão técnica** são configurados no cadastro do projeto. Zero significa ilimitado. Novos projetos sugerem 3 e 2 atividades, respectivamente; projetos antigos mantêm ausência de limite até configuração explícita. Reduzir o limite sinaliza o excesso existente, sem alterar os cartões automaticamente.
- Mover cartões não aprova revisões nem inicia ou pausa cronômetros automaticamente. As decisões e as sessões continuam sendo ações explícitas e auditadas.

## Ambiente local para testar o roadmap

```powershell
node node_modules/vite/bin/vite.js build --outDir artifacts/projetos/build
node scripts/project-kanban-preview.mjs
```

A instância abre em `http://127.0.0.1:4202`. Acesso fictício: `piloto@local.test` / `piloto-local`. As chamadas da API terminam nesse processo; somente comandos do módulo de projetos são executados. Os dados ficam em `artifacts/projetos/demo-state.json`, com gravação serializada e substituição do arquivo após o comando. O ambiente não utiliza o banco nem o OneDrive reais e não publica na Vercel.

A interface usa o build isolado, sem recarregamento automático por alterações de outros trabalhos no repositório. Após mudar o código, gere novamente o build e reinicie essa prévia para atualizar também os comandos do servidor.

O exemplo Casa Alameda conserva as quatro atividades e as revisões R01/R02 da demonstração, agora com estimativas, checklist, dependências e regra de aprovação. Os arquivos `.txt` de exemplo são documentos fictícios; não são desenhos executivos.

## Regras do cronômetro

- Cada pessoa pode ter uma única sessão ativa na empresa, inclusive entre projetos, abas e dispositivos.
- O tempo continua sendo contado até a pausa, mesmo ao navegar, recarregar ou fechar o navegador. Não há detecção automática de trabalho ou inatividade no AutoCAD/Revit.
- O início e o encerramento são datados pelo servidor autenticado. O contador visual não grava dados a cada segundo.
- Uma faixa nas outras telas do ERP indica a sessão ativa e permite pausá-la.
- Sessões acima de 12 horas ficam sinalizadas para conferência na lista de horas.
- Todos os cronômetros do projeto precisam estar pausados antes de concluir ou arquivar o projeto. Para registrar novos trabalhos ou corrigir horas depois disso, reabra o projeto.
- Uma falha de conexão não confirma início, pausa ou alteração. O formulário é preservado e a repetição da mesma operação reutiliza a chave idempotente. Use **Atualizar dados** para recuperar a fotografia confirmada do servidor após um conflito.

## Acessos e persistência

Administradores, engenheiros e engenheiros auditores recebem a aba por padrão. Listas personalizadas de abas continuam sendo respeitadas. Outros perfis precisam de concessão explícita da aba Projetos. O servidor verifica a permissão e o vínculo com a obra; operadores restritos a uma obra não recebem projetos de outras obras ou de escritório.

O agregado `engineeringProjects` é persistido pelo pipeline de comandos operacionais já existente, na linha principal da empresa. Esse pipeline usa bloqueio de linha com conexão direta ou compare-and-swap com releitura e repetição limitada. As verificações de sessão ativa são refeitas sobre os dados atuais, evitando dois cronômetros do mesmo usuário. O histórico do projeto mantém a idempotência mesmo quando uma operação antiga sai da janela compartilhada de recibos.

Cadastro, links, atividades, revisões, sessões e histórico são alterados exclusivamente pelos comandos `PROJETO_*`. Gravações diretas de `engineeringProjects` por snapshot ou delta são rejeitadas. Campos internos não podem ser substituídos pelo formulário do cadastro. Horas não geram folha ou lançamentos financeiros automaticamente. Obras com projetos vinculados não podem ser excluídas.

O controle de revisões é documental e humano: não inclui busca automática por versões no provedor, OAuth, comparação visual de PDF/DWG/RVT ou validação técnica de desenhos.

Use um endereço específico para cada versão do arquivo. O histórico preserva o link e o parecer, sem copiar os arquivos: se o mesmo endereço for sobrescrito no provedor, o conteúdo acessível por ele também poderá mudar.

## Código e testes

- Domínio e interface: `src/domains/projetos/`.
- Política de acesso: `server/engineering-project-policy.js`.
- Integração: comandos operacionais, projeção da API, catálogo de abas e navegação do ERP.
- Testes de domínio: `src/domains/projetos/commands.test.js`.
- Testes de autorização: `server/engineering-project-policy.test.js`.
- API real com persistência simulada: `src/integration/operational-command-locked-path.test.js`.
- Navegador: `e2e/engineering-projects.spec.js` e `playwright.projetos.config.js`.

Para verificar o navegador sem interferir no servidor de desenvolvimento ou no build de outro trabalho, gere um build isolado e execute a suíte dedicada:

```powershell
node node_modules/vite/bin/vite.js build --outDir artifacts/projetos/build
node node_modules/@playwright/test/cli.js test --config playwright.projetos.config.js
```

A suíte usa dados sintéticos e intercepta as chamadas da API. Não acessa nem grava o banco real. As capturas ficam em `artifacts/projetos/`. O build direto ignora o `prebuild` do projeto, que pode executar migrações quando há credenciais configuradas.

## Verificação da primeira entrega — 31/10/2026

- 311 testes de domínio, autorização, API e regressão aprovados em 11 arquivos de teste selecionados.
- 6 cenários de navegador aprovados: fluxo completo em 1440 px e 390 px, recuperação de falha com chave idempotente, duas abas concorrentes, pausa fora do módulo e carteira restrita por obra.
- Lint, typecheck e build local isolado aprovados. O build mantém os avisos de tamanho dos chunks maiores do ERP.
- Revisão visual independente: `ship`, incluindo seletor nativo no celular; identidade visual e tokens existentes preservados.
- Sem push, pull request, publicação na Vercel ou gravação no banco real.

## Verificação da evolução Kanban — 31/10/2026

332 testes de domínio, autorização, API e regressão passaram em 12 arquivos selecionados; 9 cenários de navegador passaram, incluindo arraste real por mouse e toque, reordenação após recarga, checklist, comentários e os fluxos anteriores de horas/revisões. Lint, typecheck e build isolado passaram. A revisão visual independente aprovou o ajuste dos alvos móveis de pelo menos 44 px. O exemplo e a persistência em arquivo local foram conferidos pela interface e pela leitura do arquivo salvo.

O roadmap executado e as integrações que exigem outro escopo estão em `docs/ROADMAP-PROJETOS-KANBAN.md`.
