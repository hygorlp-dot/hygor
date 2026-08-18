# Auditoria do setor Comercial

Auditoria feita em 18/08/2026, cobrindo `src/domains/comercial/` (extraído de
`LegacyApp.jsx` em 16/08/2026, mesmo padrão das demais telas já extraídas
nesta série de auditorias — ver `docs/AUDITORIA_EQUIPAMENTOS.md` para o
antecedente direto de formato e profundidade). Escopo: `ComercialView.jsx`
(~1500 linhas — dashboard, funil/kanban, jornada do cliente, leads,
atividades/reuniões, propostas, contratos, clientes, parceiros,
metas/comissões, perdas, motor de indicação), `RealEstateCommercial.jsx`
(módulo de venda de imóveis, componente próprio renderizado dentro da mesma
tela) e os módulos puros de domínio (`activities.js`, `leads.js`,
`contract-activation.js`, `real-estate.js`, `constants.js`, `selectors.js`,
`transitions.js`, `migrations.js`).

Cinco investigações, como pedido: ranking por parte/aba, opções de
ferramenta adicional frente ao mercado de CRM comercial/imobiliário, crítica
de design com a skill `impeccable` (dois agentes isolados, protocolo
Assessment A/B), depuração de bugs reais no código, e investigação
preparatória de geração de propostas/contratos em PDF (sem implementar —
falta o modelo do usuário).

**Nada foi corrigido na sessão original desta auditoria** (18/08/2026,
diagnóstico). Numa sessão seguinte, ainda em 18/08/2026, o usuário pediu
"corrija o bug e vá em busca de mais" — o Achado 0 (P0 de roteamento) foi
corrigido primeiro, separadamente (commit `f01deb7`), e os achados restantes
foram corrigidos numa segunda leva. Ver "Atualização de 18/08/2026
(correções aplicadas)" logo abaixo para o que foi de fato corrigido, o que
foi investigado e descartado, e o que ficou de fora por decisão consciente.

## Atualização de 18/08/2026 (correções aplicadas)

Depois do Achado 0 (já corrigido separadamente), os demais achados de
funcionamento foram confirmados lendo o código e corrigidos com a mesma
disciplina da auditoria de Equipamentos (increments pequenos, trava contra
duplo-clique + `try/finally` seguindo o padrão exato já usado em
`finalizarContrato`/`EquipamentosView.jsx`, suíte de testes completa verde a
cada lote). Nenhuma abstração nova nem refatoração além do necessário.

**Corrigidos:**
- **P1** — `statusProposta` (`ComercialView.jsx`) convertida de `setCom`
  direto para `persistirComercial` (checa `result?.ok`, avisa com toast em
  caso de falha). Continua gerando o contrato automaticamente ao aceitar a
  proposta, mas agora avisa se a gravação falhar.
- **P1** — Botões "ENVIAR" e "REGISTRAR ASSINATURA" do card de contrato
  extraídos para `enviarContrato`/`registrarAssinaturaContrato`, usando
  `persistirComercial` + trava contra duplo-clique.
- **P2** — `moverLead` (arrastar card no funil) convertida para
  `persistirComercial`, avisando com toast se a gravação falhar.
- **P2** — Trava contra duplo-clique (`salvandoComercial`, mesmo padrão de
  `EquipamentosView.jsx`: uma string por ação, checada como
  `salvandoComercial==="tag"` / `disabled={!!salvandoComercial}`) aplicada
  às 11 funções listadas na auditoria (`salvarLead`, `salvarPerda`,
  `salvarAtividade`, `salvarReuniao`, `salvarProposta`, `salvarContrato`,
  `salvarCliente`, `salvarParceiro`, `salvarMeta`, `salvarNps`,
  `marcarPedidoIndicacao`) mais `salvarNegociacao` e os dois novos
  `enviarContrato`/`registrarAssinaturaContrato` (mesma categoria de bug,
  achado durante a correção).
- **P2** — Os 3 `window.confirm` nativos em `ComercialView.jsx`
  (duplicidade de lead, exclusão de lead, contrato a partir de proposta não
  aceita) substituídos por um modal de confirmação estilizado
  (`confirmModal`/`{titulo,mensagem,tom,confirmLabel,onConfirmar}`), o mesmo
  padrão já usado em `EquipamentosView.jsx`.
- **P2** — `RealEstateCommercial.jsx` agora recebe `showToast` como prop
  (passada em `<LazyRealEstateCommercial>` de `ComercialView.jsx`). O
  `window.confirm` de desvincular documento virou um `confirmState` local
  com o mesmo `Dialog` já usado no resto do componente; os dois
  `window.alert` de erro (reserva/venda) viram `showToast(msg,"error")`.
- **P3** — Taxa de comissão de 1%: nomeada como constante
  `DIRECT_SALE_DEFAULT_COMMISSION_PCT` em `contract-activation.js` com
  comentário explicando que é um valor de fallback histórico sem origem
  documentada nem configuração — nenhuma regra de negócio nova foi
  inventada, só documentação. Comportamento idêntico a antes.

**Investigado e descartado (não corrigido, com justificativa):**
- **P3 — `pdfProposta` duplicando `montarRelatorioPadraoHtml`**: confirmado
  real, mas não corrigido nesta leva — é uma unificação de template HTML
  fora do escopo de "bug real", e a seção de "Ferramenta de propostas e
  contratos em PDF" deste documento já recomenda tratar isso junto da
  implementação de PDF de verdade (bloqueada no modelo do usuário), não
  isoladamente agora.
- **Pipeline de oportunidades morto** (achado estrutural #1): confirmado
  real (workspace computado e nunca usado, `transitionOpportunity` sem
  chamador) — é decisão de produto (terminar a migração vs. remover código
  morto), não bug. Não corrigido, permanece como item aberto no checklist.
- **Ciclo de vida de `comissoes`** (nunca sai de "prevista", não lido pelo
  `ledger.js`): confirmado real, mas implementar "marcar como paga" e
  decidir se isso vira despesa no DRE é uma decisão de regra de negócio que
  não deveria ser inventada sem confirmação do usuário — permanece aberto.

**Novos bugs procurados e não encontrados**: revisão de
`activities.js`, `leads.js`, `migrations.js`, `selectors.js`,
`transitions.js`, `real-estate.js` não achou nenhuma condição de corrida,
comando sem `expectedVersion`/auditoria, ou cálculo financeiro duplicado
localmente além do que a auditoria original já tinha mapeado (o único
achado adicional foi `salvarNegociacao`, já corrigido acima, encontrado por
ter exatamente o mesmo padrão dos 11 já listados).

**Verificação**: `npx vitest run` (218 arquivos, 1140 testes, 100% verde),
`npm run build`, `npm run typecheck`, `npm run architecture:check` e
`npx playwright test e2e/modules-smoke.spec.js` todos verdes a cada lote.
Um novo cenário real foi adicionado ao smoke test (exclusão de lead via o
modal de confirmação estilizado, cobrindo a troca do `window.confirm`
nativo e a trava contra duplo-clique de `excluirLead`).

**Nota geral do módulo depois desta leva: 7,4/10** (subiu de 6,7, que já
tinha subido de facto para ~7,6 com a correção isolada do Achado 0 — a nota
volta a ficar um pouco abaixo desse número porque os achados de
funcionamento P2/P3 muito numerosos, mesmo corrigidos, ainda refletem que o
padrão "trava + toast de erro" não era generalizado por padrão neste
arquivo, ao contrário de Equipamentos onde ele já nasceu consistente na
maior parte do código). O que ainda pesa contra uma nota mais alta: (1) a
identidade visual fragmentada em três sistemas (não tocada nesta leva — é
achado de design, não de bug funcional), (2) o pipeline de oportunidades
morto sem decisão tomada, e (3) o ciclo de vida incompleto de comissões.

**Achado mais grave desta auditoria, confirmado por duas fontes
independentes** (leitura de código + evidência visual ao vivo, ver Achado 0
abaixo): dois dos cinco itens da navegação lateral principal do setor
Comercial — "Propostas e contratos" e "Gestão comercial" — abrem uma tela
**completamente em branco** em produção, sem nenhum erro visível. A causa é
um bug concreto de roteamento em `ComercialView.jsx`, não falta de dado.

## Ranking por parte (0-10)

Nota combinando funcionamento/código, integração financeira (onde se
aplica), estrutura e completude funcional frente a mercado. O fluxo de
ativação de contrato pesa mais porque é o único ponto do módulo que
efetivamente move dinheiro para o DRE (cria obra + medições).

| Parte | Nota | Por quê |
| --- | --- | --- |
| **Dashboard** (`com_dash`) | **8** | Boa síntese executiva: KPIs, distribuição do funil, alertas acionáveis (leads sem responsável, follow-up vencido, reunião próxima, proposta vencendo, contrato sem assinatura, entrada pendente) com deep-link direto para a aba relevante. Não escreve dado nenhum, então não herda os achados de gravação abaixo. |
| **Funil & Jornada do cliente** (`com_funil`, `com_jornada`) | **8,5** (era 7,5 - `moverLead` corrigido) | Duas visualizações kanban genuinamente boas — a "Jornada" avança os cards sozinha conforme o sistema muda a etapa do lead. `moverLead` agora usa `persistirComercial` e avisa com toast se a gravação falhar. |
| **Leads & Indicações** (`com_leads`, `com_indicacoes`) | **8,5** (era 7,5 - trava + modal de confirmação) | O painel "Indicações" continua um diferencial real de mercado. `salvarLead`/`excluirLead`/`salvarPerda` agora têm trava contra duplo clique, e os `window.confirm` nativos viraram modal de confirmação estilizado. |
| **Agenda, Reuniões e Tarefas** (`com_agenda`, `com_reunioes`, `com_tarefas`) | **8,5** (era 7,5 - trava aplicada) | Boa cobertura (lista + calendário mensal, criação automática da primeira tarefa). `salvarAtividade`/`salvarReuniao` agora têm trava contra duplo clique. |
| **Propostas & Negociações** (`com_propostas`, `com_negociacoes`) | **8,5** (era 4,5 - Achado 0 corrigido, `statusProposta` corrigido, sub-nav própria) | A regra de negócio real (`salvarProposta`) sempre foi boa; o que rebaixava a nota era o roteamento quebrado. Corrigido, e `statusProposta` agora usa `persistirComercial` (avisa se a gravação falhar antes de gerar o contrato automaticamente). "Propostas e contratos" ganhou uma pill-nav própria (18/08/2026) para alternar entre Propostas/Negociações/Contratos/Clientes/Parceiros sem depender de atalho indireto do dashboard. `pdfProposta` continua reinventando um gerador de HTML próprio - fica para a investigação de ferramenta de PDF já registrada abaixo. |
| **Contratos** (`com_contratos`) | **9** (era 7 - Achado 0 corrigido, ENVIAR/REGISTRAR ASSINATURA corrigidos, item de menu próprio) | `finalizarContrato` continua exemplar. As ações "ENVIAR" e "REGISTRAR ASSINATURA" agora usam `persistirComercial` + trava contra duplo clique via `enviarContrato`/`registrarAssinaturaContrato`. Deixou de estar "embutido" em uma tela quebrada - tem pill própria na sub-nav de "Propostas e contratos". |
| **Clientes & Parceiros** (`com_clientes`, `com_parceiros`) | **9** (era 8 - trava aplicada, item de menu próprio) | Ponto alto do CRUD (`salvarCliente` valida CPF/CNPJ de verdade, `pendenciasCliente` calcula ao vivo o que falta). Trava contra duplo clique aplicada. Deixou de ser "só alcançável de dentro do fluxo de contrato" - tem pill própria na sub-nav. |
| **Metas & Comissões** (`com_metas`) | **7,5** (era 4 - Achado 0 corrigido, item de menu próprio, taxa de comissão nomeada) | O item de menu **"Gestão comercial" agora tem pill própria para "Metas e comissões"**, não fica mais preso em Relatórios. Taxa de comissão de 1% (achado de bug #5) nomeada como `DIRECT_SALE_DEFAULT_COMMISSION_PCT`, com comentário explicando a origem. Ainda pesa contra a nota: comissão nunca sai do status `"prevista"` e não é lida pelo `ledger.js`/DRE - ciclo de vida incompleto, decisão de produto em aberto, não corrigido. |
| **Perdas** (`com_perdas`) | **8** (era 7,5 - item de menu próprio) | Simples e funcional (motivo obrigatório, ranking, reativação). Ganhou pill própria na sub-nav de "Gestão comercial" - antes só alcançável indiretamente. Achado de código lateral: `kpi()` usado dentro de um `.map()` sem `key` (React warning real, não cosmético) - corrigido junto com a sub-nav. |
| **Imobiliário — Venda de imóveis** (`com_real_estate`, componente `RealEstateCommercial.jsx`) | **8,5** (era 8 - `showToast` corrigido) | O módulo mais rico tecnicamente (dashboard de VGV, auditoria de preço/status por unidade, expiração automática de reserva, trava de venda abaixo do mínimo, dossiê de documentos). Agora recebe `showToast` de `ComercialView.jsx` - os `window.alert`/`window.confirm` nativos viraram toast/modal de confirmação estilizados. |

**Nota geral do módulo: 8,4/10** (era 6,7, passou por 7,4 na leva de
correção de funcionamento - subiu mais nesta rodada com a sub-nav que
tornou Contratos/Clientes/Parceiros/Metas/Perdas alcançáveis pela barra
lateral, não só por atalho indireto do dashboard). O que ainda pesa contra
uma nota mais alta: (1) a identidade visual fragmentada em três sistemas
(não é bug funcional, é achado de design/consistência, não tocado nesta
leva), (2) o pipeline de oportunidades morto sem decisão tomada, e (3) o
ciclo de vida incompleto de comissões (nunca sai de "prevista", não chega
ao DRE) - os três continuam sendo decisão de produto, não conserto
pontual. O ponto mais forte do Comercial é exatamente o ponto mais crítico
para o dinheiro: a
ativação de contrato (`activateCommercialContract`) é um motor único,
isomórfico (cliente e servidor rodam literalmente o mesmo módulo — ver
seção de DRE), bem validado e bem testado — o oposto do padrão de
divergência cliente/servidor que foi o Achado 1/2 da auditoria de
Equipamentos. O que pesa contra a nota mais alta é, em ordem de gravidade:
(1) o bug de roteamento que deixa 2 dos 5 itens do menu lateral em branco
(Achado 0 — o achado mais grave desta auditoria, e o único que classifico
como bug de produção ativo, não só débito técnico), (2) um padrão
consistente de **gravações sem trava contra duplo clique** (generalizado,
baixa-média severidade individual) e (3) um punhado de **gravações que
descartam o resultado da chamada ao servidor** (menos frequente, mas mais
grave porque finge sucesso quando pode ter falhado) — ver a tabela de
achados de funcionamento abaixo.

## Achados de integração financeira / DRE

Ao contrário de Equipamentos (onde o cálculo de custo era reimplementado em
dois lugares — cliente e servidor — e podia divergir), o Comercial **não
reimplementa nenhum cálculo financeiro**. A única ponte entre Comercial e o
DRE é a ativação de contrato, e ela está bem construída:

- `src/domains/comercial/contract-activation.js` (`activateCommercialContract`)
  é o único módulo que transforma um contrato comercial em algo que o DRE
  enxerga — ele cria uma `obra` nova e `medicoes` (entrada + parcelas) usando
  o pipeline padrão de obras/medições, em vez de inventar um motor financeiro
  próprio para vendas.
- Esse módulo é **isomórfico**: `src/domains/sync/operational-commands.js:347-354`
  chama exatamente essa mesma função no tratamento do comando
  `COMMERCIAL_CONTRACT_ACTIVATED`, e `api/data.js:43` importa
  `operational-commands.js` diretamente — ou seja, cliente (que dispara o
  comando) e servidor (que o processa) rodam o mesmo código-fonte, não duas
  reimplementações que podem divergir. Esse é exatamente o tipo de bug que
  a auditoria de Equipamentos encontrou (Achados 1 e 2) e que aqui não pode
  acontecer por construção.
- Validação robusta antes de ativar: 9 pré-condições (lead vinculado,
  proposta aceita quando há proposta, contratante, valor > 0, contrato
  assinado, documentos recebidos, entrada paga, escopo validado,
  responsável técnico definido) — `contract-activation.js:30-40`. Também
  impede reativar um contrato já transferido, exige identificadores únicos
  e não colidentes com registros existentes (`medicoes`, `vendas`,
  `comissoes`, `reunioes`, `atividades`), e nunca sobrescreve um cliente já
  existente para o mesmo lead.
- `server/dre-projection.js` não tem nenhuma lógica específica de Comercial
  — o único hit de "comercial" no arquivo é `despPorGrupo.comercial`
  (despesa administrativa da empresa, sem relação com o CRM). Isso confirma
  que a integração é só através de `obras`/`medicoes`, sem caminho paralelo
  para divergir.
- Cobertura de teste real do caminho do dinheiro:
  `contract-activation.test.js` roda `buildFinancialLedger` sobre o
  resultado da ativação e verifica `selectCashFlow`/`selectAccountsReceivable`
  batendo com os valores esperados — não é só teste de forma dos dados, é
  teste de que o dinheiro aparece certo no razão.

**Único ponto fraco encontrado na fronteira financeira** (achado de bug,
detalhado abaixo): a comissão de venda (`comissoes`) usa uma taxa de 1%
"mágica" quando não há parceiro de indicação, e nunca é lida por
`ledger.js` — ela nunca vira despesa no DRE, nem tem qualquer caminho de UI
para ser marcada como paga.

`scripts/check-financial-boundaries.mjs` não cobre `src/domains/comercial/`
(só varre as telas Financeiro/DRE/Medições) — não pegaria uma futura
reimplementação de cálculo financeiro aqui, mas hoje não há nenhuma para
pegar.

## Achados de funcionamento e boas práticas

Investigação de código, com disciplina equivalente à da auditoria de
Equipamentos: funções de gravação sem `try/catch`/trava, comandos sem
resultado checado, `window.confirm`/`window.prompt`/`window.alert`
nativos, condições de corrida, cálculo financeiro reimplementado. Todos os
achados abaixo foram confirmados lendo o código — nada é suposição.

| Severidade | Achado | Local | Efeito |
| --- | --- | --- | --- |
| **P0 — Crítica** | **Bug de roteamento: 2 dos 5 itens do menu lateral do Comercial abrem em branco** | `ComercialView.jsx:35` vs. `:1167-1307` | Confirmado por duas fontes independentes: leitura de código + evidência visual ao vivo (screenshots `04-propostas-contratos-desktop.png` e `05-gestao-desktop.png`, área de conteúdo inteiramente em branco, só o cabeçalho e o menu aparecem). Ver detalhamento abaixo da tabela. |
| **P1 — Alta** | `statusProposta` grava com `setCom` direto, sem `await`/checar `result?.ok`, e ela é a mesma função que **gera contrato automaticamente** quando a proposta muda para `"aceita"` | `ComercialView.jsx:198` | Se a gravação falhar (rede, conflito de versão), a tela finge sucesso: nenhum toast de erro aparece — ao contrário de todo fluxo que passa por `persistirComercial` (que checa e avisa). Na pior hipótese, o usuário acha que aceitou a proposta e gerou o contrato, mas o servidor nunca confirmou. |
| **P1 — Alta** | Botões "ENVIAR" e "REGISTRAR ASSINATURA" do card de contrato gravam com `setCom` direto, sem checar sucesso | `ComercialView.jsx:1296` | Mesmo problema: marcar um contrato como enviado ou assinado pode falhar silenciosamente no servidor sem qualquer aviso na tela. |
| **P2 — Média** | `moverLead` (arrastar card no kanban) grava com `setCom` direto, sem checar sucesso | `ComercialView.jsx:153` | Arrastar um lead de etapa pode não persistir e o usuário não fica sabendo — o card volta para o lugar antigo só no próximo carregamento dos dados. |
| **P2 — Média** | Onze funções de gravação (`salvarLead`, `salvarPerda`, `salvarAtividade`, `salvarReuniao`, `salvarProposta`, `salvarContrato`, `salvarCliente`, `salvarParceiro`, `salvarMeta`, `salvarNps`, `marcarPedidoIndicacao`) não têm trava contra duplo clique (padrão `setSalvando<algo>` + `disabled` no botão, usado em `finalizarContrato` na mesma tela) | `ComercialView.jsx` (várias, ex. `:127`, `:154`, `:155`, `:197`, `:203`, `:252`, `:271`, `:272`) | Duplo clique/duplo Enter pode criar lead, proposta, contrato-rascunho ou cliente duplicado. O padrão correto já existe no mesmo arquivo (`finalizarContrato`/`ativandoContratoId`) — não foi generalizado. |
| **P2 — Média** | `window.confirm` nativo em 3 pontos: duplicidade de lead, exclusão de lead, criação de contrato a partir de proposta não aceita | `ComercialView.jsx:127, 141, 202` | Inconsistente com o resto do app redesenhado (mesmo achado P0 confirmado na auditoria de Equipamentos, ali corrigido). Aqui não chega a P0 porque nenhuma dessas ações é puramente destrutiva sem histórico (lead excluído é arquivado, não apagado). |
| **P2 — Média** | `RealEstateCommercial.jsx` usa `window.confirm` (desvincular documento) e `window.alert` (erro ao criar reserva/venda) | `RealEstateCommercial.jsx:59, 98, 99` | O componente **não recebe `showToast` como prop** — a assinatura é `{section,commercial,appData,currentUser,onSave,onUploadFile,onLegacyNavigate}` (`RealEstateCommercial.jsx:67`). Não é escolha de design, é lacuna de API: não dá pra usar o padrão de toast do resto do app porque a função nunca chega até aqui. Fix é de baixo esforço (passar `showToast` no `<LazyRealEstateCommercial>` de `ComercialView.jsx:1314` e trocar os 3 usos). |
| **P3 — Baixa** | `pdfProposta` monta seu próprio HTML inline (`window.open`+`document.write`) em vez de reusar `montarRelatorioPadraoHtml`/`abrirRelatorioPadrao`, o padrão usado em ~5 outros relatórios do sistema | `ComercialView.jsx:199` | Duplicação de lógica de geração de HTML para impressão; qualquer melhoria futura no padrão (cabeçalho, rodapé, marca d'água) precisa ser replicada manualmente aqui. |
| **P3 — Baixa** | Taxa de comissão mágica: `Number(partner?.comissaoPct||1)` aplica 1% sempre que a venda não tem parceiro de indicação (o caso comum — venda direta) | `contract-activation.js:92` | Não existe `comissaoPct` de vendedor/usuário em lugar nenhum do schema — só parceiros e corretores/unidades imobiliárias têm esse campo. O valor "1" não tem origem documentada nem é configurável; ele vira um registro de comissão real (`comissoes`) exibido na aba "Metas e comissões" como se fosse um número com significado. |
| **P3 — Baixa** | Registros de `comissoes` nunca saem de `status:"prevista"` — não há em nenhum lugar do código um caminho para marcá-los como pagos, nem `ledger.js` os lê | `contract-activation.js:96`, ausência confirmada em `src/domains/financeiro/ledger.js` (busca por `comiss`/`commission` sem resultado) | A aba "Metas e comissões" mostra números que nunca se tornam despesa no DRE nem têm ciclo de vida — ao contrário da Fase 5 de locação de Equipamentos, isso não está documentado como decisão consciente em lugar nenhum; parece simplesmente incompleto. |

### Detalhamento do Achado 0 (bug de roteamento)

A navegação lateral do setor Comercial foi reorganizada para 5 destinos
novos (`com_workspace`, `com_real_estate`, `com_pipeline`,
`com_relationships`, `com_deals`, `com_management` — ver
`src/LegacyApp.jsx:11181`). Dentro de `ComercialView.jsx`, a linha 35
traduz esses 5 ids novos para os ids antigos que o `if/else` interno
conhece:

```js
const commercialView={com_workspace:"com_dash",com_pipeline:"com_funil",
  com_relationships:"com_leads",com_deals:"com_propostas",
  com_management:"com_relatorios"}[view]||view;
```

Só que essa tradução é usada de forma **inconsistente** no resto do
arquivo. Os quatro primeiros ramos do `if/else` (linhas 591-1166 —
`com_indicacoes`, `com_leads`, `com_funil`) checam `commercialView`
corretamente. Mas a partir da linha 1167 (`com_jornada` em diante — agenda,
propostas/negociações, contratos, clientes, parceiros, metas, perdas,
relatórios), **todo o resto do arquivo passa a checar a variável `view`
crua**, não `commercialView`. Por exemplo, a linha 1293:

```js
} else if(["com_propostas","com_negociacoes"].includes(view)){
```

Quando o usuário clica em "Propostas e contratos" no menu lateral,
`view` chega como `"com_deals"` (o id novo) — `commercialView` já foi
corretamente traduzido para `"com_propostas"`, mas essa condição olha para
`view`, que nunca vale `"com_propostas"` neste caminho. O mesmo acontece na
linha 1305 (`view==="com_relatorios"`) quando o usuário clica em "Gestão
comercial" (`view="com_management"`). Como nenhum ramo do `if/else` bate,
a variável `conteudo` (inicializada como `null` na linha 590) nunca é
preenchida, e a tela renderiza vazia — sem erro, sem mensagem, sem
`try/catch` para capturar, porque não há exceção nenhuma: é um `null`
perfeitamente válido para o React.

Curiosamente, `src/domains/comercial/constants.js:3-8` já define
`LEGACY_COMMERCIAL_ROUTE`, um objeto com exatamente o mapeamento reverso
necessário (ids antigos → ids novos) — mas ele **nunca é importado nem
usado em `ComercialView.jsx`** (confirmado pela lista de imports no topo do
arquivo). Tudo indica que essa tradução foi escrita para resolver o
problema e nunca chegou a ser ligada ao `if/else` que precisava dela.

**O quanto isso afeta o uso real:** o conteúdo das telas em si **não está
quebrado** — só o item de menu que devia levar a elas. Existem atalhos
internos no dashboard que usam os ids antigos diretamente e por isso
funcionam: "Propostas enviadas" (`ComercialView.jsx:1156`,
`onTab("com_propostas")`), "Sem assinatura" (`:1157`,
`onTab("com_contratos")`) e "Relatório →" (`:1141`,
`onTab("com_relatorios")`). Ou seja, um usuário que conhece o caminho pelo
dashboard chega lá; um usuário que usa o menu lateral — a forma mais óbvia
e permanente de navegar, presente em toda tela — bate numa página em
branco sem explicação. Mesmo depois de corrigido, "Gestão comercial"
continuaria sem cobrir Metas (`com_metas`): o mapeamento de
`commercialView` só manda esse destino para Relatórios, nunca para Metas —
gap de IA secundário, registrado na seção de melhoria estrutural.

**Achado estrutural relacionado (não é bug, mas merece destaque aqui):** o
código dedica um pipeline inteiro e testado (`opportunities`/`stageEvents`,
com probabilidade por etapa, retrocesso auditado e evento obrigando
justificativa) que é populado a cada carregamento (`migrateCommercial`) mas
**nunca é lido pela UI** — ver próxima seção, item #1.

## Oportunidades de melhoria estrutural

| # | Achado | Impacto | Esforço |
| --- | --- | --- | --- |
| 1 | **Pipeline de oportunidades morto**: `constants.js` (`OPPORTUNITY_STAGES`, `STAGE_PROBABILITY`), `transitions.js` (`transitionOpportunity` — bloqueia retrocesso sem justificativa, registra evento auditável), `selectors.js` (`selectCommercialWorkspace`, `selectForecast`) e a migração em `migrations.js` constroem um modelo de oportunidade mais rigoroso que o `leads[].etapa` atual (string livre, sem versão, sem exigência de motivo no retrocesso). `migrateCommercial` já popula `opportunities`/`stageEvents` a cada carregamento (`ComercialView.jsx:34`), mas `ComercialView.jsx:589` computa `const workspace = useMemo(() => selectCommercialWorkspace(com), [com])` e **nunca usa a variável `workspace` em lugar nenhum do arquivo** — confirmado por busca no arquivo inteiro. `transitionOpportunity` não é chamado por nenhuma tela (só por `domain.test.js`). É trabalho de migração testado e pronto, esperando ser ligado — ou, se a decisão for não usar, `workspace`/`selectCommercialWorkspace`/`transitionOpportunity` deveriam ser removidos (custo de manutenção morto: recomputa a cada render à toa). | Médio (é uma decisão de produto: terminar a migração para o modelo de oportunidade, ou remover o código morto) | Médio |
| 2 | Duas dezenas de etapas de funil (`COM_ETAPAS`) redundam parcialmente com as 6 fases de `COM_JORNADA` e com os 5 estágios de `OPPORTUNITY_STAGES` (achado #1) — três modelagens de "onde o lead está" convivendo (`etapa` string, `fase` derivada, `stage` da oportunidade nunca usado). Não chega a ser um bug hoje porque só uma das três é lida pela UI, mas é uma fonte de confusão para quem for mexer no domínio depois. | Baixo hoje / alto se o item 1 for retomado sem consolidar | Baixo (documentar a decisão) |
| 3 | `RealEstateCommercial.jsx` não recebe `showToast` (ver achado de bug P2) — sintoma de que a integração desse componente com `ComercialView.jsx` foi feita rápido; vale conferir se outros componentes "satélite" (se surgirem) recebem a lista completa de props padrão. | Baixo | Baixo |
| 4 | Nenhum teste de componente para `ComercialView.jsx` nem para `RealEstateCommercial.jsx` — mesma lacuna já registrada como não-nova na auditoria de Equipamentos (`TerceirosView.jsx`/`ComprasView.jsx` também não têm). Os módulos puros de domínio, em compensação, têm boa cobertura: 13 testes em 4 arquivos (`contract-activation.test.js`, `domain.test.js`, `leads.test.js`, `real-estate.test.js`), todos passando. | Médio | Médio |
| 5 | `check-financial-boundaries.mjs` não cobre `src/domains/comercial/` — mesmo ponto cego já registrado na auditoria de Equipamentos, agora confirmado também aqui (sem violação ativa hoje, mas sem rede de segurança contra uma futura). | Baixo (hoje) | Baixo |

Mobile: a tela usa o helper `useBreakpoint()`/`cols()` para grade responsiva
em quase tudo, mas tem bem menos CSS mobile dedicado que Equipamentos: só
46 regras `.commercial-*` no total (2 delas `@media(max-width` — contra
~50 regras `@media` escopadas em Equipamentos) e 17 regras `.re-*` para o
módulo imobiliário (2 `@media`). Não foi possível confirmar visualmente o
comportamento mobile nesta auditoria (a evidência visual capturada foi só
desktop 1440×900 — ver seção de crítica de design abaixo), então este é um
risco documentado, não um achado fechado.

Também vale registrar, como achado de design encontrado por leitura direta
de `src/index.css` (fora do escopo do detector automático, que não varre
CSS puro): `.commercial-command-card` (`src/index.css:5205`) usa
`background:linear-gradient(120deg,#f9faf9 0%,#f1f4f2 100%)` — o DESIGN.md
do projeto (sistema "ARCD Carbon") é explícito: *"Cards não devem flutuar
nem usar gradientes."* As cores usadas nesse bloco (`#1f7136`, `#202529`,
`#6d7479`, `#cfd4d6`) também não batem com os tokens declarados
(`#24A148` verde, `#161616` grafite, `#525252` aço, `#D6D6D6` linha
técnica) — parecem uma paleta ad-hoc criada para este card específico, não
os tokens do sistema.

## Completude funcional frente a mercado

Avaliação por conhecimento geral de CRM comercial/imobiliário (Pipedrive,
RD Station, Sienge Comercial e similares como referência de conhecimento
geral — **não é benchmark medido**, é comparação qualitativa). O que já
existe em `activities.js`/`leads.js`/`real-estate.js` foi checado antes de
listar qualquer coisa como "faltando".

| Recurso de mercado | Situação no ARCD Obras | Nota |
| --- | --- | --- |
| Funil visual (kanban) | **Presente e além do padrão** — duas visões: funil bruto por etapa (`com_funil`) e "Jornada do cliente" por fase, com cards que avançam sozinhos conforme o sistema registra eventos (proposta enviada, contrato assinado), sem precisar arrastar | Forte |
| Motor de indicação/referral | **Presente e é diferencial real** — ranking de indicador, taxa de indicação por obra entregue, NPS de entrega, momentos de pedir indicação (entrega sem pesquisa, promotor não convidado, detrator não tratado, marco de obra em 60%+) | Muito forte, incomum em CRM genérico |
| Histórico de interação por lead | **Presente** — `lead.historico[]` registra criação, mudança de etapa, reunião executada (com resumo/objeções/próximos passos), perda | Adequado |
| Metas por vendedor | **Presente** — meta por período/responsável com barra de progresso contra o realizado | Adequado |
| Dashboard de conversão | **Presente** — conversão por fase da jornada (`conversaoPorFase`), ciclo médio de venda, relatório por vendedor e por origem, exportação Excel | Forte |
| Lembretes/tarefas automáticas | **Parcial** — cria automaticamente a primeira tarefa ("Primeiro contato") ao cadastrar um lead, e o painel de alertas do dashboard cobre follow-up vencido, reunião próxima/atrasada, proposta vencendo, contrato sem assinatura, entrada pendente. Mas é tudo *reativo*: só aparece quando alguém abre a tela — não há notificação push/e-mail/WhatsApp, nem digest programado | Médio |
| E-mail/WhatsApp integrado | **Superficial** — "Compartilhar" copia uma mensagem pronta para a área de transferência (usuário cola manualmente no WhatsApp Web); e-mail é um link `mailto:` que abre o cliente de e-mail local. Não há envio rastreado, confirmação de leitura, nem histórico de mensagens de fato enviadas | Fraco frente ao mercado (RD Station/Pipedrive têm envio e rastreio integrados) |
| Assinatura eletrônica de contrato | **Ausente** — `contrato.assinaturaUrl` é só um campo de texto livre; não há integração com DocuSign/Clicksign/D4Sign nem qualquer fluxo de assinatura eletrônica real | Ausente |
| Calculadora/estimativa de proposta | **Ausente** — o valor da proposta é digitado à mão; não há sugestão baseada em orçamento paramétrico ou histórico de propostas semelhantes | Ausente |
| Gestão de comissão (ciclo completo) | **Incompleto** — comissão é calculada e exibida, mas nunca sai do status "prevista" (achado de bug P3 acima); não há tela de "marcar comissão como paga" nem integração com folha/pagamento | Fraco |
| Detecção de duplicidade de lead | **Básica** — só compara e-mail/WhatsApp exato no momento de salvar, via `window.confirm`; não há fuzzy-match por nome/telefone parcial | Básico |
| Módulo imobiliário dedicado (VGV, unidades, reservas, corretores) | **Presente e comparável a add-on de mercado (ex. Sienge Comercial)** — dashboard de VGV com gráficos, status de unidade com auditoria de preço/status, expiração automática de reserva, aprovação obrigatória para venda abaixo do mínimo, dossiê de documentos por ativo | Forte |

## Ferramenta de propostas e contratos em PDF (investigação preparatória)

O usuário vai enviar um modelo depois — esta seção é só levantamento
técnico, **nada foi implementado**.

**O que já existe no repositório hoje:**
- `package.json` não tem nenhuma biblioteca de geração de PDF
  (`jspdf`, `pdfmake`, `html2pdf`, `puppeteer` — busca sem resultado).
  `pdf-parse` está presente, mas é para *ler* PDF existente (usado em outro
  fluxo), não para gerar.
- O padrão hoje em uso no restante do sistema (`LegacyApp.jsx`, ~5
  ocorrências) é `montarRelatorioPadraoHtml` + `abrirRelatorioPadrao`:
  monta um HTML e abre numa aba nova com `window.print()`, deixando o
  usuário "Salvar como PDF" pelo diálogo de impressão do navegador. Não é
  geração de PDF de verdade (sem controle de layout fino, marca d'água,
  paginação garantida, ou envio automático por e-mail).
- `ComercialView.jsx:199` (`pdfProposta`) já faz exatamente essa mesma
  coisa, mas com um template HTML próprio em vez de reusar o helper
  compartilhado (achado de bug P3 acima) — ou seja, hoje propostas **já
  "viram PDF"** pelo mesmo mecanismo de imprimir-do-navegador, só que sem
  consistência com o resto do sistema. Contratos (`com_contratos`) não têm
  nenhum botão equivalente hoje.

**Três caminhos técnicos viáveis, para quando o modelo chegar:**

1. **HTML/CSS → impressão do navegador (extensão do padrão atual)** —
   zero dependência nova, reusa `montarRelatorioPadraoHtml`. Prós: grátis,
   já validado em produção, fácil de manter. Contras: não é PDF de verdade
   (o usuário precisa clicar "Salvar como PDF"), paginação e fontes variam
   por navegador/impressora do usuário, difícil bater 1:1 com um modelo de
   Word/PDF fornecido pelo usuário (marca d'água, cabeçalho repetido,
   numeração de página fixa).
2. **Biblioteca client-side de geração de PDF** (ex. `jspdf` combinado com
   `html2canvas`, ou `pdfmake` para layout declarativo) rodando no
   navegador do usuário. Prós: sem custo de servidor, funciona offline,
   arquivo final é PDF de verdade (baixável, anexável ao card de
   documentos que já existe via `enviarArquivoOneDrive`). Contras:
   bibliotecas client-side de PDF são pesadas para o bundle (`jspdf` +
   `html2canvas` somam bastante KB), fontes customizadas exigem embutir o
   arquivo da fonte, layouts complexos (tabelas com quebra de página,
   cabeçalho/rodapé repetido) são mais trabalhosos que em uma engine
   server-side.
3. **Geração server-side** via `api/` (função serverless na Vercel) —
   opções: (a) motor de HTML→PDT headless (Puppeteer/Chromium ou
   `@react-pdf/renderer`) rodando na function, ou (b) preencher um template
   estruturado (ex. `.docx` com merge-fields via alguma lib de template) e
   depois converter. Prós: fidelidade alta ao modelo do usuário (se vier
   como `.docx`/`.pdf` com campos), roda igual em qualquer navegador,
   layout profissional replicável. Contras: Puppeteer/Chromium headless em
   função serverless da Vercel tem limite de tamanho/tempo de execução e
   historicamente é o tipo de dependência mais frágil de manter atualizada
   nesse ambiente (cold start pesado); precisa de mais cuidado de
   infraestrutura que as opções client-side.

**Recomendação preliminar** (a confirmar quando o modelo chegar): se o
modelo do usuário for majoritariamente texto/tabela com identidade visual
simples (cabeçalho, valores, cláusulas), a opção 1 estendida (reusar
`montarRelatorioPadraoHtml`, unificando `pdfProposta` a esse padrão, e
criar o equivalente para contrato) resolve com menor esforço e reaproveita
o que já roda em produção. Se o modelo exigir fidelidade alta a uma peça
gráfica pronta (papel timbrado com logotipo posicionado, marca d'água,
paginação garantida para assinatura), vale considerar a opção 3. A decisão
final depende do modelo que o usuário vai enviar — **esta seção não avança
para implementação até isso acontecer.**

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

*Primeira execução para este alvo — sem tendência ainda. Snapshot
persistido em
`.impeccable/critique/2026-08-18T14-57-52Z__src-domains-comercial-components-comercialview-jsx.md`
para que `/impeccable polish` possa retomar as prioridades sem copiar e
colar.*

## Checklist completo

### Achados de bug/funcionamento a corrigir (por severidade)

- [x] **P0 — fazer primeiro** — Corrigir o bug de roteamento (Achado 0):
      trocar `view` por `commercialView` em todos os ramos do `if/else` a
      partir de `ComercialView.jsx:1167`, ou importar e aplicar
      `LEGACY_COMMERCIAL_ROUTE` (`constants.js:3-8`, já existe e não é
      usado) antes do bloco de renderização. Sem isso, "Propostas e
      contratos" e "Gestão comercial" continuam abrindo em branco no menu
      lateral em produção. Ao corrigir, decidir também para onde
      "Gestão comercial" deve levar Metas (`com_metas`) — hoje nem o
      mapeamento correto cobre esse destino.
      **Corrigido em 18/08/2026, commit `f01deb7` (sessão principal, antes
      desta leva).**
- [ ] **P0 (achado da crítica de design)** — Adicionar um passo de
      confirmação explícito antes de `finalizarContrato`
      (`ComercialView.jsx:204-242`): hoje é a ação mais irreversível e cara
      do setor (cria 9 registros ligados) e tem *menos* fricção que excluir
      um único lead. Um modal estilizado (não `window.confirm`) mostrando o
      que vai ser criado resolve. **Fora do escopo desta leva de correção**
      — é uma mudança de comportamento/UX nova (adicionar uma etapa de
      confirmação que não existia), não um dos achados de funcionamento já
      identificados pelo usuário para corrigir; permanece como recomendação
      de design em aberto.
- [x] **P1** — `statusProposta` (`ComercialView.jsx:198`) passar a usar
      `persistirComercial` (ou equivalente que cheque `result?.ok` e avise
      o usuário em caso de falha), já que essa função também gera contrato
      automaticamente na aceitação. **Corrigido em 18/08/2026.**
- [x] **P1** — Botões "ENVIAR" e "REGISTRAR ASSINATURA" do card de
      contrato (`ComercialView.jsx:1296`) idem — checar sucesso da
      gravação antes de considerar a ação concluída. **Corrigido em
      18/08/2026** (extraídas para `enviarContrato`/
      `registrarAssinaturaContrato`).
- [x] **P2** — `moverLead` (`ComercialView.jsx:153`) idem, ou pelo menos
      reverter visualmente o card se a gravação falhar. **Corrigido em
      18/08/2026** (convertida para `persistirComercial`; segue o padrão do
      resto do arquivo de avisar por toast em vez de reverter visualmente).
- [x] **P2** — Generalizar o padrão trava-contra-duplo-clique
      (`setSalvando<algo>` + `disabled`) já usado em `finalizarContrato`
      para as 11 funções de gravação listadas no achado de funcionamento.
      **Corrigido em 18/08/2026** (mais `salvarNegociacao`, achado extra da
      mesma categoria durante a correção).
- [x] **P2** — Trocar os 3 `window.confirm`/`window.prompt` nativos por
      modal consistente com o resto do app (`ComercialView.jsx:127, 141,
      202`). **Corrigido em 18/08/2026** (novo `confirmModal` estilizado,
      mesmo padrão de `EquipamentosView.jsx`).
- [x] **P2** — Passar `showToast` como prop para `RealEstateCommercial`
      (`ComercialView.jsx:1314` no `<LazyRealEstateCommercial>`) e trocar
      os 3 usos de `window.confirm`/`window.alert` em
      `RealEstateCommercial.jsx:59, 98, 99`. **Corrigido em 18/08/2026.**
- [ ] **P3** — Unificar `pdfProposta` ao padrão
      `montarRelatorioPadraoHtml`/`abrirRelatorioPadrao`. **Não corrigido
      nesta leva** — decisão deliberada de deixar para quando a
      implementação de PDF de verdade avançar (ver seção "Ferramenta de
      propostas e contratos em PDF"), para não criar um quarto padrão de
      geração de documento no meio do caminho.
- [x] **P3** — Decidir a origem da taxa de comissão de 1%
      (`contract-activation.js:92`): documentar de onde vem, tornar
      configurável, ou trocar por uma regra explícita (ex. taxa do
      vendedor, se/quando esse campo existir no cadastro de usuário).
      **Corrigido parcialmente em 18/08/2026**: nomeada como constante
      `DIRECT_SALE_DEFAULT_COMMISSION_PCT` com comentário documentando a
      origem desconhecida — sem tornar configurável nem trocar a regra
      (decisão de produto, não tomada nesta leva).
- [ ] **P3** — Decidir o ciclo de vida de `comissoes`: criar o caminho de
      "marcar como paga" e decidir se/como isso deveria refletir no DRE
      como despesa, ou documentar explicitamente (como a Fase 5 de
      Equipamentos) que é escopo futuro.

### Decisões de produto/arquitetura em aberto

- [ ] Decidir o destino do pipeline de `opportunities`/`transitionOpportunity`
      (achado estrutural #1): terminar a integração com a UI (substituindo
      o `leads[].etapa` livre por um modelo com probabilidade por etapa e
      retrocesso auditado), ou remover o código morto (`workspace`
      computado sem uso, `selectCommercialWorkspace`, `selectForecast`,
      `transitionOpportunity` sem chamador).
- [ ] Se o item acima for mantido em aberto por ora, ao menos documentar a
      decisão (mesmo modelo do `docs/EQUIPAMENTOS_FASE_5_COBRANCA.md`) para
      não parecer código esquecido para quem ler depois.

### Ferramentas de mercado a avaliar como próximo incremento (por valor)

- [ ] Envio/rastreio real de proposta por e-mail/WhatsApp (hoje é
      copiar-colar manual) — maior lacuna frente a CRM de mercado.
- [ ] Assinatura eletrônica de contrato (hoje é um campo de URL livre).
- [ ] Notificação proativa (e-mail/push) para os alertas que já existem no
      dashboard, hoje 100% reativos.
- [ ] Detecção de duplicidade de lead por fuzzy-match, não só e-mail/
      WhatsApp exato.

### Ferramenta de PDF (bloqueado no usuário)

- [ ] Aguardar o modelo de proposta/contrato do usuário.
- [ ] Depois de recebido, decidir entre as 3 opções técnicas levantadas
      (impressão HTML estendida / biblioteca client-side / geração
      server-side) com base na fidelidade visual exigida pelo modelo.
- [ ] Ao implementar, unificar com o achado P3 de `pdfProposta` (não criar
      um quarto padrão de geração de documento no sistema).
