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

## Revisão desta entrega

Consolidação técnica com valores visuais e rótulos preservados. Fonte da ajuda e manual revisados; não há novos passos ou controles para o operador, por isso não foi necessário reescrever instruções. Manual regenerado para conferir sincronização. Tudo local, sem deploy. A capacidade de ajustar os tokens foi exercitada no navegador em Compras, no desktop e celular, sem editar o módulo.

Validação local: 136 cenários da varredura do ERP, 14 cenários específicos e 8 cenários de temas aprovados. 59 testes de componentes, ajuda e verificador aprovados; os 5 testes do verificador foram repetidos após ampliar a leitura para JS/TS. Uma prova com arquivo JSX novo contendo botão próprio e tamanho fixo foi rejeitada pelo comando real; o arquivo temporário foi removido e a checagem voltou a passar. Lint, TypeScript, manual sincronizado e build aprovados; JS/CSS 1.742,57 KiB gzip, abaixo do teto de 1.748 KiB. A captura de Conciliação no desktop ficou idêntica, pixel a pixel, à captura anterior com os mesmos dados.
