# MARCELL — barra única de comandos

02/11/2026. Alteração local em Compras e Financeiro, sem push, deploy ou migração. Lateral padrão azul-marinho MARCELL, marca, logo, IBM Plex Sans e cores semânticas preservadas.

## Padrão aplicado

WorkspaceHeading reúne título e navegação. WorkspaceCommandBar reúne escopo, consulta e ações em uma base comum. Os nomes dos controles e seus estados continuam sendo os mesmos; a ordem de Tab acompanha a organização visual.

- Compras: Obra, Buscar na fila, Visualização, Filtros, Exportar para Excel, Nova solicitação e Mais ações de Compras ficam na mesma barra. As áreas de cotação e pedido mantêm suas ações próprias nessa composição. Quantidades, valores e alertas permanecem no resumo e nos registros.
- Financeiro · Hoje: Obra, Movimentação e Visualização ficam juntos. Prazos e totais usam uma faixa compacta no computador; no celular, Fila de vencimentos entra na barra. Fichas e próximas ações continuam junto aos registros.
- Pagamentos: a barra reúne Obra, Situação, Pesquisar pagamentos, Ver notas fiscais e Receber documento fiscal. O resumo, as etapas, as permissões e as confirmações financeiras são preservados.
- Caixa por conta: Obra, Conta bancária do caixa e revisão assistida ficam juntos. A distinção entre posição da empresa e previsão por obra continua explicada.
- Documentos: Obra, competência, busca e Conferência ficam junto a Receber documento fiscal. O campo de mês ocupa a largura disponível no celular para evitar recorte.

No celular a barra se reorganiza em linhas, sem duplicar comandos ou diminuir os alvos de toque. Outros temas previamente disponíveis continuam funcionando; a preferência padrão MARCELL não foi substituída por lateral clara.

## Aproveitamento da tela

Comparação com os mesmos dados fictícios, recorte e data, usando a posição do início da tabela em relação ao topo da página. É uma medida do espaço recuperado antes da lista, não um resultado de produtividade com operadores.

| Área | Largura de teste | Antes | Depois | Espaço recuperado |
| --- | --- | --- | --- | --- |
| Compras | desktop | 495 px | 331 px | 164 px |
| Financeiro · Hoje | desktop | 477 px | 312 px | 165 px |
| Compras | mobile | 664 px | 616 px | 49 px |
| Financeiro · Hoje | mobile | 644 px | 496 px | 148 px |
| Compras | narrow | 684 px | 647 px | 37 px |
| Financeiro · Hoje | narrow | 644 px | 517 px | 127 px |

Desktop: 1440 px; mobile: 390 px; narrow: 320 px. Os registros permaneceram iguais: três na fila de Compras e um em Hoje nessa fixture.

## Validação

- 463 testes de componentes, domínios, navegação e ajuda passaram em 78 arquivos. Três testes antigos de FinanceToday passaram a consultar também o portal no body, onde a ficha compartilhada já era renderizada, sem enfraquecer as verificações de ação e retorno.
- 136 verificações de telas desktop/celular e 42 jornadas de regressão passaram. O teste de alinhamento de Compras agora verifica a obra e a ação na nova barra.
- 15 inspeções próprias: cinco áreas em 1440, 390 e 320 px, todas sem estouro horizontal, com uma barra de comandos por área e lateral azul-marinho. Capturas revisadas inclusive para os campos do celular.
- Após o último ajuste visual, foram repetidas as jornadas de fila/ficha e as verificações de alinhamento/cabeçalho, além dos 29 testes focados de componentes e ajuda.
- Build direto do Vite, lint, tipos, arquitetura, design:check e manual:check passaram. Sem executar o prebuild, que contém migrações. O scanner de layout da skill impeccable não apontou achados no componente compartilhado.
- Pacote JS/CSS: 1788751 bytes gzip, abaixo de 1.789.952, sem aumentar o teto.

Ajuda e manual regenerado: 105 guias para 65 abas. O padrão foi registrado também em DESIGN.md e docs/PADRAO-INTERFACE.md. Não foram executados pagamentos, recebimentos ou alterações reais durante a validação; dados fictícios e APIs locais/interceptadas.

Evidências locais: artifacts/commandbar/, commandbar-unit-final.log, commandbar-regression-final.log, commandbar-whole-final.log, commandbar-last-flows.log, commandbar-last-layout.log e commandbar-build.log. Capturas comparam o antes e o depois. A inspeção responsiva é em navegador automatizado, sem ensaio em aparelho físico.
