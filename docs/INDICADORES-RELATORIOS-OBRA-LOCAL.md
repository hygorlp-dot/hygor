# Indicadores e relatórios da obra — entrega local

Revisão: 02/11/2026. Metodologia: `2026-11-02.1`.

## Alcance e acesso

Em Financeiro → Mais áreas → Previsões gerenciais, a quarta consulta é **Indicadores da obra**. No celular, a escolha fica em **Consulta de previsões**. Exige perfil administrador ou financeiro autorizado e uma obra definida em **Obra da previsão**; **Todas as obras e empresa** não agrega unidades e fontes de obras diferentes.

A consulta mostra produção, planejamento e qualidade dos registros atualmente carregados. Ela reutiliza orçamento de controle, diário de obra, ponto, compromissos semanais e avanços confirmados. Não grava nesses cadastros, não fecha semanas, não altera cronograma e não cria registros financeiros. Não inclui indicadores de todos os módulos do app.

## Preparação e consulta

1. Confira o orçamento de controle e o vínculo de cada serviço do diário ao item e à unidade corretos.
2. Na origem, confira produção diária, avanço acumulado, equipe e horas apropriadas. O diário deve estar concluído e revisado pelo engenheiro; horários incompletos no ponto não são estimados.
3. No Planejamento, confira data prometida, meta, atividade e avanços confirmados dos compromissos. O status de concluído sem quantidade datada suficiente não comprova entrega no prazo.
4. Abra **Indicadores da obra**, selecione **Obra da previsão** e confira **Data de referência da previsão**. Essa data encerra o período e não pode ser futura.
5. Em **Janela dos indicadores**, escolha **Últimos 7 dias**, **Últimos 28 dias** ou **Últimos 90 dias**. Para outro intervalo, preencha **Período inicial dos indicadores**. O limite é 366 dias, incluindo início e fim.
6. Leia os três indicadores principais e os avisos. Em **Produtividade por serviço e função**, abra **Amostra** e **Ponto de origem** para conferir dias e fontes.
7. Confira **Avanço acumulado com peso do orçamento**, **Cumprimento do planejamento semanal** e **Registro diário e pendências**. Abra **Compromissos e motivos**, **Pendências e exclusões da base** e **Memória, fórmulas e limites dos indicadores**.
8. Use **Exportar indicadores da obra** para baixar o CSV. Corrija inconsistências nas áreas de origem; a consulta passa a refletir os dados carregados corrigidos.

Os filtros pertencem à sessão de previsões. Recarregar ou sair descarta as premissas da sessão; exporte o recorte que precisar guardar. A ajuda contextual acompanha a consulta sem criar registros operacionais.

## Bases e fórmulas

| Resultado | Base e cálculo | Limite de interpretação |
| --- | --- | --- |
| RUP por serviço e função | Soma das horas-pessoa ÷ soma da quantidade nos mesmos dias válidos em que a função tem horas | RUP significa razão unitária de produção. Menor valor indica menos horas por unidade; não prova causa ou ganho estatisticamente significativo |
| Produção por hora | Quantidade ÷ horas-pessoa da amostra | Não somar unidades diferentes nem quantidades compartilhadas entre funções |
| Comparação da RUP | RUP atual ÷ RUP do período anterior − 1 | O intervalo anterior tem a mesma duração. Sem RUP anterior positiva, a variação fica indisponível |
| Dispersão diária | Mínimo, máximo e média simples das razões diárias; desvio padrão amostral com divisor n−1; CV = desvio ÷ média simples | Desvio exige pelo menos dois dias com produção; CV exige também média positiva. Estatísticas descritivas não são previsão |
| Avanço ponderado do orçamento | Soma de (quantidade orçada × custo unitário × avanço acumulado do item) ÷ valor total dos itens com custo positivo | Usa a última medição acumulada revisada até a referência. Não soma percentuais diários. Valor de orçamento é peso, não custo incorrido ou pagamento |
| PPC das semanas verificadas | Compromissos cumpridos no prazo ÷ elegíveis das semanas completas verificadas | PPC significa percentual de compromissos cumpridos como prometido. Resumo ponderado pelo número de compromissos, sem média simples dos percentuais semanais |
| Cobertura dos diários nos dias com presença | Dias com diário único concluído e revisado ÷ dias com presença confirmada no ponto | Não mede todos os dias previstos no cronograma |
| Horas vinculadas / horas completas | Horas em amostras válidas de serviços ÷ horas conhecidas e completas do ponto | Jornada incompleta não é zero nem jornada integral. Horas vinculadas acima das disponíveis geram pendência e proporção indisponível |

**Horas com produção zero:** entram na RUP agregada. Dias com produção zero ficam fora apenas da dispersão das razões diárias, pois sua RUP diária não tem denominador positivo. A RUP agregada é ponderada pela quantidade e pode ser diferente da média simples diária. Exemplo: 8 Hh para 4 unidades e 8 Hh para 8 unidades dão RUP agregada de 16/12 = 1,3333 Hh/unidade; a média simples de 2 e 1 é 1,5. Se houver mais 4 Hh num dia com produção zero, a RUP agregada passa a 20/12 = 1,6667; a dispersão continua usando as duas razões positivas.

**Avanço e período:** avanço físico é acumulado até a referência, inclusive medições anteriores ao início selecionado. Produtividade e cobertura usam somente o período selecionado. O avanço total fica indisponível se faltar orçamento válido ou medição de parte do escopo com valor positivo. O produto monetário de quantidade por custo também precisa caber na representação segura em centavos; valor não representável invalida a base, sem gerar um peso infinito ou silenciosamente arredondado. Cobertura do valor medido e avanço no escopo medido são apresentados separadamente; esse subtotal não comprova o avanço da obra inteira. Itens com valor zero não compõem o peso.

## Fechamento semanal e PPC

A semana vai de segunda a domingo. Só recebe resultado definitivo quando está inteira no período, já terminou na referência e todos os elegíveis têm fechamento verificável. Semana em andamento, semana cortada pelo início do recorte ou fechamento pendente não entra no PPC do resumo.

O cumprimento exige meta válida e avanços confirmados na mesma obra, atividade e compromisso, em quantidade suficiente até a data prometida. Avanço confirmado depois do prazo não transforma atraso em cumprimento no prazo. Não cumprimento explicitamente encerrado ou entrega suficiente somente depois do prazo é classificado como não cumprido no prazo. O relatório conserva motivos e identificadores dos avanços para conferência. Produção do Planejamento e do diário não é somada entre si.

Bloqueados ficam separados e fora da base por compatibilidade com a política atual do Planejamento: não estão classificados como compromissos liberados. Isso é uma regra explícita desta implementação, não uma autorização para retirar promessas falhadas da medição. Uma futura mudança dessa política precisa preservar a rastreabilidade e rever o denominador. Cancelados também não entram. Semana somente com bloqueados não recebe PPC zero. Sem semanas elegíveis verificadas, o resumo é **Não disponível**. Quando há semanas completas encerradas pendentes, o aviso informa que o resumo cobre somente as verificadas.

A definição conceitual do PPC e o papel de promessas confiáveis seguem o [glossário do Lean Construction Institute](https://leanconstruction.org/glossary/). Os critérios de recorte, evidência e bloqueados acima descrevem o código local e sua política atual.

## Ausências, pendências e tempo

- Resultado sem denominador, medição ou fechamento suficiente é indisponível (`null`), não um desempenho presumido de zero. Zero permanece válido quando é um resultado comprovado.
- Diários sem revisão, duplicados, cancelados ou com base inconsistente não confirmam amostra produtiva. Ponto incompleto, vínculo ausente, função desconhecida, jornada mal distribuída e terceiros sem horas reduzem a base observável.
- Dias com ponto ou diário carregado aparecem na memória diária. A cobertura considera como denominador os dias com presença confirmada, não infere calendário completo de funcionamento da obra.
- Registros e correções são os atualmente carregados. Filtrar uma data passada limita fatos pela data, mas não reconstrói a versão conhecida naquele dia. Não há integração de histórico arquivado nem avaliação histórica de previsões nesta consulta.
- Desvio e CV não oferecem intervalo de confiança, probabilidade de término, causalidade ou garantia de disponibilidade futura. Não há regressão ou Monte Carlo nesta entrega.

## Exportação e conferência local

O CSV conserva referência, obra, período atual/anterior, versão metodológica, orçamento, indicadores, amostras por data/diário/função, ponto de origem, pesos e medições, semanas, compromissos, avanços, motivos e pendências. Proporções usam escala de zero a um, e não valores percentuais de zero a cem. Em Ponto de origem, a tela apresenta nome da pessoa, horas-pessoa apropriadas e identificador do registro por pessoa/data. Os horários completos de origem permanecem no CSV, inclusive a representação dos registros de ponto, para auditoria. Os identificadores ajudam a conferir fontes; o arquivo não é um snapshot imutável de todos os cadastros.

Roteiro de revisão: conferir amostra por serviço/função; comparar RUP agregada e diária com quantidades desiguais; manter horas de produção zero; conferir indisponibilidade com um único dia de produção; conferir medição acumulada anterior ao recorte; verificar semana completa, recorte parcial, atraso, bloqueados e pendências; comparar totais/memória com o CSV; confirmar estados vazios sem inferência de zeros e consulta sem gravação. Execução técnica e revisão visual pertencem à validação do bloco implementado, sem dispensar revisão dos registros reais antes do uso.

Ajuda e manual foram revisados porque a entrega acrescenta consulta, filtros, resultados e exportação visíveis ao usuário. A fonte única da orientação é `src/features/help/help-content.js`; `docs/MANUAL_DO_APP.md` é gerado por `node scripts/generate-app-manual.mjs` e conferido com `--check`.

## Referências e continuação

[CAIXA — SINAPI](https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx) permanece referência de composições e custos para conferência e ajuste às condições da obra; esta consulta calcula produtividade a partir das amostras válidas da própria obra, sem apresentar composição de referência como produtividade observada.

A continuação está no [roadmap de previsões gerenciais](ROADMAP-PREVISOES-GERENCIAIS.md): suprimentos/compras; licenciamento e qualidade com fontes e fechamento definidos; snapshots e avaliação temporal antes de previsões probabilísticas. O bloco atual não declara essas frentes concluídas.

## Demonstração local reproduzível

Em um terminal PowerShell no checkout `C:/dev/releases/previsoes-gerenciais-local-20261101`, execute:

```powershell
$env:MARCELL_DAILY_PORT = '4224'
$env:MARCELL_KPI_DEMO = '1'
node scripts/daily-production-preview.mjs
```

Abra [a demonstração local](http://127.0.0.1:4224) e entre com o usuário fictício `piloto@local.test`, senha `piloto-local`. Esse servidor independente usa dados fictícios na memória e não se conecta à produção. A porta 4224 permite preservar o servidor e eventual rascunho da integração diária na porta 4222; não reinicie esse servidor anterior para abrir o exemplo de indicadores. Encerrar/reiniciar o servidor de demonstração descarta as alterações em sua memória.

Em Previsões gerenciais → Indicadores da obra, escolha **Residencial Alameda**, **Data de referência da previsão** de **02/11/2026** e **Período inicial dos indicadores** de **26/10/2026**. O exemplo apresenta:

| Conferência | Resultado esperado na base fictícia |
| --- | --- |
| Avanço ponderado do orçamento | 30% |
| PPC das semanas verificadas | 50%, com 1 cumprimento no prazo entre 2 elegíveis; 1 bloqueado fica separado |
| Cobertura dos diários nos dias com presença | 50%, com 2 dias revisados entre 4 dias com presença |
| Produtividade da alvenaria, função pedreiro | 64 Hh / 200 m² = RUP de 0,32 Hh/m² |

A semana iniciada em 02/11 está em andamento e não recebe PPC definitivo. O exemplo de entrega posterior ao prazo demonstra por que o status cadastrado como concluído não basta para contar cumprimento no prazo. Os valores são ilustrativos e não descrevem uma obra real.

## Revisão final da extensão de interface

A comparação de `WorkPerformanceReports.jsx` e `ForecastWorkspace.jsx` com `DESIGN.md`, `docs/PADRAO-INTERFACE.md` e o craft floor da skill Impeccable caracteriza esta entrega como extensão operacional da interface vigente. O cabeçalho usa PageHeader, a navegação usa WorkspaceNavigation, os filtros usam FilterBar e os campos/ações usam Input, Select e Button compartilhados. Alert e EmptyState mantêm estados semânticos, e a família `financial-reports` existente mantém totais, tabelas e adaptação móvel. Não foram introduzidos estilos inline, controles próprios, cores de tema locais ou uma nova direção visual nesses componentes.

A leitura das capturas `artifacts/indicadores/report-1440.png` e `report-390.png` confirma composição compatível com a família: tabelas no desktop, dados rotulados empilhados no celular, controles em coluna na largura estreita, texto de método junto dos resultados e detalhes de fontes sob demanda. Ajuda permanece no shell; `useHelpTopic` seleciona `fin_previsoes_kpis`. A origem do ponto mostra informação legível na tela, reservando os horários completos para a exportação. Os detalhes gerais **Fontes, premissas e alcance** incluem os indicadores e suas fontes.

O passe documental preservou `DESIGN.md`, `docs/PADRAO-INTERFACE.md`, `.impeccable/` e baselines: não reescreveu contexto visual nem ampliou exceções. Isso não afirma que o checkout inteiro esteja sem diferenças prévias nesses arquivos; a comparação preservou a consolidação já existente.

Evidência da validação final informada pela implementação/revisão: 62 testes em 8 arquivos aprovados; 2 cenários de navegador em desktop e celular, sem escritas operacionais na API; lint, manual sincronizado (104 guias/65 abas), TypeScript e build aprovados; detector Impeccable com lista vazia (`[]`). O build conserva o aviso preexistente de tamanho de chunk. O revisor concluiu a entrega sem correções adicionais. Esses resultados não eliminam os limites metodológicos: base atualmente carregada, estatística descritiva e ausência de validação preditiva.
