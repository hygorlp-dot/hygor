# Roadmap de previsões gerenciais MARCELL

Solicitação de 01/11/2026, ampliada em 02/11/2026: implementar localmente caixa de 13 semanas, custo final por obra, previsão de mão de obra, indicadores e relatório para a diretoria. Preservar o padrão MARCELL e revisar ajuda/manual. Sem publicação.

## Sequência e critérios de aceite

| Etapa | Entrega | Critério de aceite |
| --- | --- | --- |
| 1 — base verificável | Financeiro → Mais áreas → Previsões gerenciais, com cinco consultas (três previsões, Indicadores da obra e Relatório para diretoria) | Filtros e premissas preservados na sessão; memória e exportação CSV; fontes e indisponibilidades explícitas; nenhuma gravação financeira |
| 1A — caixa | 13 períodos consecutivos de 7 dias a partir da referência; entradas, saídas, saldo, menor saldo diário e necessidade de cobertura | Motor canônico de títulos; liquidações abatidas uma vez; saldo inicial explícito e restrito à obra/conta/data; vencidos e sem data separados; atraso de recebimentos como cenário |
| 1B — custo final | Carteira e detalhe por etapa: orçamento, custo incorrido, compras pendentes, restante, risco, impactos adicionais e custo final | Reutilizar o motor de custos; não somar pedidos/notas/pagamentos em duplicidade; comparar revisões e avisar bases antigas; custo total indisponível quando faltar base relevante |
| 1C — mão de obra | Serviços e funções, quantidades restantes confirmadas, produtividade histórica informada ou referência declarada, calendário e equipe disponível | Horas-pessoa, histograma de 13 semanas, necessidade por função, capacidade e déficit; custos apenas com preço informado; cálculo por serviço auditável; nenhuma alteração em ponto/folha |
| 1D — diretoria | Comparativo das obras, gastos por categoria/etapa, evolução, resultado realizado, caixa, equipe, indicadores e anexos | CSV com 13 seções e documento para impressão/PDF de todo o recorte; memória conciliada; total da carteira indisponível se alguma obra estiver pendente; despesas da empresa e cliente direto separados |
| 2 — ampliar cobertura | Integrar apropriação de horas por serviço, produção aceita, calendário das frentes, saldos contratuais de terceiros e desembolsos estimados da folha | Vínculos comprovados; conciliação entre títulos, projeção de folha e datas de pagamento; custos indiretos e faltantes identificados; sem duplicação |
| 3 — validar previsões | Registrar snapshots, comparar previsto e observado e medir erro/viés | Validação temporal sem usar dados futuros; qualidade, quantidade e idade da amostra visíveis |
| 4 — probabilidades | Regressão, séries temporais e Monte Carlo com P50/P80, quando justificáveis | Superar referências simples no histórico; hipóteses, correlações, intervalos e calibração documentados |

## Regras da primeira versão

- Caixa utiliza títulos financeiros cadastrados; orçamento e pedidos sem obrigação não viram saídas de caixa. Ausência de folha futura, impostos, serviços ou medições no cadastro significa cobertura parcial, não zero necessário para concluir a obra.
- Custo final segue `workStageCosts`: incorrido + restante (que já contempla compras pendentes) + reserva de risco + mudanças explicitamente adicionais. A referência automática é um piso de planejamento; não é uma previsão estatística. Nas previsões gerenciais, revisões com base alterada ou etapas removidas, orçamento inválido e valores inválidos deixam o custo final indisponível até a conferência na origem.
- Incorrido é consultado por competência até o mês do corte, com a base atual dos registros. Não equivale a reconstrução histórica de informações disponíveis naquela data.
- Mão de obra é dimensionamento paramétrico. Importar um serviço apenas traz sua referência do orçamento; quantidade restante, produtividade e disponibilidade precisam de conferência. Não converter ponto em produtividade sem quantidade executada por serviço.
- RUP = horas-pessoa apropriadas / produção aceita. Horas restantes = quantidade restante × RUP. Dimensionamento considera o calendário declarado, funções e frentes. Os serviços são distribuídos uniformemente nos dias úteis do intervalo informado; o histograma não executa nivelamento de recursos.
- Horas disponíveis já devem excluir ausências e alocações fora desta simulação; não aplicar novamente perdas já contidas na produtividade histórica. Equipe é informada por função uma única vez; capacidade não é somada por serviço.
- Cenários são pessoais e mantidos na sessão aberta do app; recarregar ou sair descarta as premissas. Exportação inclui data, obra, conta, premissas, fontes e alertas. Não cria títulos, contratações, descontos, pagamentos ou mudanças de cronograma.

## Referências metodológicas

- [Lean Construction Institute — glossário](https://leanconstruction.org/glossary/): referência conceitual do PPC; o recorte de semanas e a exclusão de bloqueados são políticas explícitas desta implementação.

- [NSF — valor agregado e estimativa ao término](https://www.nsf.gov/od/ori/evm-gold-card): referência do CPI condicional à medição integral e ao mesmo corte/escopo; SPI depende de valor planejado compatível, ainda indisponível.
- [CAIXA — SINAPI](https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx): referências de custos/composições, que devem ser ajustadas às condições da obra.
- [Hyndman e Athanasopoulos — avaliação de previsões](https://otexts.com/fpp3/toolbox.html): validação temporal e intervalos, previstos na etapa 3.
- [GAO — análise de incerteza de custos](https://www.gao.gov/assets/gao-20-195g.pdf): distribuição de riscos e correlações, previstas na etapa 4.

## Base e integração

Snapshot local da consolidação `C:/dev/releases/marcell-saas-release-20261101`, incluindo suas alterações locais de interface já existentes, preservado em `C:/dev/releases/previsoes-gerenciais-local-20261101`, branch `codex/previsoes-gerenciais-local-20261101`. Não sobrescrever o checkout da consolidação com uma versão antiga; integrar somente a entrega de previsões após conferência. Artefatos, demonstrações e dados de teste ficam locais.

## Integração diária — 01/11/2026

Implementada a primeira parte da etapa 2: modo Automático · ponto e diário de obras como fonte padrão da mão de obra. O engenheiro levanta atividade, item e quantidade diária no RDO; vínculo e unidade são sugeridos quando inequívocos. A equipe presente é reaproveitada com uma confirmação; horas completas vêm do ponto. Trabalho em várias atividades exige divisão sem duplicação. Diários concluídos e revisados alimentam quantidade restante pelo avanço acumulado e RUP ponderada por função, usando horas e produção dos mesmos serviços/dias. Base alterada, diário pendente, ponto incompleto, terceiros sem horas e ausência de jornada ficam explícitos.

Equipe disponível é referência da última presença em até 14 dias, sem promessa de escala futura. Custo-hora reutiliza parcelas apuradas e completas do ciclo corrente da projeção canônica da folha; não copia salários líquidos nem cria títulos. Feriados seguem o calendário existente de Planejamento/Folha. Cenário manual permanece separado e opcional.

Permanecem para a continuação da etapa 2: reconciliação de todas as fontes históricas/arquivadas, escalas e ausências futuras por frente, horas de terceiros, nivelamento de recursos e vinculação de desembolsos futuros da folha ao caixa. Dados sem vínculo comprovado não são estimados como fatos. Teste local integrado: `node scripts/daily-production-preview.mjs`, porta 4222, dados fictícios e diários apenas na memória.

## Indicadores e relatórios da obra — 02/11/2026

Entregue localmente um bloco de consulta em Financeiro → Mais áreas → Previsões gerenciais → Indicadores da obra, com seleção de uma obra, referência e período de até 366 dias. Abrange produtividade por serviço/função, comparação com período anterior de mesma duração, dispersão diária, avanço acumulado ponderado pelo orçamento, PPC semanal verificado, cobertura dos diários, apropriação de horas e pendências. CSV contém memória, fontes e limites. Ajuda contextual `fin_previsoes_kpis` e manual revisados em 02/11/2026. Metodologia e roteiro de conferência em [Indicadores e relatórios da obra](INDICADORES-RELATORIOS-OBRA-LOCAL.md).

RUP agregada é soma das horas-pessoa / produção da mesma amostra, mantendo horas de produção zero. Desvio amostral usa n−1 e CV usa a média simples das razões diárias; exigem pelo menos dois dias com produção, com média positiva para CV. Dias sem produção ficam fora apenas da dispersão. Estatística descritiva não comprova previsão. Avanço é acumulado até a referência; produtividade e cobertura usam o recorte. Ausência de base deixa resultado indisponível, sem substituir por zero.

PPC definitivo usa somente semanas completas de segunda a domingo, encerradas e com fechamento verificável de todos os elegíveis. Quantidade confirmada até a data prometida comprova cumprimento no prazo; entrega posterior não o comprova. Bloqueados ficam separados, fora da base, conforme a política atual do Planejamento. O resumo pondera a quantidade de compromissos das semanas verificadas. A base é a atualmente carregada: não reconstrói o conhecimento de uma data passada nem integra histórico arquivado. Consulta e exportação não gravam nos módulos de origem.

Este bloco não encerra a etapa 2 nem implementa indicadores de todos os módulos. Não há previsão estatística validada, P50/P80, integração completa de suprimentos ou indicadores de licenciamento/qualidade nesta entrega.

## Relatório para diretoria e revisão dos cálculos — 02/11/2026

Implementada a quinta consulta, **Relatório para diretoria**, com comparativo da carteira, gasto acumulado por categoria e etapa, resultado e margem realizados no período, evolução mensal, caixa de 13 semanas, equipe, indicadores e memória dos gastos, pagamentos e títulos. **Obra do detalhamento executivo** troca somente o detalhe na tela; CSV e apresentação/PDF incluem todas as obras do recorte. O CSV contém 13 seções; a impressão usa o documento compartilhado MARCELL. Roteiro e critérios em [Relatório executivo por obra](RELATORIO-EXECUTIVO-OBRAS-LOCAL.md).

Custos e receitas usam competências mensais inteiras, até o mês da referência; pagamentos usam datas exatas. Gasto acumulado pode ser anterior ao início do relatório. Despesas da empresa sem rateio permanecem separadas das obras e seu agregado aparece somente no recorte geral autorizado, sem exposição na consulta individual ou em suas exportações. Cliente direto permanece fora das saídas de caixa da empresa. A base é a atualmente carregada; não equivale a todo o arquivo histórico nem ao conhecimento disponível numa data passada. Não somar custos, pedidos, pagamentos ou recebimento físico.

O motor compartilha a base acumulada para o custo final e a memória executiva. Revisões antigas, etapas removidas, orçamento vazio ou inválido, início inválido no calendário e valores ou totais fora do limite seguro deixam a previsão indisponível. Gastos ou compras sem etapa exigem apropriação ou revisão válida explícita de Sem apropriação para evitar sobreposição automática do orçamento. O relatório executivo também verifica a reconciliação da memória com os custos. Se uma obra estiver pendente, o total da carteira fica indisponível e o subtotal calculável é identificado. Restante já inclui compras a faturar; a simulação automática de mão de obra não é adicionada novamente ao custo final. CSV reutiliza a neutralização de fórmulas em texto, inclusive com espaços iniciais.

CPI fica condicionado ao último dia do mês, orçamento comparável, medição integral, custo completo reconciliado e incorrido positivo. SPI permanece indisponível sem valor planejado compatível. Resultado e margem são realizados, sem estimativa de lucro final do contrato. Ausência de base não vira zero. Não há probabilidades validadas. A ajuda `fin_previsoes_executive`, a ajuda geral com cinco consultas, os critérios de custo final e o manual acompanham a alteração.

Este relatório implementa a etapa 1D e amplia a leitura dos dados já integrados. A etapa 2 continua parcial: novas fontes e cobertura comprovada precedem snapshots e calibração. Não declarar cobertura integral apenas pela ausência de alertas.

Demonstração isolada: `MARCELL_DAILY_PORT=4226` e `MARCELL_EXECUTIVE_DEMO=1` ao executar `node scripts/daily-production-preview.mjs`. O servidor prepara revisões sintéticas válidas para 02/11/2026 na obra de teste, com orçamento fictício de R$ 120 mil, restante abatendo todo o incorrido e Sem apropriação revisado sem repetir o pessoal na etapa. Outras obras permanecem pendentes; trocar a referência ou alterar a base pode invalidar a revisão. Nenhum valor representa estimativa real. Perfis e roteiro constam no relatório local acima; a demonstração não conecta produção.

## Continuação priorizada

1. **Suprimentos e compras:** integrar necessidade, prazo prometido, entrega física e saldo pendente por item, com vínculo à etapa; separar pagar, faturar e receber. Medir atrasos e cobertura somente com datas e quantidades comprovadas, sem somar obrigações duplicadas no caixa ou custo.
2. **Licenciamento e qualidade:** definir registros, responsáveis, datas, evidências e regras de fechamento antes de medir prazos de licenças, inspeções ou retrabalho. Não derivar situação confirmada de texto livre ou documento sem revisão.
3. **Snapshots e avaliação histórica:** preservar dados, premissas e versões conhecidos em cada referência; comparar previsto e observado em janelas temporais sem dados futuros, medindo erro, viés e cobertura. Incluir conciliação com arquivos históricos antes de prometer reconstrução histórica.
4. **Probabilidades:** somente após a etapa anterior, avaliar modelos contra referências simples, documentar amostra, correlações e calibração e justificar intervalos e P50/P80. Dispersão diária atual não substitui essa validação.
