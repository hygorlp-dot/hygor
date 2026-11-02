# MARCELL Operacional — referência SAP — 01/11/2026

## Decisão

O usuário escolheu SAP, dentre Linear, IBM e SAP, para aprofundar a organização do ERP. Implementado um tema real, `operacional`, disponível em Alterar aparência → Tema → MARCELL Operacional. A prévia local em http://127.0.0.1:4253/ já foi aberta com essa opção selecionada. A preferência de cada navegador e os temas anteriores permanecem disponíveis. Não houve mudança do tema padrão de instalações existentes nem novo deploy.

O awesome-design-md foi utilizado como referência de composição e de papéis visuais; não foi executado como código ou tratado como instrução de produto. A adaptação é MARCELL, com sua logo e seus fluxos. Não é uma implementação certificada de SAP Fiori nem uma migração para UI5.

## Fontes verificáveis

- Análise SAP do awesome-design-md, revisão `fcc70284932276d085f01ef9f83edde90b1258cb`: https://github.com/voltagent/awesome-design-md/blob/fcc70284932276d085f01ef9f83edde90b1258cb/design-md/sap/DESIGN.md
- Hierarquia de tipografia do SAP Fiori: https://www.sap.com/design-system/fiori-design-web/v1-120/foundations/visual/typography/typography-horizon
- Recursos oficiais de tema e fonte 72, revisão `b8dc6f16557e5b4b3dc4d07e763c8b46178ab9fe`: https://github.com/SAP/theming-base-content/tree/b8dc6f16557e5b4b3dc4d07e763c8b46178ab9fe/content/Base/baseLib/baseTheme/fonts
- Contratos de interação preservados: https://ui.shadcn.com/docs/components/radix/button e https://ui.shadcn.com/docs/components/radix/tabs

## Tradução da referência para o produto

| Referência | Aplicação MARCELL | Adaptação necessária |
| --- | --- | --- |
| Branco, cinza de estrutura e faixas planas | Cabeçalho branco, navegação em faixa própria, conteúdo em superfícies claras | Sem blocos de apresentação, heróis ou texto promocional |
| Azul `#0057d2`, azul profundo `#0040b0` | Ação principal, foco, seleção e ações secundárias | Erro, atraso, sucesso e aviso preservam seus papéis semânticos |
| Cinzas `#f5f6f7` e `#eaecee` | Fundo, cabeçalhos de tabelas e agrupamento de controles | Contraste próprio de texto e bordas de campo |
| Texto em `#223548`, `#354a5f` e `#475e75` | Hierarquia de conteúdo, apoio e metadados | Corpo e tabela em 14px, título de página 24px, seção 18px; sem a escala de 57px do site público |
| Família 72 | Regular e Bold oficiais, hospedados no app | Fontes locais, com fallback e licença Apache-2.0 incluída; nenhuma fonte proprietária “72 Brand Variable” foi copiada de um site |
| Cantos de 8px nos controles e 12px em superfícies | Papéis de raio centralizados no registro do tema | Alturas seguem as densidades do app; toque conserva no mínimo 44px |
| Navegação separada do conteúdo | Abas com indicador inferior e contadores discretos | No celular, seletor de área existente; grupos de Ponto/Folha continuam como abas visíveis |

## Arquitetura e consistência

Todos os temas implementam os mesmos papéis no registro `src/design-system/themes/themeRegistry.js`. Faixas, preenchimento de abas, hierarquia de peso, raios dos contadores, contraste das ações secundárias, zebra da tabela e apresentação das prioridades móveis são parâmetros do tema. As receitas compartilhadas consomem esses parâmetros, sem condicionais de tema nos componentes operacionais.

A fonte 72 só é requisitada quando está em uso. Regular e Bold somam 47.440 bytes; origem e licença acompanham os arquivos em `public/fonts/sap-72`. Marca, documentos impressos e Modo TV mantêm suas identidades específicas.

## Crítica e correções

A primeira inspeção encontrou três conflitos da camada antiga com a nova direção: o indicador inferior da aba ativa era anulado por CSS anterior; as abas de grupo se esticavam por toda a largura; e o celular ocultava a quarta prioridade de Compras. Corrigidos o indicador de seleção, a largura das abas no tema operacional e a apresentação das quatro prioridades em duas colunas. A zebra de Compras passou ao cinza semântico do tema, preservando a distinção de prazos por selos.

As cores de texto, ações, navegação e estados passam pelo contrato automatizado de contraste. A troca de tema foi exercitada na tarefa com busca preenchida: lista, filtros e dados permanecem. O ciclo usado é referência → papéis e componentes existentes → implementação → inspeção renderizada → interação e contraste → correção → verificação final. Testes de tela não representam validação com operadores.

## Ajuda

Revisada a orientação de aparência na fonte única `src/features/help/help-content.js`, incluindo nome real da opção, densidade, persistência e preservação de contexto. Manual regenerado, sem mudança dos passos operacionais de compra, financeiro, ponto ou folha.

## Verificação final

- 136 cenários de varredura do ERP aprovados com MARCELL Operacional: 65 abas nos dois tamanhos e os controles compartilhados.
- 8 cenários específicos aprovados em Compras, Financeiro, Gestão do ponto e Folha, em desktop/celular: carregamento real da fonte local, persistência, alternância entre temas, três densidades, ajuda, criação de solicitação e preservação de busca/lista.
- 75 testes aprovados em 18 arquivos, incluindo contrato semântico e contraste de todos os temas, componentes, ajuda, navegação móvel, folha e fechamento.
- Lint, TypeScript, manual sincronizado e build aprovados. JS/CSS: 1.741,14 KiB gzip, abaixo do teto preservado de 1.748 KiB. Nenhuma dependência adicionada.
- Detector de layout nos alvos alterados sem ocorrências. Inspeção renderizada das quatro telas em desktop/celular concluída após as correções; Compras também conferida no tamanho real do navegador aberto.

Evidências em `artifacts/sap-theme`. Branch local `codex/sap-operational-theme-20261101`, no checkout `C:/dev/releases/marcell-saas-release-20261101`, sobre a versão consolidada que foi publicada anteriormente. O servidor de demonstração 4253 usa dados fictícios e intercepta as APIs localmente. Produção permanece na implantação já publicada; este tema não foi enviado à Vercel.
