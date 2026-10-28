# Conciliação bancária, categorias e DRE

Pesquisa, implementação e verificação da evolução solicitada em 28/10/2026.

**Status:** funcionalidades implementadas na branch `feat/conciliacao-categorias-dre-sugestoes`, com suíte completa aprovada e revisão `dre-integration-guardian` sem achados bloqueantes. Os testes de navegador permanecem pendentes por indisponibilidade de Chromium neste ambiente. Não houve implantação em produção, contratação ou conexão ativa com APIs bancárias por esta alteração.

## Objetivo

Na conciliação, permitir pesquisar categorias digitando parte do nome e restringir as opções a entradas ou saídas. Antes de oferecer um lançamento novo, apresentar sugestões de compras, notas, folha, medições e outros registros que já existam, com o motivo da sugestão e o efeito financeiro esperado.

A mesma informação deve alimentar a conciliação, o caixa e o DRE, preservando suas datas e naturezas. O pagamento de uma compra ou salário já reconhecido deve baixar ou vincular a obrigação correspondente; não deve criar outra despesa apenas porque o extrato foi importado.

## Funcionalidades implementadas

- Campo de categoria pesquisável por nome, grupo ou identificador, com busca sem acentos e navegação por teclado. As opções respeitam entrada/saída e destino obra/empresa.
- Catálogo da obra compartilhado com o DRE, incluindo categorias personalizadas, disponível também para o perfil Financeiro. As despesas corporativas usam a taxonomia gerencial existente.
- Filtros por direção e categoria na fila. Movimentos já conciliados usam a categoria do vínculo confirmado; novas candidatas não alteram sua classificação na busca.
- Sugestões de obrigações em aberto e de pagamentos/recebimentos existentes, com identidade, valor, saldo, data e identificadores disponíveis. Os registros já pagos oferecem vínculo, sem criar outra liquidação.
- Competência informada para novos lançamentos e explicação do efeito no DRE. O servidor determina a natureza financeira pelo catálogo permitido e valida os centavos do rateio.
- Prioridade de revisão para folha e pagamentos existentes. O cartão PIX de funcionário ainda sem título registra somente caixa e preserva o custo do ponto.
- Gestor de conciliação do DRE com buscas independentes para banco e registro, filtro por direção/categoria e associação parcial aos registros existentes.
- Regras de classificação associadas à direção do movimento. Elas sugerem um destino e continuam exigindo confirmação.

## Referências de ERPs

| Produto | Comportamento documentado | Aplicação ao Hygor |
| --- | --- | --- |
| Vobi | Busca lançamentos para conciliar usando valor, datas e beneficiário; permite filtrar registros por informações como descrição, categoria, projeto e conta. Pode relacionar um movimento do extrato a vários lançamentos. | Reutilizar informação cadastrada e mostrar candidatos com evidências. Separar "vincular existente" de "criar lançamento". |
| Vobi — DRE | Organiza categorias em grupos do DRE e trabalha com competência; transferências e saldo inicial não representam resultado. | Usar o plano gerencial de categorias e manter natureza financeira explícita. Entrada de dinheiro não equivale automaticamente a receita. |
| Conta Azul | Sugere correspondências por valor e data e permite conciliações com um ou vários lançamentos. A API de categorias oferece tipo `RECEITA`/`DESPESA` e busca textual. | Categoria digitável, filtrada pela direção; sugestões ordenadas e confirmação consciente. |
| Omie | A conciliação procura títulos existentes e permite agrupar valores; sua documentação diferencia localizar o lançamento e criar outro. | Evitar duplicidade entre compra, nota, pagamento e importação bancária. |

Fontes oficiais:

- [Vobi — Conciliação bancária](https://ajuda.vobi.com.br/pt-br/articles/8632074-como-utilizar-a-conciliacao-bancaria-na-vobi).
- [Vobi — DRE gerencial](https://ajuda.vobi.com.br/pt-br/articles/9641347-como-analisar-os-resultados-da-sua-empresa-com-o-dre-gerencial).
- [Conta Azul — Sugestões de conciliação](https://ajuda.contaazul.com/hc/pt-br/articles/44909103864461-Concilia%C3%A7%C3%A3o-como-funciona-a-sugest%C3%A3o-da-coluna-Lan%C3%A7amentos-da-Conta-Azul).
- [Omie — Conciliação com extrato integrado](https://ajuda.omie.com.br/pt-BR/articles/2495094-conciliacao-bancaria-com-o-extrato-do-banco-integrado-ao-omie).
- [Conta Azul — API de categorias](https://developers.contaazul.com/open-api-docs/open-api-finance/categorias).

As tolerâncias utilizadas por um ERP são critérios de sugestão, não autorização para baixar valores diferentes. No Hygor, a confirmação deve validar os centavos e o saldo; diferenças precisam de tratamento explícito.

## Regras de resultado e caixa

| Situação | Efeito no caixa | Efeito no DRE |
| --- | --- | --- |
| Compra/nota com custo já reconhecido | Baixa ou associação do pagamento existente | Preservar o custo da competência original. |
| Salário com título de folha | Baixa pelo líquido disponível no título | Preservar custo/rateio calculado pelo motor único de mão de obra. |
| Pagamento de funcionário identificado, ainda sem título | Registrar pagamento de folha e sua pendência de alocação | Preservar o custo já apurado pelo ponto, sem criar despesa genérica. |
| Medição ou recebível já existente | Registrar recebimento ou vincular o que já foi registrado | Preservar receita e competência de origem. |
| Receita nova classificada explicitamente | Entrada na data do banco | Reconhecer receita na competência informada. |
| Recebimento avulso legado sem natureza explícita | Entrada de caixa ainda não alocada | Não presumir receita. |
| Aporte, empréstimo ou transferência entre contas | Movimento de caixa conforme a natureza | Sem receita ou despesa por mera movimentação de dinheiro. |

Os novos recebimentos em `data.payments` produzem receita somente quando a classificação revisada indica `efeitoDRE: "receita"`, nas categorias `receita_servicos` ou `outras_receitas`, e sem `medicaoId`/`contratoId`. A ausência desse marcador preserva o tratamento legado. O razão e a projeção em sombra usam a mesma função de `src/domains/dre/receipt-classification.js`.

Campos relevantes do registro: `categoria`, `competencia`, `dataReconhecimento`, `efeitoDRE`, `date`, `amount`, `obraId`, `transacaoId`, origem e autoria. `date` representa o recebimento; `competencia` representa o mês do resultado. O servidor determina o marcador a partir da categoria permitida, sem aceitar um efeito financeiro arbitrário enviado pelo navegador.

Receita explicitamente classificada deixa de ser sinalizada como recebimento sem destinação. Um recebimento vinculado a medição ou contrato não gera reconhecimento adicional.

## Caminho técnico existente

1. A tela envia intenção e identificadores para `/api/data`, ação `reconciliation-command`.
2. `api/data.js` verifica perfil, escopo, comando e chave idempotente. O caminho transacional relê e bloqueia a base antes de executar a mutação.
3. `server/reconciliation-command.js` executa `CONFIRM_ALLOCATION` sobre a fotografia autoritativa. O total dos destinos deve fechar exatamente o valor bancário.
4. O resultado atualiza as coleções operacionais e o histórico; `projectReconciliationPatch` devolve somente as seções alteradas e autorizadas.
5. `payments` pertence à linha principal e já integra `LEGACY_FINANCIAL_FACT_FIELDS`. Sua alteração invalida a revisão dos dados e dispara a sincronização financeira quando aplicável.
6. `src/domains/financeiro/ledger.js` produz os efeitos de resultado e caixa. Os cálculos do DRE por obra e consolidado e a projeção do servidor consomem esse motor.
7. `server/financial-shadow.js` produz os fatos usados para projetar títulos, liquidações e eventos no banco. Ele usa a mesma classificação de recebimentos do razão, preserva competência e metadados e separa reconhecimento de liquidação.
8. `financial-dre-report` compara `sourceRevision` e `DRE_PROJECTION_VERSION` antes de servir a projeção. A versão foi incrementada para `2026-10-conciliacao-categorias-competencia-v8` nesta alteração.

### Preservação dos dados

- A normalização de `payments` em `src/LegacyApp.jsx` usa `...p`; campos novos são preservados.
- `server/data-projection.js` e `server/section-patch.js` filtram escopo/seções, preservando os objetos de recebimento autorizados.
- O codec e o roteamento de domínios mantêm `payments` no documento principal. Não é necessária uma nova linha de domínio apenas para esses campos.
- `createManualReceipt` continua construindo recebimentos legados sem natureza explícita e sem reconhecimento automático de receita.
- `server/financial-shadow.js` passou a emitir reconhecimento para a receita explícita e a preservar categoria, competência e efeito. Os demais recebimentos mantêm reconhecimento zero.
- `canonicalDreEvents` exclui títulos com `metadata.legacyId`, impedindo a soma do reconhecimento operacional com sua própria projeção.
- A normalização dos rateios aceita os nomes antigos em inglês e preserva o formato atual em português; o vínculo mantém o identificador do pagamento existente.

### Reversão e fechamento

Os recebimentos criados por conciliação ficam em `transacao.gerados`. Desfazer a conciliação marca o registro como estornado e mantém autoria/motivo; o motor deixa de considerar registros inativos. A sincronização financeira desativa as projeções legadas ausentes do conjunto ativo.

A reversão de um vínculo de pagamento que já existia desfaz apenas a associação bancária. A compra, o título de folha e o pagamento original são preservados.

O comando de rateio verifica o fechamento da data bancária e, quando cria custo ou receita, da competência afetada. A reversão de uma receita ou despesa criada também verifica a competência de origem. O pagamento de um fato já reconhecido preserva a competência original. Não há reabertura automática de período fechado.

### Rateios de mesmo valor

A revisão identificou que a proteção antiga contra caixa duplicado usava `efeito + transacaoId + valor`, confundindo duas parcelas legítimas de mesmo valor. O razão agora distingue as parcelas explicitamente identificadas em `transacao.gerados` e preserva a proteção contra espelhos duplicados do mesmo pagamento. Foram verificados dois destinos de R$ 500 em um movimento de R$ 1.000 e um rateio misto de R$ 500 para medição existente mais R$ 500 de receita nova em outra obra.

## Sugestões de vínculo

O motor usa os seguintes critérios na pontuação das candidatas:

1. Identificador ou vínculo financeiro inequívoco já registrado.
2. Documento/contraparte correspondente, direção compatível, valor e saldo disponíveis.
3. Proximidade entre data do banco e vencimento ou pagamento do registro.
4. Descrição normalizada, fornecedor, empregado, obra e categoria como reforço.

A interface mostra os motivos e distingue obrigação ainda aberta de pagamento já registrado. Valor igual sozinho não é evidência suficiente para confirmação em lote. O vínculo preserva a categoria, a competência e o custo ou receita da obrigação existente.

## APIs bancárias

### Pluggy — principal candidata

A Vobi identifica a Pluggy como parceira da sua infraestrutura de Open Finance. A conexão é autorizada pelo titular no ambiente do banco; a Vobi informa que as atualizações ocorrem ao longo do dia, sem promessa de tempo real.

- [Vobi — Integração automática via Open Finance](https://ajuda.vobi.com.br/pt-br/articles/11542519-integracao-automatica-via-open-finance).
- [Pluggy — Transações](https://docs.pluggy.ai/en/docs/products/transactions).
- [Pluggy — Webhooks](https://docs.pluggy.ai/en/reference/webhooks).
- [Pluggy — Autenticação do widget](https://docs.pluggy.ai/en/docs/connect-widget/authentication).

A API fornece direção e estado da transação, dados de contraparte quando disponíveis e enriquecimento conforme os recursos contratados. A categorização bancária é evidência auxiliar; não substitui o plano de contas do Hygor.

O adaptador deve tratar eventos de criação, atualização e exclusão com idempotência. IDs podem mudar após exclusão/recriação ou reconexão; a documentação recomenda considerar `providerId` de Open Finance, identificadores disponíveis e atributos para reconciliar esses casos. Movimentos `PENDING` não devem ser baixados como se fossem `POSTED`.

Credenciais completas ficam no servidor. O navegador recebe somente o token limitado apropriado ao widget. A pesquisa não equivale a contratação, obtenção de credenciais ou conexão bancária.

### Alternativas e integrações empresariais

- [Belvo — Transações](https://developers.belvo.com/pt-br/apis/belvoopenapispec/transactions/listtransactions) e [webhooks](https://developers.belvo.com/pt-br/developer_resources/resources-webhooks-aggregation): alternativa de agregação, com categorização opcional e eventos de atualização.
- [Omie — Lista de APIs](https://developer.omie.com.br/service-list/): títulos a pagar/receber, movimentos, extrato, categorias e contas do DRE, caso exista uma operação externa no Omie a integrar.
- [Conta Azul — API financeira](https://developers.contaazul.com/open-api-docs/open-api-finance): categorias, parcelas, competência e rateios, caso haja dados operacionais externos a sincronizar.

Não foi localizada documentação pública oficial de API Vobi nesta pesquisa. Isso não exclui a existência de acesso privado ou por parceria.

As [orientações oficiais de Open Finance para contas](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1739096252/Orienta%2Bes%2B-%2BDC%2BContas) descrevem casos PJ em que movimentos de Pix, boletos ou folha são agrupados/desagrupados entre D0 e D+1. Uma integração futura deve considerar esses estados e não assumir um movimento por empregado.

## Skills e documentação para implementação

| Recurso oficial | Utilidade |
| --- | --- |
| [Pluggy Agent Skills](https://docs.pluggy.ai/en/docs/developer-tools/ai-skills) — `pluggy-integration` | Autenticação, widget, conexões e webhooks. |
| Mesmo pacote — `pluggy-open-finance` | Busca, paginação, sincronização e tratamento das transações. |
| Mesmo pacote — `pluggy-doctor` | Revisar uma integração Pluggy existente contra a documentação atual. |
| [Pluggy Docs MCP](https://docs.pluggy.ai/en/docs/developer-tools/mcp) | Consultar documentação e referência atualizadas; endereço público `https://mcp.pluggy.ai/mcp`. |
| [Supabase Agent Skills](https://github.com/supabase/agent-skills) — `supabase-postgres-best-practices` | Integridade, índices, consultas e isolamento no Postgres. |
| [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills) — React | Revisão de componentes e eficiência do carregamento/renderização. |

Skills auxiliam o trabalho de desenvolvimento; não são o motor de conciliação executado pelo usuário final. A skill de iniciação de pagamentos da Pluggy não é necessária para importar extratos e conciliar.

## Evidências de validação e revisão

A revisão `dre-integration-guardian` conferiu comando autoritativo, normalização, projeção por papel, revisão dos fatos financeiros, razão, projeção em sombra, DRE por obra/consolidado/empresa, demonstrativo anual e reversão. Os achados de catálogo personalizado ausente para Financeiro e de filtro incorreto dos movimentos já conciliados foram corrigidos e revalidados.

A revisão incremental também conferiu a preservação de fatos arquivados e o helper compartilhado de origem do pagamento. Arquivar não remove uma obrigação real; pagamentos do cliente ou do caixa físico da obra não podem ser vinculados indevidamente ao banco da empresa. As regressões cobrem os aliases de origem usados pelos módulos existentes. Essa revisão passou em 3 arquivos/56 testes, sem achados bloqueantes.

Foram executadas rodadas focadas de 6 arquivos/67 testes e 8 arquivos/65 testes, ambas aprovadas, com sobreposição entre elas. A revalidação do contexto de classificação e da tela, após a correção do filtro, passou em `TZ=UTC` com 2 arquivos/10 testes. Esses resultados não representam uma soma de testes únicos nem substituem a suíte completa.

Os cenários verificados incluem:

- Busca de categoria sem acentos e coerência de direção/destino.
- Categoria personalizada visível ao Financeiro, inclusive restrito a uma obra.
- Vínculos a despesas, compras, folha e recebimentos existentes preservando valores e o fato original.
- Receita explícita reconhecida uma única vez e aporte/empréstimo/recebimento legado sem receita automática.
- Competência distinta da data bancária, bloqueio em período fechado e reversão auditável.
- Rateios iguais e mistos preservando o total bancário.
- Salário identificado sem título preservando o custo do ponto: R$ 100 antes e R$ 100 depois da conciliação, com registro separado de caixa.
- Filtro de movimentos conciliados pela fonte confirmada, incluindo vínculos parciais de folha, nota e terceiro; candidatas posteriores não alteram a classificação confirmada.
- Vínculo de pagamento legado pelo perfil RH, sem abrir o cartão de nova apropriação.

Na execução completa, o ambiente inicialmente estava em `Asia/Seoul`; executar em `TZ=UTC` resolveu as falhas de datas. Também foi identificado um vazamento de recursos preexistente em `apps/ponto-obra/src/logica/regressao.test.js`: cada teste abria um banco PGlite sem encerrá-lo. O ajuste adiciona apenas encerramento de recursos entre os cenários, incluindo o caso que substitui o cenário dentro do próprio teste. As 38 verificações desse arquivo passaram isoladamente e na suíte completa, sem modificar assertivas, ignorar testes ou alterar a lógica do aplicativo.

### Resultado final dos gates

Validação em 28/10/2026, sobre a base `5a03b0478849a8cf735c1484dbef7713e9929d50`:

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Aprovado. |
| `npm run architecture:check` | Aprovado, sem violações. |
| `npm run typecheck` | Aprovado. |
| `TZ=UTC npm test -- --maxWorkers=3 --reporter=dot` | **441 arquivos aprovados, 2 ignorados; 3.254 testes aprovados, 13 ignorados; nenhum erro de execução.** |
| `npx vite build` | Aprovado; aviso de tamanho de chunks já presente no projeto. |
| `git diff --check` | Aprovado. |
| Revisão `dre-integration-guardian` | Concluída, sem achados bloqueantes remanescentes. |
| Playwright desktop/mobile | 6 cenários reconhecidos com `--list`; execução e screenshots pendentes. O Chromium não está instalado e os downloads oficiais retornaram arquivos vazios/corrompidos. |

Os testes de regressão de classificação e vínculo falharam antes das respectivas correções. Para arquivamento e aliases de origem, a prova adicional usou cópias temporárias dos módulos com apenas esse delta revertido; as quatro fixtures falharam como esperado.

O build foi executado diretamente pelo Vite: nenhuma rotina de migração do `prebuild` foi acionada. A entrega fica em PR para revisão. `CLAUDE.md` informa que merge em `main` publica em produção; o agente local exige revisão humana antes de mesclar.

**Produção e APIs externas:** nenhum deploy, merge em `main`, acesso bancário ou serviço pago foi ativado por esta implementação. Uma integração de extratos via API continua sendo uma etapa futura, dependente da escolha do provedor e da autorização dos titulares.
