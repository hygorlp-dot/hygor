# Triagem das 793 transações bancárias — 15/11/2026

Continuação automática do [roadmap](ROADMAP-SOLUCOES-E-VALIDACAO-DRE-2026-11-14.md), após [W1-22 e lint](W1-22-E-LINT-2026-11-15.md). Captura em **15/11/2026 às 16:47:26, horário da Bahia**. Dados reais consultados somente para leitura; processamento, correção de código e validações locais. Nenhum comando financeiro executado sobre dados reais, nenhuma alteração remota, push, PR ou publicação na Vercel.

## Resultado

**As 793 transações foram triadas individualmente, sem escolher vínculos ou naturezas financeiras por suposição. Nenhuma ficou elegível para conciliação automática pelas salvaguardas atuais.** Triagem concluída não significa conciliação ou classificação financeira confirmada.

| Grupo final de revisão | Quantidade | Providência |
| --- | ---: | --- |
| Sem destino seguro | 436 | Comprovar natureza, contraparte e documento de origem. |
| Indicação de pessoa sem título compatível | 240 | Localizar título, folha ou medição e verificar saldo e pagamentos anteriores. Nome conhecido não identifica a obrigação. |
| Conflito entre cadastros | 21 | Conferir CPF/CNPJ ou chave Pix e separar os cadastros antes de escolher o destino. |
| Hipótese de registro financeiro para comparação | 69 | Revisar 55 medições e 14 registros de caixa da obra já existentes. Nenhum candidato foi confirmado. |
| Pendente em extrato arquivado | 27 | Conferir origem, motivo do arquivamento e histórico; não reabrir, ignorar ou reimportar automaticamente. |
| **Total, sem sobreposição dos grupos** | **793** | **Todas com ID, origem, motivo, prioridade e próxima providência.** |

Os 793 avisos correspondem a **766 movimentos de extrato ativo e 27 de extrato arquivado**. O conjunto inteiro contém 925 movimentos: 793 pendentes, 56 conciliados e 76 ignorados. O inventário canônico confirmou essas mesmas quantidades.

## Etapa 1 — origem, escopo e cobertura

O aviso `UNCLASSIFIED_BANK_TRANSACTION` foi conferido no razão e cruzado por ID com cada movimento. Não se presumiu que um aviso representasse uma despesa ainda não lançada. O mecanismo também pode avisar uma transação marcada como conciliada sem efeito de caixa, mas **os 793 casos desta captura estavam todos como pendentes**.

| Extrato | Situação | Movimentos desta triagem | Entradas nominais | Saídas nominais |
| --- | --- | ---: | ---: | ---: |
| `vynopak7taqf` | Ativo | 766 | R$ 857.330,54 | R$ 748.542,23 |
| `id7lq8dmxrta` | Arquivado | 27 | R$ 7.160,00 | R$ 20.751,52 |
| **Total** | | **793** | **R$ 864.490,54** | **R$ 769.293,75** |

São **172 entradas e 621 saídas**. Esses totais descrevem movimentos bancários pendentes, não receita e custo do DRE nem saldo disponível. Somá-los ao razão criaria o risco de contar novamente fatos operacionais já reconhecidos ou de tratar aporte/transferência como receita.

Cada um dos 793 movimentos foi comparado com uma única linha canônica pelo `metadata.legacyId`. O espelho canônico guarda o valor em módulo e a direção separadamente; a conferência respeitou esse contrato. **Zero divergências de valor ou direção** foram encontradas após ler a direção dos 925 registros canônicos. Uma comparação inicial entre valor assinado e valor em módulo foi corrigida na ferramenta e coberta por teste; não era uma divergência de dados da empresa.

Os três extratos preservam banco e conta de origem nos metadados de importação. A proposta de contexto bancário já existente foi reutilizada e identificou um mesmo escopo de conta, porém não há cadastro de conta bancária no conjunto operacional capturado. A triagem recupera esse contexto pelos IDs dos extratos, sem criar cadastros ou preencher titularidade, agência, tipo ou saldo de abertura por suposição. Uma eventual vinculação cadastral exige conferir os originais e a titularidade.

**Efeito no DRE:** zero. Todos os valores, situações, rateios e vínculos bancários foram preservados.

## Etapa 2 — hipóteses e documentos

Foi reaproveitado o motor existente de conciliação e suas salvaguardas, em vez de criar outro algoritmo de baixa. A ferramenta não gera comandos de conciliação. Pontuação, proximidade de data/valor e semelhança de nome servem apenas para ordenar a investigação.

- **228 movimentos** têm algum candidato na análise existente; só **69** apontam para um registro financeiro passível de comparação manual nesta triagem. Os demais candidatos podem ser apenas cadastros de pessoa, sem obrigação identificada.
- **272 movimentos** têm indicação de nome/pessoa pelo motor, mas **zero** têm identidade confirmada por CPF/CNPJ ou chave Pix exatos nos dados bancários comparados. “Nome identificado” não foi convertido em vínculo financeiro.
- **Zero** movimentos têm comprovante bancário anexado no cadastro capturado. **Dois** casos têm link/documento no registro de destino; esses links não foram tratados como comprovantes do movimento bancário nem declarados lidos.
- Dez IDs já apareciam na revisão anterior dos primeiros dez casos. Essa referência foi preservada para evitar retrabalho, sem reaproveitar conclusões antigas como aprovação: os dados atuais possuem impressão digital própria.

Os 14 registros de caixa da obra foram mantidos entre as hipóteses de revisão, embora não pertençam à lista de tipos admitidos para baixa automática. São duas perguntas diferentes: existir um registro financeiro para consultar não significa haver evidência para conciliá-lo. A ferramenta preserva essa distinção e não confunde cadastro de funcionário/terceiro com título de folha ou medição.

**Efeito no DRE:** zero. Não foram criadas despesas, receitas, medições, títulos ou pagamentos para encaixar os valores do banco.

## Etapa 3 — prioridade e trava preservada

| Prioridade | Casos | Tratamento |
| --- | ---: | --- |
| P0 | 1 | Movimento `mt7l9lt5xrta`, R$ 7.160, rotulado APORTE GERAL, em extrato arquivado. A composição continua não confirmada. A finalidade de mão de obra da B2-04 já informada não autoriza escolher um lançamento. |
| P1 | 95 | 69 hipóteses financeiras para comparação e outros 26 pendentes de extrato arquivado. |
| P2 | 697 | Investigar origem, identificação e conflitos cadastrais antes de qualquer lançamento. |
| **Total** | **793** | Ordem de revisão, não autorização de execução. |

A trava existente do movimento de R$ 7.160 foi mantida inclusive no caso arquivado. Não foi classificado automaticamente como faturamento, empréstimo, transferência ou aporte confirmado. Os motivos das 27 pendências arquivadas foram mantidos, sem apagar linhas para reduzir a contagem.

**W1-22:** continua em pendência documental, medição `izzo6ygfjqds`, excedente local de **R$ 12.000**. Não foi vinculado a nenhum crédito bancário apenas por nome, valor ou proximidade. As datas e os valores desse caso permanecem iguais, e nenhuma prévia de fechamento foi liberada.

## Etapa 4 — duplicidades e referência OFX

Foram verificados os identificadores no escopo da conta, sem juntar movimentos de contas desconhecidas ou diferentes. O padrão OFX exige tratar o FITID no contexto da instituição e da conta; `REFNUM` é uma referência OFX, não comprovação de um identificador Pix. Referência técnica: [especificação OFX Banking 2.3, seções de FITID e transações](https://financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%20Banking%20Specification%20v2.3.pdf).

- **Zero grupos de FITID repetido** e **zero grupos de chave de importação repetida** no escopo de conta recuperado dos metadados.
- **Sete grupos de conteúdo repetido**, envolvendo 15 movimentos desta triagem: mesma conta de origem nos metadados, data, valor e descrição normalizada. Todos são do mesmo extrato, sem repetição entre extratos nesses grupos. Isso é sinal de revisão, **não prova de duplicidade de negócio**; nenhum movimento foi excluído ou ignorado.
- **766 registros** têm o campo `txid` igual ao `refnum` preservado na importação. O parser usava `TXID || REFNUM`; uma referência repetida podia ser apresentada como identificador Pix, afetando a comparação e a detecção de identificadores repetidos.

O parser foi corrigido para preencher `txid` **somente quando o OFX trouxer a tag `TXID`**. `REFNUM` e `CHECKNUM` continuam preservados nos metadados. FITID, datas, valores, descrição e a chave de deduplicação por FITID foram mantidos. O teste reproduziu a falha antes da correção e passou depois; também confere que uma tag TXID explícita não é descartada.

Não foram encontrados os OFX originais nas pastas locais consultadas. Por isso, **nenhum dos 766 registros históricos teve o TXID apagado ou reinterpretado automaticamente**. A correção vale para novas importações locais; o saneamento histórico exige original e conferência por movimento. Não se deve reimportar tudo para “corrigir” o identificador.

**Efeito no DRE:** zero. A mudança é de procedência do identificador; não emite receita, custo ou caixa. As possíveis repetições ficaram em arquivo próprio de revisão, sem exclusão, alteração de valores ou ligação por semelhança.

## Arquivos da triagem e automação entregue

Os casos completos ficam em `C:/dev/marcell-local-review/triagem-bancaria-20261115/triage/`, fora do repositório e de pastas públicas:

- `cases.json`: 793 casos com ID, extrato, valor em centavos, motivo, prioridade, hipótese não confirmada, evidências disponíveis e próxima ação.
- `cases.csv`: fila ordenada por prioridade e valor, com proteção contra fórmulas em campos textuais.
- `summary.json`: totais e contagens de cobertura.
- `duplicate-review.json`: grupos que exigem conferência de repetição; nenhuma decisão automática.
- `account-context-review.json`: contexto de origem bancária reaproveitado, ainda como proposta não executável.

A ferramenta `scripts/triage-bank-transactions.mjs` aceita apenas arquivos locais. Não recebe conexão de banco, não altera a origem e não possui opção de aplicar conciliação. A análise se recusa a prosseguir com IDs de movimento repetidos ou valores inválidos e verifica que os dados em memória não foram alterados.

```powershell
node scripts/triage-bank-transactions.mjs `
  --input=C:/dev/marcell-local-review/triagem-bancaria-20261115/data-consolidated.json `
  --snapshot=C:/dev/marcell-local-review/triagem-bancaria-20261115/snapshot.json `
  --previous-review=C:/dev/marcell-local-review/piloto-real/primeiros-10-evidencias.json `
  --output=C:/dev/marcell-local-review/triagem-bancaria-20261115/triage
```

## DRE e validação

A nova captura foi consolidada preservando somente as correções locais já comprovadas na rodada anterior: X1-25 e identificações históricas. A cópia anterior não substituiu a linha principal atual. A conferência preservou a W1-22 e comparou o resultado com o consolidado anterior:

| Etapa | Conferência financeira |
| --- | --- |
| Captura e recuperação da origem bancária | Movimentos e espelhos preservados, sem gravações remotas. |
| Análise e exportação dos 793 casos | Impressão digital dos dados antes/depois igual; zero comandos executados. |
| Revisão de possíveis duplicidades | Nenhum fato financeiro removido ou criado. |
| Correção do parser OFX | Testes preservam valor, data, FITID e referência original; não houve reimportação real. |
| Conferência final | **36 competências empresariais e 648 projeções por obra/mês iguais ao consolidado anterior**; zero receita, custo ou caixa novos. Memoriais e composição entre razão e DRE gerencial sem diferença não explicada. |

As 793 linhas continuam pendentes no banco real e no espelho operacional: o trabalho concluiu a **triagem**, não a conciliação. O único excedente financeiro não explicado no consolidado local continua sendo o da W1-22, e o fechamento permanece bloqueado. Na origem remota, a correção local da X1-25 também ainda não foi aplicada.

- **760 testes selecionados aprovados**, zero falhas/pulos: triagem, origem bancária, OFX, conciliação, finanças, DRE, fechamento e leitores somente leitura. Incluem 14 testes da ferramenta e os testes de regressão do parser.
- **Cinco cenários de navegador aprovados**, zero falhas/pulos na rodada final: automação controlada, revisão persistente, filtros/seleção, associação parcial ao DRE, falha/retentativa e reversão. As jornadas de conciliação iniciam em desktop e incluem os estados móveis previstos nos próprios testes; o gestor do DRE também foi executado em projeto móvel separado.
- Uma configuração inicial iniciou três testes escritos para navegação desktop diretamente em projeto móvel; eles aguardaram um menu lateral inexistente naquele tamanho. A configuração foi corrigida respeitando o percurso original, que já redimensiona para celular. As asserções financeiras foram mantidas; logs da rodada inválida foram preservados, sem somar execuções repetidas.
- Imagens da revisão conferidas em desktop/celular. Ajuda e manual atualizados para distinguir indicação de pessoa, referência genérica e pendência arquivada: **143 guias para 65 abas**, revisão de 15/11/2026. Não foram criados novos componentes ou estilos.
- Lint, design e tipos aprovados, sem aumento da baseline. Build local via Vite e orçamento de bundle conferidos; nenhuma execução do prebuild com migrações remotas.

O build atual soma **1.813.149 bytes gzip**, com limite mantido em **1.891.328** e **78.179 bytes de margem**, sem violações. A orientação de ajuda e a correção da origem do identificador preservam o ganho de empacotamento das rodadas anteriores.

Evidências técnicas em `artifacts/triagem-bancaria-20261115/`: captura, inspeção, triagem, teste antes/depois do OFX, suíte final, navegador, logs, mapas do build, conferência financeira e `verification.json`. Dados detalhados permanecem no diretório privado indicado acima.

## Continuação da revisão — 15/11/2026

A [revisão das 69 hipóteses e dos sete grupos](REVISAO-HIPOTESES-E-REPETICOES-2026-11-15.md) foi concluída como análise, sem homologação financeira. As hipóteses apontam para 12 destinos; oito são concorrentes entre 65 casos. Foram separados 23 casos de caixa já existente e 46 de saldo a receber. Os dois comprovantes do destino foram encontrados e lidos localmente, com pendências de origem/data explicitadas. Os 15 movimentos repetidos possuem identificadores distintos e nenhuma duplicidade de negócio foi comprovada. DRE conferido em cada etapa, W1-22 mantida; 190 testes e verificações locais aprovados. O roadmap atualizado está no novo relatório; a lista abaixo registra as pendências ao terminar a triagem inicial.

## Roadmap seguinte à triagem inicial

1. **P0 — comprovar a composição dos R$ 7.160.** Preservar a trava e os vínculos anteriores; não gerar novo faturamento ou custo.
2. **P1 — conferir os 69 candidatos financeiros e os 27 arquivados**, respeitando a sobreposição da prioridade P0. Priorizar os dois casos com documento no destino e os dez IDs já revisados; obter o comprovante bancário individual antes de escolher vínculo ou pagamento.
3. **P1 — reinspecionar os originais OFX e validar a conta de origem.** Só então propor saneamento dos identificadores legados, comparando cada ID e sem reimportação em massa. Revalidar os sete grupos de conteúdo repetido; mesmo valor/data/descrição não autoriza exclusão.
4. **P2 — obter documentos para os demais casos e resolver conflitos cadastrais**, reaproveitando os registros existentes. Não criar cadastros ou lançamentos apenas para encaixar a linha do banco.
5. **W1-22 — manter pendência documental** até obter contrato/aditivos, composição das parcelas e comprovante da entrada. Depois de comprovar cada correção, repetir DRE, saldos e prévia de fechamento. Nenhum fechamento real foi homologado nesta rodada.
