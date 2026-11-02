# Padrão obrigatório de interface MARCELL

Vigente desde 01/11/2026. Aplica-se a toda nova tela, módulo, aba, componente, formulário, mensagem, relatório operacional e alteração de interface. Preservar MARCELL e sua logo. A base operacional segue a direção SAP aprovada, adaptada aos componentes existentes.

## Onde ajustar depois

| Ajuste desejado | Fonte única |
| --- | --- |
| Tamanhos de títulos, corpo, rótulos, tabela e botões | `src/design-system/foundations.js` |
| Peso, espaçamento interno, distância entre ícone/texto e tamanhos de botão | Tokens `--arcd-button-*` em `foundations.js`; receita em `src/design-system/primitives/button-contract.css` |
| Cores, família de fonte, pesos de cabeçalho e diferenças de cada tema | `src/design-system/themes/themeRegistry.js` |
| Altura dos controles, linhas, preenchimento de painéis e distância entre grupos por densidade | `src/design-system/tokens/density.css` |
| Escala de espaçamentos para composições | `src/design-system/tokens/spacing.css` |
| Cabeçalhos, filtros e composição comum dos módulos | `src/design-system/themes/module-standard.css` e `src/design-system/patterns/` |
| Textos genéricos já compartilhados: confirmação, carregamento e paginação | `src/design-system/copy.js` |
| Título, instrução ou ação de negócio específica | Componente do módulo; se repetidos, catálogo de textos do próprio domínio |
| Ajuda e manual do operador | `src/features/help/help-content.js`; gerar com `npm run manual:generate` |

`foundations.js` é aplicado pelo ThemeProvider a todos os temas. Um tema pode sobrescrever um papel deliberadamente; ajuste essa sobrescrita no registro quando necessário. Não acrescente outra definição do mesmo papel ao CSS de uma tela. Os tokens de `tokens/typography.css` continuam como base de compatibilidade para superfícies sem ThemeProvider; a escala vigente do ERP vem de `foundations.js`.

Para aumentar todos os títulos, por exemplo, altere `--arcd-type-page-title` de `1.5rem` para `1.625rem`. Para mudar o texto padrão de confirmação, altere `UI_TEXT.actions.confirm`. Textos específicos como “Aprovar proposta” continuam explícitos no módulo: não devem virar “Confirmar” só para reutilizar uma chave.

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
