# Piloto MARCELL — P2: gestão à vista

Data local: 01/11/2026. Checkout: `C:/dev/releases/marcell-precise-local-20261101`, branch local `codex/marcell-precise-local-20261101`. Base P1: `d0b0469`. Prévia: http://127.0.0.1:4260/, com os dados fictícios do piloto. Nenhum deploy, push ou PR.

## Compras

Tabela e Kanban são representações da mesma fila filtrada. Visualização fica junto à busca e aos filtros, no mesmo painel. Obra, busca, etapa, prazo, IDs, contagem e valores usam o mesmo conjunto de registros. A tabela continua paginada quando necessário; o quadro organiza o recorte por etapa e a exportação considera todo o resultado filtrado.

O quadro agora cobre Todas as obras e obras individuais com o mesmo modelo da tabela. O agrupamento da tabela por obra/fornecedor fica preservado na sessão, mas é desabilitado no quadro, que já agrupa por etapa. Voltar à tabela recupera a escolha.

O antigo quadro independente e sua projeção duplicada foram removidos. O Mapa gerencial mantém o atalho Abrir Kanban da fila, que abre a visão canônica. Registros concluídos continuam acessíveis pelo histórico, fora da fila ativa; não são ocultados apenas em uma das representações.

Arrastar só delega uma transição válida ao formulário do domínio. A solicitação pode preparar cotação; a decisão da cotação é revisada antes de gerar pedido; o envio de um rascunho abre a revisão existente. A área de aprovação não autoriza movimentações por arraste. Receber materiais usa a ação do registro e sua confirmação. O quadro não grava, aprova ou confirma operações sozinho. A lookup do arraste usa a fila do recorte atual e mantém o controle de acesso existente.

## Financeiro

Hoje apresenta Movimentação (A pagar / A receber) e Visualização (Tabela / Kanban). A tabela tem identificação/obra, vencimento, saldo em aberto e próxima ação; no celular, as linhas se organizam sem perder os rótulos. As ações e o memorial usam os callbacks já existentes, mantendo a origem e as permissões.

Os grupos de prazo são disjuntos: Vencidos (< hoje), Hoje (= hoje), Próximos 7 dias (amanhã até hoje + 7), Depois (> hoje + 7) e Sem vencimento. Todos os prazos reúne o recorte. O mesmo filtro é aplicado às duas visões; ao escolher um prazo, o quadro também mostra somente esse grupo. Trocar A pagar por A receber mantém o período Hoje quando ele está selecionado.

Foi acrescentada a projeção Depois ao seletor existente. Datas inválidas continuam na exceção Sem vencimento. Valores usam saldos parciais do ledger existente e não representam saldo de caixa. Não foram alteradas regras de reconhecimento, pagamentos ou conciliação. Pedidos/compromissos ainda não reconhecidos continuam nas suas consultas próprias, sem serem somados novamente às obrigações.

O quadro financeiro é consultivo: as colunas representam datas, não etapas que possam ser concluídas por um gesto. Os cartões não têm arraste nem handler de movimentação. A operação permitida continua no botão do registro.

## Padrão compartilhado e preferências

`WorkQueueBoard` e `work-queue-board.css` são o padrão compartilhado, com superfícies, tipografia, bordas, foco e espaçamento semânticos. Não recebem paletas por módulo. Os cartões podem oferecer comandos separados, sem aninhar botões em um botão de cartão. A região tem nome e foco para rolagem pelo teclado; no celular a rolagem horizontal é do quadro, não da página.

`useQueuePreferences` persiste somente apresentação (layout e, no Financeiro, direção) por usuário e área neste navegador. Valida o conteúdo armazenado e continua funcionando na sessão se o armazenamento estiver bloqueado. Busca, filtros, valores, registros e rascunhos não são gravados por esse hook. Os filtros continuam no estado da sessão montada: navegar conserva o contexto; recarregar reinicia esses filtros. A Ajuda explica a distinção.

## Crítica e refinamento

A primeira composição reservava uma linha inteira ao seletor de visão em Compras e empilhava os controles do Financeiro no celular. O resultado atrasava a chegada à informação. O seletor de Compras foi integrado à mesma barra de busca e os controles financeiros passaram a dividir espaço quando cabem. As cinco colunas cabem no desktop de referência; telas menores usam rolagem própria.

A inspeção também identificou regras antigas que forçavam o conteúdo dos cartões financeiros para um grid de linha. A apresentação dos cartões foi ajustada no CSS do Financeiro. Os testes conferem o conteúdo dentro da largura de cada cartão, além de conferir a largura da página.

Os primeiros testes de recarga presumiam persistência de todos os filtros, mas o contrato anterior guardava o workspace somente em memória. Em vez de persistir consultas e dados, foi criado o armazenamento restrito de apresentação e mantido o contrato dos filtros. O teste cobre navegação e recarga separadamente. Um localizador móvel ambíguo entre nav e select foi corrigido para o papel combobox; a interface não foi alterada para satisfazer a ambiguidade do teste.

## Validação

- 136 cenários gerais no build estático: 65 abas em desktop/celular e verificações adicionais de layout.
- Seis cenários específicos P2: paridade de IDs entre visões, duas obras e Todas as obras, busca/etapa, navegação mantendo filtros, recarga mantendo apresentação, direção e limites dos prazos, conteúdo dos cartões e cancelamento de operações e recusa de salto inválido entre etapas. Arraste exercitado por mouse no desktop; no celular, ação do cartão abre o recebimento. Nenhuma confirmação operacional disparada pelos cenários de consulta/cancelamento.
- Seis cenários de aparência da P1 repetidos e aprovados.
- 51 testes de código em nove arquivos: saldo parcial, dia +7 e +8, ausência/data inválida, independência entrega/pagamento, memorial/ação, sessão e isolamento de preferências entre usuários, armazenamento inválido e bloqueado, ajuda/manual.
- Quatro cenários adversos do quadro: Compras e Financeiro em 320 px com fontes bloqueadas, e ambos com texto ampliado a 200% em 1440 px. Sem overflow horizontal da página.
- Lint, TypeScript, manual sincronizado e análise de dependências aprovados: 1.492 módulos, 4.615 dependências, sem violações/ciclos.
- Build e gate de bundle aprovados: 1.789.681 bytes JS/CSS gzip, teto preservado em 1.789.952 bytes. A consolidação dos quadros permitiu acomodar a mudança sem elevar o teto, excluir artefatos da medição ou mexer em dependências.
- Ajuda de Compras e Financeiro · Hoje atualizada; manual regenerado com 99 guias para 65 abas. O padrão de aparência e a logo da P1 foram preservados.

Evidências: `artifacts/p2-browser`, `artifacts/p2-whole-erp.log`, `artifacts/p2-unit-final.log`, `artifacts/p2-foundation-regression.log`, `artifacts/p2-stress.json`, logs de lint/tipos/arquitetura e bundle. Chromium com viewports emulados, sem ensaio em aparelho físico ou Safari. APIs, migrações, backend e configurações de publicação sem alterações. Testes operacionais usam dados sintéticos/interceptados; não foram gravados registros reais.

## Roadmap

| Etapa | Situação |
| --- | --- |
| P0 — pesquisa e decisões | Concluída |
| P1 — fundação compartilhada | Concluída localmente |
| P2 — gestão à vista | Concluída localmente |
| P3 — ficha e ação | Concluída localmente; ver PILOTO-MARCELL-P3-20261101.md |
| P4 — exceções e linguagem | Próxima |
| P5 — revisão do piloto | Pendente |

Avaliação interna provisória: 8,8/10. A mesma informação agora permanece reconhecível ao mudar de visão e o Financeiro separa direção e prazo. A nota é uma apreciação de design; a meta 9,5 ainda depende de P3–P5 e de avaliação com operadores reais.

Atualização acumulada em 01/11/2026: P3 concluída localmente, nota interna provisória 9,0/10; P4 é a próxima etapa. Ver `PILOTO-MARCELL-P3-20261101.md`. A avaliação acima descreve a entrega P2.
