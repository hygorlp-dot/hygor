# Seis recebimentos legados e pagamento do PC-0003

**Continuação mais recente:** [centavos CA1-13 e entrada R1-16](CA1-13-E-ENTRADA-R1-16-2026-11-15.md). Documentos e extrato histórico conferidos, sem novas alterações financeiras; a publicação posterior autorizada pelo usuário se limita ao software validado.

Revisão documental local em **15/11/2026**, em continuidade à [análise dos arquivados e destinos concorrentes](ARQUIVADOS-E-DESTINOS-CONCORRENTES-2026-11-15.md). Captura real somente leitura em **15/11/2026 às 22:40:07 UTC**. As correções locais anteriores foram preservadas mediante comparação dos registros originais por ID. Não houve aplicação financeira real, normalização de recebimentos, alteração de origem, conciliação, gravação remota ou publicação Vercel.

**A revisão dos seis recebimentos e do pagamento terminou; a homologação documental continua pendente.** Foram localizados avisos bancários compatíveis com as sete hipóteses de recebimento e o aviso do Pix de R$ 900 ao fornecedor do PC-0003. Um aviso de transferência não identifica, por si, a obra, a parcela ou a obrigação econômica que deve ser baixada.

## Recebimentos legados: R$ 63.510 já entram no caixa

As seis medições possuem `recebimentos: []`, mas conservam `valorRecebido` e `dataPagamento`. O motor financeiro reconstrói um único recebimento `legacy-${measurement.id}` de cada espelho. O teste sobre a captura confirmou **uma entrada de caixa por medição, no valor e na data existentes**, acompanhada da baixa do recebível. Não são seis recebimentos a cadastrar novamente.

| Obra | Medição | Competência | Data do recebimento | Valor | Hipótese bancária | Parecer |
| --- | --- | --- | --- | ---: | --- | --- |
| X1-25 | `vhb3waj2484c` | 2026-05 | 29/05/2026 | R$ 10.170 | `lghlvk5vtaqf` | Aviso de recebimento da ACM no mesmo dia e valor; falta comprovação da parcela/obra e referência bancária original. |
| X1-25 | `8nrzat5y484c` | 2026-06 | 15/06/2026 | R$ 10.170 | `m8nzzf2staqf` | Mesmo parecer; pagamento já reconhecido no legado. |
| X1-25 | `bs2ja664484c` | 2026-06 | 01/07/2026 | R$ 10.170 | `ekikuuq6taqf` | Mesmo parecer; caixa em julho e receita na competência da medição. |
| CA1-06 | `ep48hjnf9316` | 2026-07 | 15/07/2026 | R$ 9.000 | `7obz8rp9taqf` | ACM é o cliente cadastrado, também presente na X1-25; o aviso não contém obra/parcela. |
| K1-04 | `pauj1ttjk02c` | 2026-06 | 30/06/2026 | R$ 12.000 | `f2pm6oigtaqf` | Aviso de João André Gonçalves Sampaio; cliente cadastrado é Bruno Mariano Batista. Pagamento por terceiro não comprovado. |
| K1-04 | `2pydngbsk02c` | 2026-05 | 01/06/2026 | R$ 12.000 | `zr27twgptaqf` ou `xihnw60itaqf` | Dois avisos distintos no dia: João André e Serventia Extrajudicial do Ofício. Ambos concorrem pela mesma parcela já recebida; nenhum foi escolhido. |

São **seis fatos econômicos e sete linhas bancárias candidatas**, com uma disputa adicional de R$ 12.000. A soma de todas as candidatas seria R$ 75.510, e não o total dos recebimentos legados. Esses totais não autorizam compensação, exclusão ou reconhecimento de receita adicional.

Foram examinados os resultados completos das buscas pelos avisos de R$ 10.170, R$ 9.000 e R$ 12.000: **14, 16 e 40 mensagens**, sem continuação de página indicada pelo conector. Para cada candidata, uma mensagem foi selecionada por dia, valor e pagador nominal compatível. A data de recebimento do e-mail é indício temporal; os avisos de entrada não fornecem confirmação da parcela ou identificador bancário suficiente para aplicar o vínculo. Os demais avisos encontrados não foram tratados como documentos dos seis casos.

A documentação local encontrada para a X1-25 já foi usada na etapa anterior para conferir condições contratuais; não substitui recibo de cada parcela. Nas obras CA1-06 e K1-04, a captura possui zero documentos em `documentosOneDrive`. Isso descreve o cadastro capturado, não prova ausência de documentos nas pastas remotas. Nesta rodada não se declarou acesso ou leitura dessas pastas remotas.

## Bloqueios de duplicidade conferidos

- O ID `legacy-*` é derivado pelo leitor e não existe na lista persistida de recebimentos. As **sete tentativas locais de validação** de vínculo com esse ID foram rejeitadas, sem executar comandos ou alterar dados.
- O comando de novo recebimento verifica o saldo da medição. As seis medições já têm saldo zero; não é apropriado usar esse fluxo para importar o mesmo recebimento outra vez.
- Se houver prova documental para migrar o legado, a operação futura deve **substituir a representação do mesmo fato**, preservando valor, data e baixa do recebível; jamais adicionar outra entrada. A soma de caixa e os efeitos por competência devem ser comparados antes/depois. Nenhum plano executável de migração foi produzido nesta rodada.
- Na K1-04, nomes de terceiros e igualdade de valores não comprovam vínculo ao cliente. A mesma parcela não pode liquidar as duas linhas bancárias de 01/06.

## PC-0003: Pix de R$ 900 documentado, origem ainda conflitante

Pedido **`1hawz0xvhqdh`**, obra **B2-04 (`kep278px87cr`)**, fornecedor **`f57pi0r2ghwn` — Jeyweisson Kildare da Silva Queiroz**. Pagamento **`r6tj7xmsb6ex`**, em **26/06/2026**, R$ 900; espelho de caixa **`0a3jr657b6f7`**. Hipótese bancária **`6z9tj9qttaqf`**, mesma data, valor e favorecido.

A busca pelo nome completo recuperou seis mensagens; a de **26/06/2026 às 20:46:31 UTC** é “Pagamento Pix realizado”. O corpo informa pagamento de **R$ 900**, em **26/06/2026 às 17:46**, para **Jeyweisson Kildare da Silva Queiroz**, banco **104 — Caixa Econômica Federal**, documento mascarado `***.625.484-**`, identificador **`E00416968202606261709xww5fssRkVm`**. A evidência confirma externamente a transferência. O identificador foi preservado no parecer privado, **sem preencher o banco legado nem homologar associação à compra**.

O pedido e o pagamento permanecem com origem **`caixa_obra`**. Há dois ajustes explícitos no pedido, ambos com motivo **“Mudança para caixa de obra”**, registrados em **07/08/2026 às 14:00:54 e 14:01:01 UTC**. O pagamento foi registrado depois, às 17:11:03 UTC do mesmo dia. Essa escolha manual não foi revertida por inferência a partir do aviso bancário.

O item de R$ 900 é **“SERRALHEIRO - MÃO DE OBRA”**, cadastrado no catálogo de materiais, com recebimento físico em 07/08/2026. A descrição de serviço em um item material merece revisão da obrigação e do documento de origem; não autoriza reclassificar para terceirizados, criar outra medição ou gerar estoque/custo adicional. O pedido tem documentos vazios, e o pagamento não tem comprovantes anexados nem referência bancária persistida. Não foi identificada nota fiscal vinculada ao pagamento na revisão anterior mantida nesta cópia.

O razão contém **uma saída de R$ 900**, proveniente do pagamento do pedido; o espelho do caixa da obra não gera segunda saída. O evento está sinalizado como **obrigação ausente** (`obligationMissing`); o pedido não gera custo reconhecido nessa fotografia. Pagamento e registro de entrega não substituem a documentação para reconhecer custo.

O validador compartilhado rejeitou o vínculo desse pagamento à conta da empresa porque a origem é caixa da obra. O bloqueio foi preservado. Antes de qualquer correção, esclarecer se o Pix liquidou esta obrigação de serralheria e por que houve as duas mudanças de origem. Se comprovada origem empresa, a solução é corrigir o pagamento existente e estornar somente seu espelho de caixa, com trilha de auditoria e comparação financeira — sem gerar outro pagamento. O eventual vínculo bancário exige confirmar também a referência do movimento importado.

As onze outras sugestões de débitos de R$ 900 para o PC-0003 continuam sem suporte, com datas/favorecidos diferentes. O aviso encontrado não as valida.

## DRE, caixa, memoriais e fechamentos

Em **quatro etapas**, compararam-se integralmente **36 competências da empresa (2025–2027)** e **648 projeções mensais por obra** com a cópia local consolidada anterior:

1. Recaptura e preservação das correções locais anteriores.
2. Revisão dos seis recebimentos e das sete hipóteses.
3. Revisão do PC-0003, aviso Pix, origem e espelho.
4. Exportação documental e conferência final.

**Zero receita, custo ou caixa novos em todas as etapas.** Memoriais conferidos e diferenças entre razão e DRE iguais a zero. Fingerprints dos dados financeiros, tabelas nativas e captura de origem preservados. Nenhum vínculo, recebimento, pagamento ou ajuste financeiro foi aplicado nesta rodada.

As **793 transações bancárias sem classificação permanecem**. A **W1-22 mantém os R$ 12.000 como pendência documental**, sem nova consulta ao usuário sobre informações que ele declarou não saber. A trava dos R$ 7.160 e o aporte B2-04 de R$ 10.384,50 permanecem. Nenhuma prévia de fechamento foi aprovada; a igualdade dos memoriais não homologa os fechamentos nem resolve essas pendências. O saldo local simulado do caixa B2-04 continua R$ 9.484,50 após as correções anteriores, sem representar saldo bancário disponível comprovado.

## Validação, ajuda e evidências

**80 testes aprovados em seis arquivos**, zero falhas ou pulos: razão financeiro, recebimentos/estornos, alocações de caixa, comando de conciliação, projeções e memoriais do DRE. A revisão reproduzível inclui sete rejeições de IDs derivados, rejeição da origem caixa da obra do PC-0003, deduplicação do espelho e preservação de valores/datas.

Ajuda de Conciliação, medições e caixa/manual revisados quanto à distinção entre registrar e vincular um pagamento existente. **Nenhum fluxo, regra, controle ou resultado do app mudou**; não houve necessidade de alterar instruções, data de revisão ou regenerar o manual. Não se realizou nova revisão visual ou build nesta rodada documental. **Lint, design, manual e tipos aprovados**; manual sincronizado com 143 guias e 65 abas. Logs desta rodada preservados localmente.

Artefatos reproduzíveis e validações: `artifacts/legados-pc0003-20261115/`. Evidências detalhadas privadas fora do repositório: **`C:/dev/marcell-local-review/legados-pc0003-20261115/`**:

- `legacy-receipt-cases.json` e `.csv`: seis pareceres, sete candidatas, IDs exatos e próximas providências.
- `pc0003-case.json`: pagamento, espelho, ajustes manuais, evidência Pix e bloqueio de origem.
- `bank-mail-evidence.json`: mensagens selecionadas e limites de interpretação; sem anexação automática ao ERP.
- `snapshot.json`, `data-before.json`, `data-consolidated.json`, `audit-consolidated.json`: captura somente leitura e cópia local não executável.

## Próximas pendências do roadmap

1. **Recebimentos:** recuperar comprovantes ou confirmação de parcela/obra das quatro entradas com cliente compatível; comprovar pagamentos por terceiro nas duas da K1-04 e resolver a disputa de 01/06. Homologar referência original antes de planejar normalização auditável.
2. **PC-0003:** conferir obrigação de serralheria e motivo dos dois ajustes de caixa. O aviso Pix foi localizado; não repetir a busca como se o documento bancário ainda faltasse. Origem e associação econômica continuam abertas.
3. **Próxima frente independente:** conferir R$ 0,22 da CA1-13 e entrada antiga da R1-16, preservando competência, valores e documentos existentes; não arredondar para fechar.
4. **Arquivados:** esclarecer as três abreviações JOSE SANTOS e obter as obrigações dos pagamentos sem título. Manter os 27 pareceres e os oito destinos como inventário, sem reabrir/importar para reduzir contagens.
5. **Documentais permanentes:** W1-22, R$ 7.160, composição do aporte B2-04, originais bancários e aprovação operacional da conta. Permanecem sem alteração financeira.

**Automação possível:** reaproveitar o leitor de recebimentos e o validador de vínculos para detectar espelhos legados, listar uma única vez o fato já recebido e bloquear conciliação de origem incompatível. A revisão desta rodada automatiza essas conferências sem criar campos ou escolher destinos. Uma migração futura precisa de prova e validação de equivalência; nome/data/valor e ID derivado não são autorização para conciliar automaticamente.
