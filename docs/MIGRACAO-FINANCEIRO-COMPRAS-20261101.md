# Migração do legado — Financeiro e Compras

Implementação local de 01/11/2026, no checkout `C:/dev/releases/marcell-saas-release-20261101`, branch `codex/sap-operational-theme-20261101`. Prévia em http://127.0.0.1:4253/. Sem push ou deploy.

## Escopo entregue

- Consultas financeiras: caixa, previsão, relatórios, DRE anual e seus ajustes, documentos, conferência, memória de valores e conciliação do resultado.
- Compras: fila, mapa gerencial, solicitação, cotação, pedido, recebimento, pagamento, contratos e apoio ao cadastro de fornecedores.
- Blocos Financeiro, FinanceiroAdministrativo e FinanceiroObraPainel do arquivo principal legado; ações compartilhadas de navegação e integração com o DRE.
- Valores de espaçamento e tipografia em JSX passaram à escala compartilhada. Cores de apresentação nos estilos das telas e folhas CSS passaram a papéis semânticos. Cálculos, comandos, valores persistidos e permissões não foram reformulados.

Impeccable orientou hierarquia, densidade e inspeção renderizada; shadcn orientou composição com os controles existentes. Não foi adicionada biblioteca.

## Controles e composição

Comandos usam Button. SelectControl e TextareaControl permitem reutilizar o controle comum em composições que já têm rótulos; preservam referência, eventos, limites e associações existentes. Campos simples usam o Input compartilhado. ChoiceControl conserva os controles nativos de seleção dentro dos rótulos existentes, com foco e cor do tema.

RecordAction é a receita para abrir/selecionar registro, indicador ou valor de tabela, preservando o layout do conteúdo. Não deve substituir Button em comandos como Salvar ou Cancelar. Ambas as famílias têm foco visível e comportamento de teclado.

FilePicker substitui áreas de upload que dependiam de clicar em um rótulo com input invisível. O botão tem nome explícito, pode ser acionado por teclado e conserva formatos, múltiplos arquivos, indisponibilidade e evento de seleção. Escolher arquivo não confirma a operação.

O Modal compartilhado também consome superfície, borda, raio e espaçamentos do tema, com corpo opaco e sem desfoque decorativo da camada externa. O contrato de campos usa tokens para preenchimento, peso de rótulo, altura de toque e altura mínima de texto multilinha. Não foram alterados os handlers de foco, rolagem, fechamento ou proteção de edição.

Os seletores de abrangência e as opções dos painéis de Compras mantêm a seleção exposta por aria-pressed. O menu do pedido usa variante de ícone e separa ações comuns das destrutivas. A barra de pedidos dá o espaço principal à busca e mantém Filtros na largura necessária.

## Textos e uso móvel

- Padronizados Adicionar insumo, Remover insumo, Remover item, Duplicar para outra etapa e Desvincular do contrato, preservando os handlers existentes.
- Exportar para Excel da fila de Compras fica junto à contagem tanto no desktop quanto no celular. O arquivo usa o recorte filtrado; não é mais necessário abrir Filtros para encontrar essa ação no celular.
- Mantida a rolagem própria de tabelas densas e o seletor de áreas no celular. Rótulos de escolha têm área de toque; controles não foram convertidos em cartões genéricos de comando.
- No DRE anual, removida a chamada redundante em caixa alta. O regime de competência continua identificado na tabela e nas instruções existentes.

## Ajuda e manual

Fonte única revisada e manual regenerado: 97 guias cobrem as 65 abas. Incluídas instruções de seleção de anexos por teclado e exportação da fila no celular. Contratos e medições tem guia próprio, selecionado pela ajuda contextual de Compras; descreve Fornecimento, Serviços e medições, itens e permissões.

## Controle da dívida

Redução de 865 ocorrências diretas registradas: 533 de espaçamento, 224 de tipografia, 107 de controles próprios e uma de cor literal. A baseline foi somente reduzida. As pastas `src/features/financeiro` e `src/domains/compras` não mantêm ocorrências diretas das regras atuais; os três blocos financeiros do arquivo principal também não mantêm essas ocorrências. As exceções dos demais módulos permanecem registradas para a próxima migração.

Esses números não representam uma auditoria completa de todo estilo indireto. Paletas usadas como dados de gráficos, a apresentação impressa e outros módulos não foram convertidos indiscriminadamente. A checagem e seus limites continuam descritos em `docs/PADRAO-INTERFACE.md`.

## Validação e limites

Testes usam dados fictícios e APIs interceptadas localmente. A validação não confirma transações reais nem substitui uso acompanhado em aparelho físico.

Durante a revisão, testes antigos de Compras procuravam menus e opções de desktop em uma tela móvel. Foram ajustados para o seletor e os títulos visíveis, preservando as verificações de dados. O teste de exportação móvel revelou a ação escondida em Filtros; a posição da ação foi corrigida no produto, sem mudar a geração da planilha. Um teste da ajuda identificou o guia registrado depois da criação do índice; a ordem foi corrigida.

Evidências e resultados finais ficam em `artifacts/legacy-migration`.

- 166 cenários de fluxo aprovados em desktop/celular: solicitação, cotação, pedido, recebimento parcial, pagamento, contratos, relatórios, DRE, recuperação de sessão e falhas de confirmação, temas e controles comuns.
- 136 cenários da varredura geral aprovados, incluindo 65 abas nos dois tamanhos.
- 450 testes aprovados em 75 arquivos de componentes, regras, ajuda e navegação.
- Após o último ajuste compartilhado dos diálogos/campos, repetidos e aprovados 40 cenários de navegador e 82 testes de componentes. Incluem área reduzida, foco, retorno, cancelamento, comprovante pelo teclado sem gravar pagamento e o guia de contratos.
- Lint, TypeScript, checagem do padrão, manual e build aprovados. Auditoria de importações sem ciclos. Detector de layout nos controles novos e telas de composição analisadas sem ocorrências.
- JS/CSS: 1.745,01 KiB gzip, abaixo do teto preservado de 1.748 KiB. Não foi adicionada dependência.
- Inspeção das telas renderizadas incluiu fila e pedidos de Compras, formulário de pagamento, Financeiro e DRE anual, em desktop/celular. Os diálogos mantêm rolagem para alcançar ações no fim do formulário.
