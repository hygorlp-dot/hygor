# MARCELL Plataforma — implementação local

Revisão: 19/11/2026. Checkout: `C:/dev/repositorio-mrc`.

## Pedido e escopo

Reproduzir o acabamento da imagem enviada pelo usuário como uma opção nova de tema. O nome é MARCELL Plataforma (`plataforma`), disponível em Alterar aparência → Tema. Preciso continua como padrão. Menu azul-ardósia, malha discreta, emblema oficial, caixas de vidro claro e cabeçalho arredondado usam os contratos compartilhados; a composição e os dados continuam os das telas operacionais existentes. A referência não foi usada para inventar indicadores ou cadastros.

Implementação: `themeRegistry.js`, `plataforma.css`, inclusão nas receitas `vidro-erp.css` e `box-contract.css`, importação em `src/index.js`; BrandMark usa o vetor oficial branco na lateral do novo tema. Preferência e densidade continuam no ThemeProvider e armazenamento local existentes. As alterações locais de outras frentes foram preservadas.

## Origem e DRE

A troca percorre ThemeSettings → ThemeProvider → registro de tokens → CSS e preferência `arcd-theme` no navegador. Não cria campo, vínculo, cadastro, comando de API nem escrita no banco. Nenhum efeito em previsão, compromisso, estoque físico, custo reconhecido, pagamento ou resultado realizado; não há fato financeiro novo nem duplicação de custo.

## Ajuda e manual

A orientação Escolher a aparência em `help-content.js` inclui o tema novo e corrige a descrição da fonte/ação do Preciso conforme os tokens vigentes. Data de revisão: 19/11/2026. `npm run manual:generate` gerou 147 guias; mudanças anteriores na ajuda e no manual foram preservadas.

## Evidências executadas

- `npm run validate:local`: aprovado (lint, UX, design, manual, arquitetura, tipos e build local). Nenhuma baseline aumentada.
- `node node_modules/vitest/vitest.mjs run src/design-system/theme src/design-system/tokens/tokens.test.js`: 4 arquivos, 30 testes aprovados, incluindo contraste do novo tema e persistência.
- `npm run build:local` após ajuste do vetor da marca: aprovado. Vite informa externalização de fs usado pelo ExcelJS.
- `node node_modules/@playwright/test/cli.js test --config playwright.plataforma.config.mjs`: 2 testes aprovados em 1440×1000 e 390×844. Compras: filtro preservado ao alternar Preciso, Noite, Cristal e Plataforma, sem overflow da página. Plataforma: preferência após recarga, Financeiro, ausência de erros JS e fallback sólido com prefers-reduced-transparency.
- Capturas em `artifacts/tema-plataforma/`, com fixtures locais e APIs interceptadas; nenhuma escrita remota. O primeiro servidor de desenvolvimento ficou preparando dependências; a execução foi interrompida e a validação visual final usou o preview do build compilado na porta 4267. A recarga da fixture exige entrar novamente, contemplado no teste.
- Detector Impeccable executado uma vez nos arquivos de tema: sem ocorrências. Não equivale a auditoria integral de acessibilidade.

Sem commit, push, PR ou deploy. Suíte completa de negócio e banco não executada: a alteração limita-se à apresentação. Revisão visual independente e documentação do sistema complementam estas evidências.

## Revisão visual

Revisão independente Impeccable: ship no recorte de Compras/Financeiro capturado, Plataforma 34/40 e referência comparativa Preciso 33/40 (avaliação qualitativa, não medição instrumental nem comparação histórica). Duas capturas desktop de Noite/Cristal foram refeitas após 400 ms de estabilização e com animações desativadas na captura: a revisão confirmou o desaparecimento das cores intermediárias e retirou a solicitação de recaptura. Nenhuma regressão visual material identificada nas imagens revisadas. Esses resultados não certificam todos os estados do ERP nem acessibilidade integral. Lint e 30 testes de tema reconferidos após ajuste da marca: aprovados. E2E final com recapturas: 2 aprovados.

## Revisão de compactação em Obras

Plataforma usa Inter local. Na densidade Compacta, recuo de painéis e respiro de layout passaram a 8 px. O cabeçalho, o título e a faixa de indicadores de Obras compartilham o eixo esquerdo, medido em 240 px no desktop de 1440 e em 12 px no celular de 390. A visão geral de Residencial Alameda foi aberta no Chromium com dados de demonstração e API interceptada. As capturas estão em `artifacts/tema-plataforma-obras/`. A medição não encontrou rolagem horizontal da página. Mudanças de apresentação não alteram valores do DRE.

`npm run manual:generate`, `npm run lint` e `npm run build:local` aprovados. Vitest em `src/design-system/theme` passou 26 testes. Playwright com `playwright.plataforma.config.mjs` passou os dois cenários de regressão em desktop e celular. Detector Impeccable sem ocorrências nos CSS de tema alterados e no registro.

## Visão geral de Obras

A faixa de indicadores fica após a navegação. Avanço por etapa e Próximas ações compartilham a régua de caixas e empilham em telas estreitas. Previsão executiva e Mudanças e aditivos abrem sob demanda. O tema Plataforma mantém Inter e a margem compartilhada.

O orçamento vem da base de controle aprovada. Comprometido em compras vem dos pedidos válidos da obra e custo reconhecido vem do razão que alimenta o DRE. O avanço por etapa usa vínculos explícitos do planejamento com o orçamento. Um planejamento ligado a rascunho pode mostrar progresso por etapa sem que o valor do rascunho seja apresentado como orçamento aprovado. A mudança só reorganiza consultas e preserva os comandos existentes. Nenhuma previsão, compra, movimentação física, apropriação de custo ou pagamento é gravado pela visão geral. Os indicadores não são somados no DRE.

Validação local da revisão: `npm run validate:local` passou. Vitest em navegação de Obras, motor de Planejamento e temas passou 74 testes. Playwright com dados de demonstração confirmou quatro indicadores abaixo da navegação, Estrutura em 25,0%, compromisso de R$ 250,00, expansão da previsão e retorno do Planejamento em 1440 e 390 px. Os dois painéis foram medidos nos quatro temas, lado a lado em desktop e empilhados no celular, sem rolagem horizontal. Cabeçalho, título e indicadores compartilham o eixo no Plataforma. Capturas finais em `artifacts/obras-visao-geral/`. Impeccable registrou dois avisos em declarações de tipografia já existentes; revisão visual local sem bloqueador nas capturas examinadas.

## Abas horizontais da obra

Em Geral, Informações da obra reúne Resumo e as 13 seções antes exibidas em acordeões. A faixa rola horizontalmente, usa a tipografia do tema e mostra um painel por vez. Os atalhos para as áreas completas e os dados de cada seção foram reaproveitados. A seleção é por obra e não dispara comandos na API. Não altera previsão, compromissos, estoque, reconhecimento de custos, pagamentos ou DRE.

Ajuda contextual e manual atualizados. A revisão usou a posição das abas e do conteúdo na Vobi como referência de navegação. Validação local aprovada. A prévia com dados sintéticos verificou 14 abas, seleção por clique e teclado, painel único, alinhamento e ausência de rolagem horizontal da página em 1440 e 390 px, nos temas Preciso, Noite, Cristal e Plataforma. Evidências em `artifacts/obras-abas-horizontais/`.

Revisão com Replica Skill registrada em `replica/`. Corrigida a rolagem da faixa ao recuperar uma aba de Obras. A nova regressão falhou antes e passou depois em desktop e celular. `npm run validate:local` e os quatro testes do perfil Plataforma passaram. Aba Próximos pagamentos fica registrada como achado de linguagem por listar recebimentos do cliente.

## Dashboard no tema Plataforma

A Visão gerencial usa Inter, a distância compartilhada entre blocos, valores alinhados por linha e seleção neutra no filtro da Central de ações. A alteração está no CSS do tema Plataforma. Os controles continuam com o mesmo funcionamento, portanto a ajuda e o manual foram revisados sem mudança de instrução. Os dados continuam vindo das projeções e consultas existentes; o tema não grava previsão, compromisso, estoque, custo, pagamento ou lançamento no DRE.

Validação local aprovada. Capturas Playwright em `artifacts/dashboard-plataforma/`, com dados de demonstração. Preciso, Noite, Cristal e Plataforma em 1440 e 390 px, sem rolagem horizontal da página. No Plataforma, os valores dos indicadores foram medidos no mesmo eixo vertical em cada linha.
