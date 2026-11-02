# Roadmap de experiência — Financeiro e Compras MARCELL

Data: 31/10/2026. Entrega desta rodada: pesquisa, inspeção em consulta e planejamento local. Marca, logo e direção visual MARCELL preservadas. Não houve implementação funcional, alteração de registros da Vobi, instalação de skills, push, PR ou deploy nesta rodada.

## Acompanhamento da execução

Atualização após autorização para executar a quarta onda: **onda 4 de 4 concluída no escopo do piloto local; UX01 a UX08 entregues, 8 de 8 entregas**. A contagem não representa uma medição percentual de maturidade ou validação em produção. Limites de UX07/UX08 estão no relatório da onda 4.

| Entrega | Situação | Nota manual de design |
|---|---|---:|
| UX01 — Espaço e hierarquia em Compras | Concluída localmente | 8,6/10 |
| UX02 — Entrada financeira orientada à rotina | Concluída localmente | 8,4/10 |
| UX03 — Conferência conectada da compra | Concluída localmente | 8,7/10 |
| UX04 — Próxima ação na fila financeira | Concluída localmente | 8,6/10 |
| UX05 — Revisão de conciliação | Concluída localmente | 8,7/10 |
| UX06 — Leitor de evidências | Concluída localmente | 8,8/10 |
| UX07 — Consultas salvas e lotes | Entregue localmente: consultas e conferência em sequência; sem classificação automática em massa | 8,7/10 |
| UX08 — Necessidade e caixa no tempo | Entregue localmente: consulta temporal e simulação de datas; sem projeção de necessidades sem cobertura | 8,6/10 |

Critérios das notas, alterações, correção de continuidade e evidências: [entrega da primeira onda](ROADMAP-UX-ONDA-1-2026-10-31.md). A cada conclusão, registrar nota, motivos, limitações verificadas e a posição no roadmap. Textos, botões, campos, espaçamentos e estados seguem o sistema existente; padrões duráveis ficam em `DESIGN.md`.

Conferência conectada, próxima ação, validações e notas de UX03/UX04: [entrega da segunda onda](ROADMAP-UX-ONDA-2-2026-10-31.md).

Revisão de conciliação, evidências além da nota fiscal, validações e notas de UX05/UX06: [entrega da terceira onda](ROADMAP-UX-ONDA-3-2026-10-31.md).

Consultas por usuário/empresa, seleção documental, necessidades e compromissos no tempo: [entrega da quarta onda](ROADMAP-UX-ONDA-4-2026-10-31.md). As quatro ondas do piloto estão entregues localmente. Antes de ampliar a operação, medir uso com usuários e volumes representativos, validar classificação em massa e cobertura das necessidades revisadas; não há publicação autorizada.

A descrição de pesquisa acima registra a rodada original. A execução posterior das quatro ondas está documentada no acompanhamento e nos relatórios vinculados; permanece sem deploy.

Após as quatro ondas, houve uma [revisão geral de layout e fluxos no navegador](REVISAO-GERAL-UI-2026-10-31.md), com foco em Financeiro e Compras. O roadmap permanece em 4 de 4 ondas do piloto; os refinamentos posteriores não criam uma quinta onda nem equivalem a validação de produção.

O próximo ciclo está no [roadmap para experiência 9,5/10](ROADMAP-SAAS-95-2026-10-31.md): cinco ondas e dez entregas, com 70% da avaliação voltada ao fluxo, próxima ação e recuperação. Esse ciclo começa em planejamento, sem alterar a conclusão das quatro ondas anteriores.

## Direção recomendada

Aproveitar melhor a tela e tornar a operação contínua: localizar a pendência, entender sua origem, conferir a evidência e abrir a ação correta com o mesmo contexto. Reutilizar as ferramentas existentes antes de criar outra central, outro dashboard ou novos motores financeiros.

Começar pelo espaço ocupado antes dos registros em Compras e pela passagem entre pedido, recebimento, documento fiscal, parcela e extrato. Análise gerencial continua acessível, com menor competição com a tarefa diária.

## Base e limites da análise

| Evidência | Origem | O que foi observado |
|---|---|---|
| V01 | Vobi autenticada, Financeiro → Resumo | Contas próximas dos indicadores; receitas e despesas separadas em abertas, vencidas e realizadas; listas seguintes. Na janela observada de 1280 × 720, múltiplas áreas de rolagem e um total quebrando entre dígitos |
| V02 | Vobi autenticada, Despesas | Consulta por parcelas e base de data; filas de vencidos, hoje, a vencer e pagos; busca, importação XML e tabela com fornecedor, projeto e duas datas distintas |
| V03 | Vobi autenticada, Contas e Extratos → Extratos | Seleção de contas, saldo e pendências de conciliação próximos; acesso a conciliações pendentes; busca e tabela. O painel de contas ocupa parte relevante da altura; valores de tabela também quebram na janela observada |
| V04 | Vobi autenticada, Compras → Solicitações | Etapas, contagens, necessidade, prioridade, responsável, origem e ações na mesma consulta |
| M01 | MARCELL local, Compras → Cotar | Primeiro registro começa em aproximadamente y=836 na janela de 610 × 1244, no topo da página. Antes dele: cabeçalho, ações, seletor do fluxo, título da área, integração DRE, segundo título, busca, filtros, situações e resumo de retornos |
| M02 | MARCELL local, Financeiro → Hoje e fonte atual | Aviso acionável de vencidos já existe. Cada linha ainda oferece a ação genérica “Ver memorial”, em `FinanceToday.jsx` |
| M03 | Fonte atual e documentação local | Dossiê, leitor fiscal, filas e revisão de conciliação, relatórios e contexto entre módulos já existem. A revisão de conciliação já apresenta evidências, alternativas e valores parciais |
| E01 | Documentação oficial Odoo, Omie e Conta Azul | Referências de produto; não houve acesso autenticado nem execução de jornadas nesses três ERPs |

A comparação nova da Vobi usa a sessão disponível no navegador integrado. Ela complementa a [revisão anterior](REVISAO-VOBI-FINANCEIRO-2026-10-31.md), cuja ferramenta não compartilhava essa sessão. Não se extrapola a cobertura da inspeção para todos os planos ou recursos da Vobi. Detalhes de cotações e pedidos da [varredura anterior](VARREDURA-VOBI-COMPRAS-2026-10-30.md) são históricos, não uma nova validação completa nesta rodada.

Os registros privados consultados não foram reproduzidos neste relatório. O MARCELL local usa os dados de demonstração da prévia; as observações não medem o volume nem a qualidade da base de produção. A medida de 610 px não representa uma nova bateria em 390 px ou uma medição de desktop.

## O que aproveitar dos outros ERPs

| Referência | Padrão útil | Aplicação ao MARCELL | Cuidado de desenho |
|---|---|---|---|
| Vobi | Etapas de compra e parcelas por situação; conta e pendências junto do extrato | Prioridade e próxima ação no registro; contexto bancário próximo da revisão | Evitar repetir os painéis altos, rolagens concorrentes e quebras de valores observados |
| Odoo | Documento original junto da fatura; vínculo com linhas do pedido e controle por quantidades recebidas | Comparar pedido, recebido e faturado no espaço de conferência existente | Regras de bloqueio de pagamento dependem da política do MARCELL; não importar automaticamente a política do outro ERP |
| Omie | Recebimento relaciona itens, nota, parcelas e informações gerenciais; associação a contas a pagar existentes | Continuidade entre compra, documento e parcela; reduzir redigitação e risco de criar obrigação duplicada | Abrir ou sugerir um vínculo não equivale a confirmar recebimento nem criar lançamento |
| Conta Azul | Sugestões de conciliação e revisão de associações, incluindo combinações de lançamentos | Tornar motivos, saldo restante e impacto da confirmação mais claros na revisão já existente | Sugestão e identidade da contraparte não comprovam correspondência; confirmação permanece explícita |

Fontes primárias: [extrato Vobi](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi), [gestão de compras Vobi](https://ajuda.vobi.com.br/pt-br/articles/8775687-utilizando-a-gestao-de-compras-na-vobi), [faturas de fornecedor Odoo 19](https://www.odoo.com/documentation/19.0/applications/finance/accounting/vendor_bills.html), [controle de faturamento de compras Odoo 19](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/manage.html), [recebimento de NF-e Omie](https://ajuda.omie.com.br/pt-BR/articles/1419039-recebimento-da-nf-e-de-fornecedor), [conciliação Conta Azul](https://ajuda.contaazul.com/hc/pt-br/articles/44909145995405-Concilia%C3%A7%C3%A3o-trilha-de-v%C3%ADdeos-sobre-a-concilia%C3%A7%C3%A3o-banc%C3%A1ria).

## Base existente que não deve virar trabalho duplicado

| Capacidade | Situação e referência | Evolução recomendada |
|---|---|---|
| Contexto entre módulos e retorno à origem | Implementado em sessão, incluindo obra, filtros e telas internas. [Contrato](CONTEXTO-PLANEJAMENTO-COMPRAS.md) | Tornar o contexto mais compacto e compreensível; consultas salvas são uma capacidade diferente, ainda candidata |
| Planejamento → materiais → solicitação | Implementado com identificação de materiais, referência da etapa, estoque/pedidos informativos e confirmação de quantidades. Mesmo contrato acima | Refinar o formulário de revisão; não criar outra geração automática de compras |
| Decisão junto da cotação | Implementada no cabeçalho e ao final da análise | Recuperar altura antes do primeiro registro e melhorar comparação estreita |
| Portal, revisão de respostas, histórico de preços, contratos e condições históricas | Sete etapas locais documentadas no [roadmap de Compras](ROADMAP-COMPRAS-VOBI.md) | Integrar apresentação e pendências; não reconstruir essas funções |
| Hoje, previsão, documentos, relatórios, custos e fechamento | Consolidados na [revisão financeira](CONSOLIDACAO-FINANCEIRO.md) | Facilitar descoberta e passagem entre registros |
| Vencidos na entrada, relatórios compactos, ordem do fechamento, saldo inicial ausente/zero e seleção de conta prevista | Já tratados na [evolução operacional de 31/10](LAYOUT-OPERACIONAL-CAIXA-2026-10-31.md) | Preservar contratos; integração de saldo bancário conferido ainda exige origem, data e cobertura |
| Conciliação com evidências, parciais e operações em lote | Existente em `ConciliacaoView.jsx`, `ReconciliationReview.jsx` e motores de conciliação | Refinamento de navegação e apresentação; não adicionar segundo motor nem outra ação em lote equivalente |

## Jornada desejada

```mermaid
flowchart LR
  A[Planejamento e necessidade] --> B[Solicitação]
  B --> C[Cotação e decisão]
  C --> D[Pedido]
  D --> E[Recebimento físico]
  D --> F[Documento fiscal]
  E --> G[Conferência das diferenças]
  F --> G
  G --> H[Parcela e pagamento registrado]
  H --> I[Revisão do extrato]
  I --> J[Fechamento e análise]
```

O desenho representa navegação e conferência. Nota pode chegar antes do material; pagamento pode ocorrer antecipadamente; uma compra pode ter vários recebimentos e notas. A interface deve suportar essas situações, sem impor a ordem do desenho como regra contábil.

No registro, apresentar três camadas: **situação → evidência da pendência → próxima ação permitida**. Manter distintos recebido físico, faturado, aprovado, pago e conciliado. Não resumir todos em um único status verde.

## Sequência e dependências

Estimativas S/M/L indicam porte relativo, não prazo comprometido. Reestimar após revisar os contratos e o diff atual de cada módulo.

| Onda | Entregas | Dependência | Porte |
|---|---|---|---|
| 1 — Recuperar espaço | UX01 e UX02: Compras e entrada financeira | Tokens e permissões existentes | M |
| 2 — Completar uma jornada | UX03 e UX04: conferência da compra e ação financeira contextual | Onda 1; mapa dos vínculos e comandos já existentes | L |
| 3 — Revisar exceções com menos navegação | UX05 e UX06: conciliação e documentos além da ficha fiscal | Onda 2; contratos de anexos e vínculos | M/L |
| 4 — Ganhar escala com evidência | UX07 e UX08: consultas e planejamento temporal | Medição do piloto; cobertura de dados e regras explícitas | L, divisível |

### UX01 · P0 · Espaço e hierarquia em Compras

**Problema:** M01; o usuário percorre muitos controles antes de encontrar a compra.

**Entrega:** um cabeçalho de contexto e ação da área; remover títulos redundantes; levar a consulta DRE para análise secundária acessível; manter busca/situação e resumo de filtros próximos dos resultados. Na área Cotar, “Adicionar cotação” deve ter maior relevância local que ações globais de outras etapas. Retornos pendentes continuam visíveis sem exigir um painel alto quando vazios.

**Reuso:** `PageHeader`, `WorkspaceNavigation`, `WorkspaceFilters`, `PurchaseNavigation`, `SupplierResponseQueue`, `QuoteComparisonWorkspace` e tokens de `DESIGN.md`.

**Desktop:** usar largura para lista e detalhe quando a leitura permitir; identificação da compra e ação permanecem juntas. **Celular:** lista → detalhe → revisão; controles adicionais progressivos e retorno preservado, sem três painéis lado a lado.

**Aceite:** em 390 × 844 e 1440 × 900, com dados de demonstração e página no topo, identificação do primeiro registro começa antes de y=600; busca, situação e obra continuam acessíveis. Ausência de registros mostra orientação equivalente. Não ocultar filtros ativos nem aprovação, perda de proposta ou erro para cumprir a meta. Comparativo mantém unidade, adicionais e cobertura; sem rolagem horizontal da página.

### UX02 · P0 · Entrada financeira orientada à rotina

**Problema:** M02; a seleção apresenta operação e análises junto de ferramentas auxiliares, sem explicar a finalidade de cada grupo.

**Entrega:** organizar destinos em rotina (Hoje, pagamentos, documentos e acesso à conciliação), análise (visão, relatórios e custos) e ferramentas administrativas. Usar os destinos existentes, com mesma autorização; validar a organização sem ampliar acesso à conciliação. Mostrar vencimento/competência/data efetiva conforme a tela, sem um período global ambíguo.

**Reuso:** navegação financeira atual, `FinanceToday`, `FinancialOverviewMetrics`, contexto de workflow.

**Aceite:** em celular o destino ativo e seu grupo são identificáveis; nenhum destino autorizado desaparece; usuário restrito à obra continua restrito. A fila Hoje conserva sua escolha e aviso de vencidos. Revisão por teclado e zoom de 200%; evitar menus de ícones sem nome.

### UX03 · P1 · Conferência conectada da compra

**Problema:** M03 e referências Odoo/Omie; evidências existem, mas comparar diferenças pode exigir alternar entre ficha da compra e conferência fiscal.

**Entrega:** dentro do detalhe existente, reunir referências de pedido, recebimentos, documento original, parcelas e diferenças documentadas. Destacar item/unidade, quantidade, valor e vínculo ausente; distinguir divergência comprovada de dado indisponível. Abrir a operação existente no contexto certo, com retorno.

**Reuso:** `PurchaseDossier`, `purchase-dossier-status`, `InvoiceConference`, `DocumentCenter`, `FinancialMemorial`, comandos existentes. Antes de implementar, mapear IDs de item e relações reais: não associar notas por descrição parecida ou apenas fornecedor+valor.

**Desktop:** documento e conferência lado a lado onde houver espaço útil. **Celular:** alternância clara entre original e dados, preservando seleção e rascunho; resumo da divergência e ação próximos.

**Aceite:** percurso pedido → nota → parcela → retorno sem redigitar obra ou perder o registro. Exercitar nota anterior à entrega, recebimento parcial, várias notas, frete e unidades diferentes, documento cancelado, compra sem nota e pagamento antecipado. Abrir a conferência não grava; nenhum novo bloqueio financeiro é criado por um alerta visual.

### UX04 · P1 · Próxima ação na fila financeira

**Problema:** M02; “Ver memorial” explica o valor, mas não comunica qual trabalho resolverá a pendência.

**Entrega:** manter o memorial como consulta e oferecer, quando a origem e a permissão forem inequívocas, “Abrir parcela”, “Conferir documento” ou “Revisar vínculo bancário”. Mostrar motivo e responsável somente se houver fonte real para esses dados. Na ausência de destino confiável, conservar a consulta e informar o limite.

**Reuso:** `FinanceToday`, `FinancialMemorial`, navegação de documentos e workflow; sem comandos financeiros novos nesta primeira versão.

**Aceite:** um acesso da linha leva ao registro editável ou à revisão correta; esse acesso não paga, aprova ou concilia. Retorno recupera fila, obra e posição. Sem permissão, oferecer consulta permitida; pagamento parcial mostra saldo restante e distingue pago de conciliado.

### UX05 · P1 · Revisão de conciliação mais legível

**Problema:** V03/E01 orientam a proximidade de conta e pendência. O MARCELL já tem identificação, evidências, candidatos e vínculos parciais; precisa avaliar sua leitura como uma tarefa completa.

**Entrega:** hierarquia consistente entre movimento bancário, candidatos, valores selecionados e restante; resumo da conta/data e indicação de pendências; reduzir repetição e percursos entre lista e revisão. Prototipar lado a lado no desktop e sequência única no celular usando o painel existente.

**Reuso:** `ConciliacaoView`, `ReconciliationReview`, `ReconciliationEvidence`, filas de divergências e operações em lote atuais.

**Aceite:** motivo da sugestão e diferença em centavos visíveis antes da confirmação. Exercitar valor parcial, vários lançamentos, transferência, duplicidade, contraparte identificada sem título, troca de conta, comando interrompido e período fechado. Operações já aplicadas são preservadas e comunicadas; não reaplicar ao tentar novamente. Não apresentar saldo hipotético como saldo certificado pelo banco.

### UX06 · P2 · Leitor de evidências além da nota fiscal

**Problema:** documento original com campos existe na ficha fiscal; comprovantes e anexos de pedidos/medições não devem exigir simular uma nota para serem revisados.

**Entrega:** reaproveitar leitor protegido para os tipos de documento suportados, com origem, vínculo, tipo e estado do acesso. Separar sem anexo, endereço indisponível, acesso expirado e falha do leitor. Vínculo ao registro e conferência fiscal continuam conceitos diferentes.

**Reuso:** `PdfDocumentPreview`, `FinancialDocumentLink`, validação de `document-links`, central documental e anexos existentes. **Dependência:** confirmar contrato de acesso/autorização de cada provedor; não depender de integração nova para abrir links já disponíveis.

**Aceite:** memorial e central abrem a mesma evidência autorizada; PDF/imagem/XML conforme suporte; falha de prévia oferece original quando permitido e não altera a situação documental automaticamente. Sem gravações por simples consulta.

### UX07 · P2 · Consultas salvas e lotes orientados à pendência

**Problema:** preservar sessão já está entregue; recuperar uma consulta após recarregar é uma necessidade diferente. Aplicar lotes novos sem revisar os existentes criaria duplicidade de operações.

**Entrega:** primeiro medir uso e validar quais filtros merecem uma consulta nomeada. Persistir apenas preferências válidas por usuário/empresa, sem documentos, links assinados ou rascunhos financeiros. Para classificação documental, estudar seleção com prévia, elegibilidade e erro por registro, reutilizando comandos existentes; não recriar lote de conciliação.

**Aceite:** troca de conta/usuário não restaura dados de outra sessão; consulta desatualizada remove referências inválidas com explicação. Lote exclui itens bloqueados, informa resultados individuais e não duplica a operação em reenvio. Virtualização só entra após medição de lentidão real com volume representativo.

### UX08 · P2 · Necessidade de compra e caixa distribuídos no tempo

**Problema:** planejamento → solicitação está entregue; a referência da etapa inteira não determina automaticamente quanto comprar ou em que conta haverá caixa.

**Entrega:** relacionar datas válidas, necessidades revisadas, compras existentes e títulos previstos por obra/período; expor o que é estimativa, compromisso e obrigação. Antes da projeção bancária, definir como a conta prevista será informada na origem e como obter saldo com data e cobertura de conciliação. Não atribuir saldo total da empresa à obra por inferência.

**Reuso:** `PlanningPurchaseNeeds`, `purchase-needs`, `WorkStageCosts`, `CostControlReview`, `CashForecast` e histórico financeiro existente.

**Aceite:** compra já comprometida não reaparece como necessidade adicional; estoque compartilhado não é alocado automaticamente; quantidade e unidade exigem evidência. Etapas sem data, títulos sem conta e saldo desconhecido ficam explícitos. Medir o efeito de reagendamento sem alterar lançamentos ou pedidos por navegação. Escopo depende da qualidade dos vínculos; não é só uma mudança visual.

## Padrão de layout para as próximas entregas

- Preservar MARCELL, logo, Source Sans 3 local e tokens aprovados; esta pesquisa não justifica trocar novamente a fonte ou adotar o tema de outro ERP.
- Uma ação principal por contexto, nomeada com verbo e objeto; consultas secundárias próximas, sem competir com a resolução da pendência.
- Usar espaçamentos do sistema, com maior proximidade entre rótulo/campo e registro/ação; reduzir invólucros repetidos, não a legibilidade do conteúdo.
- Valores monetários e unidades não quebram no meio dos números. Nomes podem envolver linhas; tabelas extensas usam região de rolagem identificada, sem transbordar a página.
- Desktop prioriza comparação útil e seleção/detalhe. Celular preserva identidade, prazo, saldo e ação na ordem de leitura; não comprimir a tabela inteira até ficar ilegível.
- Foco visível, rótulos de controles, estado além da cor, alvos de toque de aproximadamente 44 px, navegação por teclado e feedback de salvamento usando componentes existentes.
- Evitar painéis com altura fixa e rolagens verticais aninhadas quando uma rolagem principal resolve a tarefa. A ação fixa não pode encobrir conteúdo, teclado virtual ou foco.

## Skills pesquisadas e seleção

Pesquisa de arquivos locais e repositórios primários. Os arquivos externos foram consultados como material; não foram instalados nem executados. Não há avaliação integral de segurança, licença ou de todas as referências dessas skills comunitárias nesta rodada.

| Skill/fonte | Recomendação | Uso concreto e limite |
|---|---|---|
| Impeccable + shadcn, instaladas | Base obrigatória pelo AGENTS.md | Hierarquia, componentes e coerência com o projeto. Esta rodada não executou workflows formais de crítica pontuada nem delegação |
| data-dashboard-design, instalada | Aplicada como orientação | Priorizar decisão e composição dos indicadores; reduzir painéis sem relação com a tarefa |
| web-design-guidelines, instalada | Incluir na revisão de implementação | Auditoria de controles, teclado e responsividade; consultar a versão oficial na execução. Não alegar auditoria completa nesta pesquisa |
| vercel:react-best-practices e vercel-composition-patterns, instaladas | Usar conforme o diff | Revisar múltiplos componentes React e compor o espaço de conferência sem proliferar estados e propriedades booleanas |
| [interface-design](https://github.com/Dammyjay93/interface-design/blob/main/.claude/skills/interface-design/SKILL.md) | Melhor candidata adicional para o produto SaaS | Foco declarado em apps, ferramentas, dashboards e administração. Útil para densidade, navegação e consistência; manter `DESIGN.md` como fonte local de decisões |
| [yafa-ui-dashboard](https://github.com/rejourneyco/yafa-ui-dashboard/blob/main/SKILL.md) | Complemento seletivo | Tabelas, filtros e adaptação de dashboards. Conferir referências antes de aplicar; não importar cores, fonte ou cartões padrão para o MARCELL |
| [frontend-design da Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | Complemento de acabamento | Direção visual e qualidade de componentes; subordinada ao tema aprovado e à operação diária |
| [finfin/awesome-frontend-skills](https://github.com/finfin/awesome-frontend-skills) | Catálogo para descoberta | É um índice de skills, não uma skill única a executar. Selecionar conforme o problema concreto |

As buscas não identificaram uma skill local específica de SaaS entre as consultadas. Não é necessário instalar uma coleção inteira para começar UX01. A consulta de `skill-installer` orientou a pesquisa; instalação não faz parte desta entrega.

## Validação e medição do piloto

Primeira fatia recomendada: **Cotar com menos cabeçalhos → pedido → conferência de nota e recebimento → parcela → revisão do extrato → retorno à origem**. Manter dados sintéticos e comandos interceptados na prévia local.

| Medida | Linha de base disponível | Critério proposto |
|---|---|---|
| Posição do primeiro registro em Cotar | y≈836, janela 610 × 1244, uma captura atual | Medir novamente em 390 × 844 e 1440 × 900; meta UX01 de y<600 nesses recortes |
| Acesso da fila financeira à revisão correta | Ação genérica “Ver memorial” na fonte atual | Um acesso da linha ao destino confiável, mantendo memorial disponível |
| Tempo pedido → documento → parcela | Ainda não medido | Medir antes/depois com o mesmo roteiro e dados; publicar valores observados, sem prometer percentual de ganho |
| Continuidade e retrabalho | Contratos e verificações anteriores documentados | Nenhuma perda de obra/seleção/retorno nos cenários da fatia; não duplicar título ou comando |
| Leitura e operação responsivas | Inspeção atual estreita e evidências anteriores separadas | Capturas novas em 320, 390, 768, 1024 e 1440 px; zoom 200%, teclado e textos longos |
| Exceções de negócio | Motores e comandos atuais | Parcial, antecipado, cancelado, sem vínculo, sem permissão e competência fechada com resultados explícitos |

Antes de concluir cada implementação: revisar o diff concorrente, testar contratos alterados, executar verificações estáticas relevantes e revisar a jornada no navegador. Não executar `npm run build` indiscriminadamente: o projeto possui hooks de migração; usar a rotina local documentada apropriada ao escopo.

Indicadores de acompanhamento candidatos: tempo de revisão de cotação, idade de resposta pendente, entrega atrasada, documentos sem vínculo e conciliações restantes. Definir fonte, janela, responsável e composição antes de criar mais cartões. Não há ganho de produtividade quantitativo validado nesta pesquisa.

## Fora desta rodada

Execução de pagamentos, Open Finance, comunicações automáticas com fornecedores, mudanças de alçada/bloqueio, fechamento real e implantação. Essas capacidades não são pré-requisitos para melhorar o layout e a continuidade da jornada. A prévia local existente permanece disponível; esta documentação não altera seu comportamento.
