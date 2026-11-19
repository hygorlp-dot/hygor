# Recebimentos excedentes e referências históricas — 15/11/2026

**Continuação posterior:** [W1-22 e lint](W1-22-E-LINT-2026-11-15.md). O bloqueio de lint descrito abaixo foi resolvido no checkout e validado nesta continuação. A busca ampliada encontrou uma proposta de R$ 177.640 para o imóvel W1-22, mas não comprovou o contrato vigente nem o recebimento divergente. Os R$ 12.000 continuam como pendência documental; DRE sem novo efeito e sem aplicação remota. As constatações abaixo pertencem à rodada anterior.

Continuação automática do [saneamento e conciliação](SANEAMENTO-E-CONCILIACAO-DRE-2026-11-15.md). Captura real em **15/11/2026 às 16:14:56, horário da Bahia**. Leituras remotas somente para consulta; correção financeira aplicada **exclusivamente à cópia local**. Sem publicação na Vercel, push, PR, migração ou alteração da origem real.

## Resultado

| Pendência anterior | Resultado desta rodada |
| --- | --- |
| R$ 5.750 excedentes na X1-25 | Corrigido o valor previsto da medição de entrada, de R$ 10.170 para R$ 15.920, na cópia local. Comprovada a composição com o contrato e o restante das cobranças. Receita e resultado de março/2026 aumentaram R$ 5.750; custos e caixa permaneceram iguais. |
| R$ 12.000 excedentes na W1-22 | Preservados. O cadastro apresenta inconsistências adicionais de total e datas; não foi encontrado contrato ou comprovante suficiente para uma correção automática. |
| Cinco referências a obras ausentes | Identificadas por ID exato em três registros arquivados da projeção canônica. A ferramenta agora distingue contexto histórico confirmado de origem ainda desconhecida. Nenhuma obra foi reativada ou vinculada por nome. |
| DRE após a correção | 36 competências conferidas e 648 comparações por obra/mês. Memoriais e composição gerencial sem diferenças não explicadas. Apenas o resultado mensal da X1-25 em março/2026 mudou; o faturado acumulado e o saldo contratual refletem a correção nos meses seguintes. |

Na **cópia local**, o excedente pendente caiu de R$ 17.750 para **R$ 12.000**. Na origem remota, os valores anteriores continuam intactos: não houve aplicação em produção. A confirmação da origem arquivada esclarece as cinco referências, mas não comprova, por si só, se a retirada das obras da lista operacional foi uma decisão de negócio correta.

## Etapa 1 — investigação de origem

Foram consultados os dados atuais, os registros de auditoria que contêm obras/medições e os cadastros canônicos. Os dois eventos financeiros de 28/07/2026 já registravam os mesmos valores divergentes antes e depois da gravação. Não foi comprovado que esses eventos tenham causado o problema; tampouco foi criada uma regra geral para trocar valores com base no texto “Entrada do contrato”.

Os três backups disponíveis em `company_app_data_backup` e os dois em `app_data_import_backups`, de maio/2026, não recuperaram os registros-alvo. Há 110 backups sincronizados no computador, de julho a novembro, mas estão criptografados e a chave de backup não está configurada no ambiente local. Não foram alterados nem declarados restaurados.

A sessão Microsoft da revisão local não pôde ser aberta. Não foram usados os endpoints de produção que renovam e persistem essa sessão. A análise documental continuou sobre a cópia já sincronizada em `C:/Users/hygor/OneDrive/App/`.

**DRE nesta etapa:** somente consultas, sem mudança de previsão, compromisso, estoque, receita, custo ou caixa.

## Etapa 2 — X1-25: composição comprovada

Medição `acskc9jf484c`, obra `z6ylkb06`, competência março/2026. O valor previsto era R$ 10.170, embora o recebido registrado e a entrada cadastrada na obra fossem R$ 15.920. A parcela `d24w5t7s484c` também registra R$ 10.170 recebidos em 23/03/2026.

O PDF vinculado no cadastro da obra, `X1-25 MINUTA.pdf`, contém na cláusula 2.1.1 o lote 25, quadra X-1, e na página 4 a composição:

- Total contratual: **R$ 260.000**.
- Entrada: **R$ 26.090**.
- Outras 23 parcelas de **R$ 10.170**.

Apesar do nome “MINUTA”, o arquivo possui dois campos de assinatura preenchidos. A integridade criptográfica das duas assinaturas foi verificada com OpenSSL; a última cobre o tamanho integral do arquivo. **Não foi validada a cadeia de confiança, revogação ou validade jurídica dos certificados.** A página da cláusula foi renderizada e conferida visualmente.

SHA-256 do arquivo: `2b158d4ee1209a954b1c88172d85f8b743f962aa1f97270854d5640a91b88de5`.

| Conferência | Antes | Depois, na cópia local |
| --- | ---: | ---: |
| Primeiro registro de entrada — valor previsto | R$ 10.170 | R$ 15.920 |
| Outro registro inicial | R$ 10.170 | R$ 10.170 |
| Soma dos dois registros iniciais | R$ 20.340 | **R$ 26.090**, igual à entrada contratual |
| Demais 23 parcelas | R$ 233.910 | R$ 233.910 |
| Total das 25 cobranças cadastradas | R$ 254.250 | **R$ 260.000**, igual ao contrato |
| Recebimentos e respectivas datas | Preservados | Preservados |

Foi alterado **somente `valorPrevisto` desse registro**, sem criar recebimento, mudar competência, renumerar parcelas, alterar os R$ 15.920 já registrados como recebidos ou gerar um novo título. A separação dos registros iniciais foi preservada. O PDF fundamenta a cobrança; a rodada não certifica novamente os pagamentos bancários de março, que estão fora do intervalo dos extratos capturados.

**Impacto no DRE:** o mesmo fato passa a registrar mais R$ 5.750 de receita em março/2026, corrigindo a subavaliação da cobrança. Não se trata de custo novo ou de caixa novo. No razão, apenas os eventos de receita e aumento do direito a receber dessa medição mudaram, ambos em 575.000 centavos. Todos os eventos de caixa permaneceram idênticos.

## Etapa 3 — cinco referências: contexto arquivado confirmado

| Registro dependente | ID da obra | Cadastro canônico encontrado | Arquivado na projeção em |
| --- | --- | --- | --- |
| Conferência `pdvn4p89y7qe` | `adbcuvr2iqky` | D1-04 INCORPORADORA | 29/10/2026 |
| Conferência `u4i85dcf4cs2` | `vl0wrfbo0vjz` | J1-14 | 24/10/2026 |
| Plano `umotq99aev8e` | `077wbua1cv72` | I-02 OÁSIS (ORÇAMENTO) | 29/10/2026 |
| Orçamento `yvcdd4sjmv42` | `077wbua1cv72` | I-02 OÁSIS (ORÇAMENTO) | 29/10/2026 |
| Orçamento `34cuchthev8e` | `077wbua1cv72` | I-02 OÁSIS (ORÇAMENTO) | 29/10/2026 |

As três linhas de `core_projects` têm `active: false`, data de arquivamento e `payload.id` igual ao ID referenciado. A conferência exige também a mesma empresa e uma única correspondência. Nome semelhante, empresa diferente, ID interno divergente, linha ativa ou data inválida não são aceitos como prova.

A ferramenta mantém `orphanWorks` como inventário das referências ausentes da lista operacional e acrescenta `historicalWorkReferences` e `unresolvedWorkReferences`. Assim, as cinco ausências continuam visíveis, agora com contexto histórico confirmado, e nenhuma fica com origem desconhecida nesta amostra. Essa distinção não reintroduz obras no cálculo operacional.

**Impacto no DRE:** zero. Permaneceram 18 obras na lista de cálculo. Nenhum plano foi promovido a linha de base, nenhum orçamento foi aprovado e nenhuma conferência foi excluída. Reativar uma dessas obras seria outra decisão e poderia introduzir efeitos históricos de custeio; isso não foi feito.

## Etapa 4 — W1-22: preservação e pendência documentada

Medição `izzo6ygfjqds`, obra `1g4dehgq`: previsto R$ 8.000, recebido R$ 20.000 em 30/09/2025, diferença **R$ 12.000**. A entrada da obra é R$ 20.000, mas o conjunto exige comprovação adicional:

- Contrato cadastrado: R$ 175.000. As 21 medições somam R$ 168.000 previstos e R$ 180.000 recebidos registrados.
- Elevar apenas o previsto dessa entrada para R$ 20.000 faria a soma prevista chegar a R$ 180.000, ainda R$ 5.000 acima do contrato cadastrado. Essa hipótese não foi aplicada.
- Início contratual cadastrado: 30/09/2026; fim: 15/07/2026. A ordem está invertida.
- Data da entrada na obra: 30/09/2026; data do recebimento na medição: 30/09/2025. Não foi escolhido um ano por aproximação.
- Os 925 movimentos bancários capturados abrangem 19/05/2026 a 15/08/2026. Não comprovam o recebimento de setembro/2025. Não havia contrato PDF na pasta de contratos sincronizada da W1-22.

As diferenças são aspectos do mesmo caso e **não devem ser somadas como prejuízos independentes**. Nenhum recebimento foi reduzido, nenhuma despesa foi criada para compensar o saldo e nenhuma data foi alterada. O caso continua impedindo a aprovação das prévias no validador existente.

**Para concluir:** obter o contrato vigente e eventuais aditivos, o comprovante do recebimento de R$ 20.000 e a composição das parcelas. Conferir valor total, entrada, ano, início/fim e saldo antes de corrigir a cobrança ou seus vínculos. A conexão Microsoft também precisa estar disponível caso a conferência deva usar os documentos remotos.

## DRE em cada etapa e validações

| Etapa | Evidência |
| --- | --- |
| Captura e contexto arquivado | Nenhuma alteração financeira; lista operacional preservada. |
| Correção X1-25 | Receita e resultado +R$ 5.750 em março/2026; custo e caixa iguais. DRE gerencial da empresa nesse mês: receita de R$ 162.470 para R$ 168.220; resultado de R$ 157.310 para R$ 163.060. |
| Demais competências | 35 resultados mensais empresariais iguais; 36 memoriais e composições entre razão e gerencial conferidos. |
| Comparação por obra | 648 combinações: 647 resultados mensais iguais. Há 22 visões da X1-25, a partir de março/2026, com faturado acumulado, percentual faturado e saldo contratual ajustados; 626 visões completas permanecem iguais. A receita não foi repetida nos meses seguintes. |
| Continuidade do saneamento anterior | As seis correções de identificação do histórico foram reaplicadas à nova cópia; sem efeito adicional no DRE. Nova execução não propõe outras correções de ID. |
| Fechamento | Zero prévias aprovadas após a correção parcial. O bloqueio restante da W1-22 foi preservado. Nenhuma competência foi fechada ou reaberta. |

Os seis novos testes de classificação histórica falharam antes da alteração e passaram depois. **591 testes selecionados aprovados, zero falhas e zero pulos**, cobrindo auditoria, finanças, DRE, memoriais, fechamento, histórico e bloqueio de escrita dos leitores remotos. O CLI foi executado novamente sobre a cópia consolidada: cinco contextos históricos confirmados, zero origens desconhecidas e zero novas correções de ID.

`typecheck` e ajuda/manual passaram. Ajuda e manual foram revisados e regenerados: 142 guias para 65 abas. Não houve alteração de tela, botão ou regra operacional do aplicativo; as instruções existentes sobre conferência da origem continuam aplicáveis. A mudança de código foi restrita à ferramenta local de auditoria e seus testes. Não foi necessário gerar novo build de interface ou repetir cenários de navegador nesta rodada.

A checagem geral de lint **não passou**: o verificador de design encontrou três ocorrências de plural entre parênteses em `src/domains/arquivos/DeleteDocumentDialog.jsx:9` e `src/domains/arquivos/commands.js:36,40`, fora dos arquivos alterados nesta etapa. Esses arquivos não foram sobrescritos e a baseline não foi aumentada. Os testes financeiros aprovados não significam aprovação desse gate global.

## Arquivos e próximos passos

Evidências resumidas em `artifacts/recebimentos-orfas-20261115/`: captura, verificações do saneamento, reprodução dos testes, resultados finais e logs. Dados detalhados e PDFs permanecem fora do repositório, em `C:/dev/marcell-local-review/recebimentos-orfas-20261115/`.

- `data-before.json`: captura original preservada.
- `data-after-entry.json`: apenas a correção da cobrança X1-25.
- `data-consolidated.json`: correção X1-25 e continuidade das seis identificações históricas.
- `core-projects-evidence.json`: origem exata dos cinco vínculos históricos.
- `audit-before.json`, `audit-after-entry.json`, `audit-consolidated.json` e `recheck/`: comparações financeiras.
- `documents/`: texto, página renderizada, SHA-256 e verificação criptográfica do PDF.

**Prioridade seguinte:** comprovar o caso W1-22. Depois, repetir a prévia e tratar a fila bancária já documentada. Antes de qualquer aplicação real, recapturar a origem, conferir versões e os campos exatos; não substituir a linha principal por esta cópia. A aplicação remota e a homologação de um fechamento real permanecem pendentes. O gate de design também precisa ser regularizado antes da integração geral.
