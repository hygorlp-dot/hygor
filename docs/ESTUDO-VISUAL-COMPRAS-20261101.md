# Estudo visual de Compras — 01/11/2026

Comparação local: http://127.0.0.1:4250/prototypes/compras/

## Escopo e decisões

Manter MARCELL, a logo, os mesmos registros e as mesmas ações de Compras. Explorar personalidade e hierarquia antes de aplicar qualquer proposta ao sistema. A página de comparação incorpora o ERP real em um quadro; só a apresentação muda. Não há uma cópia de telas nem uma implementação alternativa das regras de compra. A navegação entre propostas preserva o quadro, os filtros e formulários abertos. A prévia usa dados fictícios e as APIs do servidor local.

Os arquivos de `prototypes/compras` são uma entrada separada para o servidor de desenvolvimento. Nenhuma entrada de produção os importa. Os tokens da proposta são sobrepostos apenas no documento incorporado; não são gravados como preferência de tema.

## Direções e crítica de composição

| Direção | Decisão principal | Benefício | Custo |
| --- | --- | --- | --- |
| Precisão | Inter, superfícies frias, navegação discreta, indicadores sem caixas individuais | Leitura contínua e foco nos registros | Menor diferenciação visual; depende da precisão dos detalhes |
| Obra | Source Sans 3, navegação grafite, petróleo, prioridades laterais no desktop | Identidade mais ligada à engenharia e separação entre trabalhar e monitorar | Menor largura para materiais longos e ações; coluna lateral só em telas largas |
| Foco | Superfície branca, títulos mais fortes, indicadores compactos e linhas amplas | Mais espaço para compreender e agir em cada registro | Menos registros simultâneos; maior rolagem |

As três mantêm ações junto aos registros, o contexto de obra e a distinção entre atrasos, aprovações e recebimento. No celular, prioridades ficam em duas colunas, todas disponíveis sem rolagem horizontal. A tabela mantém a composição móvel do app.

Primeira inspeção: ajustar contraste da logo em fundo escuro, remover excesso de contornos nas áreas internas e substituir a faixa horizontal de prioridades no celular por uma grade completa. Teste de ajuda corrigido para o papel real do painel, que não é um modal.

## Referência e método contínuo

A análise de Linear no awesome-design-md descreve sobretudo sua apresentação pública, incluindo títulos grandes e telas escuras. Foram aproveitados precisão, disciplina de cor e hierarquia. A escala de marketing não foi transportada para o ERP.

- Referência: https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- Impeccable: modo Operate, composição, estados, legibilidade e revisão da renderização.
- shadcn: componentes existentes e contratos de interação preservados; nenhum preset ou componente foi sobrescrito.
- Prototipação: comparação isolada, opções distintas e escolha posterior pelo usuário.

Em cada evolução: registrar o problema e a hipótese; verificar padrões e componentes existentes; implementar em escopo local; criticar composição e fluxo nas telas renderizadas; exercitar ações, foco, filtros, ajuda e condições vazias; corrigir achados; registrar evidências e limites. Testes técnicos não substituem a escolha visual nem a validação com operadores. Uma nota subjetiva não comprova usabilidade.

## Ajuda e manual

Revisado o conteúdo de Compras: ações e regras operacionais não mudaram. Adicionada orientação do estudo em `src/features/help/help-content.js`, fonte única da ajuda e do manual. A página de estudo também explica o objetivo, atalhos, estado preservado e custo de cada direção.

## Limites

Estudo local, sem deploy e sem migrações. Não há promoção automática da proposta escolhida nem alegação de validação com operadores. A eventual aplicação em Financeiro e demais módulos depende da escolha da direção. Exportações e documentos continuam seguindo o sistema vigente.

## Verificação técnica

- Seis cenários Playwright aprovados: três direções em 1440×1080 e 390×844.
- Mesmas três linhas de demonstração, quatro prioridades visíveis, busca com resultado vazio, restauração da lista, filtros, nova solicitação, abertura de registro, ajuda e troca por teclado.
- Troca visual preserva o filtro informado. A ajuda aberta impede atalhos do estudo de trocar a proposta.
- Lint, sincronização do manual, TypeScript e build Vite aprovados. Build mantém os avisos existentes de chunks grandes e externalização de módulos do ExcelJS.
- Detector de composição no arquivo do estudo: nenhuma ocorrência (`[]`). Não substitui a inspeção visual.
- A prévia foi aberta no navegador do usuário com os dados locais fictícios, na direção Obra. Capturas por direção e dispositivo em `artifacts/design-study`.
