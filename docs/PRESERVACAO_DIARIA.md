# Preservação do pagamento por diária

## Decisão que esta revisão verifica

O pagamento por diária continua disponível. Cada funcionário pode manter a diária ou utilizar o salário mensal CLT, conforme a escolha registrada pelo RH. Os dois podem participar da mesma quinzena. Preencher um salário mensal no cadastro não converte, por si só, um funcionário que recebe por diária.

Esta revisão é local, sobre a árvore de trabalho de `codex/fulano-siclano-integracao`, cuja base é `900a6b1ff12dea5f308f2a7f7288c73f846468f6`. Também foi consultada a referência local `origin/main`, em `c7d4e777e7263b823bd2ce60797346ea69bca402`. Não houve atualização dessa referência pela rede nesta revisão, nem alteração de produção, do APK de produção ou dos dados remotos.

## Como as opções coexistem

| Situação do cadastro | Comportamento preservado |
| --- | --- |
| Cadastro antigo sem modalidade e sem vínculo informado | Continua no cálculo por diária. A edição do cadastro normaliza a modalidade como `daily`, sem inventar vínculo CLT. |
| Modalidade `daily`, sem vínculo CLT explícito | Continua na folha da quinzena por diária, com os apontamentos, descontos e exportações existentes. |
| Salário mensal preenchido, mas modalidade diária | O salário preenchido não muda a modalidade nem o cálculo da diária. |
| Modalidade `clt` mensal | O salário contratual alimenta o holerite. A diária de referência mantém sua função de custeio do ponto. |
| Mudança de modalidade ou de valores | Exige vigência e segue os históricos e as proteções de fechamento existentes; não converte automaticamente os demais funcionários. |
| Vínculo CLT definido explicitamente, com remuneração por diária | Continua sendo um empregado CLT por diária, que exige memória identificada de apuração. Essa combinação explícita não é atribuída aos registros antigos. |

O cadastro conserva os valores de diária e salário separadamente. Não foi introduzida conversão de diária em salário mensal, nem multiplicação por 26. A opção de diária permanece no seletor ao lado de `CLT mensal`.

## Evidência do percurso na mesma quinzena

O novo teste `src/domains/ponto/components/FolhaView.legacy-daily.test.jsx` usa dados inteiramente fictícios e as funções oficiais de cadastro e preparação/aprovação de folha. O cenário é executado duas vezes: com a modalidade ausente no cadastro antigo e com `remunerationMode: daily` explícito.

| Item | Resultado conferido |
| --- | --- |
| Período da folha | 21/09/2026 a 05/10/2026, a segunda quinzena do calendário já usado pelo app. |
| Funcionário por diária | 11 presenças em dias úteis × R$ 100,00 = R$ 1.100,00. |
| Adiantamentos antigos | R$ 150,00 integral e R$ 50,00 de uma parcela vencida no período; desconto total de R$ 200,00. |
| Líquido da diária | R$ 900,00. O salário mensal de R$ 2.800,00 preenchido no cadastro não interfere nesse valor. |
| Outro funcionário, CLT mensal | Salário contratual de R$ 3.300,00, demonstrativo confirmado e parcela identificada de R$ 700,00 na mesma quinzena. A parcela não é confundida com o salário integral. |
| Aprovação conjunta | Cria os dois títulos pelos valores de R$ 900,00 e R$ 700,00. |
| Histórico anterior | O título de R$ 500,00 já pago, seu pagamento e os custos arquivados continuam iguais. |
| Edição simples de cadastro | Alterar o telefone não muda os apontamentos nem os adiantamentos, e não cria histórico de vínculo CLT. |

O ensaio também verifica que o comando não modifica seu objeto de entrada. A comparação de histórico usa uma fotografia fictícia anterior; não constitui uma leitura dos registros reais da empresa.

## Ponto, folha e exportações

O teste monta o componente real `FolhaView` com os dois funcionários. A folha diária apresenta R$ 900,00 e somente o funcionário dessa modalidade. A apuração CLT fica nos caminhos próprios já existentes de holerite e preparação da quinzena.

Foram acionados os botões reais de PDF e Excel. O HTML destinado à impressão contém o funcionário por diária e R$ 900,00. A exportação Excel mantém as seis abas: `Folha`, `Resumo por Obra`, `Responsabilidade`, `Funcionario por Obra`, `Ponto Diario` e `Sindicato`. O valor líquido da linha da folha é R$ 900,00, e o espelho contém as 11 presenças do cenário.

O limite dessa prova é explícito: a montagem do relatório e de suas linhas usa o código real; a janela de impressão e a gravação do arquivo Excel são substituídas por dublês no teste. Não foi feita uma nova inspeção visual de um PDF impresso nem aberto um arquivo XLSX externo nesta revisão. Os testes existentes de ponto também passaram, abrangendo presença, meio período, falta, hora extra, benefícios, atraso, tolerância e valores congelados em arquivo.

## Adiantamentos e fechamento anterior

Os adiantamentos antigos, sem `paymentTitleId`, continuam sendo descontados conforme a data e as parcelas registradas. O teste confirma R$ 150,00 e R$ 50,00 na quinzena atual, mais a parcela de R$ 250,00 no período seguinte. Esses registros não recebem título financeiro novo nem exigem baixa retroativa.

A evolução já preparada para homologação tem uma diferença deliberada para **novas solicitações** de adiantamento: cria a obrigação no Financeiro, e o desconto só é liberado após pagamento confirmado. Isso não é uma migração dos adiantamentos antigos e não implica mudança na produção durante esta revisão.

As regressões existentes também verificam o bloqueio de alterações em períodos fechados, parcelas já compensadas, títulos antigos agregados e quinzenas arquivadas. A mudança de lotação não libera o cancelamento de um desconto protegido.

## Comparação do código

Não há diferença entre a árvore revisada e a base `900a6b1` nestes arquivos:

- `src/domains/financeiro/labor-cost-engine.js`
- `server/dre-projection.js`
- `src/domains/ponto/payroll.js`
- `src/domains/ponto/attendance-engine.js`
- `src/domains/ponto/permissions.js`
- `src/domains/rh/remuneration-mode.js`
- `src/domains/rh/remuneration-values.js`
- `src/LegacyApp.jsx`

Isso confirma que esta evolução de vínculo e interface não substituiu as fórmulas centrais de diária, custeio e DRE presentes na base analisada. O filtro novo da folha usa a classificação por modalidade ou vínculo CLT **explicitamente informado**; a ausência de vínculo não significa CLT.

A referência local `origin/main` é anterior à base `900a6b1`. Entre elas já existiam alterações de vigência dos valores, propagação da data ao cálculo e tolerância de atraso, com preservação da fotografia arquivada. Por isso, não se afirma que todo cálculo atual é idêntico ao `origin/main` anterior. Esses ajustes já estavam na base desta revisão, são cobertos pelas regressões de ponto e não retiram o pagamento por diária.

## Alteração feita nesta revisão

O texto do cadastro em `src/domains/rh/components/EquipeView.jsx` foi simplificado por orientação do responsável:

- No CLT mensal: **Diária de referência para custeio \***.
- Ajuda: **Usada no custo do ponto. O salário mensal define o holerite. Alterar a modalidade não recalcula folhas anteriores.**
- Na modalidade diária: o rótulo **Diária \*** foi mantido.

O texto anterior já distinguia salário e custeio. Essa edição é uma simplificação de linguagem; não corrige nem altera uma fórmula. O teste do editor confirma que escolher CLT mantém a diária em R$ 100,00 e o salário preenchido em R$ 2.800,00, sem gravar nem converter os valores apenas ao mudar o seletor.

## Comando e resultado de validação

```sh
npx vitest run \
  src/domains/ponto/components/FolhaView.legacy-daily.test.jsx \
  src/domains/ponto/components/FolhaView.test.jsx \
  src/domains/ponto/mixed-payroll.test.js \
  src/domains/ponto/payroll.test.js \
  src/domains/rh/employee-edit-draft.test.js \
  src/domains/rh/remuneration-mode.test.js \
  src/domains/rh/attendance-pay-mode.test.js \
  src/domains/rh/advance-commands.test.js \
  --maxWorkers=1 --reporter=dot
```

Resultado: **8 arquivos e 59 testes passaram**, em **14,53 segundos**. Antes da simplificação, os quatro casos de compatibilidade passaram e o teste do editor falhou somente por esperar o novo rótulo; depois da edição, os cinco casos novos passaram no conjunto acima. Os ajustes iniciais da fixture de teste foram a identificação fictícia da empresa e a API de mídia do navegador de teste.

Os registros locais da execução estão em `/tmp/rh-preservacao-diaria-red.log` e `/tmp/rh-preservacao-diaria-green.log`; são evidências temporárias, não requisitos de execução do aplicativo. O resumo da suíte geral consultado separadamente registrava 411 arquivos aprovados, 2 ignorados, 3.059 testes aprovados e 13 ignorados, antes desta simplificação de texto. A coordenação permanece responsável por relacionar o build final aos gates finais.

## Limites e próxima entrega

Não foi identificado bloqueio concreto que remova o caminho diário antigo nos consumidores examinados. Essa conclusão cobre o cenário e as regressões descritos, sem afirmar que todos os dados históricos de produção foram auditados.

Esta revisão não publica o frontend, não altera o backend remoto, não muda o ponto do APK e não gera transferência bancária. A atualização do texto precisa entrar no próximo build de homologação; a produção existente permanece sob o controle da coordenação. Reservas gerenciais de CLT e apuração fiscal continuam separadas do cálculo de diária, conforme o aceite registrado em `docs/ACEITE_OPERACIONAL_RH.md`.
