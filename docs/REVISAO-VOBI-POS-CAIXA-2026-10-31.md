# Revisão do financeiro após a prévia de caixa por conta

31/10/2026. Comparação em consulta, sem implementação funcional, importação,
conciliação, gravação financeira ou publicação.

## O que foi verificado

A sessão autenticada da Vobi ficou acessível após uma segunda tentativa de
carregamento. Foram consultados Resumo, Despesas e seus filtros, Receitas,
Pagamentos do cliente, Transferências, Contas bancárias, Extratos, a seleção
de conta da Conciliação, suas sugestões e o histórico de importações, DRE
Gerencial e Fluxo de caixa diário. A seleção de conta apenas abriu a consulta;
nenhum botão de conciliar, importar, criar ou excluir foi executado.

No MARCELL foram lidos os componentes atuais e as evidências da prévia local.
Uma observação adicional de navegador usou 925 movimentos fictícios, com APIs
interceptadas e nenhuma gravação. Esta medição não representa um teste de
desempenho com todos os documentos reais da empresa.

As conclusões distinguem observação direta, documentação da Vobi e proposta
para o MARCELL. Não foi presumida disponibilidade da Central de lançamentos
assistida: o menu dessa função aparece com cadeado na sessão consultada.

## Achados novos sobre os dados

**A conta final 9896 tem evidência cadastral adicional.** A Vobi apresenta uma
conta INTER com agência 0001. A comparação por hash dos dígitos completos
confirmou correspondência com o número preservado nos extratos do MARCELL,
sem colocar o número completo neste documento. A descrição da conta não
comprova titularidade jurídica. O saldo inicial mostrado no cadastro da Vobi
também não foi adotado como saldo bancário confirmado.

Essa evidência foi registrada fora do repositório, em
`C:/dev/marcell-local-review/contas-bancarias/EVIDENCIA-CADASTRAL-VOBI.json`.
A proposta e a prévia continuam com os campos não confirmados em branco.

**As bases bancárias estão em momentos diferentes.** Para essa mesma conta,
o histórico da Vobi mostrou importação de 27/10/2026, com movimentos até
26/10/2026. No material revisado do MARCELL, o último movimento conhecido é
15/08/2026. Isso não permite comparar saldos ou quantidades de pendências
como se as bases tivessem o mesmo período e as mesmas operações. Também
não comprova cobertura contínua entre as datas dos movimentos.

**A listagem da Vobi reúne origens de naturezas distintas.** No extrato,
33 contas estavam selecionadas, incluindo bancos identificados, cadastros
com nomes de obras e um registro chamado ajuste de saldos. A recomendação
é distinguir banco, caixa de obra e ajuste no MARCELL; não transformar
todos esses registros automaticamente em contas bancárias.

## Prioridades atualizadas

| Ordem | Melhoria no MARCELL | Evidência e resultado esperado |
|---|---|---|
| P0 | Mostrar atualização e limite dos dados bancários | Conta, último movimento conhecido, última importação disponível e posição informada devem estar juntos. Referência posterior ao material disponível precisa revelar que a cobertura posterior não foi comprovada; ausência de dados não equivale a ausência de movimento |
| P0 | Dar ao caixa uma entrada operacional própria | Hoje o caixa está dentro de Previsão por vencimentos, depois da hipótese de saldo dos títulos. Apresentar primeiro conta, origem do saldo e referência; oferecer Movimentos, Conciliação e Previsão reutilizando os componentes atuais |
| P1 | Levar pendências do caixa à transação certa na Conciliação | O memorial já explica os registros. Acrescentar o caminho de execução, com conta, período, busca e retorno preservados. Não conciliar nem lançar pagamento por mera navegação |
| P1 | Tornar memoriais grandes leves e claros | Paginar a lista ou usar uma solução equivalente e montar dados completos somente quando o registro for expandido. Separar total do conjunto, quantidade encontrada e subtotal da busca |
| P1 | Aproximar realizado e previsto sem misturar suas bases | A Vobi oferece fluxo diário com conta e saldo. No MARCELL, explicitar movimentos importados, fatos financeiros registrados e títulos previstos; definir uma data de corte e impedir dupla contagem de movimento e pagamento correspondente |
| P2 | Guardar consultas de trabalho | Reabrir, por usuário e empresa, recortes como pendências desta conta e documentos deste mês. Salvar preferências e filtros válidos; nunca credenciais, links assinados ou cópias dos lançamentos |
| P2 | Acrescentar faixas de atraso à cobrança | Cliente, obra, parcela, saldo restante, dias de atraso e próxima ação interna. Usar data de posição explícita e considerar recebimentos parciais |
| P2 | Acrescentar centro de custo aos relatórios | A Vobi possui essa dimensão; o MARCELL já preserva centro de custo em parte dos fatos, mas ainda não o oferece no agrupamento da central. Mapear somente fontes comprovadas e manter Sem centro de custo explícito |

No fluxo diário, transferências precisam aparecer na conta de origem e na
conta de destino, com neutralidade no consolidado pertinente. Não se deve
copiar automaticamente a semântica do saldo total da Vobi: sua documentação
informa que ele considera registros independentemente do filtro de datas.
[Extrato financeiro da Vobi](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi).

A documentação distingue relatórios por competência, fluxo diário/mensal
e agrupamentos por cliente, fornecedor, categoria e centro de custo. Isso
apoia ampliar as dimensões do MARCELL mantendo as bases já explícitas,
em vez de criar totais novos com nomes semelhantes.
[Relatórios financeiros da Vobi](https://ajuda.vobi.com.br/pt-br/articles/6682929-garanta-o-controle-financeiro-do-seu-negocio-com-os-relatorios-da-vobi).

## Layout operacional recomendado

Um cabeçalho compacto deve apresentar conta, empresa/obra abrangida, origem
do saldo, referência e atualização dos dados. A seguir, posição ou motivo
de sua indisponibilidade e acesso às pendências. A lista de movimentos vem
antes dos gráficos de análise, que podem ficar recolhidos.

Os filtros precisam declarar sua base temporal: vencimento, movimento ou
competência. A Vobi mantém essa escolha junto ao período nas despesas e
oferece filtros por categoria, centro de custo, conciliação, conta, fornecedor,
nota fiscal, projeto e valor. O ganho para o MARCELL é uma barra de contexto
coerente entre módulos, sem deixar o operador deduzir qual data afeta cada
bloco. [Despesas na Vobi](https://ajuda.vobi.com.br/pt-br/articles/6571050-como-gerenciar-as-despesas-da-sua-empresa).

Na prévia atual, a consulta histórica de todos os movimentos independe das
datas da simulação. Preservar essa consulta, mas tornar visível o rótulo
Todo o histórico e diferenciá-la de Pendências no período. O memorial já
leva o contexto; a indicação deve aparecer antes do clique também.

A referência visual da Vobi não deve ser copiada inteira: nas telas de
despesas e fluxo diário observadas, gráficos altos afastam a lista da
primeira área visível. No redimensionamento de Pagamentos do cliente a
390 px, o menu lateral aberto restringiu o espaço de trabalho. Isso foi
uma observação de redimensionamento, não um teste completo de acesso móvel.
O MARCELL deve preservar sua navegação móvel e priorizar ações e registros.

## Medição do memorial

Na observação com 925 registros fictícios em 1440 px:

- A abertura e montagem levaram 2.985 ms nesta execução.
- Foram montados 151.709 elementos no diálogo e 925 painéis de detalhes,
  mesmo com registros recolhidos.
- Uma busca reduziu a lista a um registro; o cabeçalho permaneceu mostrando
  925 lançamentos e o total do conjunto, sem subtotal explícito da busca.
- As APIs foram interceptadas e nenhuma gravação foi enviada.

Os totais originais não estão necessariamente errados: falta distinguir
visualmente total original e resultado da pesquisa. A próxima implementação
deve pesquisar no conjunto inteiro, preservar a exportação do recorte
completo e manter foco, busca e posição ao voltar de um documento.
Evidência: `artifacts/financeiro/revisao-pos-caixa/memorial-observacao.json`.

## Pontos de código para a próxima implementação

- `src/features/financeiro/CashForecast.jsx:22` — hierarquia de previsão e caixa.
- `src/features/financeiro/AccountCashPosition.jsx:23` — referência sem indicador
  próximo de atualização e limite dos dados bancários.
- `src/features/financeiro/FinancialMemorial.jsx:20` — total do conjunto durante
  a busca; `:22` — montagem de toda a lista e seus detalhes.
- `src/features/financeiro/DocumentCenter.jsx:20` — lista integral, também
  candidata à paginação após medição com volume representativo.
- `src/domains/financeiro/report-center.js:12` — agrupamentos ainda limitados
  a obra, categoria e contraparte.

Essa leitura usou Impeccable e
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md),
especialmente hierarquia operacional, contexto de navegação e tratamento de
listas grandes. Não equivale a uma auditoria completa de acessibilidade.

## O que já existe e deve ser preservado

Memoriais de DRE, bases de cálculo e exportações com o mesmo recorte,
indicadores clicáveis, ações operacionais da fila Hoje, filtros compactos,
consulta de evidências e originais, leitor do OneDrive, comparação na
Conciliação e apropriação por etapa já estão presentes no código atual.
A recomendação não é reconstruir essas funções. A documentação de revisão
anterior precisa ser lida considerando essas evoluções posteriores.

A próxima entrega recomendada reúne cabeçalho e atualização do caixa,
recorte explícito das pendências, acesso direto à Conciliação e memorial
com paginação, detalhes sob demanda e subtotal da busca. Os demais itens
podem seguir depois, reaproveitando os motores e as autorizações atuais.

Nesta rodada, apenas esta análise e evidências locais foram produzidas.
Dados, cadastro, vínculos da conta e campos da prévia não foram alterados.
O servidor de revisão e seu processo do OneDrive foram mantidos, sem
publicação na Vercel, push ou criação de branches remotas.
