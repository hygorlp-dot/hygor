# Relatório executivo por obra — entrega local

Revisão: 02/11/2026. Consulta em Financeiro → Mais áreas → Previsões gerenciais → Relatório para diretoria. Perfis: administrador ou financeiro autorizado; obras limitadas ao acesso do usuário. Implementação e validação locais, sem publicação.

## Preparar e apresentar

1. Confira os cadastros nas origens: orçamento de controle, início da obra, custos apropriados por etapa, documentos, folha e equipamentos, ponto, diários revisados e compromissos do Planejamento. Identifique despesas ainda ausentes e arquivos não carregados.
2. Escolha **Obra da previsão** e **Data de referência da previsão**. **Todas as obras e empresa** compara as obras disponíveis; despesas da empresa sem rateio permanecem separadas e seu total aparece somente no recorte geral autorizado. Selecionar uma obra não expõe o agregado da empresa.
3. Defina **Início do relatório executivo**, até 12 competências mensais. Custos e receitas cobrem meses inteiros; pagamentos usam as datas exatas. O gasto acumulado começa na origem carregada, inclusive antes desse início.
4. Informe **Saldo inicial do caixa executivo (R$)** somente com saldo confirmado para as obras e a referência escolhidas. Sem saldo, entradas e saídas permanecem consultáveis; saldos e necessidade de cobertura ficam indisponíveis. A consulta não verifica o saldo no banco. Trocar obra ou referência exige reconfirmá-lo.
5. Confira o comparativo, resultado, evolução mensal e caixa de 13 semanas. Em **Obra do detalhamento executivo**, revise **Gastos incorridos por função** e **Gastos e pagamentos de terceirizados**, além de categorias, etapas, equipe prevista, indicadores, memória, títulos e pagamentos. Trate **Pendências para decisão** nas áreas de origem.
6. Use **Exportar relatório executivo CSV** ou **Preparar apresentação / PDF**. No documento, **Imprimir / salvar PDF** abre a impressão do navegador. Confira o arquivo antes de compartilhar. As exportações incluem todas as obras do recorte, independentemente da obra escolhida no detalhamento.

Filtros e premissas permanecem na sessão; recarregar ou sair os descarta. Consultar, exportar e imprimir não altera registros financeiros, ponto, diário, orçamento ou planejamento. Ajuda contextual: `fin_previsoes_executive`; fonte única em `src/features/help/help-content.js`, incluída no manual gerado.

## Conteúdo entregue

O relatório reúne comparativo da carteira, orçamento e estimativa por etapa, gastos acumulados por categoria e função, terceirizados por prestador e contrato, evolução mensal, resultado e margem realizados, caixa de 13 semanas, necessidade de equipe, indicadores e pendências. Anexos identificam os eventos de gasto, pagamentos e saldos de títulos. O documento de impressão usa o invólucro compartilhado MARCELL; o operador escolhe salvar o PDF no navegador.

O detector de design indicou um aviso informativo para `Arial` no HTML de impressão. É a alternativa de fonte do documento, sem introdução de outra identidade: o invólucro compartilhado `marcellReportHtml` aplica a fonte vigente **Nimbus Sans**, incorporada, com prioridade no corpo e conteúdo do relatório. Mantida a receita existente de impressão, sem alterar DESIGN, padrão compartilhado ou baseline para suprimir o aviso.

O CSV contém 17 seções: **Recorte**, **Carteira**, **Categorias**, **Funções**, **Terceirizados**, **Evolução pessoal**, **Comparação pessoal**, **Etapas**, **Evolução**, **Caixa**, **Equipe**, **Indicadores**, **Produtividade**, **Gastos**, **Pagamentos**, **Títulos** e **Pendências**. Inclui versões, referência, fontes e limites; valores monetários são reais e proporções usam escala de zero a um. Não são 17 arquivos separados. Gastos são acumulados; pagamentos correspondem ao intervalo por data; títulos representam a posição na referência. A exportação reutiliza `safeReportText`, neutralizando texto que possa iniciar fórmula na planilha, inclusive após espaços iniciais.

## Cálculos e interpretação

| Informação | Regra e cuidado |
| --- | --- |
| Incorrido | Custo líquido, com estornos negativos, por competência até o mês da referência. Categorias e etapas agrupam os mesmos fatos. |
| Custo do período | Competências mensais inteiras entre início e referência. Não aplicar um corte diário a esse total mensal. |
| Pagamentos | Saídas nas datas efetivas. Pagamento direto pelo cliente ao fornecedor fica separado do caixa da empresa. Não acrescentar pagamentos ao custo incorrido. |
| Despesas da empresa | Custos sem obra no período, sem rateio automático. Agregado disponível somente no recorte geral autorizado; omitido no recorte individual, inclusive CSV e PDF. |
| Custo final | Incorrido + restante + reserva de risco + mudanças adicionais. Compras ainda não faturadas já compõem o restante; pedidos, notas, pagamentos e recebimento físico não são parcelas para somar novamente. |
| Base confiável | Exige orçamento de controle com itens válidos, início válido no calendário e valores e totais em centavos inteiros seguros. Orçamento vazio, revisões com base alterada ou etapas removidas, restante inferior às compras pendentes e divergência entre memória e custo impedem usar o total. Gastos ou compras sem etapa exigem apropriação ou revisão válida explícita de Sem apropriação, pois a referência automática pode sobrepor o orçamento. Os registros de origem não são apagados ou alterados pela consulta. |
| Total da carteira | Se alguma obra tiver custo final indisponível, o custo final e o desvio totais ficam indisponíveis. O subtotal das obras calculáveis aparece explicitamente; não representa a carteira inteira. |
| Resultado e margem | Resultado = receita reconhecida − custo do período; margem = resultado / receita positiva. Não estima receita contratual futura nem lucro final do contrato. |
| Caixa | Treze intervalos de sete dias, somente títulos existentes. Vencidos, títulos sem data e além do horizonte ficam separados. Folha futura, tributos e serviços sem obrigação cadastrada não são projetados automaticamente. |
| Equipe | Dimensionamento paramétrico com ponto, produção revisada, jornada e calendário integrado. Última presença observada não confirma disponibilidade futura. Serviços sem base ficam pendentes; custo de mão de obra dessa consulta não é acrescentado ao custo final. |

## Gastos por função e terceirizados

Em **Obra do detalhamento executivo**, selecione a obra. **Gastos da equipe própria por função** mostra a tabela **Gastos incorridos por função**: pedreiro, ajudante e demais funções presentes na apuração, com **Mão de obra e encargos**, **Benefícios**, **Total incorrido** e **Base**. São gastos acumulados por competência até o mês da referência, obtidos pelo mesmo cálculo do demonstrativo de resultado (DRE). Encargos e benefícios já integram os gastos por categoria; esse detalhamento não é outra parcela do custo.

A função usa o registro histórico do dia quando disponível e, na falta dele, o cadastro atual. Por isso, alterar o cadastro pode mudar a classificação de dias sem função histórica. Arquivos históricos sem discriminação e outros lançamentos de pessoal sem função ficam em linhas explícitas, em vez de serem atribuídos a pedreiros ou ajudantes. O rateio dos centavos preserva a soma acumulada; **Conferência por função** compara o detalhamento com a mão de obra e os benefícios no razão. Diferenças permanecem identificadas para revisão da origem. **Previsão executiva de mão de obra**, abaixo, estima a necessidade e o custo restantes; não representa o gasto realizado.

**Terceirizados por prestador e contrato** mostra **Gastos e pagamentos de terceirizados**, com prestador, contrato e especialidade. **Incorrido acumulado** reúne medições e documentos reconhecidos até a competência de referência; uma nota vinculada à medição não cria custo em dobro. **Pago no período** e **Cliente direto no período** correspondem às datas do intervalo do relatório; **Saldo a pagar** representa a posição na referência. Não some essas colunas: elas descrevem custo, pagamento e obrigação dos mesmos fatos, em cortes diferentes.

Contratos cadastrados sem custo reconhecido permanecem visíveis com **Sem custo reconhecido nas fontes**. Isso não comprova gasto real zero: confira medições, documentos e seus vínculos na área Terceirizados. Sem contrato ou evento carregado, a consulta explica a falta de base. CSV e apresentação / PDF incluem os dois detalhamentos para todas as obras do recorte, mesmo quando a tela mostra outra obra.

## Indicadores para a diretoria

- **Avanço ponderado:** medição acumulada com peso do orçamento; exige cobertura integral para divulgar o total.
- **PPC:** percentual de compromissos cumpridos no prazo, em semanas completas verificadas. Bloqueados ficam separados, conforme a política explícita do Planejamento. Entrega posterior ao prazo não comprova cumprimento no prazo.
- **Cobertura dos diários:** diários revisados em relação aos dias com presença confirmada; não mede todos os dias planejados da obra.
- **Apropriação de horas:** horas vinculadas válidas em relação às horas completas do ponto.
- **CPI:** índice de eficiência de custo = valor agregado / custo incorrido. Valor agregado = orçamento × avanço físico comparável. Disponível somente no último dia do mês, com medição integral, mesmo orçamento e escopo físico/financeiro, custo completo reconciliado, incorrido positivo e sem gasto sem etapa. A revisão de Sem apropriação pode liberar o custo final, mas não comprova escopo físico comparável para o CPI. Abaixo de 1 indica custo superior ao valor agregado. Não usar o índice quando essas condições faltarem.
- **SPI:** índice de eficiência de prazo = valor agregado / valor planejado compatível. Indisponível nesta entrega, pois falta essa linha de base; o calendário não a substitui.
- **RUP:** soma das horas-pessoa / produção aceita dos mesmos dias válidos, preservando horas com produção zero. Para cada função, a produção entra somente nos dias em que essa função tem horas apropriadas maiores que zero. Datas da amostra e vínculos ao ponto seguem o mesmo recorte por função; a produção de dias em que ela esteve ausente não reduz sua RUP nem a equipe prevista. A comparação usa o período anterior de mesma duração. Não somar produção compartilhada entre funções ou unidades diferentes.
- **Dispersão:** desvio amostral usa n−1; coeficiente de variação é desvio / média diária positiva. Exigem dois dias com produção. São estatísticas descritivas, sem comprovação de capacidade preditiva.

## Limites e continuação

A base é a atualmente carregada e corrigida no ERP. A data de referência não reconstitui o que era conhecido naquele dia, nem recupera automaticamente arquivos históricos. O título “Todos os gastos registrados” identifica os eventos presentes nessa base; não certifica integralidade documental ou contábil. Ausência de fonte ou resultado indisponível não significa zero.

As próximas fontes são conciliação histórica, custos indiretos, contratos e entregas por item, escalas e ausências futuras, horas de terceiros e desembolsos da folha sem duplicar títulos. Depois, preservar dados e premissas conhecidos em cada referência, comparar previsto e observado sem informação futura e medir erro, viés e cobertura. Somente após essa avaliação cabe estudar modelos probabilísticos, intervalos, P50/P80 e calibração. Não há previsão estatística validada ou probabilidades nesta entrega.

Referências metodológicas: [GAO — Cost Estimating and Assessment Guide](https://www.gao.gov/assets/gao-20-195g.pdf), [NSF — Earned Value Management](https://www.nsf.gov/od/ori/evm-gold-card) e [Lean Construction Institute — glossário](https://leanconstruction.org/glossary/). As condições de cobertura, os cortes mensais e as exclusões acima são regras explícitas da implementação.

## Conferência local

Revisar desktop, celular, teclado e tabelas longas; comparar memória, CSV e impressão para o mesmo recorte. Verificar obra com base válida, revisão antiga, orçamento inválido, mês parcial, carteira com obra pendente, saldo ausente, estorno, cliente direto e despesa da empresa sem obra. Ajuda e manual foram atualizados por mudança de fluxo e critérios, não apenas por mudança visual. Resultados dos comandos de validação devem acompanhar a entrega; este roteiro não constitui evidência de execução.

A regressão de produtividade separa dois dias e duas funções: pedreiro com 100 unidades e 8 horas-pessoa em um dia; ajudante com 50 unidades e 8 horas-pessoa em outro. As razões esperadas são, respectivamente, 0,08 e 0,16 hora-pessoa por unidade. A produção de um dia não integra a amostra da função ausente; a previsão automática usa datas e ponto das mesmas amostras. Isso verifica a independência das funções, sem tratar os valores fictícios como referência real de produtividade.

### Demonstração isolada anterior — porta 4226

No PowerShell, iniciar na raiz deste checkout:

```powershell
$env:MARCELL_DAILY_PORT='4226'
$env:MARCELL_EXECUTIVE_DEMO='1'
node scripts/daily-production-preview.mjs
```

Abrir `http://127.0.0.1:4226`. Perfis fictícios: financeiro `piloto@local.test` e engenharia `engenharia@local.test`, ambos com senha `piloto-local`. Não há conexão com produção; gravações financeiras são bloqueadas. Diários fictícios podem mudar somente na memória; reiniciar descarta alterações.

Ao iniciar esse modo, o servidor prepara revisões de custo fictícias válidas para a obra de demonstração na referência **02/11/2026**, com orçamento de **R$ 120 mil**. Cada linha registra orçamento, base, referência e identificação da base (`fingerprint`). A revisão reconhece que o pessoal incorrido sem etapa já está contemplado no orçamento da etapa; o restante corresponde ao orçamento menos todo o incorrido, com restante zero em Sem apropriação, evitando soma repetida. Trata-se de premissa sintética para testar a apresentação, sem valor de estimativa real. Outras obras continuam pendentes no recorte geral.

Mudar a referência ou reabrir/alterar registros de origem pode invalidar essas revisões; o total deve então ficar indisponível até nova conferência. A demonstração não substitui testes dos bloqueios ou validação de dados reais. O reset local repõe a fixture original; reiniciar o servidor recompõe as revisões sintéticas desse modo.

## Evidências da etapa anterior — 02/11/2026

Os registros abaixo pertencem à entrega anterior ao detalhamento por função e terceirizado. Não constituem validação das duas novas tabelas; os resultados dessa alteração devem ser registrados após a execução correspondente.

- **Testes automatizados:** 82 testes em nove arquivos aprovados, registrados em `executivo-tests.log`.
- **Navegador:** 12 casos aprovados: dois do relatório executivo em desktop de 1440 px e celular de 390 px, um na largura de 1700 px usada pelo usuário, três regressões das previsões existentes e seis casos de integração diária.
- **Verificações do projeto:** lint, TypeScript e build local aprovados. O build mantém o aviso existente de tamanho de chunk. Manual gerado e sincronizado: 105 guias cobrem 65 abas.
- **Design:** um aviso informativo de Arial, justificado acima pela aplicação prioritária de Nimbus Sans no invólucro MARCELL. DESIGN, padrão de interface e baselines preservados.
- **Impressão:** `relatorio-diretoria-alameda.pdf` gerado com seis páginas; todas renderizadas e abertas para inspeção, com imagens `artifacts/executivo/pdf-page-1.png` a `pdf-page-6.png`.
- **Revisão independente:** código e evidências de tela revisados, com conclusão favorável à entrega local. O revisor não executou novamente os testes nem mediu contraste de forma independente.

A demonstração local na porta 4226 foi deixada no relatório de Alameda, com início em **01/10/2026**, referência **02/11/2026** e saldo inicial fictício de **R$ 5.000**. Na base sintética, o incorrido observado é **R$ 24.720**, o custo final planejado é **R$ 120.000** e o menor saldo do caixa é **−R$ 6.000**. Esses valores conferem o funcionamento da consulta e de sua apresentação; não representam fechamento contábil, estimativa real aprovada ou validação preditiva.

Entrega restrita ao checkout e aos dados locais, sem publicação, push ou deployment. A validação cobre os fluxos exercitados e as condições documentadas; não certifica integralidade dos registros reais nem capacidade estatística das previsões.

## Nova conferência do detalhamento

A nova demonstração deve usar a porta **4228**, com `MARCELL_DAILY_PORT=4228` e `MARCELL_EXECUTIVE_DEMO=1`, preservando a sessão anterior na porta 4226. O acesso fictício continua `piloto@local.test`, senha `piloto-local`. A base inclui pedreiros e ajudantes com custos diferentes e contrato elétrico com medição e pagamento parcial para permitir a comparação entre funções, custo reconhecido e pagamento. Esses exemplos são sintéticos; confira os valores na fixture e nos relatórios antes de registrar evidências.

Revisar as novas tabelas no computador e no celular, bem como as seções **Funções** e **Terceirizados** do CSV e a apresentação / PDF. Conferir conservação de centavos, encargos e benefícios, função histórica e cadastro atual, histórico sem função, outros lançamentos sem função, contrato sem medição, medição com nota vinculada, pagamentos diretos do cliente e os cortes diferentes de custo, pagamento e saldo. Este roteiro não afirma que os testes foram executados.

## Evidências do detalhamento por função e terceirizado — 02/11/2026

Esta alteração amplia a consulta operacional existente, preservando a direção MARCELL de `DESIGN.md`, o contrato de `docs/PADRAO-INTERFACE.md`, os componentes compartilhados e as baselines vigentes. Não requer nova direção visual nem exceções locais. A ajuda contextual e o manual explicam as novas tabelas e seus cortes; a revisão final não encontrou inconsistência que exigisse outra mudança nas instruções ao operador.

- **Testes automatizados:** `funcoes-tests.log` registra 125 testes aprovados em sete arquivos, abrangendo motor de mão de obra, motor de cálculos, demonstrativo de resultado, projeção da folha, detalhamento por função e terceiros, relatório executivo e espaço de trabalho.
- **Navegador:** `funcoes-e2e.log` registra três casos aprovados, nas larguras de 1440, 390 e 1700 px. As verificações incluem pedreiro de **R$ 3.360**, ajudante de **R$ 2.520** e terceiro com **R$ 3.000** incorridos, **R$ 1.200** pagos no período e **R$ 1.800** a pagar, além de consulta, CSV, apresentação, ajuda e preservação dos filtros, sem comandos de gravação financeira.
- **Projeto e manual:** `funcoes-lint.log`, `funcoes-types.log` e `funcoes-build.log` registram lint, TypeScript e build local aprovados. O build mantém o aviso de chunks acima de 650 kB. O manual está sincronizado: 105 guias cobrem 65 abas.
- **Apresentação / PDF:** o novo `artifacts/executivo/relatorio-diretoria-alameda.pdf` contém sete páginas. Todas foram renderizadas e abertas na revisão visual; a página 3 apresenta as funções e os terceirizados. As imagens correspondem a `artifacts/executivo/pdf-page-1.png` até `pdf-page-7.png`.
- **Design e revisão independente:** o detector mantém um aviso informativo de Arial como alternativa de fonte; o invólucro compartilhado aplica Nimbus Sans incorporada prioritariamente. A revisão independente de código, registros e evidências de tela não identificou correção material necessária para esta entrega local. Não houve medição independente de contraste nem repetição dos testes pelo revisor.

A nova demonstração na porta **4228** ficou no relatório de **Alameda**, com início em **01/10/2026**, referência **02/11/2026** e saldo inicial fictício de **R$ 5.000**. O incorrido sintético de **R$ 26.880** corresponde a **R$ 18.000** de materiais, **R$ 5.880** de equipe própria e **R$ 3.000** de terceiro. O custo final condicional de **R$ 120.000** depende da revisão fictícia preparada para essa referência. A demonstração anterior na porta 4226 foi preservada.

Esses registros verificam os fluxos e valores exercitados na base fictícia. Não comprovam fechamento contábil, integralidade de todos os gastos reais de terceiros ou capacidade preditiva. Contrato sem custo reconhecido continua indicando ausência de reconhecimento nas fontes carregadas, sem comprovar gasto real zero. A entrega permanece local, sem push, pull request ou deployment.


## Evolução e comparação dos custos de pessoal — 02/11/2026

Na obra escolhida em **Obra do detalhamento executivo**, abra **Evolução e comparação dos gastos por função** e **Evolução e comparação dos gastos por terceirizado**. As tabelas mostram **Evolução mensal por função**, **Evolução mensal por terceirizado** e a comparação dos respectivos custos entre o período selecionado e o mesmo número de competências imediatamente anteriores. Por exemplo, outubro a novembro é comparado com agosto a setembro. O intervalo usa competências mensais inteiras, inclusive quando o início informado cai no meio do mês.

A equipe própria inclui mão de obra, encargos e benefícios já reconhecidos nas categorias do relatório. Terceirizados usam o custo reconhecido por prestador e contrato, sem acrescentar pagamentos nem duplicar a nota vinculada à medição. Essas tabelas reorganizam os mesmos gastos e não são parcelas adicionais do custo acumulado ou final.

Sem registros para uma função ou terceiro em um dos períodos, o total desse período fica indisponível (`null` no cálculo), em vez de ser presumido zero. Um custo líquido registrado de zero, inclusive por estorno, continua sendo um valor conhecido. **Diferença** e **Variação** exigem referência no último dia do mês e valores nos dois períodos; a variação percentual também exige total anterior positivo. Em referência intermediária, os custos aparecem como provisórios e a comparação fica indisponível. Encerramento no calendário não comprova fechamento contábil. A mudança de gasto não demonstra economia ou ganho de produtividade; compare equipe, produção, escopo e qualidade das fontes.

O CSV inclui **Evolução pessoal** e **Comparação pessoal**, totalizando 17 seções no mesmo arquivo. Os períodos, a situação e os eventos de origem acompanham a comparação; variações relativas mantêm escala de zero a um. A apresentação / PDF inclui evolução e comparação para todas as obras do recorte, independentemente da obra mostrada no detalhe da tela. Ajuda contextual `fin_previsoes_executive` e manual foram revisados para esse fluxo; a data da fonte única permanece **02/11/2026**.

Esta extensão usa os componentes e receitas existentes: Button, Input, Select, FilterBar, Alert, tabelas com região rolável e blocos expansíveis. Cores e tipografia continuam no registro de temas e em `foundations.js`; a impressão mantém o invólucro `marcellReportHtml`. `DESIGN.md` e `.impeccable/design.json` foram consultados e preservados, pois não há nova direção visual nem token ou componente de sistema introduzido. `PRODUCT.md` não está presente neste checkout; não foi criado para esta extensão. O sidecar histórico e a documentação de temas já possuem diferenças anteriores; não foram reescritos para legitimar a alteração. O Arial de reserva do HTML impresso continua subordinado à Nimbus Sans incorporada pelo invólucro, conforme a receita existente.

A demonstração desta etapa continua local na porta **4228**, sem push, pull request ou deployment. Conferir no computador e celular, teclado, exportação e impressão: meses iguais consecutivos, mês parcial, referência no último dia, ausência de base, anterior zero ou negativo, estornos e consistência de centavos e origens. Este registro descreve o comportamento e o roteiro de revisão; não declara execução de testes, build ou revisão visual desta etapa. As evidências anteriores acima continuam restritas às entregas que identificam.


Validação da evolução mensal (02/11/2026): `evolucao-tests.log` registra 28 testes aprovados em três arquivos; `evolucao-e2e.log`, três cenários aprovados em 390, 1440 e 1700 px, incluindo expansão dos quadros, exportação e ausência de gravações financeiras. Typecheck e build local direto do Vite aprovados (`evolucao-types.log`, `evolucao-build.log`); build mantém o aviso existente de chunks grandes. Detector da tela sem achados (`evolucao-design.json`). PDF atualizado com oito páginas renderizadas, sem cortes nas tabelas novas, e revisão independente com disposição `ship`, sem correções materiais. Ajuda e manual: 105 guias e 65 abas sincronizados. A tentativa de retomar a aba já aberta pela automação encontrou indisponibilidade da integração do navegador; a validação automatizada do app foi concluída em sessões isoladas e a porta 4228 permanece ativa, sem recarregar a sessão do usuário.

## Revisão dos alinhamentos — 02/11/2026

O contexto de Previsões gerenciais e o recorte do relatório executivo passam a alinhar seus campos pelo início: a descrição da data deixa de deslocar o campo Obra para baixo. Input e Select usam a mesma altura de densidade da receita central, preservando a altura mínima de toque. Cabeçalhos e células textuais das tabelas executivas se alinham à esquerda com quebra de conteúdo; os números continuam à direita. A opção de alinhamento pertence a FilterBar e mantém o padrão das demais telas.

Escopo estritamente visual e local, sem mudança de cálculo, filtro aplicado, fluxo, rótulo, permissão ou resultado financeiro. Revisados os guias `fin_previsoes` e `fin_previsoes_executive` na fonte única `src/features/help/help-content.js`: os controles e passos descritos continuam corretos, sem necessidade de acrescentar instruções sobre apresentação. A data de revisão permanece **02/11/2026**. `npm run manual:generate` regenerou o manual e `npm run manual:check` confirmou a sincronização: **105 guias cobrem 65 abas**. Não houve push, pull request ou deployment nesta revisão.

Validação do alinhamento: cinco cenários do relatório aprovados nas larguras 390, 768, 1440, 1470 e 1700 px, medindo igualdade dos topos e alturas de cada par de controles no desktop, tolerância de 1 px. Quatro cenários de regressão em Compras/Financeiro e troca de temas aprovados em desktop/celular. Typecheck, build local e lint aprovados. Ajuda/manual sincronizados, sem mudança de instruções operacionais. Revisão independente: ship no escopo dos alinhamentos, sem achados materiais. Evidências: artifacts/alinhamento-e2e.log, alinhamento-themes.log, alinhamento-types.log, alinhamento-build.log, alinhamento-lint.log e artifacts/executivo/alinhamento-*.png. Sem publicação nesta revisão.

## Resumo do CEO e conferência por seção — 02/11/2026

O relatório abre em **Resumo do CEO**. Os três totais ficam próximos da cobertura do custo final, da contagem de avisos e da ressalva de que os dados carregados não comprovam integralidade dos registros. A mesma entrada mostra a referência, o alcance do acumulado, a necessidade máxima de cobertura e o menor saldo diário das 13 semanas. Sem saldo inicial confirmado para o recorte, saldos e cobertura permanecem indisponíveis. Sem avisos detectados no cálculo não significa fechamento contábil nem aprovação das fontes.

**Obra e referência** e **Ajustar período e saldo** ficam recolhidos na entrada válida, conservando os controles existentes para conferir e mudar o recorte. **Seções do relatório executivo** oferece Resumo do CEO, Caixa, Custos e Execução; no celular usa o seletor compartilhado. Trocar de seção conserva os valores e o detalhe da obra. A memória semanal fica em **Conferir as 13 semanas do caixa**. Essa organização reduz o conteúdo inicial sem retirar as tabelas de conferência.

**Conferir pendências** abre **Pendências para decisão**, com contagem e agrupamento por obra e área. Cada item mostra a pendência e a providência sugerida nas áreas reais do app; data e registro aparecem quando a fonte os oferece. A ausência dessas informações continua identificada. Avisos gerais de cobertura não passam a ter uma origem individual presumida. O relatório não corrige os avisos automaticamente e a sugestão não substitui conferir o documento, ponto, diário, planejamento ou revisão de custos na origem.

Caixa explicita competências mensais inteiras para custos e receitas e datas exatas para pagamentos e recebimentos realizados. Gastos por categoria, função e etapa são acumulados até a competência da referência; o início escolhido não elimina os fatos anteriores desse acumulado. A comparação de pessoal mantém suas condições de disponibilidade e mês parcial já documentadas. A organização da consulta e o agrupamento dos avisos não introduzem novos cálculos financeiros.

As ações **Exportar relatório executivo CSV** e **Preparar apresentação / PDF** ficam no Resumo do CEO e mantêm todas as obras do recorte, independentemente da seção consultada ou da obra no detalhe. O CSV conserva 17 seções; Pendências passa a conter Obra, Área, Data, Registro, Pendência e Providência. A apresentação inclui a cobertura e os limites no início e a tabela de pendências e providências, sem depender dos blocos abertos na tela. Consultar, exportar e imprimir não grava registros.

Os guias `fin_previsoes` e `fin_previsoes_executive` foram revisados na fonte única `src/features/help/help-content.js`, com data **02/11/2026**. `npm run manual:generate` concluiu a geração de 105 guias e `npm run manual:check` confirmou **105 guias cobrindo todas as 65 abas**. Estes são os comandos verificados nesta revisão documental; testes funcionais, build e inspeções de navegador pertencem às respectivas evidências da implementação e não são presumidos por este registro.

`DESIGN.md`, `.impeccable/design.json`, `docs/PADRAO-INTERFACE.md`, `foundations.js`, o CSS das tabelas e os componentes do relatório foram consultados. A extensão reutiliza a paleta dos temas, a escala de títulos/corpo/rótulos e espaçamentos compartilhados, a navegação por seções, Alert, Button, Input, Select, FilterBar e detalhes expansíveis. Não cria sistema visual, tokens ou baselines; DESIGN e sidecar foram preservados. Diferenças históricas do registro visual, incluindo entradas de tipografia e canvas e o sidecar anterior à direção operacional, não foram transformadas em novas regras nem corrigidas neste escopo. Trabalho restrito ao checkout local, sem push, pull request ou deployment.

Validação desta entrega: 31 testes aprovados em quatro arquivos (decisões, relatório, componente e custos por função); quatro cenários de navegador aprovados em 390, 768, 1440 e 1470 px, cobrindo seções, recortes, preservação de premissas, pendências com datas/registros, caixa expansível, CSV, PDF e ausência de gravação financeira. Lint, tipos e build local aprovados. Detector dos dois JSX sem achados. PDF completo de nove páginas renderizado e conferido. Revisão independente: ship no escopo das quatro melhorias, sem correções materiais. Ajuda/manual: 105 guias e 65 abas sincronizados. Exemplo local da Residencial Alameda aberto em aba nova na porta 4228, Resumo do CEO, referência 02/11/2026, início 01/10/2026 e saldo fictício confirmado de R$ 5.000,00; cobertura R$ 6.000,00. As abas anteriores foram preservadas. Capturas e logs artifacts/ceo-summary-*, artifacts/executivo/ceo-*. Nenhuma publicação ou alteração de dados reais foi realizada.


## Adequação ao padrão compartilhado — 02/11/2026

Após a revisão de design, o relatório usa PageHeader com o título **Relatório executivo por obra**, sem descrição redundante, e o botão secundário **Exportar relatório** no cabeçalho. Esse botão abre o Popover compartilhado com **Exportar relatório executivo CSV** e **Preparar apresentação / PDF**; o painel fecha depois da escolha. A exportação fica disponível em Resumo do CEO, Caixa, Custos e Execução quando o recorte é válido; não é necessário voltar ao resumo para exportar. A indicação anterior de que as ações ficavam apenas no Resumo do CEO foi superada por este ajuste. As exportações continuam abrangendo todas as obras do recorte, sem mudança dos cálculos ou de seu conteúdo.

Os três indicadores reutilizam SummaryCard com rótulo e valor, sem detalhes repetidos, mantendo o resumo compacto no celular. **Conferir pendências** permanece na barra de ações existente; **Obra e referência** e **Ajustar período e saldo** usam a receita expansível do Financeiro. Na área executiva, o título e a descrição redundantes de Previsões gerenciais deixam de se repetir; a identificação acessível da área é preservada. O CSS do Financeiro restringe sua regra de grade aos cabeçalhos que não são PageHeader, permitindo que o cabeçalho compartilhado aplique sua própria composição.

Revisados os guias `fin_previsoes` e `fin_previsoes_executive` em `src/features/help/help-content.js`, com data **02/11/2026**, para informar o título e a posição das exportações. As demais instruções continuam correspondendo aos controles e resultados existentes. `DESIGN.md`, `.impeccable/design.json` e `docs/PADRAO-INTERFACE.md` foram consultados junto de PageHeader, SummaryCard, Popover, `foundations.js`, `themeRegistry.js`, `module-standard.css` e os componentes/CSS do relatório. Esses documentos foram preservados: o ajuste aplica receitas existentes, sem novos tokens, escalas, regras de sistema ou baseline. Diferenças históricas de tipografia, canvas e sidecar não foram canonizadas nem reparadas neste escopo. A entrega permanece local, sem push, pull request ou deployment.

Validação documental desta adequação: `npm run manual:generate` concluiu a geração de 105 guias e `npm run manual:check` confirmou **105 guias cobrindo todas as 65 abas**. Esta revisão documental não executou testes funcionais, build ou inspeção de navegador; não atribui à adequação visual os resultados históricos acima.


## Inadimplência, compromissos e variação de custo — 02/11/2026

A fase 1 do [roadmap de indicadores](ROADMAP-INDICADORES-FINANCEIROS-20261102.md) está implementada localmente e em validação. **Sinais financeiros da carteira**, no Resumo do CEO, reúne saldo vencido, percentual sobre saldos datados, compras a faturar e CV com cobertura de obras comparáveis. **Caixa** inclui **Posição da inadimplência** e **Conferir atrasos e títulos a receber**, com faixas de atraso e memória dos recebíveis. **Custos**, para a obra escolhida em **Obra do detalhamento executivo**, inclui **Compromissos financeiros da obra**, **Conferir compras a faturar** e **Variação de custo por valor agregado**.

Atraso usa o saldo residual aberto com vencimento anterior à referência; vence hoje e futuro não entram como vencidos. O percentual divide os vencidos por todos os saldos abertos com vencimento válido, incluindo futuros; sem base positiva fica indisponível. Sem data válida fica separado, sem classificação presumida de adimplência. Faixas: 1–30, 31–60, 61–90 e mais de 90 dias. A posição vem dos registros carregados, sem reconstruir o conhecimento histórico da equipe.

Compras a faturar vêm da seleção de compromissos do razão na referência, separadas dos títulos a pagar. Não são um novo gasto a somar ao incorrido ou ao custo final: compras pendentes já são consideradas no restante conforme o critério de Custos por etapa. A posição não comprova todos os compromissos futuros e não cobre integralmente contratos sem medição, folha futura e serviços sem obrigação cadastrada.

CV é valor agregado menos custo incorrido; negativo indica custo acima do valor agregado, positivo não comprova lucro. Reutiliza os critérios conservadores da base do CPI: mês encerrado, medição integral e orçamento e custos comparáveis e conciliados. O CV da carteira exige todas as obras comparáveis. VAC é orçamento menos custo final previsto; negativo indica previsão acima do orçamento e seu sinal é inverso ao de Desvio previsto. Falta de base fica indisponível, com motivo. O CV monetário é diferente do coeficiente de variação nas estatísticas de produtividade.

O CSV passa de 17 para **20 seções**, com **Inadimplência**, **Compromissos** e **Variação custo**. Apresentação/PDF deve manter esses quadros, as origens e os mesmos limites, para todas as obras do recorte. O conteúdo do guia `fin_previsoes_executive` foi revisado com data **02/11/2026**, incluindo preparação, sequência real dos controles, interpretação e cuidados. O manual é gerado da mesma fonte. Consultar, exportar e imprimir continua sem gravar registros; nenhuma nova tabela de banco, migração ou permissão é introduzida.

Revisão documental do sistema: `DESIGN.md`, `.impeccable/design.json`, `docs/PADRAO-INTERFACE.md`, `foundations.js` e os componentes do relatório foram consultados. A extensão mantém paleta semântica dos temas; escala comum de títulos de 24 px, seções de 18 px e corpo/controles de 14 px; espaçamento e alvo de toque compartilhados; tabelas roláveis, Alert, Button, Input, Select, FilterBar e detalhes expansíveis existentes; impressão pelo invólucro MARCELL. Não surgem tokens ou regras de sistema. DESIGN e sidecar permanecem preservados. Diferenças históricas de tipografia/canvas e do sidecar anterior aos temas vigentes não são canonizadas nem reparadas nesta extensão.

Este registro descreve implementação e critérios de revisão, sem atribuir a esta fase resultados históricos de testes, build ou navegador. Conferir limites de faixas, saldos parciais, sem vencimento, ausência de base, compromissos parcialmente faturados, sinais CV/VAC, obra não comparável, desktop/celular, teclado, CSV/PDF e preservação dos filtros. As evidências finais pertencem à validação da entrega. Trabalho restrito ao checkout local, sem push, pull request ou deployment.

Fase financeira validada localmente: 32 testes, quatro cenários de navegador, lint, tipos, build, detector e revisão independente concluídos. PDF de dez páginas conferido. Demonstração na porta 4232, Caixa da Residencial Alameda, com saldos fictícios e nenhuma conexão de produção. Evidências e roteiro completo no roadmap ROADMAP-INDICADORES-FINANCEIROS-20261102.md. Sem publicação.


## Continuação local — prazo por obra, 02/11/2026

O resumo passa a incluir Sinais de prazo por obra. Em Execução, Prazo da obra reúne vencidas com saldo confirmado, vencidas sem medição, conclusões, próximas entregas, cobertura do diário e desvio das datas contra a fotografia salva. O detalhe identifica atividades, marcos e semanas verificadas. CSV passa a 23 seções; apresentação/PDF inclui os mesmos registros. Consulte `INDICADORES-PRAZO-LOCAL.md` para critérios, demonstração e validação. PV/SPI continuam dependentes de governança de linha de base; esta entrega não infere valor planejado de datas ou custo real.
