# Padrão obrigatório de interface MARCELL

Vigente desde 01/11/2026. Aplica-se a toda nova tela, módulo, aba, componente, formulário, mensagem, relatório operacional e alteração de interface. Preservar MARCELL e sua logo. A base operacional segue a direção SAP aprovada, adaptada aos componentes existentes.

## Onde ajustar depois

| Ajuste desejado | Fonte única |
| --- | --- |
| Fonte da interface e tamanhos de títulos, corpo, rótulos, tabela e botões | `src/design-system/tokens/typography.css` |
| Peso, espaçamento interno, distância entre ícone/texto e tamanhos de botão | Tokens `--arcd-button-*` em `foundations.js`; receita em `src/design-system/primitives/button-contract.css` |
| Cores, pesos de cabeçalho e diferenças de cada tema | `src/design-system/themes/themeRegistry.js` |
| Altura dos controles, linhas, preenchimento de painéis e distância entre grupos por densidade | `src/design-system/tokens/density.css` |
| Escala de espaçamentos para composições | `src/design-system/tokens/spacing.css` |
| Caixa padrão: raio, recuo interno, distância entre caixas e alinhamento de tabelas | Tokens `--arcd-box-*` em `foundations.js`; receita em `src/design-system/themes/box-contract.css`; regras em `docs/REGRAS-UX-UI.md` §8 |
| Cabeçalhos, filtros e composição comum dos módulos | `src/design-system/themes/module-standard.css` e `src/design-system/patterns/` |
| Textos genéricos já compartilhados: confirmação, carregamento e paginação | `src/design-system/copy.js` |
| Título, instrução ou ação de negócio específica | Componente do módulo; se repetidos, catálogo de textos do próprio domínio |
| Ajuda e manual do operador | `src/features/help/help-content.js`; gerar com `npm run manual:generate` |

A família da interface começa em `--arcd-font-sans`, com Inter local. Ajuste esse token uma vez em `tokens/typography.css` para todos os temas, incluindo o Modo TV. Os tamanhos da interface também ficam nesse arquivo. A densidade aplica os papéis compactos em `tokens/density.css`. As aliases legadas `--type-body` e `--type-display` seguem a fonte comum. Identificadores técnicos usam `--arcd-font-mono`. Impressão e PDF usam Nimbus Sans.

A geometria de botões vem dos tokens de `foundations.js` e da densidade, com a receita em `primitives/button-contract.css`. O tema fornece as cores dos papéis ao mesmo componente. Textos genéricos como Confirmar vêm de `UI_TEXT.actions.confirm`. Ações específicas como Aprovar proposta continuam com o nome da operação.

As alturas de toque têm mínimo de 44px. Ao alterar a escala, preserve esse mínimo, contraste, foco e legibilidade. Aparência e densidade podem ser escolhidas pelo operador em Alterar aparência; este guia descreve manutenção pelo desenvolvimento, não um editor visual de todos os textos.

## Contrato para toda introdução

1. Consultar Impeccable e shadcn, esta documentação e o componente existente antes de criar outro. Usar imports diretos para evitar carregar módulos desnecessários.
2. Usar PageHeader para título, descrição e ações; FilterBar para filtros relacionados; FormSection para grupos de edição; padrões de tabela, navegação, diálogo e estados vazios já disponíveis. O cabeçalho geral mantém Ajuda.
3. Usar Button, Input, Select, Textarea, Checkbox e demais controles compartilhados. `Btn`, `Inp` e `Sel` são pontes de compatibilidade para código legado, não uma nova biblioteca. Não criar botões com `div` ou `label` clicáveis. O seletor de arquivo nativo pode ficar oculto e ser aberto por botão acessível.
4. Usar variantes primary, secondary, ghost e destructive conforme o contrato do Button. Preferir uma ação principal por etapa; estados de erro, aviso e sucesso usam papéis semânticos. Não aplicar cores, fontes, tamanhos ou espaçamentos fixos nos módulos para contornar o sistema.
5. Escrever rótulos em português, com ação e objeto: “Novo orçamento”, “Salvar alterações”, “Receber materiais”. Não usar caixa alta como estilo. Preservar nomes e regras do negócio; nunca substituir conteúdo cadastrado pelo usuário por texto de interface.
6. Usar UI_TEXT apenas para linguagem realmente genérica. Textos do módulo podem ter catálogo próprio com chaves estáveis. Não criar um arquivo global com todo o conteúdo do ERP nem localizar valores técnicos, status persistidos ou códigos usados em comandos.
7. Preservar obra, período, busca e filtros na tarefa; aproximar a próxima ação do registro. Diálogos precisam de título, foco e saída claros. Mensagens devem explicar o problema e a recuperação, sem prometer recursos inexistentes.
8. Verificar composição e interação em desktop e celular, teclado, conteúdo longo, vazio, carregamento e erro. Aumentar tipografia não pode cortar controles. Modo TV e impressão têm receitas próprias documentadas; não copiar essas exceções para telas operacionais.
9. Revisar ajuda e manual na mesma alteração. Fluxo interno próprio usa useHelpTopic com identificadores existentes/cadastrados e seu guia incluído no manual.
10. Executar `npm run design:check`, lint, testes pertinentes e build local com `npx vite build`. Não usar a publicação como forma de testar; o prebuild do projeto executa migrações, portanto não chamar `npm run build` para uma validação puramente visual.

## Como a checagem protege o padrão

`npm run design:check` também faz parte de `npm run lint`. Inspeciona marcação JSX em arquivos JS, JSX, TS e TSX de produção, incluindo arquivos ainda não versionados. Bloqueia crescimento por arquivo/regra de controles HTML próprios e de tipografia, cores e espaçamentos literais nos atributos `style`. Componentes de infraestrutura e campos nativos de arquivo/invisíveis têm tratamento específico.

O legado está registrado em `scripts/design-system-baseline.json`. Um novo arquivo começa com limite zero; um arquivo existente não pode aumentar suas ocorrências. Reduzir exceções é permitido. Não regenerar nem aumentar a baseline para fazer uma implementação passar; novas exceções exigem justificativa e aprovação explícita. Ao migrar o legado, reduzir a baseline correspondente após revisão.

A checagem é uma barreira parcial: não interpreta todo CSS, estilos indiretos, semântica de textos ou qualidade do fluxo. Quantidades por arquivo também não provam que uma exceção antiga não foi trocada por outra. Revisão do diff, composição e comportamento permanece obrigatória. Não declarar adesão completa do legado apenas porque o lint passou.

## Primeira migração do legado

Financeiro e Compras adotam os controles e tokens comuns; detalhes em `docs/MIGRACAO-FINANCEIRO-COMPRAS-20261101.md`. Para campos que já têm um rótulo associado, usar SelectControl, TextareaControl e ChoiceControl, sem criar rótulos aninhados. Para seleção/abertura de um registro ou indicador, usar RecordAction; comandos continuam com Button. Anexos usam FilePicker. Importar diretamente de `src/design-system/primitives/` ou `patterns/`; não criar outra família de controles no domínio.

## Revisão desta entrega

Consolidação técnica com valores visuais e rótulos preservados. Fonte da ajuda e manual revisados; não há novos passos ou controles para o operador, por isso não foi necessário reescrever instruções. Manual regenerado para conferir sincronização. Tudo local, sem deploy. A capacidade de ajustar os tokens foi exercitada no navegador em Compras, no desktop e celular, sem editar o módulo.

Validação local: 136 cenários da varredura do ERP, 14 cenários específicos e 8 cenários de temas aprovados. 59 testes de componentes, ajuda e verificador aprovados; os 5 testes do verificador foram repetidos após ampliar a leitura para JS/TS. Uma prova com arquivo JSX novo contendo botão próprio e tamanho fixo foi rejeitada pelo comando real; o arquivo temporário foi removido e a checagem voltou a passar. Lint, TypeScript, manual sincronizado e build aprovados; JS/CSS 1.742,57 KiB gzip, abaixo do teto de 1.748 KiB. A captura de Conciliação no desktop ficou idêntica, pixel a pixel, à captura anterior com os mesmos dados.

## Segunda migração do legado

Obras, Orçamento, Planejamento e Pessoas, incluindo seus apoios operacionais, seguem as mesmas receitas da primeira migração. Ver `docs/MIGRACAO-OBRAS-PESSOAS-20261101.md` para escopo, verificações e limites.

- Planilhas: `--arcd-sheet-row-height`, `--arcd-sheet-line-height`, `--arcd-sheet-cell-padding` e `--arcd-sheet-type-body` ficam em `foundations.js`. Usar Input/TextareaControl na célula existente; conservar edição, autoexpansão e navegação. A densidade da célula não deve diminuir o alvo dos comandos no celular.
- Ponto: situações e troca da obra do dia usam RecordAction. Cores representam a situação; não aplicar a aparência genérica de Salvar a essas células.
- Arquivos: FilePicker conserva o evento original. Propriedades do input nativo, como `capture`, `aria-label`, `key` e `onClick` de reinicialização, passam por `inputProps`. Escolher um arquivo não equivale a salvar o formulário.
- Busca composta: manter uma única superfície de campo e foco visível. Não empilhar uma moldura de controle ao redor de outro Input nem fixar filtros sobre as linhas da operação.

Ajuda revisada para importação de planilha/PDF, anexos do diário, câmera/galeria, prontuário e edição do orçamento. Manual gerado da mesma fonte; mudanças estritamente visuais de espaçamento, foco e ícones não alteram os passos operacionais.

## Atalhos do RH — 01/11/2026

Pendências do RH retoma o painel existente e usa os mesmos Button, Badge, campos e FlowTabs do sistema. A alteração de composição das abas pertence ao componente compartilhado: listas longas quebram em linhas no desktop; no celular permanece o seletor de áreas. Não criar versões locais para resolver o mesmo problema em cada módulo.

Toda alteração de linguagem visual deve valer para toda a ERP pela base comum. Tipografia, cores, espaçamentos e dimensões vêm dos tokens; estados e apresentação vêm dos controles. Composições e textos de uma tarefa podem pertencer ao domínio, sem redefinir o padrão visual. A regra também está em AGENTS.md.

Detalhes funcionais e evidências em `docs/ATALHOS-RH-20261101.md`.

## Cadastro pelo ponto e entrada — 01/11/2026

Na Gestão do ponto, o nome usa RecordAction como acesso ao cadastro, sem a moldura de um comando. A linha não repete Ficha ou Limpar; correções continuam nas células do dia. O cabeçalho do cadastro apresenta vínculo, último dia e motivo antes dos demais campos. Os comandos e indicadores continuam usando a base compartilhada.

A espera inicial usa a marca existente e o Spinner comum, com tokens do tema. Só aparece após 200 ms; não representa uma falha de login nem dispensa o download do aplicativo em uma conexão lenta. Detalhes e evidências em `docs/PONTO-CADASTRO-DESLIGAMENTO-20261101.md`.

## Ações de registro sem esconder o próximo passo

A ação frequente de um registro deve estar junto dele. Em Equipes, Desligar abre uma confirmação existente; não executa uma saída por um clique isolado. Nome abre a ficha, Detalhes tem acionador próprio e ações de consulta não devem receber rótulos que aparentem outra operação. Reutilizar RecordAction, controles e tokens da base, sem variantes de aparência por módulo. Entrega e verificações em `docs/DESLIGAMENTO-DIRETO-20261101.md`.


Aplique o mesmo critério aos ativos: em Frota e Patrimônio, o nome usa RecordAction para abrir o cadastro. Movimentações operacionais ficam na linha/cartão; comandos destrutivos conservam confirmação e contexto. Menu não substitui a próxima ação frequente, nem deve repetir uma ação já exposta. Exigências de Licenciamento usam Editar com o documento no nome acessível. No celular, dê largura ao conteúdo antes de comprimi-lo para acomodar comandos lado a lado. Ver `docs/ACOES-DIRETAS-ERP-20261101.md`.


## Anotações e descarte de rascunhos

Cores escolhidas pelo usuário para desenhar são conteúdo: use ColorSwatch da base, mantendo a amostra real e nome acessível. A aparência do botão, seleção e foco continua no tema. Não substitua a cor desenhada pelo fundo genérico de um comando.

Editores de foto usam Modal; não recrie overlay, foco ou Escape. Limpar conteúdo deve permitir recuperação por Desfazer ou pedir confirmação quando a recuperação não existir. Filtros não exigem essa confirmação. Use useUnsavedChanges e UnsavedChangesPrompt para preservar a edição ao cancelar; nomeie a ação pelo conteúdo, como Limpar cálculo. Rascunhos não são preferências e histórico salvo não é apagado pela limpeza do formulário.

Em diálogos empilhados, fechar uma confirmação não encerra a edição de origem, e fechar editor/confirmação juntos deve devolver o foco ao acionador válido. Evidências em `docs/EDITOR-FOTOS-RASCUNHOS-20261101.md`.


## Espera de telas e consultas

Use LoadingState de `src/design-system/patterns/LoadingState.jsx` para preparar áreas e consultas. label é o assunto, como compras ou documento; o componente monta a mensagem, aguarda 200 ms para anunciar e usa o Spinner comum. title e description mantêm a compatibilidade com o catálogo anterior. A ponte legacy/ui reexporta a mesma receita para telas antigas.

Não crie textos soltos de Carregando nem deixe uma ação explícita sem retorno por usar fallback vazio. Um editor aberto sob demanda deve preservar título e fechamento enquanto carrega. Ao cancelar, a resposta atrasada não pode reabrir o editor. Não associe esse aviso a uma confirmação de gravação.

Consultas de fundo devem conservar os dados úteis e indicar a atualização no próprio trecho. Esqueletos estruturados, mensagens de última consulta/offline e botões com loading continuam tendo função própria. Elementos decorativos não precisam anunciar espera. O status do carregamento não deve ficar dentro de um contêiner aria-busy que impeça seu anúncio; a DataTable usa a mensagem comum como indicação de espera.

Revisão e evidências em `docs/CARREGAMENTOS-INTERNOS-20261101.md`.

## Menu lateral ajustável

O shell compartilhado usa `SidebarResize` e `useSidebarWidth`. Largura expandida de 208 a 360 px, inicial de 224 px, persistida neste navegador. Arrastar, setas, Home/End e Enter (restaurar) têm o mesmo resultado em todos os módulos. O modo compacto conserva a preferência; celular e tablet mantêm a navegação existente. Não definir larguras próprias por módulo.

## P1 — fundação precisa, piloto local

O tema `marcell` é MARCELL Preciso, padrão para novos navegadores, com densidade Compacta. Preferências válidas são preservadas; Alterar aparência permite selecionar o piloto ou Restaurar padrão. IBM Plex Sans é a família operacional comum, hospedada localmente em `public/fonts/ibm-plex`, pesos 400/500/600 e licença OFL incluída. A paleta do tema está em `themeRegistry.js`; foco da lateral usa `--arcd-nav-focus`, adequado ao fundo escuro. Densidade continua em `tokens/density.css`, sem reduzir o tamanho da fonte. Listas e formulários reutilizam controles, escala e estados existentes. Esta etapa não altera regras ou transições de Compras e Financeiro.

## P2 — fila e quadro com o mesmo recorte

Usar `WorkQueueBoard` para a representação por colunas. O domínio fornece os grupos de registros já filtrados e os callbacks de ação; o componente não grava operações nem altera datas. O mesmo seletor/modelo serve às duas visões. `onMove`, quando houver, só pode abrir o fluxo existente de revisão e confirmação e deve validar o registro no escopo e o acesso atual. Não criar estados de negócio para salvar a posição visual de um cartão.

Preferências de apresentação usam `useQueuePreferences`, com área e usuário. Só layout e direção podem ser armazenados por esse hook. Filtros, busca, registros e rascunhos ficam no workspace da sessão, conforme o contrato existente. Tabela e quadro compartilham prazos e contagens; grupos da tabela são apresentação, não filtro. Financeiro não permite arraste por coluna de prazo. Detalhes e evidências em `PILOTO-MARCELL-P2-20261101.md`.


## P3 — ficha rápida e retorno ao contexto

Nas filas de Compras e Financeiro, identificação usa `RecordAction` para consultar e `Button` para uma operação distinta. A consulta usa `RecordPanel` (`src/features/workflow/RecordPanel.jsx`), composto sobre o `Modal` existente: painel à direita no desktop e tela inteira no celular, com título, fechamento e Ajuda contextual. Conteúdo e espaçamento usam tokens compartilhados; não criar sobreposições próprias por módulo.

Mostrar primeiro identidade, obra, situação/prazo, valor e próxima ação permitida. Consultas não gravam dados. Formulários curtos existentes abrem sobre a ficha; cancelar retoma a consulta. Edição extensa continua na área operacional. Compras registra a origem para o retorno à fila e o Financeiro conserva seus retornos operacionais. A ficha guarda só a identidade do registro na sessão e resolve o conteúdo no modelo atual e no escopo permitido; registro removido ou concluído deve informar indisponibilidade, sem comandos obsoletos.

Paginação e seleção usam `useWorkspaceState`; `useQueuePosition` conserva a rolagem da fila e do quadro na sessão, por área e escopo. Fechar a ficha devolve o foco ao código/nome sem deslocar a lista. Não persistir registros ou rascunhos no armazenamento de preferências. Recarregar encerra o contexto da sessão, conforme P2. Guias temporários usam prioridade no `useHelpTopic`; ao fechar, o guia da área reaparece. A Ajuda pode receber foco sem que o modal de origem a capture; Escape encerra apenas a camada ativa.

Relatório e roadmap: `PILOTO-MARCELL-P3-20261101.md`.


## P4 — exceções, confirmação e linguagem

Pagamentos de Compras e da central financeira, além do recebimento em Compras, usam `dispatchConfirmedAttempt` em `src/features/workflow/command-attempt.js`. Preserve o comando completo enquanto a resposta for incerta: mesma chave idempotente, versão, IDs, quantidades, pagamento e anexos. Repetir a confirmação na mesma sessão deve reenviar o comando original. Uma confirmação ou rejeição definitiva encerra a tentativa; erro de conexão, timeout ou resposta potencialmente transitória a conserva. Não transformar ausência de resposta em sucesso, nem gerar outra operação automaticamente.

Durante o envio, proteja campos e fechamento. Após resposta incerta, conserve o preenchimento e impeça sua alteração até confirmar a mesma operação. O fechamento continua disponível após a falha, com orientação para conferir o histórico antes de sair ou recarregar. Esta tentativa não é um rascunho durável: documente a limitação e não prometa recuperação após desmontagem do módulo ou recarga. `mrc-command-fields` é a composição comum dos campos protegidos; botões de confirmação e Ajuda ficam fora do fieldset.

Use Registrar pagamento em Compras e Financeiro; Dar entrada no estoque continua confirmando a chegada real. Adiantamento é classificação do servidor, não uma promessa feita por um checkbox. Motivo recomendado não vira nova trava. Entrega, pagamento e conferência fiscal permanecem independentes; excesso recebido continua sendo aviso.

Na ficha de pedido, distinguir Valor do pedido, Pago e Saldo a pagar. No Financeiro, distinguir Valor original, Liquidado e Saldo em aberto. Pagamento de pedido ainda sem vínculo fiscal exige aviso junto à ação; não abater o saldo da nota no navegador nem vincular por descrição/fornecedor. Avisos do ledger respeitam a obra da parcela, inclusive em rateios. Textos genéricos repetitivos podem ficar na Ajuda, preservando valores, alertas relevantes e próxima ação na ficha.

A consulta não concede autorização. Resolver ações contra usuário, acesso e obra atuais, espelhando os papéis existentes da API; o servidor continua sendo a autoridade. Registros excluídos/inativos não devem participar da fila operacional. Datas impossíveis não podem receber aparência de prazo válido.

Evidências, riscos residuais e avaliação conservadora em `PILOTO-MARCELL-P4-20261101.md`.

## Recuperação e pagamento compartilhado — P5, 02/11/2026

Pedidos e notas fiscais em Compras e Financeiro devem usar `PaymentDialog`. Reutilizar `Button`, campos, `FilePicker`, `Modal` e tokens existentes. Ação curta financeira precisa distinguir rascunho de confirmação enviada sem resposta; usar `dispatchConfirmedAttempt` com usuário e contexto para proteger o comando antes do envio. Não reenviar automaticamente na recarga. Retomar confirmação mantém IDs, versão e chave idempotente. A alocação usa o comando próprio, respeitando saldo, obra e fechamento; nunca fabricar novo pagamento para representar dinheiro já pago. Ajuda e manual acompanham o mesmo formulário. Ver [P5](PILOTO-MARCELL-P5-20261102.md) para limites da proteção local e validação.

## Retomada e contexto atual — revisão P5, 02/11/2026

A identidade da confirmação local distingue classe do documento e ID. Consulte o registro atual para apresentar obra e decidir acesso; o contexto do rascunho é histórico e não concede permissão. Falha de armazenamento durante reenvio mantém o comando original em memória. Migrações locais devem preservar registros e comprovantes, abortar integralmente em falha e ser verificadas com o formato anterior.

Para selecionar o contexto de Ajuda, use os IDs de `src/features/help/help-topics.js` ou `useHelpTopic`. Os textos continuam na fonte única `help-content.js`; não importe os guias completos estaticamente em telas operacionais apenas para acessar o mapa de IDs. Mensagens genéricas compartilhadas, como `UI_TEXT.feedback.recordUnavailable`, pertencem à base comum de linguagem.

A recuperação de falhas da fila geral usa `src/domains/sync/SaveRecovery.jsx` e os controles compartilhados. Ação de retomada só aparece quando a fila a permite; mensagens não devem prometer persistência após recarga se o fluxo guarda dados apenas em memória. Os mapas de ajuda ficam em `src/features/workflow/help-topics.js`, com reexportação compatível no endereço anterior; os textos permanecem na fonte única `help-content.js`.


## Recuperação compartilhada — 02/11/2026

- Toda tentativa de gravação geral deve passar pela fila com proteção local, escopo da conta e revisão do servidor. Não criar reenvio automático após recarga nem tratar recusa de acesso como falha transitória.
- Modal, Dialog e Drawer compartilham ciclo de foco, Escape apenas na camada superior, bloqueio de rolagem e limites da área visível com teclado. Use essas bases; não crie camadas e atalhos paralelos.
- Uma recuperação altera a revisão dos editores. Formulários antigos devem ser fechados e reabertos; seus campos e ações ficam bloqueados para impedir envio de dados desatualizados. Fechar permanece acessível.
- Tentativas de salvar outro formulário durante uma pendência são protegidas separadamente, sem substituir a primeira. Se a gravação local falhar, manter a memória, impedir confirmação e oferecer proteção ou descarte explícito.
- Gráficos operacionais mostram a geometria final imediatamente, sem animação de entrada. Valores, legendas e interações continuam disponíveis.
- Ajuda explica o limite: proteção das tentativas de salvar não equivale a salvamento automático de todo campo nem a backup.


## Barra única de comandos — 02/11/2026

Compras e Financeiro usam WorkspaceHeading e WorkspaceCommandBar, em src/design-system/patterns/WorkspaceCommandBar.jsx. O título e a navegação formam a identificação da área. A barra seguinte reúne escopo, consulta e ações; indicadores resumidos e resultados precedem a lista. Não repetir obra, exportação ou ação principal em outra faixa. Nenhum comando deve ser duplicado apenas para adaptar o celular.

Submenus de áreas, abas e filtros de visão seguem o mesmo contrato em `src/design-system/patterns/submenus.css`. A seleção usa um filete inferior na cor do texto, com contagens tabulares e foco visível. Altura, tipografia e espaçamentos vêm da densidade compartilhada. No celular, os seletores existentes conservam sua função e as faixas horizontais têm altura de toque. Mudanças nesse padrão devem chegar a todas as implementações do mesmo controle.

Use `TabRow`, `TabsList`, `FlowTabs` ou `WorkspaceNavigation` conforme a navegação da tela. Grupos de filtros de visão que precisam de marcação própria usam `mrc-submenu`. Ajuste a posição do grupo em um contêiner da página e faça alterações visuais dos submenus no CSS compartilhado. O comando `npm run design:check`, também executado pelo lint, exige a regra comum e barra novas exceções nos seletores e elementos cobertos. O inventário `scripts/submenu-legacy.json` identifica regras anteriores e permite sua remoção. Preserve o inventário ao alterar a regra comum.

A barra usa os tokens comuns e conserva os rótulos dos controles, a ordem natural de Tab e os estados dos filtros. No celular, os grupos se reorganizam em linhas, mantendo alvos de toque e a próxima ação no registro. Não ocultar valores ou avisos relevantes para compactar. A lateral padrão continua azul-marinho MARCELL; outros temas previamente disponíveis conservam suas preferências.


Correção de alinhamento em 02/11/2026: WorkspaceCommandBar controla a altura real dos campos e o padding vertical dos botões com --arcd-control-height. O rótulo usa o mesmo intervalo da base em todos os grupos. Não reintroduzir mínimos próprios como os 43 px legados do seletor de obra. A densidade continua configurável; no celular os alvos mantêm pelo menos 44 px. Indicadores textuais usam alinhamento pela linha de base. O teste visual compara topo, altura e rótulos, além da borda inferior.


## Alturas na base global — 02/11/2026

O contrato de campos em src/design-system/primitives/control-contract.css aplica a altura da densidade a entradas de uma linha e seletores simples em toda a ERP. Os espaçamentos verticais dos botões vêm de foundations.js; a altura mínima e a centralização do conteúdo não dependem do padding. Botões com texto longo continuam podendo crescer. Textarea, seletores múltiplos, arquivos, opções de seleção e editores de planilha preservam seus contratos próprios. No celular, campos e botões comuns mantêm pelo menos 44 px.

A barra de Compras/Financeiro consome a mesma base. Filtros da Conciliação usam Input, Select e Button compartilhados, incluindo rótulos visíveis e o intervalo padrão no seletor de categoria. Não criar controles nativos ou alturas particulares para reproduzir uma barra.

## Travas de padronização do ERP — 24/11/2026

O `design:check` também verifica mudanças de apresentação nos seletores compartilhados e em propriedades de estilo inline dos componentes abaixo. As exceções encontradas na primeira varredura foram registradas por arquivo, seletor, propriedade e valor. A trava permite eliminar esse legado. Novos valores e duplicações precisam seguir a fonte comum.

| Padrão protegido | Fonte para mudanças globais | Ocorrências legadas na auditoria inicial |
| --- | --- | ---: |
| Botões e campos | `primitives/button-contract.css` e `primitives/control-contract.css` | 228 |
| Caixas e indicadores | `themes/box-contract.css` e `patterns/kpi-strip.css` | 167 |
| Diálogos e estados de tela | `primitives/styles.css` e `patterns/styles.css` | 80 |
| Tokens de aparência | `foundations.js`, `themeRegistry.js` e `tokens/` | 32 |
| Cabeçalhos e filtros | `themes/module-standard.css` e `patterns/command-bar.css` | 24 |
| Tabelas e listas responsivas | `data/styles.css` | 3 |

As contagens registram declarações ou propriedades, inclusive algumas regras históricas na base comum. Cada contagem indica o escopo da trava estática. Componentes próprios ainda precisam ser migrados para herdar o contrato. A auditoria local abriu as 65 áreas administrativas no Plataforma em 1440 e 390 px e conferiu dez áreas nos temas Preciso e Noite nas mesmas larguras, em 170 combinações. Os dados de teste eram fictícios. Foram observados cabeçalhos compartilhados em 64 áreas, com a composição própria do Modo TV. Na amostra do desktop, nove telas exibiram tabelas e não apresentaram o componente de tabela compartilhado. Entre elas estão Compras, Financeiro, Conferência e Ponto Geral.

A primeira prioridade de migração é eliminar a personalização direta de botões e campos no legado, começando por Obras, Orçamento e Compras. Em seguida, adote o padrão comum nas tabelas operacionais sem perder seleção, ordenação, paginação e ações em linha. A revisão de filtros e indicadores deve conferir mesmo recorte, mesmo alinhamento e mesmas convenções de resultado em desktop e celular. Para novas telas, prefira os componentes compartilhados desde a origem.

Use `e2e/erp-layout-review.spec.js` para verificar o cabeçalho das áreas acessíveis ao administrador, o encaixe horizontal e o alinhamento dos filtros. O teste lê o tamanho do título pelo token global. A checagem de código cobre seletores e usos diretos conhecidos. Estilos indiretos, telas com outras permissões e estados que dependem de dados específicos exigem validação de navegador. Ajuda e manual foram revisados pela checagem de sincronização. O lint e seus testes atuam no código de apresentação, sem efeito no DRE.

Na DRE Empresa, Saldo em conta usa a variante de seção do cabeçalho compartilhado. A consulta, o cálculo e o caminho para a Conciliação foram conferidos em oito cenários com dados fictícios nos temas Preciso e Noite.

### Tabelas operacionais e controles migrados

Use `DataTable` em listas de registros que adotam os comportamentos comuns. Em tabelas com fluxo especializado, aplique `arcd-data-table__table` à tabela existente para herdar tipografia, divisórias e recuos da base em `src/design-system/data/styles.css`. Use `data-align="end"` para colunas numéricas. Nas matrizes de Ponto Geral e Locação, `data-table-layout="matrix"` aplica a tipografia comum e preserva a geometria da grade e a sinalização de cada célula.

A base passou a atender Compras, Financeiro, Fornecedores, Conferência, Ajustes, Locação de equipamentos, Ponto Geral, Gestão comercial e Relatórios comerciais, além da tabela de etapas na Visão geral de Obras. Os seletores ajustados de Orçamento e Diário de Obra usam o contrato de controles. A ajuda e o manual foram revisados com os fluxos existentes. Todos os dados e cálculos da DRE continuam nas fontes anteriores. O teste de layout confere a adoção da base e a tipografia para as tabelas apresentadas nas nove áreas.

Use `RecordAction layout="row"` para linhas que abrem registros. Recuos, foco, realce ao passar o mouse e divisórias entre linhas vêm de `record-action.css`. A tela fornece a composição das colunas com `--record-columns`. Os resultados de referência e exceções em Compras e a abertura de análises por obra no Financeiro usam essa receita.

Use os tamanhos de `Button`, a caixa de seleção de `ChoiceControl` e os estados nativos de `SelectControl` para herdar o padrão. Seletores de Orçamento, Obras, Conferência e caixas de seleção de Planejamento e Licenciamento passaram por essa revisão. Em Obras, um vínculo com serviço removido usa o estado de campo inválido. A seleção, os vínculos e os cálculos de competência e resultado mantêm a lógica anterior.

### Fonte e escala em um lugar

A Inter passou a ser a família de interface em todas as opções de aparência. Os testes alteram temporariamente a fonte e o peso do botão principal na raiz e conferem os controles em Obras, Orçamento, Compras, Financeiro, Equipamentos e Modo TV. O lint rejeita fontes fixas em CSS de tela e em estilos JSX diretos. A troca altera somente a apresentação. Os fluxos, dados e regras do DRE permanecem no domínio de origem.

## Roteiro de padronização — 24/11/2026

| Etapa | Trabalho | Critério de conclusão |
| --- | --- | --- |
| 1. Botões e campos | Eliminar exceções em Orçamento, Obras, Compras e Ponto. Usar os controles e estados da base para ações, seletores, buscas e linhas clicáveis. | Cada remoção sai do inventário do lint. Controles especializados mantêm a indicação de estado, a operação e a navegação por teclado. |
| 2. Caixas e indicadores | Unificar faixas de indicadores e caixas em Dashboard, Obras, Compras e Financeiro. Reaproveitar os valores e recortes existentes. | O mesmo ajuste de raio, recuo e tipografia aparece nas telas cobertas. Desvios continuam identificáveis sem depender só da cor. |
| 3. Diálogos e formulários | Aplicar o contrato de cabeçalho, campos, ação principal, cancelamento, erro e retorno do foco nos fluxos frequentes. | Editar, cancelar, revisar erros e fechar funcionam por teclado e no celular. Ajuda e manual acompanham mudanças de fluxo ou de rótulo. |
| 4. Proteção contínua | Em paralelo às migrações, testar a propagação de mudanças nos tokens e validar filtros expandidos, diálogos e outros estados condicionais. | O lint rejeita novos desvios. Os testes comprovam a propagação em 1440 e 390 px, com verificações em Plataforma, Preciso e Noite. |

O ponto de partida do lint registrava 78 ocorrências de botões e campos, 167 de caixas e indicadores e 80 de diálogos e estados. As contagens medem ocorrências de código. O trabalho começou pelas linhas de referência e pela navegação da memória de cálculo no Orçamento, pela escolha de etapas no Planejamento e pelo teste de propagação da geometria em Compras.

A primeira rodada reduziu de 78 para 68 as ocorrências de botões e campos. Os resultados do Orçamento e a escolha de etapas do Planejamento usam `RecordAction layout="row"`. A altura mínima de toque dos botões legados e do formulário de Compras acompanha `--arcd-touch-target`. O teste abre os filtros e o formulário para conferir altura, raio e espaçamento. Os nomes dos controles e os passos da Ajuda e do Manual continuam aplicáveis. O fluxo usa os mesmos dados, eventos e cálculos, sem efeito na DRE.

No Ponto Geral, os controles de situação e de troca de obra usam `RecordAction layout="cell"`. Tipografia, raio, altura, foco e indicador de gravação vêm da base. A cor da situação vem do domínio do Ponto e também é usada na legenda. As situações começam na mesma altura na linha, inclusive quando o nome da obra aparece abaixo de uma delas. A ajuda descreve o rótulo Trocar obra e o caminho pelo teclado. O comando de ponto, a obra considerada no cálculo e as permissões continuam com a lógica anterior. A padronização visual não gera lançamentos nem muda o cálculo da DRE.

### Botões e campos concluídos no inventário estático

As 45 ocorrências restantes saíram do inventário. As opções de encargos e de cópia de quantidades em Orçamento usam a caixa de seleção visível de `ChoiceControl`. A Visão geral e o Diário de Obra usam `RecordAction layout="row"` para abrir registros. A descrição curta dos filtros e a sinalização de responsável pendente pertencem ao contrato de campos. A trava continua a rejeitar propriedades locais nos seletores e componentes que monitora.

### Caixas e indicadores em migração

Use `mrc-box` e `mrc-box__header` para caixas com cabeçalho e `mrc-kpi-strip` para faixas de indicadores clicáveis. O recuo, o raio e a tipografia vêm de `box-contract.css` e `kpi-strip.css`. As faixas de Dashboard, Obras, Compras e Financeiro compartilham essa geometria. O fluxo de trabalho permanece nas telas: Compras e Financeiro mantêm o filtro selecionado e os atalhos por teclado. As caixas Avanço por etapa e Próximas ações, em Obras, compartilham o cabeçalho de caixa.

O inventário de caixas e indicadores caiu de 167 para 154 ocorrências. A trava cobre as receitas novas e os seletores existentes da fila de Compras e da fila de hoje do Financeiro. O teste `Caixas e indicadores compartilham tokens` altera temporariamente raio, recuo e tamanho do número em quatro telas e confere sua propagação. A revisão da ajuda e do manual confirmou os rótulos e passos vigentes. As alterações estão na apresentação e preservam as fontes, os cálculos e os lançamentos do DRE.

Na prévia local com dados fictícios, passaram 36 cenários de layout e interação em Plataforma, Preciso e Noite, em 1440 e 390 px, e 68 cenários de contexto da obra e busca de itens do orçamento. A varredura de 210 combinações não apontou problemas de encaixe horizontal, submenus ou propagação da tipografia nos elementos medidos. As duas caixas de seleção revisadas no Orçamento responderam ao rótulo e à tecla Espaço em 1440 e 390 px. Passaram também os 17 testes de contrato e controles, `npm run lint`, `npm run architecture:check`, `npm run typecheck` e `npm run build:local`.

Na rodada seguinte, a DRE de Obras e a Composição do pagamento da Folha passaram a consumir a mesma base. A Folha usa seis colunas no desktop amplo, três em largura intermediária e duas no celular. O total líquido mantém destaque pela superfície, e valores negativos usam o token de desvio. A faixa da DRE conserva o acesso a Ver movimentos, com foco visível. A remoção de estilos duplicados no Dashboard, nos resumos de página e na DRE reduziu de 154 para 72 as ocorrências legadas de caixas e indicadores. A trava passou a abranger a faixa e o total da Folha.

Os valores, origens, recortes, encargos e cálculos continuam sob responsabilidade das implementações financeiras existentes. A ajuda e o manual seguem aplicáveis aos mesmos controles. A validação cobriu 36 cenários de propagação dos tokens em seis telas, 210 combinações da varredura geral e 20 testes de contrato, Folha e integração com a DRE. Lint, arquitetura, tipos, manual e build local passaram. A checagem mecânica do Impeccable apontou ocorrências fora do trecho editado do arquivo legado. As capturas e o log da varredura estão em `artifacts/caixas-indicadores`.

### Caixas e indicadores concluídos no inventário estático

As 72 ocorrências restantes foram retiradas do inventário. Os cartões de Locação e do Dashboard compartilham a escala dos valores, os recuos e a hierarquia de texto. Os painéis de gráfico usam `mrc-box` e `mrc-box__header`, com superfície opaca e detalhes em tokens de tema. Em Relatórios, as barras e a legenda usam as mesmas cores semânticas, inclusive no Noite. O recuo da lista de Compras e do resumo do Financeiro também vem do contrato de caixas.

A trava protege seletores de cartões, painéis, detalhes de gráficos e faixas. A revisão da ajuda e do manual confirmou os mesmos caminhos de consulta. As mudanças preservam as séries, os recortes, os cálculos e os lançamentos do DRE. A amostra de navegador cobriu Plataforma, Preciso e Noite em 1440 e 390 px. A segunda varredura de 210 combinações completou todas as telas após dois esgotamentos de tempo da primeira. Evidências em `artifacts/cartoes-graficos`.

### Diálogos e formulários operacionais

`DialogSurface` é a base do diálogo, da gaveta e do componente legado `Modal`. O cabeçalho apresenta o título e Fechar. O corpo pode rolar sem deslocar as ações do rodapé. Use `footer` para ações de confirmação e cancelamento, `mrc-dialog-fields` para agrupar campos e `mrc-dialog-fields__row` para pares responsivos. Os campos usam os rótulos e estados de erro da base. O título, o recuo e a tipografia seguem os mesmos tokens de tema e densidade.

Solicitar materiais, Receber, Registrar pagamento e Novo orçamento usam as ações compartilhadas. Em recebimento e pagamento, os erros aparecem junto aos botões. Os testes cobrem retorno de foco, ordem de tabulação, cancelamento, dados inválidos, diálogos empilhados e repetição de confirmação. A trava passou a proteger o rodapé e os agrupamentos de campos. O inventário de diálogos e estados caiu de 76 para 55 ocorrências.

A Ajuda e o Manual passaram a descrever as ações no rodapé e os avisos de falha. Os formulários preservam permissões, validações, recuperação de rascunhos e comandos de gravação. A mudança visual não gera lançamentos e não altera a origem ou o cálculo do DRE.

A prévia local cobriu os tokens e a navegação por teclado em Plataforma, Preciso e Noite, em 1440 e 390 px. Também foram conferidos recebimento e pagamento com resposta perdida, recuperação de rascunhos e o editor de fotos em tela estreita e paisagem. O teste de recebimento voltou a exercitar a recuperação após alinhar a unidade do pedido fictício à do catálogo. A varredura de 210 combinações passou. Capturas e logs em `artifacts/dialogos-formularios`.

### Diálogos e estados concluídos no inventário estático

As 55 ocorrências restantes saíram do inventário. A tipografia, os campos e as tabelas dos diálogos e gavetas usam a receita compartilhada. O estado Carregando pertence à base de padrões. O lint continua a rejeitar estilos locais nos seletores e componentes monitorados.

O rodapé compartilhado ganhou criação e edição de pedidos, cotações e obras, cópia e edição de orçamento, insumos e composições. A confirmação de descarte de pedido e cotação usa o mesmo rodapé. Ajuda e manual incluem os caminhos e as ações. Comandos, permissões e cálculos financeiros continuam no domínio de origem. A padronização de apresentação não cria lançamentos nem interfere no DRE.

A tabela de propostas da cotação fica em uma região rolável com foco por teclado. No celular, a primeira coluna ocupa menos espaço e a instrução indica como acessar os fornecedores fora da área visível. Os testes conferiram abertura, cancelamento e retorno de foco dos formulários, bem como a escolha entre continuar editando e descartar um pedido. Plataforma, Preciso e Noite foram conferidos em 1440 e 390 px. A varredura de 210 combinações passou. Evidências em `artifacts/dialogos-restantes`.

### Cabeçalhos, filtros e tokens concluídos no inventário estático

As 16 ocorrências restantes de cabeçalhos e filtros e as duas definições locais de tokens saíram do inventário. Cabeçalhos operacionais usam a escala de título e descrição do componente compartilhado. Os filtros de Pedidos e Cotações usam o intervalo de `--arcd-layout-gap`. Em Relatórios financeiros, o cabeçalho de seção identifica a consulta. Use `FilterBar` com `legend` e `disabled` para agrupar e desabilitar os controles juntos durante uma exportação.

A densidade compacta do Plataforma é definida em `tokens/density.css`. A impressão recebe Nimbus Sans de `tokens/print.css`. A interface usa Inter. A trava também protege o espaçamento de layout contra novas definições locais. O inventário de contratos visuais ficou vazio após a remoção dessas ocorrências. A ajuda e o manual explicam o caminho pelos filtros. As consultas e exportações preservam os critérios, as fontes e os totais do DRE.

### Tabelas, caixas e indicadores operacionais

As tabelas nativas da interface web usam `arcd-data-table__table`. A receita define a tipografia, os recuos e os cabeçalhos das tabelas comuns. A matriz fixa do DRE anual mantém a geometria e as colunas fixas, com tipografia da base. A matriz de Sapatas mantém os tamanhos escolhidos pelo usuário. As tabelas do documento da Folha seguem a configuração de impressão. Para cabeçalhos fixos, use `arcd-sticky-table-header` na faixa inteira ou `arcd-sticky-table-header-cells` no `thead` de uma matriz com células fixas. A regra em `data/styles.css` encosta o cabeçalho no topo da área que rola, seja a página ou a própria tabela. O lint barra recuos locais em cabeçalhos.

Use `mrc-box--padded` para o recuo da caixa e `mrc-box--scroll` para manter a rolagem de uma tabela dentro da caixa. As faixas de Pagamentos, DRE, Projeção de mão de obra, Fornecedores, Comercial e Relatório financeiro por obra usam os mesmos elementos de rótulo, valor e contexto de `kpi-strip.css`. O resumo da Visão financeira usa as caixas e a mesma escala de valores. Orçamento e a análise de Locação usam a escala de indicadores sem perder a disposição dos dados de cada consulta.

O lint exige a receita nas tabelas JSX da interface e protege as classes compartilhadas de caixas e indicadores contra substituições locais. A ajuda e o manual foram conferidos para os mesmos controles, consultas e exportações. A alteração de apresentação preserva as origens, fórmulas, recortes e gravações do DRE.

A migração aplicou a receita a 83 tabelas e retirou 17 ocorrências do inventário de UX/UI. A varredura na prévia local cobriu 210 combinações de telas, temas e larguras. A substituição temporária dos tokens em navegador confirmou a propagação em Plataforma, Preciso e Noite, em desktop e celular. Os testes de Orçamento conferiram o alinhamento, a abertura da versão e a busca. As evidências estão em `artifacts/tabelas-caixas-indicadores`.

### Varredura de cores, bordas e espaçamentos

Superfícies, textos, estados e divisórias operacionais usam as cores semânticas. Use `--arcd-border-width` nas bordas e divisórias comuns, os raios compartilhados nas caixas e controles e `--arcd-space-*` nos recuos e intervalos. A folha de estilos carregada pelo aplicativo também segue essa base. O Ponto Geral usa a receita declarada na folha principal para evitar dois estilos concorrentes.

O inventário do lint passou de 333 para zero ocorrências de cor fixa nas propriedades de CSS monitoradas, de 956 para zero raios fixos em CSS e JSX e de 121 para zero lacunas fora da escala monitorada. A trava impede redefinições locais da espessura da borda. A cor da arte institucional e a escala de leitura à distância seguem os tokens das respectivas superfícies. A ajuda e o manual foram revistos e os controles e caminhos de consulta continuam descritos pelos guias atuais. As alterações de apresentação não geram lançamentos nem interferem nas origens e nos cálculos do DRE.

A varredura local percorreu as 65 abas do perfil administrador em Plataforma, Preciso e Noite, a 1440 e 390 px, totalizando 390 combinações. Os testes alteraram temporariamente os tokens de borda, cor, raio e recuo em Ponto Geral e Fornecedores. Passaram também os testes de navegação em Obras, busca no Orçamento, lint, arquitetura, tipos e build local. Capturas e logs em `artifacts/varredura-visual-final`.
