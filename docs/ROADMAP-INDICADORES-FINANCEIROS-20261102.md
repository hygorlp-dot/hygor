# Roadmap dos indicadores financeiros e de obra

Revisão: **02/11/2026**. Escopo: relatório executivo em Previsões gerenciais. Entrega e validação locais; este documento não autoriza push, pull request ou deployment.

## Direção e prioridade

A seleção de indicadores considera custo, prazo, caixa e qualidade operacional discutidos pela [SmartPM](https://smartpm.com/blog/12-fundamental-key-performance-indicators-in-construction) e as famílias de análise financeira apresentadas pela [UCJ](https://ucj.com.br/blog/principais-indicadores-financeiros/). São referências de orientação, sem comprovação estatística para o modelo MARCELL. As prioridades abaixo são decisões de implementação baseadas nas fontes que o app já possui; não são uma reprodução das fórmulas dos blogs.

Primeiro tornar os saldos, obrigações e desvios existentes conferíveis. Em seguida preparar as bases ausentes antes de acrescentar índices. Resultado gerencial e margem do período não equivalem a lucro líquido contábil; EBITDA não equivale a saldo ou fluxo efetivo de caixa.

| Fase | Entrega | Dependência principal | Situação em 02/11/2026 |
| --- | --- | --- | --- |
| 1 | Inadimplência, compromissos de compra, CV e VAC | Razão canônico, recebíveis e pedidos, orçamento e avanço comparáveis | Publicada em 02/11/2026 |
| 2 | Prazo, valor planejado e SPI | Linha de base aprovada, versionada e distribuída no tempo | Prazo, linha de base aprovada e SPI publicados em 02/11/2026 |
| 3 | Rentabilidade, liquidez, endividamento e atividade | Classificação contábil, balanço e demonstrativos validados | Rentabilidade, liquidez e endividamento implementados localmente; atividade permanece planejada |
| 4 | Retrabalho, segurança, paradas e qualidade | Registros diários completos com denominadores e classificação | Planejada; sem substituição por ausência de registro |
| 5 | Validação retrospectiva das previsões | Histórico de previsões congeladas e resultados observados | Planejada; sem probabilidades de acerto presumidas |

## Fase 1 — posição financeira e variação de custo

O **Resumo do CEO** reúne **Sinais financeiros da carteira**. **Caixa** mostra **Posição da inadimplência** e **Conferir atrasos e títulos a receber**. **Custos**, após escolher **Obra do detalhamento executivo**, mostra **Compromissos financeiros da obra**, **Conferir compras a faturar** e **Variação de custo por valor agregado**. Não são criados cadastros, permissões, gravações ou migrações.

Inadimplência é o saldo residual aberto com vencimento anterior à referência. Vencimento no dia e futuro não são atraso. O percentual usa como denominador todos os saldos abertos com vencimento válido, inclusive futuros; sem denominador positivo fica indisponível. Títulos sem data válida permanecem separados. As faixas são 1–30, 31–60, 61–90 e mais de 90 dias. A carteira usa a razão dos totais, sem média simples de percentuais por obra. A consulta usa as fontes atualmente carregadas e não reconstrói o conhecimento histórico da equipe.

Compromissos são os saldos de compras ainda a faturar selecionados pelo razão na referência. Títulos a pagar aparecem separados. Pedido, faturamento, recebimento físico e pagamento são fatos distintos. A posição de compras não deve ser acrescentada ao incorrido ou ao custo final: o motor já considera compras pendentes no restante conforme seu critério por etapa. A consulta não comprova cobertura de contratos sem medição, folha futura e serviços sem obrigação cadastrada.

Na notação de valor agregado, CV = EV − AC e VAC = BAC − EAC, conforme a [NSF — EVM Gold Card](https://www.nsf.gov/od/ori/evm-gold-card). No relatório, EV é o valor orçado do avanço medido, AC o custo incorrido, BAC o orçamento e EAC o custo final condicional. CV negativo indica custo acima do valor agregado; VAC negativo indica previsão acima do orçamento. **Desvio previsto** usa EAC − BAC e, portanto, tem sinal inverso ao VAC. Não confundir CV monetário com o coeficiente de variação da produtividade.

CV reutiliza as condições conservadoras da base do CPI: último dia do mês, medição integral, orçamento e custos de mesmo escopo, apropriação por etapa e memória conciliada. Sem elas, aparece indisponível com motivo. CV da carteira exige todas as obras comparáveis; a contagem de cobertura acompanha o resultado. VAC exige orçamento e custo final disponíveis. Não transformar subtotal calculável em total integral da carteira.

Critérios de aceite: conservar centavos e origens; conferir pagamentos parciais, vencimento no dia, títulos futuros e sem data, faixas limítrofes, ausência de base, pedidos parcialmente faturados e referências intermediárias; verificar sinais CV/VAC, carteira com obra não comparável e ausência de duplicação. Conferir desktop, celular, teclado, exportações e preservação dos filtros. CSV possui 20 seções, incluindo **Inadimplência**, **Compromissos** e **Variação custo**; apresentação/PDF deve conservar os mesmos cortes, memória e limites. A conclusão desta fase depende das evidências da validação, não da presença deste documento.

## Fase 2 — prazo e valor planejado

Entrega local desta continuação: datas vigentes das atividades e marcos do Planejamento confrontadas com o último avanço acumulado revisado no Diário de obra. Indicadores: vencidas com saldo confirmado, vencidas sem medição, maior atraso aberto em dias corridos, conclusões registradas e tardias, entregas em sete dias, cobertura da medição, fim vigente das atividades e desvio das datas contra a fotografia salva. Resumo por obra para o CEO, detalhe em Execução e Indicadores da obra, PPC semanal existente, pendências com providências, CSV e apresentação/PDF. Ver `INDICADORES-PRAZO-LOCAL.md`.

A fotografia `planos[].baseline` existente pode ser substituída e não mantém histórico versionado de valores aprovados. Seu custo pode inclusive vir de custo real. Por isso, ela serve aqui apenas para desvio de datas, com escopo integral e data válida na referência, nunca como PV aprovado. Não distribuir custos uniformemente para simular um SPI. O avanço editado diretamente no plano também não comprova uma medição histórica.

Continuação implementada localmente: propostas e aprovação por comando auditável, versões imutáveis, justificativa, calendário e pesos congelados, seleção pela aprovação até a referência e SPI por obra. Distribuição de PV linear pelos dias trabalhados explicitamente aprovada; EV por item com medição revisada compatível e cobertura integral. Consulte `LINHA-BASE-SPI-LOCAL.md`. A fotografia legada continua separada e não sustenta o SPI. Os requisitos abaixo orientam os testes e evoluções futuras, como curvas de distribuição não uniformes.


Preparar linha de base por etapa com valor orçado distribuído por data, identificação da versão aprovada, mudanças autorizadas e vínculo com a medição física. SPI = EV / PV usa o valor planejado da mesma referência e escopo; a relação é documentada pela [NSF](https://www.nsf.gov/od/ori/evm-gold-card). PPC e percentual de avanço atuais não substituem PV nem demonstram atraso em dias.

Aceite: reproduzir uma linha de base conhecida, manter versões anteriores, conferir mudanças e denominador nulo, impedir mistura de escopos e apresentar cobertura. Só então disponibilizar SPI e comparação planejado/executado. O SPI permanece não calculado na fase 1.

## Fase 3 — demonstrativos financeiros

Entrega local: onze indicadores contábeis sobre balancete CSV antes do encerramento, importação e conferência por comandos auditáveis, revisões preservadas, reconciliação por conta e grupos, comparação com o razão do ERP, memória e exportações. Escopo da empresa inteira, restrito a administrador/financeiro com acesso geral. Métodos e critérios em `INDICADORES-CONTABEIS-LOCAL.md`. Índices de atividade e prazos médios ainda dependem de novas bases. ROA e ROE desta entrega usam saldos finais expressos, sem médias nem anualização. Não há deploy nesta etapa.

Definir com o responsável contábil receitas líquidas, deduções, custos, despesas, juros, tributos, depreciação, amortização, ativos, passivos e patrimônio. Separar obra, empresa e despesas sem rateio, mantendo regras explícitas para consolidação. As famílias propostas pela [UCJ](https://ucj.com.br/blog/principais-indicadores-financeiros/) ajudam a organizar essa pauta, mas fórmulas e bases precisam de validação contábil própria.

Aceite: reconciliar demonstrativos e saldos de abertura/fechamento, validar classificações e periodicidade, definir bases médias quando aplicáveis e tratar denominador zero ou negativo. Não chamar recebíveis/pagáveis de ativo/passivo circulante completo. Não publicar rentabilidade, liquidez corrente, endividamento ou prazos médios como completos enquanto essas dependências faltarem.

## Fase 4 — qualidade, segurança e produção

Preparar classificações e registros de retrabalho, horas de parada, causas, incidentes e exposição; controlar duplicidade de produção compartilhada. Para satisfação do cliente, definir coleta, população e período próprios. Esses temas ampliam a visão operacional sugerida pela [SmartPM](https://smartpm.com/blog/12-fundamental-key-performance-indicators-in-construction).

Aceite: distinguir zero confirmado de ausência de registro, conservar eventos de origem e usar denominadores de mesma unidade e cobertura. RUP, PPC e dispersão existentes continuam descritivos; não deduzir segurança ou qualidade apenas da produtividade observada.

## Fase 5 — confrontar previsões com resultados

Guardar a previsão e as fontes disponíveis em cada referência, sem incorporar informações posteriores ao teste. Comparar custo final, necessidade de cobertura e equipe prevista com resultados observados em obras encerradas e períodos posteriores. Separar amostra de ajuste e avaliação; registrar erro, viés, cobertura e mudanças de escopo. Conservar uma regra simples de comparação para demonstrar eventual ganho.

Aceite: amostra identificada, critérios reproduzíveis, resultados por horizonte e limites explícitos. Probabilidade de conclusão, intervalos de confiança ou taxas de acerto somente após método e dados suficientes; nenhuma dessas garantias está implementada pela fase 1.

## Entrega e documentação

Cada fase mantém componentes e tokens MARCELL, ajuda contextual e manual sincronizados, critérios de indisponibilidade e trilha de origem. A fase 1 revisa somente o guia `fin_previsoes_executive` na fonte única `src/features/help/help-content.js`; o manual deriva de `npm run manual:generate`. DESIGN e sidecar são preservados, sem novos tokens ou baseline. A publicação depende de solicitação explícita do usuário e deve consolidar a entrega, evitando builds remotos intermediários.

## Validação da fase 1 — 02/11/2026

32 testes aprovados em quatro arquivos e quatro cenários de navegador em 390, 768, 1440 e 1470 px. Cobertura: saldos parciais, recebimentos e pedidos futuros, recorte por obra, vencimento no dia, vencimentos inválidos, faixas 30/60/90, dia bissexto, centavos e limites seguros, sinais CV/VAC, carteira parcialmente comparável, CSV e PDF. Lint, tipos e build local aprovados; detector sem achados. PDF completo de dez páginas renderizado e conferido. Revisão independente: ship no escopo desta extensão MARCELL, sem achados materiais. Ajuda e manual sincronizados: 105 guias, 65 abas.

Demonstração independente local em http://127.0.0.1:4232/ (servidor com MARCELL_FINANCIAL_KPI_DEMO=1 e MARCELL_EXECUTIVE_DEMO=1), sem modificar a base da demonstração anterior na porta 4228. Residencial Alameda, referência 02/11/2026, início 01/10/2026: R$ 3.000,00 vencidos, R$ 19.000,00 de saldos com vencimento válido, 15,79%, R$ 1.000,00 sem data; compras a faturar R$ 2.000,00. CV indisponível no mês em andamento, com motivo explícito. Cenário de saldo inicial fictício R$ 5.000,00 confirmado somente na sessão. Nenhuma migração, gravação financeira, publicação, push ou PR nesta entrega.

Evidências: artifacts/kpis-financeiros-tests.log, kpis-financeiros-e2e.log, kpis-financeiros-lint.log, kpis-financeiros-types.log, kpis-financeiros-build.log e kpis-financeiros-design.json; capturas e PDF em artifacts/executivo.

## Validação da fase 3 — entrega local

Onze indicadores e fluxo de balancete conferível implementados e documentados em `INDICADORES-CONTABEIS-LOCAL.md`. 322 testes em 13 arquivos e 11 cenários de navegador aprovados (7 contábeis e 4 regressões do relatório executivo). Lint, tipos, ciclos, manual e build Vite direto aprovados; 108 guias e 65 abas. Detector sem achados; revisão independente deu ship após resolver a compressão das tabelas em tablet e conferir formulários/pendências em desktop e celular. PDF de quatro páginas renderizado e inspecionado. Demonstração local independente em http://127.0.0.1:4248/. Sem publicação. Preservar a API e o sistema de design mais recentes ao integrar esta extensão à consolidação vigente.
