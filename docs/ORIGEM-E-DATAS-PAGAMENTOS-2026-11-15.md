# Origem dos R$ 4.100, comprovante dos R$ 275 e conferência do caixa

**Atualização posterior — conta e aporte:** a [conferência da B2-04](CONTA-E-APORTE-B204-2026-11-15.md) localizou a identificação completa da conta no contrato, cláusula 5.8.1, e verificou a integridade de sua assinatura digital. O rascunho de conta foi enriquecido, sem cadastro efetivado. Os dois vínculos continuam sem identificador Pix na origem importada; o aporte de R$ 10.384,50 permanece sem composição comprovada. Recebimento já conciliado de R$ 220 preservado. DRE e caixa iguais em quatro etapas; 75 testes selecionados e gates locais aprovados. W1-22 documental e nenhuma publicação.

Continuação local da [revisão das 69 hipóteses](REVISAO-HIPOTESES-E-REPETICOES-2026-11-15.md), em 15/11/2026. **Os comprovantes e os avisos bancários confirmam pagamentos pela conta da construtora.** Na cópia descartável de revisão, foram corrigidos a data do pagamento de R$ 275 e a origem dos dois pagamentos. Nenhum dado financeiro foi gravado no ERP real, nenhum vínculo bancário foi confirmado e nada foi publicado na Vercel.

A captura da origem ocorreu em **15/11/2026 às 20:24:16 UTC**. As correções locais anteriores da X1-25 e dos identificadores históricos foram preservadas. A **W1-22 permanece documental, com R$ 12.000 excedentes**, sem alteração de contrato, parcelas, valores ou datas. Nenhum fechamento foi homologado.

## Evidências e rastreabilidade

| Fato | R$ 4.100 — PC-0002 | R$ 275 — PC-0001 |
| --- | --- | --- |
| Pedido exato | `86n99g2c3cg1` | `ezcd9jb6no0g` |
| Pagamento existente | `puitymbw42ul` | `0v2moqmwqnaq` |
| Espelho no caixa da B2-04 | `r2mvcz3mt0mh` | `tnj2mv7hqthm` |
| Linha bancária ainda pendente | `aqqg1o8btaqf` | `m0vbchtmtaqf` |
| Data e horário do comprovante | 26/06/2026, 17h46 | 25/06/2026, 14h33 |
| Data de pagamento no cadastro capturado | 26/06/2026 | 24/07/2026 |
| Data do pedido | 26/06/2026 | 25/06/2026 |
| Origem cadastrada capturada | `caixa_obra` | `caixa_obra` |
| Origem física comprovada | Pix da construtora no Banco Inter | Pix da construtora no Banco Inter |

Os arquivos foram associados aos pagamentos pelos **anexos já registrados**, preservando os IDs do pedido, pagamento e espelho. O CNPJ do pagador visível nos dois comprovantes coincide exatamente com o CNPJ configurado da empresa. Não foram criados cadastros de fornecedores ou contas, nem vínculos por nome parecido.

Foram encontrados no Outlook dois avisos de **“Pagamento Pix realizado”**, com remetente `no-reply@inter.co`, recebidos em **25/06/2026 às 17:33:35 UTC** e **26/06/2026 às 20:46:28 UTC**. Seus conteúdos informam valor, data, favorecido, documento do destinatário e ID Pix correspondentes aos comprovantes. O segundo aviso distingue inclusive o caractere `I` maiúsculo no identificador, evitando usar uma transcrição ambígua da imagem. Os IDs e links das mensagens, trechos relevantes e critérios de seleção estão no arquivo privado `mail-evidence.json`.

As consultas apenas pesquisaram e leram resultados; não enviaram mensagens, alteraram situações ou baixaram anexos adicionais. O Gmail não retornou evidência correspondente. Alguns resultados do Outlook vieram fora do filtro de datas solicitado; a seleção foi conferida pelo conteúdo de cada aviso, sem presumir que o filtro foi aplicado nem alegar busca exaustiva por período. A leitura não incluiu validação criptográfica dos cabeçalhos de e-mail.

### Retificação da leitura anterior dos R$ 275

**A imagem original está completa e permite ler 25/06/2026. A indicação anterior de arquivo cortado/incompleto foi um erro de inspeção.** A reabertura individual mostrou a data, e o aviso bancário a corroborou. O arquivo tem o mesmo tamanho e SHA-256 da rodada anterior; não houve substituição por outro documento.

- Anexo de R$ 275: `b0fcd331-aa96-4d59-ba6c-a76a49ff577a.jpeg`, 52.212 bytes, SHA-256 `9e2e4a5fde17b808887cf5ef28ab80d7759db271bb411b5d6d7efc9503eb4cfa`.
- Anexo de R$ 4.100: `f8e28dbd-cbb1-41c0-856d-97fc505793e0.jpeg`, 52.296 bytes, SHA-256 `1b174b0103e055ffdeabe700f9a3dbcd27575a7ae607bdcdb95010c138d0254b`.

A data de 24/07/2026 coincide com a inclusão do pagamento de R$ 275 no ERP. Isso é compatível com uso da data do cadastro, mas **não comprova a causa do erro do operador**. O que está comprovado é a data efetiva de 25/06/2026, pelo comprovante e pelo aviso bancário.

### Histórico dos R$ 4.100 e limite da comprovação

O PC-0002 tem dois ajustes de 24/07/2026: às **15:09:19 UTC**, de Caixa da obra para Cliente direto; às **15:09:22 UTC**, de Cliente direto para Caixa da obra. Os dois registram alteração por arrastar, sem documento ou justificativa adicional para a origem econômica. Essa trilha foi preservada integralmente; não foi interpretada como prova de pagamento pelo cliente.

O comprovante identifica a construtora como pagadora no Banco Inter, e o aviso confirma a saída dessa Conta Digital. Isso sustenta a origem física **Conta bancária da empresa**. Continua sem comprovação a **composição econômica do aporte geral de R$ 10.384,50** lançado no caixa da B2-04 em 24/07/2026. Não se presumiu que esse aporte financiasse os pagamentos de junho, nem se criou empréstimo, transferência, receita, aporte complementar ou compensação.

A conta final **9896** consta dos metadados do extrato importado. Os comprovantes não mostram seu número completo; não foi criado cadastro de conta nem certificado seu vínculo com a linha apenas por banco/nome/valor. Os identificadores Pix dos documentos também não foram gravados sobre o `txid` legado `077` nem usados para aprovar automaticamente os movimentos importados sem identificador exato correspondente.

## Correções preparadas e validadas na cópia local

1. **Data de R$ 275:** pagamento `0v2moqmwqnaq` e seu espelho `tnj2mv7hqthm` passaram de **24/07/2026 para 25/06/2026**, na cópia local. Valores, IDs, anexos, datas de cadastro e datas de recebimento físico foram preservados. Os períodos das duas datas não estavam fechados na captura.
2. **Origem de R$ 4.100:** foi simulado o comando existente `PAGAMENTO_COMPRA_RECLASSIFICADO`, de `caixa_obra` para `empresa`. O pagamento mantém o mesmo ID e valor; seu espelho anterior fica **estornado**, com trilha, sem exclusão física.
3. **Origem de R$ 275:** o mesmo comando foi simulado após a correção da data. O pagamento e o comprovante permanecem; o espelho anterior também fica estornado.

As simulações usam ator explicitamente identificado como **revisão local não enviada ao ERP**. Não são confirmações de um usuário autenticado em produção. O JSON é uma cópia descartável de conferência, **não deve ser importado como cadastro nem enviado como comando à origem real**. A correção de data foi aplicada somente nessa cópia com registro de antes/depois na evidência privada; não foi criada uma ação nova de edição de data no app.

Não houve `Registrar pagamento`, novo recebimento, exclusão de comprovante ou nova nota fiscal. Os dois fatos continuam produzindo **uma saída de caixa cada** pelo pagamento do pedido. A quantidade de pagamentos, os itens, recebimentos físicos, movimentos de estoque, notas e medições ficaram iguais. A origem remota continua com os registros anteriores até uma futura aplicação financeira autorizada e auditável.

## Incompatibilidade encontrada no motor e corrigida localmente

A conferência encontrou um defeito adicional no seletor compartilhado `selectCashFlow`: ao receber limites de data junto com a competência do documento, ele cruzava os dois filtros. Um pagamento em julho de um pedido de junho podia desaparecer dos indicadores de caixa do DRE da obra e da conferência do fechamento de julho.

O teste reproduziu uma medição de junho de R$ 500 recebida em julho e um pedido de junho pago em julho por R$ 275. A fotografia do fechamento mostrava entrada de **R$ 500**, saída de **R$ 275** e saldo de **R$ 225**, mas a conferência validava os três como zero. Um segundo teste reproduziu a falha diretamente no seletor e conferiu isolamento por obra e corte de data. Ambos falharam antes da correção e passaram depois.

**Correção na base compartilhada:** quando houver corte explícito por data inicial, final ou data de referência, o caixa segue esse corte, preservando obra e demais filtros, sem restringir novamente pela competência do documento. O DRE continua selecionado por competência. O mesmo tratamento vale para o indicador de pagamentos diretos de cliente, que continua fora do caixa da empresa. Consultas sem corte de data mantêm seu comportamento anterior.

Na base capturada, antes das correções dos dois pagamentos, o ajuste corrigiu os indicadores de caixa de **23 projeções de obra/mês, em nove obras**, e **27 valores de conferência de caixa em 13 competências**. Esses são valores que já existiam nos fatos e eram omitidos pelo filtro. **Não representam movimentação nova, correção dos contratos ou homologação dos comprovantes dos demais registros.** Receita, custos, resultado e margens do resultado permaneceram iguais.

## DRE e caixa conferidos em cada etapa

Em todas as cinco etapas da conferência dos pagamentos, foram comparadas **36 competências empresariais e 648 projeções de obra/mês**. Os campos de receita, custo e resultado permaneceram iguais, com memoriais e composição entre razão e DRE conferidos. O teste dos recortes de caixa foi separado da invariância do resultado.

| Etapa | Efeito no DRE | Efeito no caixa |
| --- | --- | --- |
| Captura, documentos, avisos e histórico | Nenhum | Nenhuma alteração de fatos; baseline conferida. |
| Correção local da data de R$ 275 | Nenhum | Saídas de junho **+R$ 275**; saídas de julho **−R$ 275**. Saldo de junho −R$ 275 e de julho +R$ 275; total do intervalo igual. |
| Reclassificação local dos R$ 4.100 | Nenhum | Total de caixa igual; saldo do caixa da obra +R$ 4.100 pela retirada do débito indevido desse subcaixa. |
| Reclassificação local dos R$ 275 | Nenhum | Total de caixa igual; saldo do caixa da obra +R$ 275. |
| Conferência final | Zero receita, custo ou resultado novo | Uma saída por pagamento; total geral igual; bancos e vínculos preservados. |

O saldo do caixa da B2-04 passa, **na cópia local**, de **R$ 5.109,50 para R$ 9.484,50**: aumento de R$ 4.375 por retirar os dois débitos do subcaixa. O aporte de R$ 10.384,50 foi preservado e sua composição permanece pendente. Esse aumento do subcaixa **não cria dinheiro na empresa** nem confirma saldo bancário disponível.

Depois de corrigir o seletor, a correção de data modifica os indicadores de caixa de junho e julho da B2-04, inclusive pagamentos sem documento de competência alocado e margem de caixa. As outras **646 projeções completas** são iguais à baseline com o motor corrigido; nos **648 recortes**, o resultado por competência é igual. Os pedidos permanecem sem nota fiscal de competência vinculada no razão; pagar ou conciliar não autoriza reconhecer novamente custo nem inventar nota fiscal.

As **793 pendências bancárias permanecem**, inclusive os dois movimentos desta revisão. A W1-22 conserva o excedente de R$ 12.000 e seus dados originais; a trava dos R$ 7.160 também foi preservada. Nenhuma prévia de fechamento foi aprovada e não havia fechamento real a certificar.

## Validação e evidências

- **756 testes aprovados em 86 arquivos**, zero falhas/pulos na suíte final: Financeiro, DRE, conciliação, projeção, memorial, integração canônica, triagem, saneamento e ajuda. Os testes de regressão do seletor e do fechamento têm evidência de falha antes e aprovação depois.
- **Quatro cenários de navegador aprovados**, em desktop e celular: associação parcial ao DRE com falha/retentativa/reversão e leitura da orientação de fechamento sem gravações. Ajuda revisada visualmente nos dois tamanhos, sem transbordamento horizontal.
- Ajuda e manual atualizados na fonte única: explicação de competência do resultado e data do caixa. **143 guias para 65 abas**, revisão de 15/11/2026. Nenhum componente, estilo ou cadastro novo.
- Lint, tipos, design e manual conferidos; sem aumento da baseline. Build local por Vite, sem executar o prebuild de migrações. **1.815.601 bytes gzip**, limite mantido em **1.891.328**, margem de **75.727 bytes**, zero violações no orçamento.
- A primeira descoberta do navegador varreu worktrees aninhados e encontrou duas instalações de Playwright. A configuração foi limitada aos diretórios dos testes desta rodada; nenhuma asserção foi retirada. Logs da tentativa preservados e não contados como falhas do ERP. As primeiras asserções da investigação também separaram, progressivamente, o resultado por competência dos campos de caixa que deveriam mudar; as divergências levaram aos testes de regressão acima.

Evidências compactas, testes, logs, imagens, build e `verification.json` em `artifacts/origem-pagamentos-20261115/`.

Dados financeiros e documentos de evidência fora do repositório, em **`C:/dev/marcell-local-review/origem-pagamentos-20261115/`**:

- `data-before.json` e `snapshot.json`: captura real somente leitura.
- `data-consolidated-before-payments.json`: baseline com as correções locais anteriores preservadas.
- `data-consolidated.json` e `audit-consolidated.json`: cópia final de revisão; não são dados aplicados à produção.
- `payment-evidence.json`: cadeia exata, hashes, IDs Pix e simulações locais com ator explícito.
- `mail-evidence.json`: dois avisos bancários e critérios da pesquisa.
- `projections-before-cash-fix.json`: comparação do seletor anterior, sem sobrescrever sua evidência.

## Roadmap atualizado

1. **Revisão documental dos dois pagamentos concluída; aplicação real pendente.** Revalidar a origem na data de uma futura aplicação; reaproveitar os pagamentos existentes e a trilha de correção, sem importar a cópia descartável.
2. **Conta identificada documentalmente na continuação; vínculo bancário ainda pendente.** O contrato relaciona banco, agência, conta e CNPJ; rascunho pronto para revisão, sem ativação. Ainda é necessário OFX/original ou evidência bancária que associe o ID Pix à linha importada; não substituir `REFNUM` por Pix nem gerar outra baixa.
3. **Conferir o aporte geral de R$ 10.384,50 da B2-04.** A origem física dos pagamentos está comprovada; a composição desse aporte continua separada e não foi vinculada por semelhança.
4. **Manter a trava do aporte de R$ 7.160 e revisar os destinos concorrentes.** Conferir distribuição e saldo único antes de escolher títulos, inclusive diferenças de centavos.
5. **Manter W1-22 como pendência documental.** Aguardar contrato/aditivos, composição das parcelas e comprovante da entrada; nenhuma correção por suposição ou fechamento para eliminar a diferença.

Sem push, pull request, migração remota, publicação Vercel ou comando financeiro real.
