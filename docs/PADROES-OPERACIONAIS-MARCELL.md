# Padrões operacionais MARCELL

Base implementada em 31/10/2026, com Impeccable, shadcn e revisão das práticas React. Preserva React, Radix, Source Sans 3 local e os tokens MARCELL. Referências de componentes não autorizam misturar bibliotecas ou substituir fluxos financeiros por demonstrações visuais.

## Contrato compartilhado

| Padrão | Aplicação |
|---|---|
| Cabeçalho | Um H1 visível na página; H2 para áreas internas; H3 para grupos. `PageHeader` e `PageHero` recebem `headingLevel`. |
| Botão principal | Confirmar a ação principal disponível, com verbo e objeto. |
| Secundário | Consultar, voltar ou executar ação complementar com borda. |
| Discreto | Limpar filtros, alternar contexto ou executar ação auxiliar. |
| Destrutivo | Ação destrutiva, com confirmação definida pelo fluxo existente. |
| Campo | Rótulo associado, foco visível, erro acessível, estado desabilitado e somente leitura distintos. |
| Filtros | Contexto antes da lista; controles em linha no desktop e empilhados no celular; limpar é explícito. |
| Registro | Identidade, contexto, situação e ação no mesmo agrupamento. Valores desconhecidos continuam desconhecidos. |
| Diálogo | Nome acessível, foco contido, Escape e retorno ao acionador. Confirmações operacionais pertencem aos comandos existentes. |
| Feedback | Carregando bloqueia reenvio; erro é anunciado; vazio explica uma providência; sucesso só após confirmação real. |

Botões padrão têm mínimo de 40 px no desktop e 44 px no celular. Compacto de 36 px fica restrito a consultas de desktop; grande tem 48 px. Campos editáveis usam 15 px no desktop e 16 px no celular. Rótulos e botões usam 14 px; títulos de página, seção e grupo usam 24/18/16 px. Espaçamento de composição segue 4/8/12/16/24/32 px.

As três APIs usam o mesmo renderizador `components/ui/button.jsx`, os mesmos papéis em `button-contract.js` e a mesma folha `button-contract.css`. O `Btn` legado conserva `ghost` como secundário com borda; o `ghost` das outras APIs permanece discreto. Essa tradução preserva a intenção das chamadas antigas. `danger`/`destructive` apontam para destrutivo; cores antigas de ação convergem para principal. Os adaptadores de entrada, seleção e texto usam `control-contract.css`.

As chamadas existentes mantêm callbacks, referências, nomes acessíveis e comandos. `asChild` desabilitado bloqueia também o handler do filho. Carregamento impede cliques repetidos. O botão base conserva a semântica nativa de formulário; adaptadores de ação usam `type="button"` por padrão.

## Catálogo local

Storybook: **Fluxo → Padrões compartilhados → Catalogo**. Fonte: `src/design-system/stories/WorkflowPatterns.stories.jsx`. Compara os quatro papéis nas três APIs e mostra estados, filtros, registro, campos, aviso, consulta e diálogo. Os exemplos não gravam operações.

Verificação automatizada: `node scripts/wf-patterns-verify.mjs`, com Storybook estático servido localmente na porta 4215. Compara estilos computados em 1440, 768, 390 e 320 px e testa o foco do diálogo. Evidências em `artifacts/wf-foundation/catalog/`.

## Limites e continuidade

Esta é a base compartilhada, não uma declaração de migração integral do app. Botões HTML específicos, controles de terceiros e estilos explícitos de chamadas antigas ainda exigem revisão nas ondas seguintes. A composição dos módulos deve usar os padrões aprovados sem adicionar nova família visual. Textos de negócio devem distinguir “Receber material”, “Receber documento fiscal”, “Confirmar pagamento” e “Conciliar”; não renomear ações sem conferir o efeito real.

As referências fornecidas pelo usuário — [FreeFrontend](https://freefrontend.com/), [Rocketseat](https://app.rocketseat.com.br/catalogo/contexto/tag/front-end) e [Envato](https://elements.envato.com/pt-br/web-templates/frontend) — foram consultadas como repertório. Não foram importados templates, nem introduzidos MUI, Vue ou Svelte. A implementação mantém os componentes e a arquitetura existentes.
