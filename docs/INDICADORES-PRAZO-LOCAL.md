# Indicadores de prazo por obra — teste local

Revisão: 02/11/2026. Continuação local do roadmap; sem publicação ou migração de banco.

## Consulta

Financeiro → Mais áreas → Previsões gerenciais → Relatório para diretoria. No Resumo do CEO, consultar Sinais de prazo por obra. Em Execução, escolher Obra do detalhamento executivo e consultar Prazo da obra; expandir Conferir atividades, marcos e semanas. O mesmo componente está em Indicadores da obra. Ajuda permanece no cabeçalho compartilhado e usa os guias específicos de cada consulta. Obra, referência, período e seleção permanecem na sessão.

## Fontes e critérios

- `planos` da obra: datas vigentes, atividades executivas (exclui títulos de etapas sem itens próprios com valor e canceladas), marcos e fotografia da base. Mais de um plano impede escolher um arbitrariamente.
- `rdos`: identificação exata da atividade, data válida até a referência, status concluído e revisão técnica aprovada. A evidência é avanço acumulado em percentual; não exige nova digitação nem soma quantidades de unidades diferentes. Progresso do plano não entra como medição. Não infere avanço zero quando o diário não existe.
- Um diário posterior ainda em revisão não substitui a última medição revisada. Duplicidade no dia ou na atividade, ou avanço inválido em registro revisado, invalida a evidência daquele corte; posterior medição válida restabelece a leitura.
- Atividade vencida confirmada: fim válido anterior à referência e avanço revisado inferior a 100%. Sem medição fica em vencidas sem medição. Hoje não é vencido. Atraso aberto é diferença em dias corridos entre referência e fim vigente; maior atraso não representa atraso da obra inteira.
- Conclusão: primeiro registro de 100% do ciclo atual; se reabrir com avanço inferior, novo ciclo. Registro posterior à execução pode aparentar conclusão tardia: conferir o diário. Futuro, outra obra e cancelamento não concluem atividades.
- Próximas entregas: fim entre referência e referência + 7 dias, inclusive, sem conclusão confirmada. Inclui atividades sem medição, com sua situação explícita.
- Cobertura: atividades com avanço revisado / atividades executivas cadastradas. Não comprova que todas as atividades da obra foram cadastradas. Não confundir com cobertura de dias com presença do ponto.
- Maior fim vigente exige todas as atividades com datas e identificações válidas. Não é previsão estatística nem prazo contratual. Marcos são listados separadamente e não presumem entrega concluída.
- Desvio de data = data vigente − data da fotografia salva, em dias corridos. Positivo significa postergação; negativo, antecipação. Desvio integral do fim exige correspondência integral e única de atividades/datas e fotografia salva até a referência. A fotografia substituível não reconstrói versões anteriores.
- PPC conserva os critérios do relatório existente: semanas inteiras encerradas e verificadas, evidência datada dos compromissos e bloqueados separados. Não se cria vínculo presumido entre quantidade diária e compromisso semanal.

## Demonstração Residencial Alameda

Iniciar `scripts/daily-production-preview.mjs` com MARCELL_EXECUTIVE_DEMO=1 e MARCELL_SCHEDULE_DEMO=1. Todos os dados são fictícios e ficam em memória; reiniciar descarta alterações. Gravações financeiras e mudanças de planejamento ficam bloqueadas nesse servidor de demonstração.

Na referência 02/11/2026: cinco atividades, duas medidas (40%), uma vencida com saldo confirmado e quatro dias corridos de atraso, uma vencida sem medição, uma conclusão registrada dois dias após o prazo, duas entregas entre hoje e sete dias e desvio de dois dias no fim contra a fotografia. Existe um marco futuro e PPC de semanas com fechamento pendente separado.

Financeiro: piloto@local.test / piloto-local. Engenharia: engenharia@local.test / piloto-local. Para testar a integração, registrar o levantamento diário da atividade de alvenaria, conferir equipe e produção, salvar, revisar e concluir o diário. Consultar novamente os indicadores na referência correspondente. Clima noturno continua opcional.

## Exportações e limite seguinte

CSV executivo: 23 seções, incluindo Prazos, Atividades prazo e Marcos prazo. Exportar indicadores da obra também inclui memória de atividades e marcos. Apresentação/PDF executivo conserva o mesmo objeto de relatório, escopo, origens, revisão e limites; conteúdo escapado.

SPI permanece indisponível. A relação EV/PV e os requisitos de valor planejado são tratados pela [NSF](https://www.nsf.gov/od/ori/evm-gold-card). A fotografia de datas atual não tem governança de versões e valores para satisfazê-los. Próxima evolução: preservar versões aprovadas com mudanças justificadas, orçamento distribuído no tempo, calendário e correspondência integral de escopo. Planejamento semanal e acompanhamento dos compromissos seguem a referência do [Lean Construction Institute](https://leanconstruction.org/lean-topics/last-planner-system/).

## Validação concluída nesta entrega

- 50 testes de cálculo e componentes passaram: prazos, desempenho, relatório executivo, decisões e indicadores financeiros; mais 3 testes do orçamento de bundle.
- 4 testes de prazo no navegador passaram: 1440, 390 e 768 px, CSV/PDF, ajuda e preservação do contexto; fluxo adicional de engenharia concluindo o diário e atualização do prazo sem redigitação.
- 4 testes de regressão do relatório executivo passaram em 1440, 390, 1470 e 768 px. Consultas e exportações não emitiram comandos de gravação financeira nos cenários verificados.
- Lint, tipos, auditoria de ciclos, design:check e manual:check passaram. Manual: 105 guias / 65 abas. Detector Impeccable sem achados mecânicos nos componentes alterados. Componentes React reutilizados sem efeitos de sincronização, dependências novas ou estilos locais; mesma tabela acessível e mesmo componente de prazo nas duas consultas.
- Build direto Vite passou, sem executar o prebuild de migrações. Bundle gzip final: 1.856.583 bytes, +5.015 bytes sobre a publicação anterior; teto total local passou de 1809 a 1814 KiB. Limites individuais, entrada, mídia e baseline visual preservados.
- Revisão visual de desktop e celular; apresentação gerada com 12 páginas, renderizada com Poppler, conferida em conjunto e no detalhe dos indicadores da página 9. Não houve publicação, push, pull request, migração nem gravação em produção.
- Demonstração local ativa em http://127.0.0.1:4236/, deixada na Residencial Alameda → Relatório para diretoria → Execução, referência 02/11/2026 e início 01/10/2026. Apenas dados fictícios; a porta 4228 e as abas anteriores foram preservadas.
