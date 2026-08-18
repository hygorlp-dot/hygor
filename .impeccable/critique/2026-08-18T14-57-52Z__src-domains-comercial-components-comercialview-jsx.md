---
target: setor Comercial (ComercialView.jsx + RealEstateCommercial.jsx)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-18T14-57-52Z
slug: src-domains-comercial-components-comercialview-jsx
---
## Crítica de design (skill impeccable)

`Method: dual-agent (A: general-purpose subagent · B: general-purpose subagent)`.
Protocolo `impeccable critique` seguido via `Skill({skill:"impeccable"})`
(carregou normalmente nesta sessão — sem precisar do workaround de ler o
`SKILL.md` manualmente). Duas Assessments isoladas, sem visibilidade uma da
outra: **A** (revisão de design lendo `ComercialView.jsx` e
`RealEstateCommercial.jsx` na íntegra + as 6 capturas visuais) e **B**
(detector mecânico `detect.mjs` + inspeção das mesmas 6 capturas em busca de
defeito visível). Evidência visual: 6 screenshots desktop 1440×900 com dados
mockados (leads, funil, propostas, contratos, imobiliário), capturados via
Playwright com o mesmo padrão de mock de `e2e/modules-smoke.spec.js`,
salvos em `critique-shots-comercial/` no scratchpad e descartados do
repositório depois de usados (o spec temporário
`e2e/comercial-visual-modules-smoke.spec.js` e o `test-results/` gerado
foram apagados ao final). **Não há evidência visual mobile** — nenhuma
captura de mobile foi obtida (o padrão de navegação mobile não estava
roteirizado no spec temporário) e nenhuma das duas Assessments alega
achado mobile a partir de imagem; onde o mobile aparece abaixo, é sempre
citado como leitura de CSS/breakpoint, nunca como evidência visual.

### Design Health Score (Nielsen, 0-4 por heurística)

| # | Heurística | Nota | Achado-chave |
| --- | --- | --- | --- |
| 1 | Visibilidade do status do sistema | 2 | O aviso "Alterações ainda não salvas" é claro e persistente, e `finalizarContrato` mostra "CONFIRMANDO..." durante a cascata assíncrona. Mas 2 dos 5 destinos principais do menu renderizam página em branco sem nenhum indicador — o pior status possível: nenhum. |
| 2 | Compatibilidade com o mundo real | 4 | Terminologia nativa do setor de vendas de construção o tempo todo (etapas, jornada do cliente, dossiê, medição de entrada, "Transferido para Engenharia"). Heurística mais forte desta revisão. |
| 3 | Controle e liberdade do usuário | 2 | Kanban tem fallback manual de clique (não só arrastar); edição de lead acessível por várias entradas. Mas não há desfazer para mudança de etapa, nem cancelamento durante a cascata de `finalizarContrato`, e os `window.confirm` nativos só dão OK/Cancelar sem prévia do que vai mudar. |
| 4 | Consistência e padrões | 1 | Três sistemas visuais não reconciliados dentro do mesmo setor (ver Veredito de especificidade). Confirmação destrutiva inconsistente: excluir lead pede `window.confirm`, mas "CONFIRMAR CONTRATAÇÃO" — que cria 9 registros ligados (cliente, obra, venda, comissão, kickoff, pós-venda, medições) — não pede nada. |
| 5 | Prevenção de erro | 1 | Nenhuma confirmação antes da ação mais irreversível e cara de todo o setor (ativação de contrato). Existe validação real de limite de desconto por usuário — um guardrail genuíno —, mas está mal distribuída: forte num lugar de baixo risco, ausente no de maior risco. |
| 6 | Reconhecimento em vez de memorização | 2 | Cards do kanban mostram responsável, dias na etapa, orçamento e próxima atividade inline — bom suporte ao reconhecimento. Mas o modal de lead tem 12 abas sem indicação de quais têm dado pendente, forçando memorização. |
| 7 | Flexibilidade e eficiência de uso | 2 | Busca global, KPIs que também são atalho de navegação, exportação Excel. Sem ação em lote, sem atalho de teclado no kanban, busca da lista de leads é só texto livre. |
| 8 | Design estético e minimalista | 2 | Cards individuais são razoavelmente limpos. Mas a "Visão geral" do imobiliário empilha 14 KPIs numa grade só + 4 gráficos, dois deles renderizando como caixa branca vazia sem "sem dados". |
| 9 | Ajudar a reconhecer, diagnosticar e corrigir erros | 2 | Mensagens de validação específicas e no domínio ("Seu limite de desconto é X%...", "CPF do representante legal inválido"). Mas a falha de página em branco (Achado 0) não produz nenhuma mensagem — o usuário não tem como diagnosticar. |
| 10 | Ajuda e documentação | 1 | Sem ajuda contextual, sem onboarding para o modal de 12 abas nem para o kanban de 19 etapas. Depende inteiramente de rótulo autoexplicativo. |
| **Total** | | **20/40** | **Faixa: Poor (50%) — melhoria significativa necessária antes que a experiência core esteja saudável.** |

### Veredito de especificidade de design

**Conteúdo é específico da ARCD; execução visual não é uma coisa só.** O
vocabulário do domínio é genuíno — "Reunião realizada", "Aguardando
pagamento da entrada", "Transferido para Engenharia", a taxonomia de
motivo de perda (`COM_PERDAS`), os campos de qualificação de lead
("Área do terreno", "Pavimentos", "Padrão construtivo") — nenhum CRM
genérico de prateleira tem isso pronto. Mas visualmente o setor atravessa
**três sistemas de cor/tipografia diferentes**, nenhum deles o que o
`DESIGN.md` documenta:

1. As regiões de estilo inline legado de `ComercialView.jsx` (leads,
   funil, propostas, contratos, clientes, metas, perdas, relatórios) —
   objeto `C.*`, tamanhos de fonte em pixel fixo (`fontSize:8.5`, `9.5`),
   raio de borda 6-10px.
2. As classes `.commercial-*` do dashboard em `src/index.css:5204-5249` —
   uma paleta própria com hex que não bate com os tokens documentados
   (`#1f7136`, `#cfd4d6`, `#6d7479`, `#ae2929`) e, mais grave, um
   `background:linear-gradient(120deg,#f9faf9 0%,#f1f4f2 100%)` em
   `.commercial-command-card` (`src/index.css:5205`) — o `DESIGN.md` deste
   projeto é explícito: *"Cards não devem flutuar nem usar gradientes."*
   Justamente a tela que o `DESIGN.md` chama de "referência visual para
   todas as telas operacionais" viola a própria regra que deveria
   exemplificar.
3. `RealEstateCommercial.jsx` + `real-estate.css` — uma quarta paleta
   bespoke (`#8a6b13`, `#687078`) e um array de cor de gráfico
   (`["#2563eb","#16a34a","#d4af37","#ea580c","#7c3aed","#dc2626","#64748b"]`)
   que são tons genéricos de Tailwind/shadcn, não os tokens documentados
   (Azul técnico #0F62FE, Verde #24A148, Laranja técnico #8A3800, Roxo
   técnico #4A148C) — comparação direta: `#2563eb≠#0F62FE`,
   `#16a34a≠#24A148`.

Só o objeto `C.*` usado nas regiões legadas bate com a paleta declarada
(confirmado contra `LegacyApp.jsx`) — mas nem ele passa por variável CSS,
então não herda atualização de token e diverge em toda outra dimensão
(escala tipográfica, raio, sombra). Resultado: um usuário navegando entre
"Comercial da empresa" (paleta 2), "Pipeline"/"Relacionamentos" (paleta 1)
e "Venda de imóveis" (paleta 3) atravessa três linguagens visuais
diferentes dentro do mesmo setor — soa menos como "autoral para a ARCD" e
mais como três equipes construindo telas vizinhas sem biblioteca de
componente compartilhada.

**Varredura determinística** (`detect.mjs --json` sobre os dois arquivos,
saída completa): **13 achados, código de saída 2, zero achados em
`RealEstateCommercial.jsx`** (todos os 13 estão em `ComercialView.jsx`):

- 12× regra `side-tab` (borda de destaque colorida à esquerda de card/linha,
  classificada como "slop" de IA) nas linhas 736, 825, 1037, 1164, 1166,
  1223, 1292, 1296, 1386, 1418, 1424 (kanban, ranking de indicação,
  listas de lead, cards de proposta/contrato/meta).
- 1× regra `overused-font` (`font-family:Arial`) na linha 199 — dentro do
  HTML de impressão gerado por `pdfProposta` (documento separado, aberto
  numa aba nova via `window.open`, fora da árvore de UI do app).

**Possíveis falsos positivos, sinalizados pela própria Assessment B**: o
`overused-font` da linha 199 é um documento de impressão isolado, não a UI
viva do produto (que já usa IBM Plex Sans/Mono corretamente) — tratar como
achado de baixo valor. Alguns `side-tab` carregam significado semântico
real (cor por temperatura do lead, linhas 1164/1166/1223 — confirmado nas
capturas) — mecanicamente o padrão bate, mas é uma reivindicação de "slop"
mais fraca que instâncias puramente decorativas (ex. cabeçalho de coluna
do kanban, todos idênticos em azul independente da etapa, mesmo "Perdido"
sendo a mesma cor que "Novo lead").

### Impressão geral

O setor entrega conteúdo de domínio genuíno e pelo menos duas
funcionalidades de padrão alto (jornada do cliente com progressão
automática, motor de indicação) — mas isso é encoberto por dois problemas
sérios: uma navegação primária quebrada (Achado 0, confirmado por código e
por captura de tela) e uma identidade visual fragmentada em três sistemas
que nunca foram unificados sob o `DESIGN.md` do projeto. A maior
oportunidade não é "redesenhar" — é terminar a integração que já está
quase pronta (consertar o roteamento, aplicar os tokens que já existem) em
vez de inventar mais uma camada visual nova.

### Pontos fortes

1. **Divulgação progressiva da complexidade do funil.** O resumo de 6 fases
   no dashboard (`COM_JORNADA`) versus o kanban completo de 19 etapas, só
   exposto quando o usuário entra no funil — redução deliberada e bem
   executada de carga cognitiva no ponto onde a maioria dos usuários chega.
2. **Texto de confirmação de exclusão de lead.** `ComercialView.jsx:131-152`:
   tanto o `window.confirm` quanto o toast seguinte dizem explicitamente o
   que é preservado (propostas, contratos, reuniões, histórico) e o que
   acontece (some das listas, não é apagado) — exatamente o tipo de
   linguagem específica e tranquilizadora que a heurística de prevenção de
   erro pede, raro de ver bem feito numa tela legada.
3. **Motor de alerta fiel ao domínio.** O cálculo de `alertas`
   (`ComercialView.jsx:86-93`) cobre lead sem próxima ação, lead parado
   ≥5 dias, follow-up vencido, reunião nas próximas 24h, proposta vencendo
   em 3 dias, contrato sem assinatura e entrada pendente — tudo genuíno e
   específico de como um funil de vendas de construção realmente quebra,
   não um "tarefa atrasada" genérico.

### Priority Issues

**[P0] Dois dos cinco itens do menu lateral do Comercial abrem em branco**
— **Why it matters**: 40% da navegação principal do setor silenciosamente
não funciona num sistema real em produção; o usuário não tem como saber se
é bug, permissão ou falta de dado — parece perda de dado. **Fix**: ver
Achado 0 detalhado na seção de funcionamento acima (trocar `view` por
`commercialView` a partir de `ComercialView.jsx:1167`, ou aplicar
`LEGACY_COMMERCIAL_ROUTE` já existente e não usado). **Suggested command**:
`/impeccable harden`.

**[P0] Ativação de contrato irreversível e em cascata não tem nenhuma
confirmação** — **Why it matters**: "CONFIRMAR CONTRATAÇÃO"
(`ComercialView.jsx:204-242`) cria 9 entidades ligadas (cliente, obra,
venda, comissão, kickoff, pós-venda, medição de entrada + N parcelas) num
único clique irreversível — e tem *menos* fricção que excluir um único
lead, que pede `window.confirm`. **Fix**: adicionar um passo de confirmação
explícito (modal estilizado, não `window.confirm`) que mostre o que vai
ser criado antes de disparar o comando. **Suggested command**:
`/impeccable harden`.

**[P1] Três sistemas de cor/tipografia incompatíveis convivem no mesmo
setor** — **Why it matters**: o `DESIGN.md` chama o dashboard de
"referência visual para todas as telas operacionais", mas o próprio
dashboard está fora dos tokens e contém o único elemento que o sistema
proíbe explicitamente (gradiente). **Fix**: consolidar em
`--arcd-type-*`/`--arcd-icon-size-*` e nos primitivos `SummaryCard`/
`PageHeader`; remover o gradiente de `.commercial-command-card`; trocar a
paleta de gráfico de `real-estate.css` pelos tons técnicos documentados.
**Suggested command**: `/impeccable adapt`.

**[P1] Modal de lead com 12 abas sem indicação de completude** — **Why it
matters**: a diretriz de carga cognitiva recomenda agrupar em até ~4; 12
abas de peso igual forçam o usuário a memorizar qual tem o campo que falta,
e `salvarLead` só valida 2 campos globalmente — dá para deixar 10 das 12
abas pela metade sem nenhum sinal. **Fix**: agrupar em 3-4 clusters
("Cadastro", "Qualificação", "Atividade comercial", "Documentos e
histórico") ou adicionar indicador de completude por aba. **Suggested
command**: `/impeccable distill`.

**[P2] Alvos de toque abaixo de 44px em controles customizados fora do
primitivo compartilhado** — **Why it matters**: o botão "×" de remover
documento é 25×25px (`:427-436`), os botões de nota NPS 0-10 são 34×34px
(`:1344`) — ambos fora do `Btn` compartilhado, que já carrega a regra de
44px mínimo em mobile. Achado de código, não confirmado visualmente (sem
captura mobile). **Fix**: rotear esses controles pelo primitivo
compartilhado ou aplicar `min-width/min-height` explícito na media query
mobile. **Suggested command**: `/impeccable harden`.

**[P3] Painéis de gráfico vazios sem mensagem de "sem dados"** — **Why it
matters**: confirmado na captura `06-imoveis-overview-desktop.png` —
"Unidades por status" e "Origem dos leads" renderizam como caixa branca só
com título, sem eixo nem texto — inconsistente com o resto do mesmo
arquivo, que usa o componente `<Empty>` em toda outra seção quando a lista
está vazia. **Fix**: envolver os `PieChart` com o mesmo fallback `<Empty>`
usado nas demais seções de `RealEstateCommercial.jsx` quando o array
estiver vazio. **Suggested command**: `/impeccable polish`.

### Persona red flags

**Alex (usuário avançado)**: busca global e KPI-como-atalho ajudam Alex,
mas a fileira de ações do card de proposta tem até 7 botões sem
diferenciação visual clara (Editar/PDF/WhatsApp/E-mail/Enviar/Negociar/
Aceitar/Gerar contrato, `:1294`), forçando reler toda vez. Mais sério: Alex
vai bater no Achado 0 em 2 dos 5 destinos de uso diário e não vai saber se
é o app ou o filtro dele — reflexo de usuário avançado é assumir que é
filtro, então perde tempo real antes de concluir que está quebrado.

**Riley (testador de estresse)**: vai notar rápido que `window.confirm`
protege a exclusão de baixo risco (lead) mas não protege a ativação de
contrato de altíssimo risco — "a trava de segurança está na porta errada".
Também vai testar fechar/atualizar a página no meio da cascata de
`finalizarContrato`: o botão trava contra duplo clique durante a chamada
(`ativandoContratoId`), mas um recarregamento no meio gera um novo
`obraId` (`k.obraId||uid()`, linha 210) se a primeira tentativa não
persistiu de volta no contrato antes de falhar — risco de corrida real,
ainda que exija um recarregamento no timing exato.

**Sam (acessibilidade/teclado/leitor de tela)**: o mecanismo principal de
mudar etapa no kanban é arrastar-e-soltar HTML5 puro (`draggable`,
`onDragStart`, `onDrop`) — não operável por teclado e com suporte
historicamente fraco em leitor de tela; existe fallback de clique para
abrir o card, mas a affordance primária mostrada na tela é só arrastar
("Arraste os cards", subtítulo do funil). Os `window.confirm`/`alert`
nativos (achado de bug P2 acima) também ficam fora da árvore de componente
estilizada do app, com comportamento potencialmente inconsistente em
leitor de tela comparado ao `Modal` próprio do sistema.

### Observações menores

- O rótulo "Comercial" acima do título de cada tela é colorido com
  `C.green` permanentemente (`:461-467`), não como indicador de status —
  pequeno desvio de "Verde... apenas estados".
- `pdfProposta` (`:199`) abre uma quarta linguagem visual só para o
  documento impresso (Arial, `#151515`, caixas `#f5f5f5`), sem relação com
  nenhuma das três paletas internas discutidas acima.
- A aba financeira do modal de lead calcula "Propostas" como
  `Math.max(s,p.valor)` entre todas as propostas do lead (`:1423`) — na
  prática mostra o maior valor de proposta única, não uma soma; o rótulo
  "Propostas" sozinho pode confundir.
- Raio de borda nas regiões legadas fica em 6-10px (ex. `:322, 351,
  496-498`), enquanto o `DESIGN.md` pede painéis "estruturais, com até
  4px" — mesmo tipo de desvio de token do achado de fonte, em menor escala.

### Perguntas provocativas

1. Se `LEGACY_COMMERCIAL_ROUTE` já existe em `constants.js` com exatamente
   o mapeamento que faltava, foi uma correção que ficou pela metade, ou foi
   escrita para outro lugar e nunca chegou a ser ligada aqui? De um jeito
   ou de outro — como 2 dos 5 destinos principais do menu foram para
   produção em branco sem serem pegos, e o que isso diz sobre a cobertura
   de teste/QA deste setor especificamente?
2. Excluir lead ganha confirmação estilizada com linguagem explícita de
   preservação de dado; ativar contrato — que cria uma obra inteira mais
   oito outros registros ligados — não ganha nenhuma. Havia um modelo
   mental consciente de "apagar é perigoso, criar é seguro"? Essa premissa
   ainda vale quando "criar" significa uma cascata irreversível
   cross-domínio?
3. Três paletas separadas convivem neste setor, duas delas
   (`.commercial-*` e `real-estate.css`) aparentemente construídas depois
   dos tokens do ARCD Carbon já estarem documentados — essas telas mais
   novas foram construídas sem consultar o `DESIGN.md`, ou o `DESIGN.md`
   chegou depois delas já estarem no ar? A resposta muda se o conserto é
   "migrar código legado" (esperado, baixo drama) ou "fazer valer adoção
   de design system daqui pra frente" (problema de processo, não só item
   de backlog).

**Questions skipped: esta é uma auditoria em segundo plano (tarefa
não-interativa que produz um documento, não uma sessão de chat ao vivo) —
as perguntas de priorização do protocolo `impeccable critique` viram, em
vez disso, os itens do checklist consolidado no final deste documento, que
o usuário resolve escolhendo o que atacar primeiro.**
