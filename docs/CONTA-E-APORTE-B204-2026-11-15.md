# Conta bancária, identificadores e aporte da B2-04

**Atualização posterior — arquivados e destinos concorrentes:** [27 casos e oito destinos revisados](ARQUIVADOS-E-DESTINOS-CONCORRENTES-2026-11-15.md). Os oito destinos reúnem 65 hipóteses; sete coincidem condicionalmente em data/valor com seis recebimentos legados e 11 não têm suporte atual para o PC-0003 sugerido. Corrigido o falso conflito entre contratos do mesmo prestador, preservando obrigações e obras. DRE/caixa iguais em cinco etapas; 772 testes e sete cenários de navegador aprovados. Pendências financeiras mantidas, sem publicação.

Continuação local em 15/11/2026 da [conferência dos R$ 4.100 e R$ 275](ORIGEM-E-DATAS-PAGAMENTOS-2026-11-15.md). **A identificação da conta da empresa ficou documentada; os vínculos dos dois pagamentos e a composição do aporte de R$ 10.384,50 continuam pendentes.** Nenhum cadastro, vínculo ou fato financeiro foi gravado no ERP real. Nenhuma publicação na Vercel.

Captura real somente leitura: **15/11/2026 às 20:50:07 UTC**. A cópia atual reaproveita as correções locais anteriores da X1-25, dos seis identificadores históricos e da data/origem dos dois pagamentos. Cada registro reaproveitado foi comparado com a origem anterior antes de transportar sua correção; a linha principal atual não foi substituída por uma cópia antiga. Nenhuma correção financeira nova foi aplicada nesta rodada.

## Identificação da conta documentada

Foi localizado `C:/Users/hygor/OneDrive/Desktop/Arquivos/CONTRATO ISRAEL.pdf`. A página 1 identifica **lote 04, quadra B2, Arú**. A cláusula **5.8.1, página 5**, relaciona a empresa **ARCD CONSTRUTECH LTDA**, o mesmo CNPJ do ERP, **Banco 077 — Inter**, **agência 0001**, **conta corrente final 9896** e chave Pix CNPJ. A conta completa, normalizada somente pela retirada do hífen de apresentação, coincide exatamente com os metadados dos três extratos importados. Não se fez identificação apenas pelo final da conta ou pelo nome do cliente.

O cabeçalho do CSV local de 31/12/2024 a 31/12/2025 também contém a mesma conta completa. O CSV foi usado para corroborar o número, **não como prova isolada de titularidade nem como saldo de abertura atual**. Avisos bancários de recebimento Pix de 2026 citam expressamente a mesma conta e o destinatário ARCD. Os avisos do cliente servem à pesquisa documental; seu nome não autoriza classificar cada entrada como recurso da B2-04.

**Integridade do documento contratual:** SHA-256 `34174ea0e576c3aafbc044aa47d60ff0d323097dd7d47abd2670a18aa23cf241`. Há uma assinatura digital no arquivo, cuja integridade criptográfica foi verificada com OpenSSL; o intervalo assinado cobre os **3.217.609 bytes** do documento. A página de assinatura mostra a assinatura da contratada e campos dos contratantes/testemunhas sem assinatura visível. Não foram certificados confiança/revogação do certificado, assinatura de todas as partes ou vigência integral das condições contratuais. O documento não foi usado para alterar taxas, valores ou condições da obra.

### Rascunho bancário reaproveitado

A proposta somente para revisão já existente foi enriquecida com os dados documentados, sem criar outro fluxo ou cadastro:

| Campo | Tratamento |
| --- | --- |
| Banco e conta | Reaproveitados dos metadados dos extratos; conta completa conferida com o documento. |
| Agência | 0001, conforme cláusula 5.8.1. |
| Tipo | Conta corrente, conforme “C/C” no documento. |
| Titular, documento e Pix | Empresa/CNPJ expressamente relacionados à conta no documento. |
| Saldo inicial e data de referência | **Não preenchidos.** Não presumir zero nem transportar saldo de 2025 para 2026. |
| Situação ativa/inativa atual | **Não preenchida.** Aviso recente não substitui a conferência operacional atual. |
| Aprovação e execução | **Pendentes; proposta não executável.** |

Não foi obtido certificado/comprovante bancário formal de titularidade. O rascunho registra a identificação documental e suas limitações para revisão operacional; não ativa automaticamente uma conta nem aprova seus vínculos. Há **zero contas cadastradas** tanto no espelho operacional quanto na tabela bancária nativa consultada.

**DRE nesta etapa:** zero receita, custo ou caixa novos. Rascunho bancário e leitura contratual não são fatos financeiros.

## Identificadores dos dois pagamentos

| Pagamento | Linha importada | Resultado da leitura nativa complementar |
| --- | --- | --- |
| PC-0002 · R$ 4.100 | `aqqg1o8btaqf` | Registro canônico único, valor/direção/situação coerentes com a captura; sem ID Pix, conta nativa ou lote original associado. |
| PC-0001 · R$ 275 | `m0vbchtmtaqf` | Mesma conferência e mesmas ausências. |

Os comprovantes e avisos preservados na rodada anterior contêm IDs Pix. As linhas importadas não os contêm: o campo legado `txid` continua com a referência genérica **077**, também presente em `REFNUM`. Não foi promovida essa referência a identificador Pix, nem usado o nome/valor/data para criar correspondência exata artificial.

Também foram consultadas as tabelas nativas de contas e lotes de importação: **zero contas, zero lotes e nenhum conteúdo OFX recuperável** por esse caminho. Os dois movimentos têm `account_id`, `import_batch_id` e `e2e_id` nulos. A identificação documental da conta não preenche automaticamente essas referências nativas.

O original `Extrato-19-05-2026-a-17-08-2026-OFX.ofx` não foi localizado nas fontes consultadas. A busca de avisos de extrato encontrou três mensagens, com períodos de 2023 e 2025; nenhuma cobre as duas saídas de junho/2026. Um anexo PDF de 2025 foi materializado pelo conector, mas não foi obtido conteúdo local validado: houve divergência de tamanho em uma tentativa e falhas de acesso nas seguintes. **Seu conteúdo não foi inspecionado nem usado como prova de titularidade.** A evidência positiva desta rodada veio do contrato local, do cabeçalho CSV e dos avisos de 2026.

**Parecer:** conta identificada documentalmente; associação dos IDs Pix aos FITIDs ainda sem original suficiente. Os dois movimentos continuam pendentes e os pagamentos existentes permanecem sem novo vínculo. Nenhuma nova saída ou baixa foi gerada.

## Composição do aporte de R$ 10.384,50

Registro exato: `p6ef4ue0yhr0`, obra `kep278px87cr` — B2-04, tipo `aporte`, descrição **APORTE GERAL**, data **24/07/2026**, valor **R$ 10.384,50**.

- Não possui comprovante, documentos, referência bancária, pedido ou pagamento vinculado. O ID aparece apenas no próprio registro de caixa nas coleções capturadas.
- **Nenhuma das 925 transações capturadas é um crédito de R$ 10.384,50.** Isso não prova que o aporte seja incorreto: ele pode representar composição, saldo anterior ou outro contexto não documentado. Nenhuma dessas hipóteses foi adotada como fato.
- O contrato descreve repasses para custeio, pagamentos e prestação de contas, mas **não identifica esse valor nem sua composição**. Não autoriza deduzir a composição dos recebimentos observados ou reclassificá-lo como honorários.
- A pesquisa pelo nome do cliente retornou 37 mensagens em duas páginas, sem página restante indicada pelo conector; 24 eram avisos bancários. Foram preservados sete avisos anteriores a 25/07/2026 e um aviso posterior para corroborar a conta. Esse é o alcance da consulta, não uma certificação de todos os canais ou pagadores.
- Há sete movimentos no inventário por nome até a data do aporte: cinco pendentes, um já conciliado e um ignorado. Essa seleção é **somente hipótese de pesquisa**, sem confirmação de identidade bancária, finalidade ou participação no aporte. Não se buscou uma combinação de valores que “fechasse” R$ 10.384,50.

### Recebimento de R$ 220 preservado

O crédito `nhpjvhw2xrta`, de **21/07/2026**, já baixa a medição `5iuh3bgo2k4v` da B2-04 por meio do recebimento `rec_ms522ma3_n7hy3t`, de R$ 220. A conferência encontrou **um único evento de entrada de caixa** para esse vínculo. Ele foi preservado integralmente.

Esse crédito não ficou disponível para criar outro recebimento ou outro aporte apenas porque aparece no histórico do mesmo cliente. Se futura documentação demonstrar que integra uma composição diferente, será preciso conferir e tratar o vínculo atual pela trilha auditável existente, sem somar outra entrada ao mesmo fato.

O movimento de R$ 4.200 de 06/07/2026 encontrado nesse inventário permanece **ignorado**, conforme sua situação capturada. Não foi reativado nem utilizado para recompor o aporte. Também não foram usados créditos posteriores à data do aporte para justificar retroativamente o registro.

**DRE nesta etapa:** o aporte existente produz uma entrada de caixa no razão, sem receita ou custo próprios. A revisão não criou outra entrada, não reconheceu honorários e não desfez a medição de R$ 220. **Composição não comprovada; registro e vínculos preservados.** Para concluir, faltam memória do aporte, documentos de cada componente e eventual saldo anterior, separando custeio e honorários.

## Incompatibilidade documental adicional

A `PROPOSTA TÉCNICA ISRAEL ADM.pdf` usa **27.254.760/0001-74**, enquanto o contrato, os comprovantes e o cadastro da empresa usam **27.259.760/0001-74**. A divergência foi registrada para revisão do documento na origem. Não foi criado outro cadastro de empresa, alterado o CNPJ do ERP nem reescrito qualquer PDF.

O contrato de compra do imóvel também localizado é um documento de outro negócio; não foi confundido com comprovante de aporte ou pagamento da construção.

## DRE e validação por etapa

| Etapa | Conferência |
| --- | --- |
| Recaptura e transporte das correções locais anteriores | Comparação com o consolidado anterior; origem atual preservada, W1-22 intacta. |
| Conta, contrato e rascunho documental | Mesmo DRE, caixa, saldos e projeções; nenhum cadastro efetivado. |
| Aporte e recebimento já conciliado | Vínculos e situações preservados; nenhum rateio ou novo lançamento. |
| Conferência final dos artefatos | **36 competências empresariais e 648 projeções completas de obra/mês iguais ao consolidado anterior.** |

Em todas as quatro etapas: **zero receita, custo ou caixa novos**, memoriais e composição entre razão e DRE conferidos. As correções locais da etapa anterior continuam preservadas, inclusive o caixa mensal dos R$ 275 e o saldo local de R$ 9.484,50 do caixa da B2-04. Isso não homologa a composição do aporte nem confirma saldo bancário disponível.

As **793 pendências bancárias** continuam. A **W1-22 permanece documental, com R$ 12.000 excedentes**, e a trava dos R$ 7.160 foi preservada. Nenhuma prévia de fechamento foi aprovada.

- **75 testes aprovados em sete arquivos**, zero falhas/pulos: proposta de conta, triagem, saneamento, leitor somente leitura, composição de fontes, razão e fechamento.
- Lint, tipos, design e sincronização do manual aprovados. Ajuda e manual revisados: esta rodada não altera o app, seus controles, regras ou resultados operacionais; não exigiu novo texto de instrução. Permanecem 143 guias para 65 abas.
- Não houve alteração de código do app, interface ou dependências. Build e jornadas do navegador da rodada anterior não foram repetidos nem contados como novas validações. As páginas do documento local foram renderizadas e conferidas visualmente.
- Uma consulta adicional de conta/CNPJ falhou no transporte do conector de e-mail; esse limite e as falhas do anexo antigo ficaram registrados. Não foi usado refresh de sessão Microsoft do ERP nem executado comando remoto para contornar a falha.

Evidências compactas e logs em `artifacts/conta-aporte-b204-20261115/`. Dados e documentos completos fora do repositório, em **`C:/dev/marcell-local-review/conta-aporte-b204-20261115/`**:

- `account-proposal-reviewed.json`: rascunho bancário reaproveitado, evidência por fonte e limites de aprovação.
- `bank-identifiers-review.json` e `native-bank-origin.json`: dois casos e ausências verificadas nas tabelas nativas.
- `funding-review.json`: aporte sem composição comprovada, hipóteses não aprovadas e recebimento de R$ 220 protegido.
- `mail-review.json`, `local-document-scan.json`, `signature-verification.json` e páginas renderizadas: evidências documentais e limitações.
- `document-discrepancies.json`: divergência de CNPJ na proposta.
- `snapshot.json`, `data-before.json`, `data-consolidated.json` e `audit-consolidated.json`: captura e conferência financeira, sem aplicação à produção.

## Próximas pendências do roadmap

1. **Conta: revisão documental concluída.** Rascunho pronto para futura aprovação operacional; não ativar sem conferir situação e saldo de abertura. Original bancário/identificador exato ainda necessário para os dois vínculos.
2. **Aporte B2-04: pendência documental de R$ 10.384,50.** Obter memória da composição e origem dos componentes. Não reutilizar o crédito já conciliado de R$ 220 nem preencher lacunas por soma de hipóteses.
3. **Próxima frente independente: revisar os 27 casos arquivados e os oito destinos concorrentes**, preservando as travas e conferindo documentos, saldos e pagamentos existentes por ID.
4. **Revisar o CNPJ na proposta documental** pela fonte correta, sem alterar cadastros persistidos ou contrato assinado por comparação de nomes.
5. **Manter W1-22 e R$ 7.160 documentais**, sem criar fatos para liberar fechamento. Aplicação financeira real e publicação continuam pendentes de autorização própria.

Sem push, pull request, migração remota, publicação Vercel ou comando financeiro real.
