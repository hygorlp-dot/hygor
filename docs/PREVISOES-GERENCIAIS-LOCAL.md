# Previsões gerenciais — entrega local

Revisão: 02/11/2026. Extensão do Financeiro MARCELL: caixa de 13 semanas, custo final por obra e previsão de mão de obra. Roadmap e critérios de expansão em `docs/ROADMAP-PREVISOES-GERENCIAIS.md`.

A mão de obra agora abre em **Automático · ponto e diário de obras**. O levantamento do engenheiro e as horas do ponto alimentam a consulta sem repetir as informações no Financeiro. Demonstração integrada, regras e evidências atuais em `docs/INTEGRACAO-PONTO-DIARIO-PREVISOES.md`. O exemplo abaixo na porta 4220 conserva o cenário manual da primeira entrega.

O diário concluído também mantém produção, vínculo orçamentário, acumulado, equipe e horas legíveis na consulta e na impressão, sem reabrir o documento. Horas registradas e horas consultadas do ponto têm origem distinta; ausência histórica permanece Não informado. A rodada de integração de 01/11 registra 157 testes e nove cenários de navegador; a impressão foi conferida em HTML, sem geração de PDF binário. Em 02/11, o clima noturno passou a ser opcional: manhã e tarde continuam obrigatórias. A rodada focal registra 52 testes e seis E2E, além de lint e manual sincronizado. Demonstração e evidências no documento da integração.

Checkout: `C:/dev/releases/previsoes-gerenciais-local-20261101`, branch `codex/previsoes-gerenciais-local-20261101`. Base: snapshot da consolidação `C:/dev/releases/marcell-saas-release-20261101`, HEAD `23057ef1`, incluindo alterações locais de outras tarefas. Essas alterações foram preservadas. Entrega sem commit, push ou publicação.

## Demonstração reproduzível

Na raiz deste checkout, execute:

```powershell
node scripts/management-forecasts-preview.mjs
```

Abra `http://127.0.0.1:4220` e entre com `piloto@local.test` / `piloto-local`. O servidor usa dados sintéticos de `scripts/fixtures/management-forecasts-data.mjs`; intercepta as APIs localmente e rejeita `save`, `save-sections` e `operational-command`. Não conecta à produção. Esta proteção pertence à demonstração, não substitui autorização do app real.

No desktop: Financeiro → Mais áreas → Previsões gerenciais. No celular: Financeiro → Áreas do financeiro → Previsões gerenciais. As consultas internas usam botões no desktop e o seletor Consulta de previsões no celular.

Selecione **Residencial Alameda** e **01/11/2026** como Data de referência da previsão. Para reproduzir a linha de mão de obra abaixo, escolha **Simulação manual separada** em **Fonte das premissas da mão de obra**; as premissas não devem ser digitadas no modo automático. Use os cenários abaixo para conferir o resultado.

| Consulta | Premissas e conferência | Resultado esperado na demonstração |
| --- | --- | --- |
| Caixa de 13 semanas | Saldo inicial do cenário: R$ 5.000; Conta prevista da projeção: Conta fictícia da demonstração; confirmar saldo no recorte após trocar a conta | Primeira semana: saídas R$ 18.000, entradas R$ 25.000; menor saldo diário −R$ 13.000. Ver títulos abre a memória; exportação registra conta, títulos e premissas |
| Custo final por obra | Conferir carteira, memória e alerta de apropriação | Incorrido R$ 19.200 + restante R$ 102.000 = R$ 121.200; R$ 1.200 sem apropriação por etapa exigem conferência. Conferir em Custos por etapa permite revisar a origem e Voltar às previsões gerenciais retoma a consulta |
| Previsão de mão de obra | Intervalo 02/11 a 27/11/2026, segunda a sexta, 8 horas/dia; trazer Alvenaria do orçamento; confirmar restante 1.200 m², função pedreiro, RUP 0,8 Hh/m²; 4 pessoas disponíveis e R$ 30/h | 20 dias declarados; 960 horas-pessoa; 6 pessoas necessárias, déficit de 2; custo restante R$ 28.800; histograma de 13 semanas e memória por serviço |

RUP significa razão unitária de produção, em horas-pessoa por unidade. Trazer referência do orçamento deixa a quantidade restante em branco para confirmação. No exemplo, 1.200 × 0,8 = 960 Hh e 960 ÷ (20 × 8) = 6 pessoas.

Abra Ajuda em cada consulta. Na mão de obra, a ajuda deve mostrar Previsões · Mão de obra e preservar os campos preenchidos ao fechar. Alterne entre consultas para conferir a preservação das premissas na sessão. Exporte o CSV antes de recarregar: recarregar ou sair descarta o cenário.

## Alcance funcional

- Caixa consulta títulos existentes pelo motor financeiro canônico; liquidações não entram duas vezes. Vencidos e títulos sem data têm tratamento explícito. Saldo inicial depende da confirmação para obra, conta e data; orçamento ou pedido sem obrigação não vira saída automaticamente.
- Custo final reutiliza `workStageCosts`: incorrido + restante + reserva de risco + impactos adicionais. Compras pendentes já compõem o restante. O corte de competência usa os registros atuais até o mês da referência; não reconstrói informações conhecidas no passado. Sem base relevante, o total fica indisponível.
- Mão de obra é dimensionamento paramétrico, não previsão estatística nem projeção de folha. O modo automático usa produção revisada do diário, horas do ponto, jornada do RH e custo-hora das parcelas apuradas completas da projeção canônica da folha; desconta feriados do calendário de Planejamento/Folha. Equipe observada não garante escala futura. A simulação manual continua separada: distribui demanda nos dias declarados, sem desconto automático de feriados, ausências ou alocações externas; equipe é contada uma vez por função e custo exige preço informado. Nenhum modo nivela frentes.
- Perfil administrador ou financeiro ativo acessa a consulta, respeitando o vínculo de obra. As consultas e os CSVs não criam títulos, pagamentos, contratações ou alterações em ponto e folha.

## Comparação com o padrão existente

Referências consultadas: `DESIGN.md`, `docs/PADRAO-INTERFACE.md` e orientação `impeccable/reference/document.md`. Esta entrega prolonga o mundo operacional MARCELL/SAP existente. Usa PageHeader, WorkspaceNavigation, FilterBar, FormSection, Button, Input, Select, Alert e EmptyState compartilhados; reaproveita `financial-reports.css` para tabelas e composição responsiva. Não introduz token CSS, texto genérico global ou primitivo próprio de interface.

Comparação direta com o checkout da consolidação confirmou identidade de `src/design-system/foundations.js`, `src/design-system/copy.js` e `src/features/financeiro/financial-reports.css`. `DESIGN.md` não apresenta diferença de conteúdo no comparador Git; a diferença do hash bruto decorre das terminações de linha. O documento existente contém definições repetidas de `operational-canvas`; essa condição anterior não foi corrigida nem ampliada por esta documentação. `PRODUCT.md` permanece ausente. Não foram alterados DESIGN, sidecar ou baseline do legado nesta documentação.

A captura final `artifacts/previsoes/cost-1440.png` mostra a hierarquia, controles e memória completos. A revisão ship foi concluída após recapturar o desktop com movimento reduzido: a captura inicial ocorreu durante uma transição, sem defeito de interface identificado. No celular, a evidência inclui o dimensionamento em `labor-capacity-390.png`. As capturas documentam os estados exercitados, não certificam todas as superfícies legadas do ERP.

## Evidências de validação

Resultados da primeira rodada local registrada nos logs da raiz; a rodada posterior de integração está documentada em `docs/INTEGRACAO-PONTO-DIARIO-PREVISOES.md`:

| Evidência | Resultado |
| --- | --- |
| `previsoes-tests.log` | 93 testes aprovados em 11 arquivos |
| `previsoes-e2e.log` | 3 cenários aprovados: fluxo completo em 1440 px e 390 px; bases incompletas e serviço manual |
| `previsoes-lint.log` | Fronteira financeira, nomes, armadilhas de UI, design e manual aprovados; 103 guias cobrem 65 abas |
| `previsoes-types.log` | TypeScript aprovado |
| `previsoes-build.log` | Build direto Vite aprovado; aviso de chunks acima de 650 kB permanece registrado |
| `previsoes-design.json` | Detector da revisão: `[]` |

Os E2E conferem 13 semanas, CSV com origem, memória de títulos, retorno de Custos por etapa, premissas preservadas, ajuda contextual, ausência de erros de página e de solicitações de gravação, além de ausência de overflow horizontal da página no fluxo exercitado. O teste de base incompleta mantém custo indisponível e permite serviço manual identificado. Configuração: `playwright.management-forecasts.config.js`, com servidor sintético próprio na porta 4221.

Capturas: `artifacts/previsoes/cash-{1440,390}.png`, `cost-{1440,390}.png`, `labor-{1440,390}.png`, `help-{1440,390}.png` e `labor-capacity-390.png`. Build local em `artifacts/previsoes/build/`.

Ajuda das previsões revisada em `src/features/help/help-content.js` em 01/11/2026, com os guias `fin_previsoes`, `fin_previsoes_cash`, `fin_previsoes_cost` e `fin_previsoes_labor`; `useHelpTopic` acompanha a consulta interna. A revisão de 02/11 atualizou o guia `rdo` para noite opcional e a data geral da ajuda. `docs/MANUAL_DO_APP.md` foi regenerado e a sincronização verificada. Este documento técnico não altera passos do operador.

Para integração posterior, conferir somente o delta de previsões sobre a consolidação vigente. Não substituir arquivos com versões anteriores nem incluir alterações locais de outras tarefas por associação ao checkout. Snapshots persistidos, validação temporal, estatística e probabilidades permanecem no roadmap.
