# Integração de ponto, diário e previsão de mão de obra

Revisão: 02/11/2026. Entrega local em `C:/dev/releases/previsoes-gerenciais-local-20261101`, branch `codex/previsoes-gerenciais-local-20261101`, sobre o snapshot `23057ef1` da consolidação MARCELL e suas alterações locais preservadas. Sem commit, push ou deployment. Complementa `PREVISOES-GERENCIAIS-LOCAL.md` e a primeira parte da etapa 2 de `ROADMAP-PREVISOES-GERENCIAIS.md`.

## Registrar uma vez e reaproveitar

O engenheiro levanta as atividades diariamente no Diário de obras. O orçamento fornece item e unidade; o planejamento sugere as atividades previstas. Quando o vínculo é inequívoco, item e unidade já vêm selecionados. **Vincular equipe presente do ponto** reaproveita a presença do dia com uma confirmação. O engenheiro informa a quantidade realmente executada e confirma quem trabalhou na atividade: presença, sozinha, não prova produção nem alocação.

**Quantidade executada hoje** sugere o novo **Progresso acumulado**, partindo do último acumulado revisado na mesma base. Sem essa referência, parte de zero e pede conferência da posição inicial. Quantidade diária e acumulado são medidas diferentes; o operador deve conferir a sugestão. Uma pessoa em uma só atividade traz a jornada registrada, descontado o intervalo. Se trabalhar em várias atividades, é necessário dividir as horas, sem ultrapassar o ponto e sem repeti-las.

Após revisar relato, clima, serviços e evidências e usar **Concluir relatório**, o diário alimenta o Financeiro com os dados carregados. A fonte padrão é **Automático · ponto e diário de obras**: quantidade restante, função, horas, produtividade, equipe, jornada e custo-hora não precisam ser redigitados na previsão. O intervalo e o calendário da simulação continuam ajustáveis. Hipóteses avulsas usam **Simulação manual separada**, sem substituir os registros de origem.

O diário concluído continua mostrando produção do dia, unidade, item e orçamento de origem, progresso acumulado, equipe e horas por pessoa, sem reabrir para consultar. A informação fica fora do botão desabilitado e conserva a legibilidade. O helper `src/domains/obras/production-report.js` fornece a mesma leitura factual para a tela e `imprimirRdo`. Horas explícitas são identificadas como **apropriação registrada**. A derivação da jornada somente ocorre com `productionVersion: 1`, atividade única, ponto completo e ausência de outro diário não cancelado da mesma obra/data; a origem é **ponto consultado de [data] · atividade única**. Em registros antigos sem apropriação, permanece **Não informado**, mesmo que exista ponto consultável: a impressão não reconstrói uma alocação histórica.

## Cálculo e limites da base

| Informação | Origem e tratamento |
| --- | --- |
| Quantidade restante | Orçamento de controle atual menos quantidade equivalente ao último avanço acumulado concluído e revisado; percentuais dos diários não são somados |
| RUP por função | Soma das horas apropriadas / soma da produção dos mesmos serviços e dias válidos; RUP significa razão unitária de produção, em horas-pessoa por unidade |
| Equipe de referência | Última presença observada na obra em até 14 dias; não é confirmação de disponibilidade futura |
| Jornada | Jornada comum cadastrada para a equipe; ausência ou divergência pede conferência no RH |
| Custo-hora | Parcelas apuradas completas do ciclo corrente da projeção canônica da folha / horas do ponto correspondentes; não usa salário líquido como custo total |
| Calendário | Intervalo declarado, com feriados existentes de Planejamento/Folha excluídos no modo automático; distribuição uniforme, sem nivelamento de frentes |

Diários pendentes, duplicados, cancelados ou sem revisão não confirmam a produção. Reabrir retira o diário da base aceita. Mudanças em serviços invalidam a revisão técnica; mudanças no ponto recalculam as horas e a RUP. Orçamento, quantidade de referência ou unidade alterados exigem reconferir o vínculo. Horários incompletos, função ausente, terceiros sem horas e divisão pendente ficam identificados, sem fabricar produtividade. As regras de produção são validadas também na fronteira de gravação dos relatórios com `productionVersion: 1`; campos normalizados, versão e auditoria acompanham o RDO.

Histórico arquivado, escalas e ausências futuras por frente, horas de terceiros e nivelamento de recursos permanecem fora desta integração. Caixa e custo final conservam seus motores originais: o custo restante de mão de obra não cria títulos nem deve ser somado novamente aos custos já incluídos. A consulta não altera ponto, folha ou contratações. Não há previsão estatística validada nem reconstrução histórica do que era conhecido em cada data.

## Demonstração reproduzível

Na raiz do checkout, execute:

```powershell
node scripts/daily-production-preview.mjs
```

Abra `http://127.0.0.1:4222/`. Dados fictícios, sem conexão com produção: somente comandos de diário são aceitos em memória; reiniciar o servidor descarta as alterações. Gravações financeiras são bloqueadas. Essa proteção pertence à demonstração, não substitui as permissões do app real.

1. Entre com `piloto@local.test` / `piloto-local`. No desktop, abra **Financeiro → Mais áreas → Previsões gerenciais → Previsão de mão de obra**; no celular, use **Áreas do financeiro** e **Consulta de previsões**. Selecione **Residencial Alameda** e referência **01/11/2026**. Preserve a fonte automática e o intervalo padrão de 01/11 a 28/11.
2. Confira o orçamento de 1.200 m², diário de 30/10 com produção de 100 m², acumulado de 25% e quatro pessoas com oito horas cada. São 32 Hh / 100 m² = RUP 0,32; restam 900 m² × 0,32 = 288 Hh. O calendário tem 18 dias úteis, excluindo 02/11 e 20/11. Resultado: duas pessoas necessárias, quatro como referência observada e custo restante de R$ 8.640, com custo-hora apurado de R$ 30.
3. Em outra sessão, entre como `engenharia@local.test` / `piloto-local` no Diário de obras. Use **Novo relatório** em 01/11 e **Levantar Alvenaria · demonstração fictícia**. Confira item e unidade sugeridos; use **Vincular equipe presente do ponto**. Informe 100 em **Quantidade executada hoje** e confira a sugestão de acumulado de aproximadamente 33,333%, além das oito horas de cada pessoa. Salve a atividade.
4. Preencha **Relato do dia**, confira o clima de manhã e tarde (noite é opcional), marque **Revisei o relato, o clima, os serviços e todas as evidências disponíveis.** e use **Concluir relatório**. Com os novos dados carregados na sessão financeira, a quantidade restante passa a 800 m² e a demanda a 256 Hh. Fotos, voz e reflexão por IA são opcionais.
5. Confira os estados sem base ou jornada. **Aguardando levantamento diário** orienta a resolver orçamento e levantamento na origem; jornada indisponível orienta conferir RH e ponto. O modo automático não oferece formulário de serviço manual para contornar a pendência. Para o exemplo manual antigo da porta 4220, selecione explicitamente **Simulação manual separada**.

## Continuidade do sistema MARCELL

As autoridades visuais continuam `DESIGN.md` e `docs/PADRAO-INTERFACE.md`; `PRODUCT.md` está ausente. A orientação `impeccable/reference/document.md` foi consultada para registrar o sistema observado, sem criar outra identidade nem substituir a documentação visual existente.

Em comparação com o sistema incumbente, esta extensão conserva o shell e a navegação do Financeiro e do Diário. Os novos controles usam Button, Input, Select, FilterBar, FormSection e Alert compartilhados, com estruturas de serviço, equipe e revisão já existentes. Não acrescenta tokens CSS, família de controles, estilos locais para contornar a base ou aumento da baseline. Esta documentação não modifica DESIGN, sidecar, ajuda, manual nem código-fonte.

O detector `integracao-design.json` registra seis avisos consultivos: cinco cores e um tamanho de fonte no HTML de impressão preexistente de `DiarioObraView.jsx`. Não são novos tokens da integração; o estilo legado de impressão não foi reparado nesta entrega. O primeiro parecer ship cobriu a recuperação do modo automático sem base. O último parecer ship cobriu a correção da consulta e impressão do diário encerrado. Esses pareceres não certificam todas as superfícies legadas.

## Evidências locais e alcance da validação

| Registro na raiz | Resultado observado |
| --- | --- |
| `integracao-tests.log` | 157 testes aprovados em 15 arquivos, incluindo três casos de `production-report.test.js` |
| `integracao-e2e.log` | Seis cenários aprovados em 1440 e 390 px: automático, fluxo do engenheiro, consulta e impressão com divisão de horas e ausência histórica; inclui orientação de recuperação sem base e sem jornada |
| `integracao-regression-e2e.log` | Três cenários aprovados de regressão de caixa, custo, ajuda e simulação manual |
| `integracao-lint.log` | Lint, design e sincronização do manual aprovados; 103 guias e 65 abas |
| `integracao-types.log` | TypeScript aprovado |
| `integracao-build.log` | Build direto Vite aprovado, sem executar o prebuild de migrações |

Capturas em `artifacts/integracao/`: `automatic-{1440,390}.png`, `daily-editor-{1440,390}.png`, `daily-hours-{1440,390}.png`, `automatic-empty-{1440,390}.png`, `automatic-missing-hours-{1440,390}.png`, `daily-split-{1440,390}.png`, `daily-legacy-{1440,390}.png`, `print-split-{1440,390}.png` e `print-legacy-{1440,390}.png`. São nove cenários de navegador somando integração e regressão. Conferem reaproveitamento da produção concluída, ajuda, leitura de jornada única e divisão registrada, ausência histórica e ausência de overflow nos estados testados. A conferência de impressão inspeciona o popup com o HTML imprimível; não gerou nem validou um PDF binário. Não valida escalas futuras, todo histórico arquivado ou todo o ERP.

A ajuda contextual, inclusive `fin_previsoes_labor` e o guia `rdo`, foi revista na implementação, incluindo a consulta e impressão após concluir; o manual foi regenerado da fonte única `src/features/help/help-content.js`. A presente documentação técnica não acrescenta controles ou passos ao app e não exige outra geração do manual. Integrar posteriormente somente o delta conferido, preservando as alterações locais de outras tarefas e a consolidação vigente.

## Revisão de 02/11/2026 — clima noturno opcional

Manhã e tarde são obrigatórias no clima; **Noite (opcional)** pode ficar vazia, inclusive para concluir o relatório. A validação de conclusão exige somente os dois períodos diurnos. O ajuste conserva os controles e o padrão MARCELL existentes, com alteração dos rótulos e sem novos tokens.

A demonstração da porta 4222 inclui ponto fictício completo em 02/11: quatro pessoas com oito horas cada. No navegador, foi preparado um rascunho de Alameda nessa data, com produção de 100 m², 32 Hh, manhã e tarde com clima bom e noite vazia; faltava somente a revisão técnica. A consulta financeira aberta em outra sessão permanecia automática com 288 Hh, pois o rascunho ainda não integra a produção confirmada. Esse estado é transitório da demonstração em memória; reiniciar o servidor o descarta.

Evidências desta rodada, registradas separadamente das anteriores:

| Registro na raiz | Resultado observado |
| --- | --- |
| `clima-opcional-tests.log` | 52 testes focais aprovados em três arquivos |
| `clima-opcional-e2e.log` | Seis cenários aprovados em 1440 e 390 px, incluindo conclusão com noite vazia e consulta do diário encerrado |
| `clima-opcional-lint.log` | Lint e checagens de design e manual aprovados; 103 guias cobrem 65 abas |

Capturas em `artifacts/integracao/`: `clima-opcional-{1440,390}.png` e `clima-noturno-opcional-pronto.png`. O guia `rdo`, a data `HELP_REVIEWED_AT` (02/11/2026) e o manual foram atualizados na implementação. Esta revisão documental apenas registra a mudança já orientada na fonte sincronizada; não exige nova geração do manual nem certifica outras áreas do ERP.
