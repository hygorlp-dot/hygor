# Revisão das 69 hipóteses financeiras e dos sete grupos de repetição

**Atualização posterior — origem e datas:** a [conferência dos R$ 4.100 e R$ 275](ORIGEM-E-DATAS-PAGAMENTOS-2026-11-15.md) confirmou pagamentos pela conta da construtora. A imagem dos R$ 275 está completa: a avaliação anterior de corte foi um erro de inspeção; a data legível é 25/06/2026, corroborada pelo aviso bancário. Data e origens foram corrigidas somente na cópia descartável de revisão. Também foi corrigido o filtro de caixa que omitia pagamentos de outra competência no DRE por obra e na conferência do fechamento. Resultado por competência preservado, caixa mensal explicitado, 756 testes e quatro cenários de navegador aprovados. Fonte real e W1-22 intactas. As contagens da revisão inicial abaixo são históricas.

Continuação local em 15/11/2026 da [triagem das 793 transações](TRIAGEM-BANCARIA-2026-11-15.md). A revisão cobriu todos os 69 casos e todos os 15 movimentos dos sete grupos. **A análise foi concluída; os vínculos bancários e as supostas duplicidades de negócio não foram homologados.** Nenhuma conciliação, exclusão, nova baixa, alteração financeira remota ou publicação foi executada.

A captura final ocorreu em **15/11/2026 às 20:14:19 UTC**. A cópia consolidada reaproveita as correções locais já comprovadas da X1-25 e dos seis identificadores históricos, preservando as demais informações da nova captura. A origem real continua sem a correção local da X1-25. A **W1-22 permanece documental, com R$ 12.000 excedentes**, sem alteração de valores ou datas para liberar fechamento.

## Resultado da revisão individual

| Conferência | Resultado |
| --- | ---: |
| Hipóteses revisadas por ID bancário e destino | 69 de 69 |
| Hipóteses de medição/parcela | 55, em nove medições |
| Hipóteses de caixa da obra | 14, em três registros |
| Destinos distintos, incluindo o ID do recebimento quando existente | 12 |
| Destinos sugeridos para mais de uma transação | 8, envolvendo 65 hipóteses |
| Casos para examinar vínculo a caixa já registrado | 23: nove recebimentos de medição e 14 saídas do caixa |
| Casos para examinar saldo a receber | 46 |
| Casos com diferença de valor em relação ao destino sugerido | 32 |
| Casos com diferença entre a data bancária e a data disponível no destino | 26 |
| Casos sem data prevista para comparar | 40 |
| Casos com data coincidente | 3 |
| Hipóteses já bloqueadas pelas regras do motor | 14 |
| Identidade bancária exata por documento ou chave Pix | 0 |
| Comprovantes anexados diretamente à linha bancária | 0 |
| Comprovantes do destino encontrados e lidos localmente | 2 |

As contagens de divergência se sobrepõem: um caso pode ter diferença de valor, data e concorrência pelo mesmo destino. “Saldo a receber” não autoriza uma nova baixa; ainda é necessário comprovar que aquela entrada pertence àquela parcela. “Caixa já registrado” exige examinar uma associação ao pagamento existente, sem registrar outro recebimento ou outra despesa.

### Destinos e concorrência entre hipóteses

Valores em reais. Para saldo a receber, a base é o saldo da medição após os recebimentos existentes. Para caixa já registrado, a base é o valor do recebimento/pagamento específico, **não um novo saldo disponível para baixar**. A soma bancária reúne apenas hipóteses concorrentes; não representa dívida, receita, custo, diferença contábil comprovada ou montante aprovado para conciliar.

| Obra / destino exato | Natureza da conferência | Casos | Soma das hipóteses | Base do destino |
| --- | --- | ---: | ---: | ---: |
| K1-02 · `sf1n14tdlkof` | Saldo de julho/2026; R$ 6.250 já recebidos | 16 | 69.734,74 | 6.250,00 |
| X1-25 · `63s888ep484c` | Saldo de julho/2026 | 6 | 61.020,00 | 10.170,00 |
| CA1-06 · `f31atxjp9316` | Saldo da segunda quinzena de agosto/2026 | 1 | 9.000,00 | 9.000,00 |
| CA1-13 · `cq2s5rx5gw6v` / recebimento `5puz70luakvq` | Recebimento já registrado; medição integralmente recebida | 6 | 75.391,32 | 12.565,00 |
| R1-16 · `dr15n9d4kmlw` | Saldo da entrada de agosto/2025; R$ 24.000 já recebidos | 11 | 35.303,31 | 4.000,00 |
| CA1-06 · `5c96rutv9316` | Saldo da primeira quinzena de agosto/2026 | 5 | 45.000,00 | 9.000,00 |
| P1-08 · `las4cf951dzh` / recebimento `s6as76t2cuo2` | Recebimento já registrado; medição integralmente recebida | 3 | 36.000,00 | 12.000,00 |
| K1-04 · `k1xepo2mk02c` | Saldo da competência julho/2026 | 6 | 72.000,00 | 12.000,00 |
| B2-04 · `r2mvcz3mt0mh` | Saída existente do PC-0002 | 1 | 4.100,00 | 4.100,00 |
| B2-04 · `0a3jr657b6f7` | Saída existente do PC-0003 | 12 | 10.800,00 | 900,00 |
| B2-04 · `tnj2mv7hqthm` | Saída existente do PC-0001 | 1 | 275,00 | 275,00 |
| R1-16 · `x8ftuacrkmlw` | Saldo de julho/2026 | 1 | 28.000,00 | 28.000,00 |

**Não somar aprovações individuais como se cada sugestão dispusesse de outro saldo.** O arquivo individual registra o grupo concorrente, a base única e o excesso hipotético se todas as sugestões fossem atribuídas ao mesmo destino. Não foi escolhido vencedor por pontuação, nome ou valor.

Achados que exigem cuidado específico:

- **CA1-13:** cada uma das seis entradas é de R$ 12.565,22, contra recebimento de R$ 12.565,00 em 30/07/2026. A diferença de **R$ 0,22 por linha** não foi arredondada, incorporada à medição ou classificada como juros. Cinco datas também divergem. O motor já impede a vinculação integral desses valores ao pagamento existente.
- **P1-08:** três entradas de R$ 12.000 disputam um único recebimento manual de R$ 12.000, de 28/07/2026. Esse recebimento já produz caixa no razão; uma nova baixa duplicaria o fato se representasse a mesma operação.
- **R1-16:** a entrada de agosto/2025 está marcada `recebido: true`, mas os valores informam R$ 28.000 previstos e R$ 24.000 recebidos. O razão preserva saldo de R$ 4.000. O indicador legado não elimina o saldo, e as 11 entradas de 2026 não comprovam pagamento dessa entrada antiga. Mantidos dados e alerta, sem mudar competência, situação ou parcelas por hipótese.
- **K1-04:** a competência é julho/2026, enquanto a descrição menciona junho/2026. Registrada a divergência de origem, sem reescrever a competência com base no texto.
- **K1-02:** o recebimento existente de R$ 6.250 já referencia outra transação (`prxcpwlmxrta`); preservado. As 16 hipóteses não recebem autorização para reutilizar essa entrada ou consumir repetidamente o saldo restante.

**DRE nesta etapa:** nenhuma receita nova. As nove medições já têm seus eventos de receita no razão; receber ou vincular um recebimento não deve faturar novamente. Os pagamentos de pedidos e seus espelhos de caixa foram rastreados pelos IDs do pedido e do pagamento, respeitando a deduplicação existente. Compromisso, custo reconhecido e pagamento continuam separados; a conciliação não autoriza transformar uma saída em novo custo.

## Comprovantes encontrados e conferidos

Os anexos foram localizados nas pastas sincronizadas do OneDrive pelos nomes exatos preservados no cadastro. Os dois arquivos têm os tamanhos esperados; seus hashes e a leitura visual estão em `documents-reviewed.json`, no diretório privado da revisão. Não foram usados links assinados ou dados de documentos como prova de uma conexão bancária que a linha importada não contém.

### PC-0002 — R$ 4.100: suporte documental forte, origem pendente

Linha bancária `aqqg1o8btaqf` → hipótese de caixa `r2mvcz3mt0mh` → pedido `86n99g2c3cg1` → pagamento `puitymbw42ul`.

O comprovante mostra Pix enviado de **R$ 4.100 em 26/06/2026**, com favorecido compatível com a descrição do banco e pagador identificado como a construtora. Valor e data coincidem. O ID da transferência aparece no comprovante, mas está ausente na linha importada; o `txid` legado contém a referência genérica `077`.

O pagamento está registrado com origem **`caixa_obra`** e já existe uma única saída de R$ 4.100 no razão pelo pagamento do pedido; o espelho de caixa não cria outra saída. A leitura sustenta priorizar esse caso, mas **não prova sozinha como a conta importada e o caixa da obra foram financiados**. Não foi convertido para origem bancária nem criado outro pagamento. Próxima providência: conferir titularidade/conta de origem e eventual aporte, depois definir o vínculo ao fato existente.

Arquivo: `C:/Users/hygor/OneDrive/App/B2-04/08 - Financeiro e Fiscal/Pagamentos de compras/PC-0002/2026-06/f8e28dbd-cbb1-41c0-856d-97fc505793e0.jpeg`.

SHA-256: `1b174b0103e055ffdeabe700f9a3dbcd27575a7ae607bdcdb95010c138d0254b`.

### PC-0001 — R$ 275: datas divergentes, data documental confirmada na continuação

Linha bancária `m0vbchtmtaqf` → hipótese de caixa `tnj2mv7hqthm` → pedido `ezcd9jb6no0g` → pagamento `0v2moqmwqnaq`.

Valor e favorecido são compatíveis. A linha do banco está em **25/06/2026**; pagamento e caixa capturados estão em **24/07/2026**. A primeira inspeção considerou a data da imagem incompleta; essa avaliação foi retificada na continuação: o mesmo arquivo permite ler **25/06/2026**, também confirmado pelo aviso bancário. Uma data de envio do anexo ou de cadastro do registro não comprova a data do Pix.

A divergência foi preservada ao terminar a primeira revisão. Na [continuação documental](ORIGEM-E-DATAS-PAGAMENTOS-2026-11-15.md), data e origem foram corrigidas na cópia local com base no comprovante e no aviso, preservando uma única saída e sem confirmar o vínculo bancário real. Não é necessário pedir outro arquivo para ler essa data; permanecem pendentes a conta de origem e a aplicação financeira real.

Arquivo: `C:/Users/hygor/OneDrive/App/B2-04/08 - Financeiro e Fiscal/Pagamentos de compras/PC-0001/2026-07/b0fcd331-aa96-4d59-ba6c-a76a49ff577a.jpeg`.

SHA-256: `9e2e4a5fde17b808887cf5ef28ab80d7759db271bb411b5d6d7efc9503eb4cfa`.

**DRE nesta etapa:** leitura documental sem comandos financeiros. Receita, custo, datas dos fatos e caixa preservados. Não se presume que comprovar uma transferência autorize reconhecer novamente seu pagamento ou custo.

## Revisão dos sete grupos de possível repetição

Todos os 15 movimentos continuam pendentes, sem evento de caixa ligado diretamente ao seu ID. Cada movimento tem um registro bancário canônico único com valor e direção coincidentes. Dentro de cada grupo, os FITIDs, as chaves de importação e os IDs canônicos são distintos. Os grupos pertencem ao mesmo extrato e à mesma conta de origem recuperada dos metadados; nenhum é repetição entre extratos.

| Grupo | Data | Direção / valor de cada linha | Quantidade | IDs bancários revisados |
| --- | --- | --- | ---: | --- |
| 1 | 14/08/2026 | Saída de R$ 200,00 | 2 | `0bs5wsjftaqe`, `e7kh99cztaqe` |
| 2 | 11/08/2026 | Entrada de R$ 175,00 | 3 | `qi4kumnvtaqe`, `esil8ucxtaqe`, `t6sp5y68taqe` |
| 3 | 03/07/2026 | Saída de R$ 700,00 | 2 | `vayu6mm1taqf`, `v4newszntaqf` |
| 4 | 03/07/2026 | Saída de R$ 1.501,75 | 2 | `cm6zloyltaqf`, `0a11q5bxtaqf` |
| 5 | 02/07/2026 | Saída de R$ 200,00 | 2 | `8s9yd866taqf`, `sqwpssnjtaqf` |
| 6 | 19/06/2026 | Saída de R$ 500,00 | 2 | `v136ra39taqf`, `lq7nawf3taqf` |
| 7 | 12/06/2026 | Saída de R$ 200,00 | 2 | `3c8suta8taqf`, `nzeg29kwtaqf` |

**Parecer para cada um dos sete grupos:** conteúdo repetido confirmado; repetição de identificador de importação não encontrada; duplicidade de pagamento/recebimento de negócio não comprovada. Nenhum desses 15 movimentos tem hipótese de título financeiro na classificação atual. Os dois do grupo 6 possuem indicação de pessoa, que não comprova obrigação nem duplicidade.

Não foram encontrados os originais OFX nas pastas locais pesquisadas (OneDrive, Downloads e Documents). Também não há comprovantes anexados às 15 linhas. FITIDs diferentes permitem operações distintas e não descartam a possibilidade de alguém ter pago duas vezes. A decisão exige comprovantes individuais e a obrigação de origem, sem eliminar registros pelo conteúdo parecido.

**DRE nesta etapa:** nenhum fato removido ou criado. As 15 linhas permanecem sem classificação e não foram convertidas em receitas/custos apenas para completar a revisão.

## Conferência do DRE e validação

| Etapa | Resultado financeiro |
| --- | --- |
| Nova captura e consolidação das correções anteriores | 36 competências empresariais e 648 projeções de obra/mês iguais ao consolidado anterior; W1-22 intacta. |
| Revisão dos 69 casos / 12 destinos | Mesmas 36 competências e 648 projeções; memoriais e composição entre razão e DRE conferidos. |
| Revisão dos sete grupos / 15 registros canônicos | Mesmas comparações, sem exclusões ou novas classificações. |
| Leitura dos dois comprovantes e conferência final | Mesmas comparações; **zero receita, custo ou caixa novos**. |

Os 793 avisos continuam pendentes. O único excedente não explicado no consolidado local continua sendo o da W1-22; nenhuma prévia de fechamento foi aprovada. Preservada também a trava dos **R$ 7.160** do aporte sem composição comprovada, sem ligação automática a obra, folha ou receita.

- **190 testes aprovados em 13 arquivos**, zero falhas/pulos na rodada final: triagem, proposta de conta, saneamento histórico, OFX, candidatos, pagamentos existentes, conciliação, razão, DRE, integração canônica e memorial.
- Lint, tipos, design e sincronização do manual aprovados. Ajuda de Conciliação e Caixa da obra revisada; manual gerado e conferido com **143 guias para 65 abas**, revisão de 15/11/2026. Esta rodada altera relatórios e auxiliares locais de investigação; não altera controles, fluxos, regras ou instruções operacionais do app. Não exigiu novos textos de ajuda.
- Não houve alteração de código do app, interface ou dependências nesta rodada. Não foi necessário repetir build ou jornadas de navegador; os resultados de bundle e navegador da rodada anterior permanecem históricos, sem apresentá-los como novas execuções.
- Duas falhas de instrumentação foram corrigidas: o leitor de portal não selecionava a direção bancária, recuperada por leitura adicional e validada antes da comparação; três arquivos Vitest foram inicialmente chamados com `node --test`, sem executar suas suítes. A execução final usou Vitest corretamente. Logs preservados; essas tentativas não foram contadas como testes aprovados ou falhas do ERP.

Dados individuais fora do repositório, em **`C:/dev/marcell-local-review/revisao-hipoteses-20261115/`**:

- `cases.csv` e `cases.json`: 69 pareceres, destino, recebimentos, saldo, diferenças, alternativas, concorrência, fingerprints e próxima providência.
- `targets.json`: 12 destinos, com oito grupos de hipóteses concorrentes.
- `repeated-groups.json`: sete grupos com os 15 IDs operacionais/canônicos, FITIDs, chaves e evidências disponíveis.
- `documents-reviewed.json`: leitura visual, hashes e limitações dos dois comprovantes.
- `summary.json`, `data-before.json`, `data-consolidated.json`, `snapshot.json` e `audit-consolidated.json`: captura e conferência financeira.

Evidências compactas e auxiliares descartáveis desta investigação em `artifacts/revisao-hipoteses-20261115/`: captura, conferências por etapa, resumo, logs e `verification.json`. Os auxiliares só leem a origem e escrevem arquivos locais de evidência; não geram nem executam comandos de conciliação.

## Roadmap atualizado

| Prioridade | Providência concreta | Critério de conclusão / impacto no DRE |
| --- | --- | --- |
| P0 | Comprovar a composição do aporte de R$ 7.160. | Preservar trava; classificação só após documento e composição, sem receita/custo presumidos. |
| P1 | Resolver origem do PC-0002 (R$ 4.100), reaproveitando o comprovante já encontrado. | Identificar conta e percurso banco → aporte/caixa/pagamento; vincular fato existente, sem nova saída. |
| P1 | PC-0001 (R$ 275): conferência documental concluída na continuação. | Imagem completa e aviso confirmam 25/06/2026; correção preparada localmente. Revalidar antes da aplicação real e preservar uma saída, sem nova baixa. |
| P1 | Revisar os oito destinos concorrentes com documentos individuais. | Aprovar distribuição por ID de parcela/recebimento; respeitar saldo único e conferir novamente após cada eventual comando. Separar os R$ 0,22 da CA1-13 somente se comprovada sua natureza. |
| P1 | Obter originais e comprovantes dos sete grupos. | Identificar obrigação e transferência de cada linha; documentar pagamento repetido ou operações legítimas. Não excluir/ignorar por semelhança. |
| P1 | Concluir a revisão dos 27 casos arquivados e validar a conta de origem. | Manter arquivamento, vínculos e trava do aporte. Reaproveitar contexto de conta existente, sem inventar saldo inicial/titularidade. |
| P2 | Automatizar a preparação da revisão, após validar a origem documental. | Extrair propostas de ID Pix/data/valor dos anexos, comparar com o original e exigir conferência; não preencher dados financeiros automaticamente pela imagem. Reaproveitar os anexos existentes. |
| P2 | Evoluir a triagem com concorrência entre destinos e alertas de datas/situação legado. | Automatizar agrupamento e bloqueios explicáveis; sugestões não reservam nem multiplicam saldo. Esta revisão já entrega os grupos em arquivo, sem nova tela ou regra de produção. |
| Documental | Manter W1-22 em aberto. | Exigir contrato/aditivos, parcelas e comprovante da entrada antes de qualquer correção; repetir DRE e prévia de fechamento após comprovação. |

Nenhum push, pull request, deployment Vercel, migração remota ou homologação financeira foi realizado.
