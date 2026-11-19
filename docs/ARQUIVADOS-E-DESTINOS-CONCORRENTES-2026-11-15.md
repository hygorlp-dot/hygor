# Revisão dos 27 arquivados e dos oito destinos concorrentes

**Continuação mais recente:** [seis recebimentos legados e PC-0003](RECEBIMENTOS-LEGADOS-E-PC0003-2026-11-15.md). Confirmado que os seis recebimentos já entram uma vez no caixa; avisos bancários compatíveis encontrados, sem homologar obra/parcela. Aviso Pix de R$ 900 do favorecido do PC-0003 localizado; origem e dois ajustes para caixa da obra permanecem documentais. DRE/caixa preservados; os próximos itens abaixo registram a situação histórica desta rodada.

Continuação local em 15/11/2026 da [conferência da conta e do aporte B2-04](CONTA-E-APORTE-B204-2026-11-15.md). **Os 27 casos arquivados e as 65 hipóteses dos oito destinos foram revisados individualmente.** A análise terminou sem homologar pagamentos, recebimentos ou vínculos. Foi corrigido um falso conflito de identidade do prestador compartilhado entre contratos; não se alteraram os contratos ou dados financeiros.

Captura real somente leitura: **15/11/2026 às 22:12:23 UTC**. As correções locais anteriores foram transportadas por ID, com comparação dos registros de origem antes de reaproveitá-las. Nenhuma gravação financeira remota, reabertura de extrato, exclusão, push ou publicação Vercel.

## Os 27 casos arquivados

Os casos pertencem ao extrato arquivado de 20 a 22/07/2026. Todos continuam pendentes; cada ID operacional corresponde a um registro bancário canônico único, com valor e direção conferidos e situação nativa `pending`. Não há evento de caixa ligado ao ID desses movimentos nem vínculo nativo ativo encontrado para eles.

| Resultado final da revisão | Casos |
| --- | ---: |
| Sem fato financeiro recuperado pelo motor | 20 |
| Pessoa indicada, sem obrigação financeira comprovada | 6 |
| Aporte de R$ 7.160 com trava documental preservada | 1 |
| Total | **27** |

O conjunto contém um crédito de **R$ 7.160** e 26 débitos que somam **R$ 20.751,52**. Esses são valores nominais do extrato, sem classificação econômica confirmada: não foram transformados em receita, custo ou novos pagamentos.

### Evidência bancária externa

A consulta de avisos de “Pagamento Pix realizado” das três datas retornou **76 mensagens**, com **76 IDs Pix distintos**. A pesquisa de 20/07 exigiu duas páginas; as outras duas datas tiveram uma página cada. O conector não indicou páginas restantes ao final.

Para **23 das 26 saídas**, existe um aviso com data, valor e nome normalizado coincidentes. Os 23 IDs Pix desses avisos são distintos entre si. Isso corrobora transferências bancárias, mas **não associa automaticamente o ID Pix ao registro legado**, que não preservou FITID/ID Pix suficiente, nem identifica a obrigação, obra ou contrato. Os avisos ficaram na evidência privada; não foram anexados às transações por um comando de gravação.

Os três casos restantes trazem apenas **JOSE SANTOS** na descrição importada:

- `41wu8sgnxrta`, R$ 1.200, e `inzs497rxrta`, R$ 1.000: há avisos da mesma data e valor em nome de **Jose Henrique da Silva Santos**, mas falta prova do vínculo entre a abreviação e a identidade completa.
- `mwo46qc3xrta`, R$ 2.000: há dois avisos da mesma data e valor, um para Jose Henrique e outro para Marcos Aclésio. Valor/data não escolhem o favorecido. O aviso de Marcos também é compatível nominalmente com o caso `drqg1awdxrta`; não se reutilizou esse documento para confirmar duas linhas.

Também foi encontrado um aviso de recebimento de **R$ 7.160 de Anne Priscilla**, recebido em 21/07/2026, citando a conta documentada. Ele não informa a composição ou natureza econômica desse valor. **A trava de `mt7l9lt5xrta` permanece**, sem vincular a folha, custo, receita ou ao aporte geral da B2-04.

### Conferência por movimento

“Compatível” indica somente coincidência de nome/data/valor com aviso externo. Não significa título comprovado ou conciliação aprovada. Nenhum caso foi reaberto, ignorado ou baixado por essa tabela.

| ID | Data | Movimento | Parecer | Aviso externo |
| --- | --- | ---: | --- | --- |
| `mt7l9lt5xrta` | 21/07/2026 | R$ 7.160,00 | Trava documental | Recebimento; composição pendente |
| `drqg1awdxrta` | 21/07/2026 | -R$ 2.000,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `mwo46qc3xrta` | 21/07/2026 | -R$ 2.000,00 | Sem fato financeiro | Nome abreviado; não vinculado |
| `1wpct8aixrta` | 20/07/2026 | -R$ 1.600,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `h0mk9cn2xrta` | 21/07/2026 | -R$ 1.600,00 | Sem fato financeiro | Compatível; não vinculado |
| `xonc7ittxrta` | 20/07/2026 | -R$ 1.600,00 | Sem fato financeiro | Compatível; não vinculado |
| `k559hygixrta` | 21/07/2026 | -R$ 1.440,00 | Sem fato financeiro | Compatível; não vinculado |
| `41wu8sgnxrta` | 21/07/2026 | -R$ 1.200,00 | Sem fato financeiro | Nome abreviado; não vinculado |
| `jwp7btrsxrta` | 20/07/2026 | -R$ 1.100,00 | Sem fato financeiro | Compatível; não vinculado |
| `4qy0ws4sxrta` | 20/07/2026 | -R$ 1.000,00 | Sem fato financeiro | Compatível; não vinculado |
| `d1a4t3n6xrta` | 20/07/2026 | -R$ 1.000,00 | Sem fato financeiro | Compatível; não vinculado |
| `inzs497rxrta` | 21/07/2026 | -R$ 1.000,00 | Sem fato financeiro | Nome abreviado; não vinculado |
| `mpt6ll3uxrta` | 20/07/2026 | -R$ 1.000,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `31lxqkg4xrta` | 20/07/2026 | -R$ 800,00 | Sem fato financeiro | Compatível; não vinculado |
| `ojijqa6qxrta` | 20/07/2026 | -R$ 600,00 | Sem fato financeiro | Compatível; não vinculado |
| `djf0grzbxrta` | 20/07/2026 | -R$ 500,00 | Sem fato financeiro | Compatível; não vinculado |
| `wpd1w4aqxrta` | 21/07/2026 | -R$ 460,00 | Sem fato financeiro | Compatível; não vinculado |
| `13schl7vxrta` | 21/07/2026 | -R$ 400,00 | Sem fato financeiro | Compatível; não vinculado |
| `dayql56xxrta` | 21/07/2026 | -R$ 220,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `anxdkgxtxrta` | 21/07/2026 | -R$ 200,00 | Sem fato financeiro | Compatível; não vinculado |
| `kmru8nvyxrta` | 21/07/2026 | -R$ 200,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `q0boxe9xxrta` | 20/07/2026 | -R$ 200,00 | Sem fato financeiro | Compatível; não vinculado |
| `zpmqv2lixrta` | 21/07/2026 | -R$ 200,00 | Sem fato financeiro | Compatível; não vinculado |
| `f3jybac2xrta` | 21/07/2026 | -R$ 160,00 | Pessoa; falta obrigação | Compatível; não vinculado |
| `0a3e3ktpxrta` | 22/07/2026 | -R$ 100,00 | Sem fato financeiro | Compatível; não vinculado |
| `qb3ez2qlxrta` | 20/07/2026 | -R$ 100,00 | Sem fato financeiro | Compatível; não vinculado |
| `o0sw2bq8xrta` | 21/07/2026 | -R$ 71,52 | Sem fato financeiro | Compatível; não vinculado |

Nenhum dos 27 preserva FITID no cadastro legado. A ausência desse identificador não foi preenchida com `REFNUM` ou ID obtido por semelhança. A busca por nome/data/valor em outros extratos da mesma conta não encontrou pares desses 27 na captura; isso **não certifica ausência de duplicidade de negócio** nem permite excluir linhas sem o original bancário.

## Falso conflito de identidade corrigido

O movimento `drqg1awdxrta`, de R$ 2.000, indicava Marcos Aclésio, mas o motor considerava os IDs de três contratos como três identidades diferentes. Os registros `0g646su9wls5`, `t5oc1j9ldask` e `l1wf2te21c9b` têm o mesmo **`prestadorId: 0g646su9wls5`** e pertencem a K1-04, W1-22 e K1-02. São vínculos declarados no sistema, não uma união inferida pelo nome.

**Correção em `identity.js`:** a leitura de identidade reaproveita o prestador compartilhado quando nome normalizado, documento, Pix e tipo de pessoa são compatíveis. Preserva os IDs dos contratos e a lista de obras; os candidatos financeiros continuam separados por contrato. Divergências mantêm os registros separados e o conflito, assim como homônimos com outro `prestadorId` ou sem esse vínculo.

O teste reproduziu o erro antes da correção. A cobertura confirma identidade compartilhada, três destinos contratuais preservados, ausência de mutação e bloqueios por nome/documento/Pix/tipo de pessoa divergentes. Também confirma que a identificação por nome **não torna o pagamento automático**.

A correção removeu o falso conflito deste arquivado e de **21 avisos ativos** que antes estavam classificados como conflito. Esses 21 passaram a **pessoa indicada sem título**, continuando pendentes. Não foram fundidos cadastros, editadas chaves Pix, alteradas obras ou escolhida uma obrigação.

O inventário atual das 793 pendências ficou: **27 arquivadas, 69 hipóteses financeiras, 436 sem destino seguro e 261 com pessoa sem título**. Há zero elegíveis para automação na captura. O inventário inicial foi preservado como histórico; a versão atual está em `current-triage.json`.

**DRE nesta etapa:** nenhuma alteração. Corrigir a identidade derivada não cria contrato, obrigação, custo ou pagamento. A W1-22 não teve qualquer condição contratual ou recebimento modificado.

## Oito destinos concorrentes: 65 hipóteses

São 65 das 69 hipóteses financeiras da triagem inicial. Os oito destinos continuam sem alocação aprovada. A tabela usa saldo a receber para título aberto e valor do pagamento específico para caixa já existente; **caixa existente não é outro saldo livre para registrar novamente**.

| Obra / destino | Hipóteses | Natureza da base | Base única | Soma das hipóteses |
| --- | ---: | --- | ---: | ---: |
| K1-02 · `sf1n14tdlkof` | 16 | Saldo a receber | R$ 6.250,00 | R$ 69.734,74 |
| X1-25 · `63s888ep484c` | 6 | Saldo a receber | R$ 10.170,00 | R$ 61.020,00 |
| CA1-13 · `cq2s5rx5gw6v` | 6 | Caixa já registrado | R$ 12.565,00 | R$ 75.391,32 |
| R1-16 · `dr15n9d4kmlw` | 11 | Saldo a receber | R$ 4.000,00 | R$ 35.303,31 |
| CA1-06 · `5c96rutv9316` | 5 | Saldo a receber | R$ 9.000,00 | R$ 45.000,00 |
| P1-08 · `las4cf951dzh` | 3 | Caixa já registrado | R$ 12.000,00 | R$ 36.000,00 |
| K1-04 · `k1xepo2mk02c` | 6 | Saldo a receber | R$ 12.000,00 | R$ 72.000,00 |
| B2-04 · `0a3jr657b6f7` | 12 | Caixa já registrado | R$ 900,00 | R$ 10.800,00 |

As somas bancárias representam hipóteses concorrentes, não dívida, receita, custo ou diferenças contábeis comprovadas. Em todos os oito grupos, atribuir todas as linhas ao mesmo destino ultrapassaria sua base única.

| Parecer por hipótese, sem sobreposição | Quantidade |
| --- | ---: |
| Valor integral já bloqueado pelo motor | 14 |
| Data/valor coincidem com recebimento legado e exigem prova antes de nova baixa | 7 |
| Caixa já registrado, sem documento suficiente para vínculo | 3 |
| Priorizar documento do pagamento existente de R$ 900 | 1 |
| Sem suporte atual para o caixa/pedido originalmente sugerido | 11 |
| Saldo a receber ainda sem vínculo comprovado | 29 |
| Total | **65** |

### Parecer dos oito grupos

1. **K1-02:** 16 hipóteses disputam R$ 6.250 restantes da medição de julho. R$ 6.250 já foram recebidos com outra transação referenciada. Seis linhas excedem o saldo para vínculo integral. Não reutilizar o recebimento existente nem repartir o saldo entre hipóteses sem documentação.
2. **X1-25:** seis entradas de R$ 10.170 disputam uma parcela de R$ 10.170. Três coincidem em data/valor com recebimentos legados de outras parcelas, detalhados abaixo. Isso exige conferir o fato já registrado antes de criar novo recebimento.
3. **CA1-13:** seis entradas de R$ 12.565,22 apontam para recebimento existente de R$ 12.565,00, em 30/07/2026. Todas têm diferença de **R$ 0,22** e estão bloqueadas para vínculo integral; cinco datas divergem. Não arredondar, chamar a diferença de juros nem refaturar sem documento.
4. **R1-16:** 11 hipóteses de 2026 disputam R$ 4.000 restantes da entrada de competência agosto/2025. O campo legado `recebido: true` continua divergente dos valores de R$ 28.000 previstos e R$ 24.000 recebidos. A revisão não corrigiu condição contratual ou data por suposição; duas linhas excedem o saldo para valor integral.
5. **CA1-06:** cinco entradas de R$ 9.000 disputam uma parcela de R$ 9.000. Uma coincide em data/valor com parcela já recebida em julho. CA1-06 e X1-25 compartilham o mesmo `clienteId`; identificar o cliente não escolhe a obra ou a parcela.
6. **P1-08:** três entradas de R$ 12.000 apontam para um recebimento manual de R$ 12.000 datado de 28/07. As entradas são de 15/07 (duas) e 31/07; nenhuma coincide com essa data. As descrições também têm pagadores nominais diferentes. Não confirmar as três contra o mesmo recebimento nem alterar sua data para encaixar uma linha.
7. **K1-04:** seis entradas de R$ 12.000 foram sugeridas ao mesmo saldo. Três coincidem com recebimentos legados, mas os pagadores nominais dessas seis linhas não correspondem ao cliente cadastrado da obra. As comparações abaixo **não comprovam que essas entradas pertençam à K1-04**. Uma mesma parcela legada também é disputada por duas linhas de 01/06.
8. **B2-04 / PC-0003:** 12 saídas de R$ 900 foram sugeridas ao pagamento único `r6tj7xmsb6ex`, espelhado no caixa `0a3jr657b6f7`. Somente `6z9tj9qttaqf`, de 26/06, coincide também em favorecido nominal e data do pagamento; falta documentação suficiente para confirmar o vínculo. As outras **11 têm favorecidos nominais diferentes do fornecedor** e datas diferentes: não há suporte atual para atribuí-las ao PC-0003. Não foram apagadas, ignoradas ou convertidas em despesas novas.

### Sete comparações com seis recebimentos legados

As comparações são condicionais à obra sugerida, que continua sem vínculo bancário confirmado. Os IDs `legacy-*` são derivados pelo razão a partir dos campos históricos; **não são novos registros persistidos nem IDs prontos para enviar em comandos**. Normalizar um recebimento antigo exige trilha própria e comprovação, preservando o caixa já reconhecido.

| Obra sugerida | Linha bancária | Data | Valor | Medição que já informa recebimento nessa data/valor |
| --- | --- | --- | ---: | --- |
| X1-25 | `ekikuuq6taqf` | 01/07/2026 | R$ 10.170,00 | `bs2ja664484c` |
| X1-25 | `m8nzzf2staqf` | 15/06/2026 | R$ 10.170,00 | `8nrzat5y484c` |
| X1-25 | `lghlvk5vtaqf` | 29/05/2026 | R$ 10.170,00 | `vhb3waj2484c` |
| CA1-06 | `7obz8rp9taqf` | 15/07/2026 | R$ 9.000,00 | `ep48hjnf9316` |
| K1-04 | `f2pm6oigtaqf` | 30/06/2026 | R$ 12.000,00 | `pauj1ttjk02c` |
| K1-04 | `zr27twgptaqf` | 01/06/2026 | R$ 12.000,00 | `2pydngbsk02c` |
| K1-04 | `xihnw60itaqf` | 01/06/2026 | R$ 12.000,00 | **A mesma** `2pydngbsk02c` |

Nenhuma dessas sete comparações virou associação. A coincidência de data/valor não corrige a identidade, a obra ou a finalidade da transferência. O conflito adicional de duas linhas contra a mesma medição foi registrado para impedir que uma futura revisão aprove ambas como se houvesse dois recebimentos existentes.

## DRE conferido em cada etapa

Foram comparadas **36 competências empresariais e 648 projeções completas por obra/mês** com a cópia consolidada anterior, em cinco etapas:

1. Recaptura e preservação das correções locais anteriores.
2. Revisão dos 27 arquivados e dos avisos bancários externos.
3. Correção da identidade compartilhada, sem escolher contratos.
4. Revisão dos oito destinos, 65 hipóteses e seis recebimentos legados.
5. Exportação não executável e conferência final.

**Todas permaneceram iguais: zero receita, custo ou caixa novos**, memoriais e composição entre razão e DRE conferidos. Não houve novo recebimento, pagamento, rateio ou reconhecimento de folha por valor do extrato. Pessoa conhecida não é obrigação; salários/custos já apropriados na origem não podem ser reconhecidos novamente ao pagar.

As **793 pendências bancárias permanecem**. A W1-22 conserva os **R$ 12.000 documentais**, assim como a trava dos R$ 7.160 e a pendência de composição dos R$ 10.384,50 da B2-04. Nenhuma prévia de fechamento foi aprovada e nenhum fechamento real foi homologado.

## Validação e arquivos

- **772 testes aprovados em 89 arquivos**, zero falhas/pulos na suíte final. Incluem oito testes da identidade compartilhada e preservação de ambiguidades. Duas falhas de regressão foram demonstradas antes da correção; os oito testes passaram depois.
- **Sete cenários de navegador aprovados**, zero falhas/pulos: automação controlada e revisão persistente de conciliação, filtros/seleção, associação parcial ao DRE, falha/retentativa/reversão e ajuda em desktop/celular. A ajuda foi revisada visualmente nos dois tamanhos.
- Ajuda de Conciliação e manual atualizados na fonte única: pessoa compartilhada não escolhe contrato, obra ou obrigação. **143 guias para 65 abas**, revisão de 15/11/2026. Nenhum componente, estilo, campo persistido ou cadastro novo.
- Lint, tipos, design e manual aprovados, sem aumento da baseline. Build local por Vite, sem prebuild de migrações: **1.818.173 bytes gzip**, limite inalterado de **1.891.328**, margem de **73.155 bytes**, sem violações de orçamento.

Evidências compactas, testes, logs, imagens, build e `verification.json`: `artifacts/arquivados-concorrentes-20261115/`.

Arquivos detalhados fora do repositório, em **`C:/dev/marcell-local-review/arquivados-concorrentes-20261115/`**:

- `archived-cases.json` e `archived-cases.csv`: os 27 casos com origem, avisos compatíveis/ambíguos, título ausente e próxima providência.
- `target-cases.json` e `target-cases.csv`: as 65 hipóteses, destino original, bloqueios, contraparte e parecer individual.
- `competing-targets.json` e `existing-receipt-comparisons.json`: oito destinos, matriz condicional de recebimentos e a concorrência adicional pela mesma parcela.
- `bank-mail-proofs.json`: evidências bancárias externas, sem confirmação de associação ao legado.
- `archive-before-identity-fix.json`: referência do falso conflito antes da correção.
- `current-triage.json`: classificação atual das 793 pendências, preservando o inventário anterior como histórico.
- `snapshot.json`, `data-before.json`, `data-consolidated.json`, `audit-consolidated.json` e `summary.json`: captura e conferência financeira; não são comandos ou dados aplicados à produção.

## Roadmap atualizado

1. **Revisão dos 27 e dos oito destinos concluída como análise.** Obrigações, vínculos e distribuição financeira continuam sem homologação; não reabrir/reimportar para reduzir contagens.
2. **Priorizar documentos dos sete casos com recebimento legado compatível e do PC-0003 de R$ 900.** Comprovar obra/parcela e a referência bancária antes de normalizar ou vincular recebimento existente. Não enviar IDs derivados `legacy-*` como se fossem registros persistidos.
3. **Resolver as três abreviações JOSE SANTOS e obter as obrigações dos arquivados.** Reaproveitar folha, contratos e medições existentes; não criar pessoas ou custos apenas para encaixar o banco. O prestador compartilhado está identificado, mas seus três contratos seguem separados.
4. **Comprovar os R$ 0,22 da CA1-13 e a entrada antiga da R1-16.** Conferir documentos e condições vigentes, sem arredondar saldos ou mudar datas por hipótese.
5. **Manter as pendências documentais W1-22, R$ 7.160 e aporte B2-04**, além da aprovação operacional da conta e dos originais bancários. A correção documental do CNPJ da proposta também permanece na origem, sem alterar o cadastro do ERP.

Nenhuma publicação Vercel, migração remota, envio de mensagem ou aplicação financeira real.
