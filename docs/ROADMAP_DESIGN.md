# Roadmap de padronização de design — ARCD Obras

> Criado em 17/08/2026. Este documento existe para dar sequência ao item já
> previsto em [MATRIZ_MODULOS_10_10.md](./MATRIZ_MODULOS_10_10.md) ("Migrar
> as telas de maior uso para primitives/tokens, com regressão visual e de
> contraste") com um plano concreto, priorizado e verificável — não é uma
> reescrita de uma vez, é uma sequência de fases pequenas, na mesma
> disciplina usada na extração de módulos de `LegacyApp.jsx`
> (`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`): um passo por vez, suíte
> completa verde a cada passo, sem big bang.

## Critério de avaliação (framework de ranking)

> Proposto pelo usuário em 17/08/2026, formalizado aqui como a régua
> oficial de avaliação deste roadmap. Substitui qualquer instinto de
> "parece mais bonito" por um placar com peso, porque para um sistema de
> gestão de obras **clareza, velocidade e ausência de erro valem mais que
> estética** — um app lindo que atrasa uma medição no campo é um app pior,
> não melhor.

Nota de 0 a 100, dividida em três blocos:

| Bloco | Peso | Critérios internos |
| --- | ---: | --- |
| **Experiência do usuário** | 50 | Usabilidade e facilidade de aprendizado (20%); Organização da informação (15%); Prevenção de erros e feedback (7%); Acessibilidade e legibilidade (5%); Percepção de velocidade (3%) |
| **Eficiência para gestão de obras** | 35 | Eficiência nas tarefas de obra (15%); Experiência mobile/em campo (15%); Dashboards e visualização de dados (10%, ajustado para caber no bloco — ver nota) |
| **Qualidade visual** | 15 | Consistência visual e UI (8%); Qualidade estética (2%); resíduo do bloco de dashboards |

> Nota: os pesos individuais do usuário somam 100% distribuídos em 10
> critérios; o agrupamento em 3 blocos (50/35/15) é uma segunda camada de
> leitura para não deixar um app esteticamente impecável, mas ruim de
> operar, subir no ranking. Manter os dois níveis (peso por critério E
> teto por bloco) ao pontuar.

### Os 5 testes de tarefa real

A nota de "Eficiência nas tarefas de obra" não é opinião — é medida
executando estas 5 tarefas e contando passos/cliques até o resultado:

1. Registrar uma ocorrência com foto.
2. Consultar o avanço físico da obra.
3. Identificar uma atividade atrasada.
4. Comparar orçamento previsto × realizado.
5. Encontrar um documento ou projeto específico.

Quanto menos passos e menos ambiguidade (o usuário nunca precisa parar
para pensar "onde clico agora"), melhor a nota desse bloco.

### Detalhamento de 3 critérios (sub-pontuação)

Para "Experiência mobile/em campo", "Dashboards e visualização de dados" e
"Consistência visual e UI" — os três critérios mais fáceis de avaliar de
forma genérica e por isso mais fáceis de pontuar errado — usar esta
sub-régua em vez de uma nota de cabeça. Os pontos aqui somam ao peso do
critério dentro do bloco correspondente (não são um segundo ranking
paralelo).

**Experiência mobile/em campo** (parte de "Eficiência para gestão de obras"):

| Sub-critério | Pontos |
| --- | ---: |
| Navegação fácil com uma mão | 0–7 |
| Tamanho adequado de botões e áreas clicáveis | 0–6 |
| Legibilidade de textos e informações | 0–5 |
| Contraste para ambientes externos/sol forte | 0–4 |
| Facilidade para registrar fotos, vídeos e documentos | 0–6 |
| Velocidade para executar ações frequentes | 0–6 |
| Adaptação correta a diferentes tamanhos de tela | 0–4 |
| Funcionamento com internet ruim/offline | 0–4 |
| Feedback claro após salvar/enviar informações | 0–3 |

**Dashboards e visualização de dados** (parte de "Eficiência para gestão de obras"):

| Sub-critério | Pontos |
| --- | ---: |
| Clareza dos principais KPIs | 0–5 |
| Hierarquia das informações | 0–4 |
| Facilidade para identificar atrasos | 0–4 |
| Facilidade para identificar desvios de custos | 0–4 |
| Facilidade para identificar riscos/problemas | 0–3 |
| Qualidade e escolha dos gráficos | 0–3 |
| Uso adequado de cores e alertas | 0–2 |
| Filtros por obra, período, equipe etc. | 0–3 |
| Possibilidade de aprofundar informações | 0–2 |

Teste rápido: um gestor deveria responder em poucos segundos "a obra está
atrasada? quanto? onde? qual atividade está causando o problema? o custo
realizado está acima do previsto?" — se precisa interpretar dez gráficos
para isso, o dashboard não merece nota alta aqui.

**Consistência visual e UI** (bloco próprio, "Qualidade visual"):

| Sub-critério | Pontos |
| --- | ---: |
| Consistência de botões e ações | 0–4 |
| Consistência de cores | 0–3 |
| Consistência de tipografia | 0–3 |
| Padronização dos ícones | 0–3 |
| Padronização de campos e formulários | 0–3 |
| Espaçamentos e alinhamentos | 0–3 |
| Estados visuais: sucesso, erro, alerta, desabilitado | 0–3 |
| Consistência entre desktop, tablet e mobile | 0–3 |

Exemplo do que derruba nota aqui: o mesmo rótulo aparecer com grafia
diferente em dois lugares do mesmo app (não é hipotético — ver achado #2
da auditoria de linha de base).

### Faixas de classificação

| Nota | Classificação |
| --- | --- |
| 90–100 | Excelente — referência de mercado |
| 80–89 | Muito bom |
| 70–79 | Bom, com melhorias importantes |
| 60–69 | Regular |
| 50–59 | Fraco |
| 0–49 | Experiência problemática |

### Regra de atualização deste ranking

Rodar essa avaliação **antes de começar e depois de cada fase concluída**
da Fase 2 em diante — não é uma nota única, é uma série temporal. A
diferença entre a nota "antes" e "depois" de migrar uma tela é a evidência
real de que a fase valeu a pena, no lugar de "ficou mais consistente com
o design-system" (que é meio, não fim).

## Por que não "refazer tudo de uma vez"

Este é um sistema financeiro real, em produção, com pessoas trabalhando
nele hoje. Reescrever a camada visual de 67 telas num único lote seria
trocar disciplina por velocidade — exatamente o oposto do método que este
projeto já usa (extração de módulos verificada teste a teste). Design não é
exceção a essa regra: cada fase abaixo é pequena o suficiente para ser
revisada, testada e revertida sozinha.

## Estado atual (auditoria de 17/08/2026)

| Achado | Evidência |
| --- | --- |
| O design-system moderno já é maduro | `src/design-system/` tem tokens completos (cor, espaçamento, tipografia, raio, sombra, motion, densidade, breakpoints), primitivos (`Button`, `Input`, `Select`, `Dialog`, `Drawer`, `Checkbox`, `Switch`, `Field`), padrões (`ConfirmDialog`, `FilterBar`, `PageHeader`, `SummaryCard`, `StatusBadge`) e tema Carbon com Storybook. |
| ...mas quase não é adotado nas telas operacionais | Só **14 de 67** arquivos `.jsx` fora de `design-system/` importam algo dele — majoritariamente a camada `src/mobile/` e o motor de edição genérico (`src/edit-engine/`). O fluxo desktop principal (`LegacyApp.jsx` e as views extraídas em `src/domains/*/components/`) usa primitivos locais (`Btn`, `Modal`, `Sel`, `Inp`) com estilo inline. |
| A densidade de estilo inline é alta e concentrada | `style={{` aparece **2.973 vezes** em `LegacyApp.jsx`. Nas views extraídas nesta sessão: OrcamentoView 666, ComprasView 557, ComercialView 298, TerceirosView 161. |
| A paleta de cor **já é a mesma**, só duplicada | O objeto `C` hardcoded em `LegacyApp.jsx` (`C.bg`, `C.yellow`, `C.text`...) bate **hex a hex** com os tokens `--arcd-gray-*`/`--arcd-gold-*` de `src/design-system/tokens/primitives.css` — confirmado por comparação direta. **Uma exceção real**: `C.green: #24A148` diverge de `--arcd-green-500: #198038`. Isso significa que unificar cor é migração mecânica de referência, não reconciliação de identidade visual — com uma decisão pontual pendente (qual verde é a fonte de verdade). |
| Dois "teleports" de feedback identificados e **corrigidos nesta sessão** | A classe `animUp`, aplicada a todo painel de modal do sistema, não tinha definição de CSS em lugar nenhum — todo modal aparecia/sumia sem transição. O toast (`showToast`, chamado em centenas de pontos) tinha o mesmo problema. Corrigido em `src/index.css` usando só os tokens de motion já existentes (`--arcd-motion-*`, `--arcd-ease-standard`) — commit `2e6e59a`. Verificado com a suíte completa (1110 testes) + 25 testes E2E + confirmação visual via Playwright. |
| Inconsistência interna de motion | O chevron de expandir/colapsar do card de contrato em Terceiros já usa os tokens corretamente (`src/index.css:6575`), mas o painel que ele anuncia abre em `display:grid` sem transição — o componente sinaliza uma coisa e entrega outra. |

## Princípios que ordenam as fases

1. **Bugs de feedback antes de decisões de estética.** Um modal sem
   transição de entrada não é opinião de design, é lacuna de implementação
   — corrigir custa pouco e não exige consenso de time.
2. **Tokens antes de componentes.** Como a cor já é a mesma, unificar a
   referência (trocar hex hardcoded por `var(--arcd-*)`) é mecânico e de
   risco quase zero. Fazer isso antes de trocar componentes evita refazer
   trabalho quando o componente novo herdar uma cor que ainda não bateu.
3. **Componentização é a fase cara — vai por tela de maior uso, uma de
   cada vez**, seguindo o mesmo método comprovado de extração de módulos
   desta sessão (ver `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`): ler,
   mapear dependências, migrar, testar, só então seguir para a próxima.
4. **Movimento por último**, e só onde sobrevive ao filtro de frequência
   (`find-animation-opportunities`): nunca em ações de teclado/alta
   frequência, nunca em dado financeiro que o usuário está lendo.
5. **Densidade de informação não é negociável.** Ver a tabela de
   anti-padrões abaixo — ela é a régua de aceite para qualquer migração de
   tela financeira densa.

## Fases

### Fase 0 — Lacunas de feedback (concluída em 17/08/2026)

- [x] Animação de entrada de modal (`animUp`) — commit `2e6e59a`.
- [x] Animação de entrada de toast — commit `2e6e59a`.
- [ ] Painel expansível de contrato em Terceiros (`.terceiros-registry-contract__details`) — precisa de mudança de JS (o painel é hoje `{exp && (...)}`, desmontado por completo; uma transição de altura real exige manter o elemento montado e alternar uma classe). Maior risco que os dois itens acima porque toca lógica de componente, não só CSS — fazer como item isolado, com teste próprio.

### Fase 1 — Unificação de tokens de cor

**Decisão tomada em 17/08/2026**: o verde do legado é a fonte de verdade.
`--arcd-green-500` foi atualizado de `#198038` para `#24A148` em
`src/design-system/tokens/primitives.css` (commit seguinte a este) — o
design-system passou a bater com o que já está em produção, não o
contrário. Verificado: suíte completa (1110 testes), testes de
tema/tokens, `architecture:check` e `lint` continuam verdes.

**Achado durante a execução que muda o plano original**: a ideia inicial
era fazer `C` (em `LegacyApp.jsx`) referenciar os custom properties do
design-system via string (`C.green = "var(--arcd-green-500)"`). Isso
**não é seguro** — o código usa `C.<cor>` concatenado com um sufixo hex de
2 dígitos para opacidade em **444 pontos** (`` `${C.blue}0D` ``,
`` `${cor}44` ``, etc., contados em `LegacyApp.jsx` + `src/domains` +
`src/features`). Se `C.blue` virar a string `"var(--arcd-blue-500)"`, essa
concatenação produz `"var(--arcd-blue-500)0D"` — CSS inválido. Trocar
todos os 444 pontos por `color-mix()` para permitir o wiring direto é, por
si só, uma migração do tamanho da Fase 2 inteira, não um ajuste mecânico
de baixo risco.

**Escopo real e seguro da Fase 1, portanto**: sincronizar os *valores*
entre o objeto `C` e os tokens do design-system (como foi feito para o
verde), não a *referência* em tempo de execução. `C` continua sendo hex
literal — é o que o padrão de opacidade por concatenação exige. A
"fonte de verdade única" nesta fase é de intenção/documentação, garantida
por este documento e por um teste, não por `var()` compartilhado.

1. ~~Wiring direto via `var()`~~ — descartado pelo motivo acima.
2. **Feito**: sincronizar o valor divergente do verde.
3. **Feito (17/08/2026)**: as 3 divergências restantes, todas decididas a
   favor do legado (já em produção):
   - `C.card2`/`C.ivory` (`#EDEDED`) vs. `--arcd-gray-100` (`#E8E8E8`) →
     `--arcd-gray-100` atualizado para `#ededed`.
   - `C.cinza` (`#A8A8A8`, "cinza técnico" de série de gráfico/texto
     neutro secundário) não tinha token → criado `--arcd-gray-400`
     (preenche o degrau que faltava entre gray-300 e gray-500; o valor
     bate com o gray-40 padrão do IBM Carbon, então não é arbitrário).
   - `C.ink` (`#121212`, texto sobre fundo de ação/dourado) não tinha
     token → criado `--arcd-gray-950`, e `--arcd-action-primary-text`
     (em `carbon.css` e `semantic.css`, o tema padrão) passou a apontar
     para ele em vez de `--arcd-gray-900` (que é 5 tons mais claro,
     `#161616` vs `#121212` — outra divergência que só apareceu ao
     rastrear o papel semântico real de `C.ink`, não só o valor bruto).
     `architectural.css` (tema alternativo, não usado pelo legado) não
     foi tocado — tem paleta própria, não corresponde ao mesmo papel.
4. **Feito**: `src/integration/design-tokens-parity.test.js` cobre agora
   os 19 pares confirmados (era 15) — nenhuma divergência de cor conhecida
   ficou sem teste.
5. Critério de saída: **fechado**. Todas as divergências conhecidas
   decididas e sincronizadas; suíte completa (1129 testes), testes de
   tema/tokens, `architecture:check` e `lint` verdes.

### Fase 2 — Componentização das telas de maior uso

Ordem sugerida (por tráfego/superfície de erro, mesma lente já usada na
matriz de qualidade):

1. Dashboard — **iniciado em 17/08/2026** (commit `698075d`)
2. Financeiro / DRE — **iniciado em 17/08/2026**: modal de despesa da
   `FinanceiroObraPainel` (visão por obra) migrado primeiro; em seguida o
   modal "Lançar Outras Despesas" da `DRELegado` (visão consolidada,
   `src/LegacyApp.jsx:4398-5372`), mesmo padrão (`Dialog`/`Input`/
   `Select`/`Button`). `DRELegado` ainda tem 3 modais locais (`Btn`/`Sel`/
   `Inp`/`Modal`) por migrar: o modal de upload por IA (mais complexo —
   fluxo de análise em lote e revisão de sugestões) e o modal de detalhe
   de KPI `detalheKpi` (busca + filtro de categoria + tabela) — deixados
   para cortes seguintes, seguindo a regra de migrar um componente por
   vez, do mais isolado ao mais acoplado.
3. Compras
4. Obras
5. Ponto

Para cada tela: migrar um tipo de componente por vez (primeiro botões,
depois selects/inputs, depois modais — nessa ordem, do mais isolado ao
mais acoplado), rodando a suíte a cada passo. **Não migrar uma tela
inteira num commit só.**

Critério de saída por tela: `grep -c "style={{"` cai de forma mensurável,
zero teste quebrado, zero mudança de comportamento, aprovação visual em
claro e escuro (`ThemeSettings`).

#### Dashboard — nota de escopo real

O Dashboard (`src/LegacyApp.jsx:4178-4273`) é estruturalmente diferente
das telas de formulário (Compras, Orçamento): **não usa `Btn`/`Sel`/`Inp`/
`Modal` locais em nenhum lugar** — é uma tela de leitura/KPI, não de
cadastro. A única superfície real de componente compartilhado eram os 3
usos de `LINK_BTN_STYLE` ("Ver portfólio →", "Detalhes →", "Abrir
comercial →"), migrados para `Button` (`variant="link"`) do
design-system, com uma classe (`.dashboard-link-btn`) para preservar a
aparência exata (o `variant="link"` do design-system vem com sublinhado e
tamanho de fonte que o Dashboard nunca teve).

O restante do Dashboard usa `<button>` nativo com layout customizado
(cards de KPI clicáveis, itens de lista com grid próprio, botões de
"ações rápidas" com ícone empilhado sobre o rótulo). Forçar esses dentro
do componente `Button` genérico não é recomendado — não são botões de
formulário, são cards clicáveis com estrutura visual própria; a régua de
anti-padrão deste documento ("se reduz densidade ou legibilidade, é
regressão") também vale para forçar um componente genérico onde a
estrutura não cabe. **Considerar o Dashboard concluído nesta fase** — não
há mais superfície de baixo risco a migrar ali sem também entrar em
redesenho de layout, que é decisão de produto, não de token/componente.

### Fase 3 — Telas de uso médio

Terceirizados, Planejamento, Comercial, Administração, Folha, Medições,
Conciliação — mesma técnica da Fase 2, depois que o padrão estiver
validado nas 5 telas de maior uso.

### Fase 4 — Telas administrativas / baixo uso

Ajustes, Backup, Relatórios avançados, configurações pontuais. Só depois
de Fases 2 e 3 fechadas — são as que menos usuários veem por dia.

### Fase 5 — Polimento de movimento adicional

Depois que a Fase 0 provar o padrão em produção por um tempo:
- Painel expansível de Terceiros (ver Fase 0).
- Crossfade sutil no padrão `{pending?"Salvando...":"Salvar"}` (~15
  ocorrências) — **avaliar se vale o esforço**: é ação de alta frequência
  (tens de vezes/dia), então a régua do `find-animation-opportunities` é
  "nada, ou algo quase imperceptível". Pode ser que a resposta certa seja
  não mexer.
- Crossfade no badge de estado de salvamento (`.rdo-save-state`).

Não adicionar nada além disso sem rodar `find-animation-opportunities` de
novo — o relatório completo desta auditoria está registrado no histórico
desta sessão; não duplicar aqui.

## Anti-padrões a vigiar em toda migração de tela financeira densa

| Anti-padrão | Por que quebra uma tela financeira densa |
| --- | --- |
| Aumentar padding/whitespace por padrão | Cada padding extra numa tabela de 40 linhas é uma linha a menos visível sem rolar. |
| Envolver cada bloco de dado em `Card` | "Card dentro de card" — adiciona borda/sombra/padding sem adicionar informação. |
| Centralizar números financeiros | Precisam ficar alinhados à direita, fonte tabular, para comparação vertical rápida. |
| Animar valor financeiro ao mudar (count-up, crossfade de número) | É decoração num dado que o usuário está lendo para decidir — mesma regra do relatório de animação. |
| Suavizar cor de status (verde/vermelho/laranja) por estética | A cor tem significado formal (pago/pendente/vencido); reduzir contraste é regressão funcional disfarçada de polish. |
| Aplicar `Button`/`Input` padrão do design-system sem checar `density.css` | O padrão provavelmente foi dimensionado para toque/mobile; numa tabela densa de desktop isso infla a altura de cada linha. |

Régua prática: **se a mudança reduz quantas linhas cabem na tela ou quanto
tempo leva para comparar dois números, é regressão, não polish** — mesmo
que pareça mais "profissional" isoladamente.

## Regra de atualização

Cada fase concluída marca a caixa correspondente aqui e nesse mesmo commit
atualiza a evidência na tabela de estado atual. Este documento não é
prescritivo sobre prazo — é prescritivo sobre ordem e sobre o que não fazer
antes de fechar a fase anterior.
