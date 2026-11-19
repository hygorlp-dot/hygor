# Saneamento histórico e conciliação do DRE — 15/11/2026

**Continuação posterior:** a [investigação dos recebimentos e obras arquivadas](RECEBIMENTOS-E-OBRAS-ARQUIVADAS-2026-11-15.md) corrigiu R$ 5.750 da cobrança X1-25 na cópia local, com impacto explícito no DRE e sem alterar o caixa. As cinco referências foram identificadas por ID na projeção de obras arquivadas; não houve reativação. R$ 12.000 da W1-22 continuam para comprovação. Os valores e limites abaixo pertencem à captura anterior; a origem remota não foi alterada.

Continuação automática autorizada do [roadmap](ROADMAP-SOLUCOES-E-VALIDACAO-DRE-2026-11-14.md), após [tipografia e planos antigos](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md). Implementação, saneamento e validação locais. A origem real foi consultada em modo somente leitura; **nenhum registro remoto foi alterado e nada foi publicado na Vercel**.

## Resultado e limites

| Frente | Resultado |
| --- | --- |
| Histórico de alterações | Seis colisões de identificação corrigidas **na cópia local**. Os 94 eventos foram preservados, inclusive conteúdo, ordem, datas e vínculos. A causa de novas colisões foi corrigida no comando de funcionários. |
| Memorial de equipamentos | Corrigida a inclusão de três manutenções canceladas: R$ 70 em agosto e R$ 80 em setembro/2026 apareciam indevidamente no detalhamento. O DRE já excluía esses valores; seu resultado permaneceu igual. |
| Conciliação dos demonstrativos | 36 competências mensais, de 2025 a 2027, conferidas. Todos os memoriais finais coincidem com suas fontes e a composição entre razão canônico e DRE gerencial fecha em centavos. |
| Preservação por obra | 648 comparações, 18 obras × 36 meses, sem alteração dos valores após o saneamento de identificações. |
| Fechamentos efetivamente registrados | **Zero períodos contábeis e zero fotografias de fechamento** encontrados na origem consultada. Não existe fechamento histórico registrado para certificar nesta captura. |
| Prévia de fechamento | As 36 prévias continuam recusadas pelo validador existente. Há dois recebimentos acima do documento de origem, somando **R$ 17.750**, que exigem comprovação. Nenhum fechamento foi forçado. |
| Referências a obras ausentes | Cinco registros preservados: duas conferências, um plano e dois orçamentos. Nenhum vínculo foi inventado por semelhança de nome. |

**Esta etapa conclui a conferência e as correções locais comprováveis. Não conclui o saneamento dos fatos que dependem de comprovantes ou decisão financeira, nem aplica a cópia saneada na ERP em produção.**

## Origem e rastreabilidade

A captura inicial ocorreu em **15/11/2026 às 11:01:00, horário da Bahia** (14:01:00 UTC). A segunda captura foi às **11:12:06** (14:12:06 UTC). Foram lidas 23 linhas de dados, incluindo os domínios separados e os apontamentos por obra. O reconstrutor existente não encontrou quinzenas arquivadas que exigissem arquivos adicionais; nenhum arquivo esperado estava ausente.

Inventário: 18 obras, 85 funcionários, cinco planos, sete orçamentos, 178 medições, 925 transações, 24 equipamentos, 201 locações e seis manutenções. A camada canônica continha 251 títulos, 210 liquidações, 925 movimentos bancários e 56 vínculos de conciliação. Não havia notas fiscais nessa captura; a cobertura desse domínio nesta etapa é por regressão controlada, não por documentos reais.

O conector Supabase conferiu o inventário e a ausência de períodos contábeis. Para transferir os dados compactados, foi reaproveitado o leitor existente, com bloqueio de métodos diferentes de `GET`/`HEAD`. Nenhuma chave de serviço ou sessão foi incluída no relatório. As consultas paginadas não são uma transação remota atômica.

A leitura final detectou uma alteração externa apenas em `workFileCabinets`, o arquivo de pastas da obra. A cópia mais recente preserva essa alteração. O saneamento e as 36 conferências foram repetidos nessa cópia: questões financeiras, referências ausentes e resultados permaneceram iguais. Uma proposta antiga não pode ser aplicada sobre outro conteúdo: o saneador exige a mesma impressão digital da cópia analisada.

Dados e detalhes pessoais permanecem fora do repositório, em `C:/dev/marcell-local-review/historico-fechamentos-20261115/`. A versão mais recente está em `latest/`: `data-before.json`, `data-after.json`, `sanitation-plan.json`, `audit-before.json`, `audit-after.json`, `summary.json` e `pending-review.json`. A planilha textual `pending-review.csv`, na pasta principal, contém a fila de conferência por identificação exata; seus registros continuam equivalentes na captura mais recente. Não contém comandos para executar pagamentos ou alterar a origem.

## Etapa 1 — saneamento das identificações

A criação do histórico reutilizava a mesma identificação para todos os eventos de uma edição do funcionário. Por exemplo, transferência, desligamento e mudança de diária eram três fatos distintos com uma única identificação. O teste reproduziu a falha: três eventos, apenas uma identificação única.

O comando agora diferencia os eventos pelo seu tipo. Não altera a data, a lotação histórica ou os parâmetros de remuneração. O teste que combina transferência, desligamento e mudança de diária passou com três identificações distintas.

Para os registros anteriores, o saneador local mantém a primeira ocorrência e propõe uma identificação determinística para as demais, calculada a partir do conteúdo exato do evento. Não elimina nenhum fato. A proposta é recusada para repetições idênticas ou identificações referenciadas por outro registro, que exigiriam conferência adicional. Nos seis casos encontrados, os conteúdos eram distintos e não havia referência externa à identificação colidente.

O processamento conferiu a impressão digital da origem, o conteúdo de cada registro e a ausência de mudanças fora do campo de identificação. Repetir a análise da cópia saneada não propõe novas alterações. O razão financeiro inteiro e os demonstrativos por obra permaneceram iguais. **Efeito no DRE: zero; não houve novo custo, reconhecimento ou pagamento.**

## Etapa 2 — memorial das manutenções

O cálculo `calcEquipMes` já excluía `status: cancelada`. O construtor do memorial não aplicava esse mesmo filtro. Isso fazia o detalhamento de agosto somar R$ 70 para um total de manutenção igual a zero, e o de setembro somar R$ 280 para um total de R$ 200.

O memorial agora exclui as canceladas, preservando-as no cadastro de origem. O teste também confere uma manutenção válida, uma paga pelo proprietário e a imutabilidade dos dados consultados. As duas falhas foram reproduzidas antes das correções; os 22 testes dos arquivos diretamente envolvidos passaram depois.

| Competência | Manutenção no DRE | Memorial antes | Memorial depois | Efeito no resultado |
| --- | ---: | ---: | ---: | --- |
| Agosto/2026 | R$ 0,00 | R$ 70,00 | R$ 0,00 | Nenhum |
| Setembro/2026 | R$ 200,00 | R$ 280,00 | R$ 200,00 | Nenhum |

As fotografias de fechamento existentes são preservadas pelo fluxo atual: uma fotografia antiga não é recalculada para receber o novo filtro. Essa proteção foi testada com dados controlados; não foi encontrada fotografia real para verificar sua composição.

## Etapa 3 — razão, DRE gerencial e memoriais

As 36 competências incluem meses anteriores à atividade e meses futuros presentes nas medições, inclusive seis medições em 2027. Isso representa a cobertura dos dados capturados, não 36 meses de resultados já realizados ou fechados.

Em cada mês foram conferidas as fontes individualizadas, os tributos calculados pelas alíquotas do demonstrativo e a seguinte composição:

`resultado gerencial = resultado canônico − mão de obra/equipamentos suplementares das obras + receita bruta de locações − descontos − repasses aos proprietários − manutenção da empresa − tributos sobre receita − provisões sobre lucro`.

O resultado canônico não contém sozinho todos os cálculos suplementares do demonstrativo gerencial. Não foram alterados valores para fazer as duas bases parecerem iguais. A composição foi explicitada e a diferença não explicada terminou em **zero centavos em todos os 36 meses**.

Exemplo real de agosto/2026: resultado canônico de R$ 116.305,00, menos R$ 53.550,00 de mão de obra/equipamentos suplementares, mais R$ 16.170,00 de receita bruta das locações, menos R$ 100,00 de descontos e R$ 10.336,00 de repasses = **R$ 68.489,00 de resultado gerencial**. Manutenção, tributos e provisões desse mês eram zero. O exemplo anterior de R$ 800 utilizado nas fixtures de outras etapas não foi tratado como dado desta empresa.

Os quatro totais principais do demonstrativo de cada mês de 2026 foram comparados com a projeção real capturada antes da correção do memorial: receita, custo dos serviços, despesa operacional e resultado preservados. O saneamento foi conferido separadamente nas 36 competências e nas 648 combinações de obra/mês. Nenhum registro foi promovido de previsão a compromisso, estoque, custo reconhecido ou pagamento.

## Etapa 4 — prévias e fila de conferência

| Ocorrência | Quantidade | Providência e impacto |
| --- | ---: | --- |
| Recebimento acima da medição | 2 | Medição de março/2026: previsto R$ 10.170, recebido R$ 15.920, excedente R$ 5.750. Medição de setembro/2025: previsto R$ 8.000, recebido R$ 20.000, excedente R$ 12.000. Conferir comprovantes e origem; não presumir adiantamento nem reduzir o recebido. Impede certificar o fechamento. |
| Referência a obra ausente | 5 | Preservar os dois orçamentos, o plano e as duas conferências. Conferir exclusão, origem e eventual arquivo pelo ID exato. Não restaurar obra nem excluir documentos automaticamente. |
| Transação bancária sem classificação financeira | 793 | Separar custo/receita de transferência, aporte, empréstimo ou movimento ignorável mediante comprovação. Uma classificação automática inadequada poderia criar custo ou receita indevidos. |
| Pagamento sem alocação | 3 | Conferir a origem do desembolso e seu vínculo. O pagamento não constitui automaticamente novo custo. |
| Pagamento legado de terceiro sem medição | 1 | Conferir contrato, medição e comprovante antes de criar qualquer reconhecimento ou vínculo. |
| Mesmo efeito de caixa detectado em espelhos | 3 | O motor já evita repetir o efeito. Conferir os registros exatos antes de eliminar ou desvincular um espelho; mesmo valor não prova duplicidade de negócio. |
| Recebimento reconstruído de campo legado | 132 avisos informativos | A origem informa o recebido sem lista individualizada de parcelas. Isso foi preservado; o aviso não prova recebimento duplicado. |

A fila detalhada contém **807 ocorrências para triagem**, incluindo avisos que não são bloqueios independentes. Os 132 avisos informativos legados ficam separados no relatório técnico. As contagens podem se referir ao mesmo fato de negócio e não devem ser somadas como quantidade de lançamentos financeiros duplicados.

As 36 prévias foram calculadas sem gravar fechamento. A validação existente considera inconsistências do conjunto e saldos acumulados; o bloqueio em todos os meses **não significa um excedente de R$ 17.750 em cada competência**. Não foi removida essa proteção para obter um resultado aprovado.

## Automação local entregue

`scripts/audit-historical-finance.mjs` recebe arquivos locais e os anos exatos. Gera diagnóstico, proposta de saneamento, cópia saneada e conferência antes/depois. Não recebe conexão de banco e não possui opção para aplicar remotamente.

```powershell
node scripts/audit-historical-finance.mjs `
  --input=C:/dev/marcell-local-review/historico-fechamentos-20261115/latest/data-before.json `
  --snapshot=C:/dev/marcell-local-review/historico-fechamentos-20261115/snapshot-latest.json `
  --output=C:/dev/marcell-local-review/historico-fechamentos-20261115/latest `
  --years=2025,2026,2027
```

O teste da ferramenta cobre determinismo, repetição sem novas alterações, recusa de cópia desatualizada, referências externas, preservação de fatos e fechamentos, obras ausentes, alíquotas e divergência de memorial. Automatizar a identificação e a conferência é seguro neste escopo; decidir a natureza de recebimentos e transações sem comprovante continua dependendo de conferência financeira.

## Validação

- **582 testes selecionados aprovados**, zero falhas ou pulos: ferramenta local, finanças, DRE, memorial, fechamento, proteção de períodos fechados, histórico de funcionários e lotação. Não é uma nova execução da suíte completa do aplicativo.
- **32 cenários de navegador aprovados**, desktop/celular, sem falhas, pulos ou retentativas: DRE anual, memorial mensal/anual/congelado simulado, conciliação, folha e funcionários. As seis consultas de memorial agora verificam também a manutenção válida de R$ 100 e a ausência da cancelada de R$ 70, sem gravação financeira.
- Revisão visual de imagens do memorial em desktop e celular. Não foram criados componentes ou estilos locais.
- Build local via Vite, `lint`, `typecheck`, `design:check` e ajuda/manual aprovados. Manual com revisão de **15/11/2026**, **142 guias para 65 abas**. A ajuda explica cancelamentos, documentos históricos ausentes e a conferência dos recebimentos excedentes.
- Gzip final: **1.811.206 bytes**, limite mantido em **1.891.328**, margem de **80.122 bytes**. O ganho anterior permanece; nenhuma baseline de interface ou limite de bundle foi aumentado.
- Mapas do build conferidos contra o comando de funcionários e a ajuda atuais. Nenhuma migração, push, PR, deploy ou gravação na origem real. PostgreSQL descartável não foi reaberto nesta etapa; testes em memória e cenários simulados não certificam transações remotas.

Evidências locais em `artifacts/historico-fechamentos-20261115/`: `capture-summary.json`, `origin-check.json`, `regressions-before.json`, `regressions-after.json`, `unit-tests.json`, `browser-tests-final.json`, `summary.json`, `bundle-final.json`, `verification.json`, capturas e logs. Os dados detalhados ficam na pasta privada indicada acima; o verificador compara as duas capturas sem descartar a atualização externa.

## Próximas pendências do roadmap

1. **P1 — comprovar os dois recebimentos excedentes.** Usar as identificações da fila local e os comprovantes para decidir se há valor incorreto, crédito do cliente ou vínculo a corrigir. Aceite: explicação documentada, saldos conciliados e ausência de novo custo por pagamento. Sem evidência, nenhuma alteração automática de valor.
2. **P1 — conferir a fila bancária e os pagamentos sem origem.** Classificar por natureza e documento, respeitando os vínculos já existentes. Aceite: caixa conciliado, títulos corretos e cada custo reconhecido uma única vez.
3. **P2 — decidir o destino das cinco referências órfãs.** Recuperar a origem exata ou formalizar a preservação histórica. Aceite: nenhum vínculo por nome, nenhum documento perdido e orçamento/planejamento sem dupla interpretação.
4. **P2 — reaplicar a proposta de identificações sobre uma nova captura antes de eventual uso real.** A cópia saneada está pronta para revisão local, com mapa antes/depois; aplicação na origem não foi executada. Não substituir uma linha principal desatualizada.
5. **Fechamento — repetir a prévia após resolver os fatos comprovados.** Só então registrar fechamento pelo fluxo autorizado e conferir o memorial congelado. Não há fechamento real homologado nesta rodada.
