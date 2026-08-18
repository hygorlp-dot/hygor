# Auditoria do módulo Equipamentos

Auditoria feita em 17/08/2026, logo após a extração de `Equipamentos` de
`LegacyApp.jsx` para `src/domains/equipamentos/components/EquipamentosView.jsx`
(~1.945 linhas). Quatro investigações independentes, cada uma cobrindo uma
dimensão: funcionamento/boas práticas por aba, conformidade com o DRE,
oportunidades de melhoria estrutural, e completude funcional frente a
sistemas de mercado de gestão de frota.

**Status das correções (atualizado após o diagnóstico):**
- Achado 1 (quantidade/pacote tarifário ignorados no servidor) - em
  correção numa sessão separada (chip de tarefa disparado pelo usuário).
- Achado 2 (guard de proprietário terceiro ausente no motor do cliente) -
  **corrigido nesta sessão**, ver `src/domains/equipamentos/calculations.js`
  (`calcEquipMes`/`calcEquipamentosPorObra`) e o novo teste de regressão em
  `financial-calculations.test.js`.
- Achado 3 (cobrança/fatura de locação não alimenta o DRE) - **não é um
  bug**, é fase inacabada e documentada (ver correção de entendimento na
  seção do achado). Não corrigido nesta sessão, é decisão de produto.
- Demais achados (funcionamento/boas práticas, estrutura, completude de
  mercado) - diagnóstico apenas, nada corrigido ainda.

## Ranking por parte (0-10)

Nota combinando as 4 dimensões - funcionamento/código, conformidade com o
DRE, estrutura/manutenibilidade e completude funcional. A dimensão DRE pesa
mais nas partes onde ela se aplica (Frota e Locações), porque divergência
de dinheiro real é mais grave que um `try/catch` faltando.

| Parte | Nota | Por quê |
| --- | --- | --- |
| **Cadastro físico** (`fisico`) | **8,5** (era 8 - `materializarCadastroFisico` agora com E2E de submissão real) | Fluxo mais robusto tecnicamente. Não é mais alcançado por nenhum dos 3 achados de DRE nem pela falta de `try/catch`/trava. `e2e/modules-smoke.spec.js` agora clica "Materializar cadastro" → confirma no modal → verifica o toast de sucesso, não só a navegação. |
| **Relatório** (`relatorio`) | **8,5** (era 8 - protegido pelo novo guardrail estrutural) | Componente limpo, sem lógica de gravação própria. O número que exibe reflete um servidor corrigido (Achado 1) e um cliente correto (Achado 2); `scripts/check-financial-boundaries.mjs` agora falha o build se `server/dre-projection.js` voltar a reimplementar `valorDiaria`/`custoDiaria` localmente em vez de usar `calcEquipCustoObra` - a exata classe de regressão do Achado 1. |
| **Mapa de ocupação** (`gestao`) | **8,5** (era 7,5 - `salvarIndisponibilidade` agora com E2E de submissão real) | Grade sólida e só leitura; o modal de indisponibilidade tem trava contra duplo-clique. `modules-smoke.spec.js` agora preenche e salva uma reserva de verdade (antes só abria e fechava o modal) e confirma o toast "Reserva registrada." |
| **Frota** (`frota`) | **8,5** (era 8 - `salvarDono` agora com comando versionado e E2E de submissão real) | Achado 1 e Achado 2 corrigidos. `salvarEquip`/`excluirEquip`/`salvarTransf`/`salvarDono` seguem o mesmo padrão de comando+trava. `modules-smoke.spec.js` agora cria um proprietário de verdade via UI e confirma o toast. |
| **Manutenção** (`manutencao`) | **8,5** (era 7,5 - `salvarManut` agora com E2E de submissão real) | Era o pior ponto de código da tela; corrigido, e agora `modules-smoke.spec.js` registra uma manutenção de verdade (equipamento + custo) e confirma o toast "Manutenção registrada." - fecha a lacuna que mais pesava contra esta aba. |
| **Locações** (`locacoes`) | **7,5** (era 7 - aviso persistente sobre a Fase 5 substitui depender só de toasts) | A aba mais rica e bem protegida em wiring de comando. O subsistema de cobrança/medição/fatura ainda não alimenta o DRE (Achado 3, decisão de produto em aberto, não um bug) - mas agora a aba mostra um aviso fixo ("COBRANÇA POR CICLO · EM DESENVOLVIMENTO") assim que o usuário abre a lista de locações, em vez de só avisar depois que ele já iniciou uma ação. Reduz o risco de alguém interpretar o subsistema como concluído; não resolve a integração em si. |

**Nota geral do módulo: 8,3/10** (era 7,7 - revisado após 3 melhorias
estruturais: (1) `scripts/check-financial-boundaries.mjs` passou a vigiar
`server/dre-projection.js` contra a exata classe de regressão do Achado 1;
(2) `e2e/modules-smoke.spec.js` passou a submeter de verdade 4 dos fluxos
antes só verificados por unidade - materializar cadastro físico, reservar
equipamento, registrar manutenção e cadastrar proprietário - fechando boa
parte do item #3 de "oportunidades de melhoria estrutural"; (3) aviso
persistente sobre a Fase 5 de cobrança na aba Locações). Código de UI
maduro, comando versionado + trava+catch em toda função de gravação, rede
de segurança de teste bem mais forte que antes desta rodada. **Não chega a
8,5** porque o que resta é, deliberadamente, decisão de produto e não
conserto de código: (a) a Fase 5 de cobrança de locação (Achado 3) - retomar
e concluir, ou pausar/simplificar explicitamente - continua sem decisão; e
(b) a lacuna de completude funcional frente a sistemas de mercado (tabela
abaixo, com destaque para a calculadora de tarifa de locação que o usuário
pediu para investigar) segue sem nenhum item implementado. Fechar (a) e/ou
avançar em (b) é o caminho real para passar de 8,3 - não é algo que se
resolve só revisando código existente.

## Achados de conformidade com o DRE (severidade máxima desta auditoria)

Investigado pelo agente `dre-integration-guardian`, com confirmação
numérica rodando os dois motores (cliente vs. servidor) lado a lado.

### Achado 1 - CONFIRMADO: custo de equipamento no servidor ignora quantidade e pacote tarifário

- `server/dre-projection.js:62-69` (`equipmentWork`) faz `days *
  valorDiaria` puro - não multiplica por `quantidade`, não roda
  `melhorTarifa`/`tarifasDaLocacao` (a escolha do pacote mais barato:
  dia/semana/quinzena/mês) que o motor canônico do cliente
  (`src/domains/equipamentos/calculations.js:63-81,325-338`) usa.
- Esse valor do servidor **sobrescreve** o do cliente na tela
  (`aplicarRazao` em `LegacyApp.jsx:4412-4416` substitui todo campo
  numérico quando a resposta do servidor chega).
- Cenário confirmado: locação `quantidade:3`, `dia:100`, 10 dias → cliente
  calcula R$3.000, servidor calcula R$1.000 (3× subestimado). Outro
  cenário: tarifa `{dia:100, mes:2000}` por 30 dias → cliente escolhe o
  pacote mensal (R$2.000), servidor usa `valorDiaria*dias` (R$3.000,
  superestimado em R$1.000).
- O único teste que cobre essa função (`src/dre-projection.test.js:56-82`)
  usa sempre `quantidade:1` e tarifa plana - nunca exercita o caminho que
  está errado.

### Achado 2 - CONFIRMADO: guard "repasse só para proprietário terceiro" existe no servidor, falta no motor do cliente

- `server/dre-projection.js:70-89` (`equipmentCompany`) só reconhece
  `custoDono` como obrigação quando `equipment.proprietarioId` existe. O
  motor canônico do cliente (`calc EquipamentosMes`/`calcEquipFaturamentoEmpresa`,
  `calculations.js:154-189,340-352`) soma `custoDono` sem esse guard.
- Cenário confirmado: equipamento sem `proprietarioId` (próprio da
  empresa) mas com `tarifasCusto` residual de quando era terceirizado →
  cliente calcula lucro R$600, servidor calcula R$1.500 - R$900 de
  diferença no lucro consolidado de equipamentos.
- O `financial-shadow.js` (comparação em sombra) não pega essa
  divergência porque compara o servidor contra ele mesmo, nunca contra o
  motor canônico do cliente.

### Achado 3 - CORRIGIDO DE ENTENDIMENTO: não é bug, é fase inacabada e documentada (não wireado ao DRE por decisão explícita, não por defeito)

**Atualização de 17/08/2026, após checar `docs/EQUIPAMENTOS_FASE_5_COBRANCA.md`
e o histórico de commits**: o achado técnico abaixo continua correto (o
subsistema de fato não alimenta o ledger), mas a severidade original estava
errada - isto não é o mesmo padrão do bug do `contaAdmin`. O documento de
planejamento da "Fase 5: motor de cobrança e faturamento" (iniciada em
04/08/2026, 8 incrementos, `git log` confirma cada um como commit próprio)
diz explicitamente, desde o primeiro incremento: *"o comando apenas prepara
a cobrança e não cria lançamento no razão, título ou movimentação bancária
neste incremento"* e *"locações e relatórios legados continuam sendo
calculados como antes até a ativação explícita da nova projeção"*. A última
linha do documento: **"A Fase 5 ainda não está concluída."**

Ou seja: os toasts ("sem emitir faturamento", "Emissão e vencimento
continuam pendentes", "Nenhum recebimento foi registrado") não são um
sintoma de bug escondido - são avisos honestos e deliberados de um recurso
em construção, exatamente como o plano descreve. Conectar isso ao DRE agora,
sem terminar a "ativação explícita da nova projeção" que o próprio plano
prevê como etapa distinta, seria arriscar contagem dupla de receita (a
locação já é reconhecida no DRE pelo modelo antigo via `locacoesEquip`+
`tarifas`; ativar o novo modelo em paralelo sem migrar exigiria decidir como
os dois convivem). **Não tentei corrigir isto nesta sessão** - é uma decisão
de produto/arquitetura (retomar e terminar a Fase 5, ou decidir
explicitamente pausar/simplificar), não um bug pontual.

Isso também explica o achado #1 da seção de melhorias estruturais
(`EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED` sem UI): é o "Oitavo incremento"
do mesmo plano (`git log`: commit `fe7f9ca`, "concilia recebimentos de
faturas") - implementado no backend, mas sem a ação de UI correspondente
ainda, ao contrário dos incrementos 5 e 7 que documentam explicitamente
"ação X aparece na tela". Não é abandonado, é a próxima etapa não feita.

Achado técnico original (ainda válido como descrição do estado atual, só a
gravidade foi revisada):

- `src/domains/financeiro/ledger.js` não lê `rentalChargeItems` nem
  `rentalInvoices` em lugar nenhum (grep exaustivo, zero ocorrências).
- Ou seja: qualquer cobrança lançada via `rentalChargeModal` (avulsa,
  `salvarLinhaCobranca`), `rentalMeasurementModal` (medição por ciclo,
  `salvarMedicaoLocacao`) ou fatura emitida via `rentalInvoiceModal`
  (`salvarFaturaLocacao`) **nunca aparece em nenhum DRE**, nem cliente nem
  servidor.
- Os próprios toasts do código confirmam que o fluxo é sabidamente
  incompleto: "Linha de cobrança adicionada **sem emitir faturamento**"
  (`EquipamentosView.jsx:552`), "Cobrança medida. **Emissão e vencimento
  continuam pendentes**" (`:570`), "Fatura emitida com saldo em aberto.
  **Nenhum recebimento foi registrado**" (`:587`).
- Dentro do próprio subsistema (não-DRE) não há bug: fatura marca linhas
  como `billed` corretamente, sem risco de fatura duplicada.

`scripts/check-financial-boundaries.mjs` (o guardrail que hoje existe)
**não pegaria nenhum dos 3 achados** - só varre `LegacyApp.jsx`/
`MedicoesView.jsx`, não `server/*.js` nem o domínio de equipamentos. É um
ponto cego real da rede de segurança atual, não só desta feature.

## Achados de funcionamento e boas práticas (por aba)

Sete funções de gravação **não seguiam o padrão** (que a maioria seguia
corretamente: `setSalvandoEquipamento(chave)` → `try/catch` → `result?.ok`
checado → `finally` limpa a trava, com o botão usando
`disabled={!!salvandoEquipamento}`). **Todas as 7 foram corrigidas nesta
sessão** (commits desta sessão de audit+polish, mais o fix do `salvarDono`
descrito abaixo):

| Severidade | Função | Local | Efeito (antes da correção) | Status |
| --- | --- | --- | --- | --- |
| Alta | `salvarManut` | `EquipamentosView.jsx:592-604`, botão `:1576` | Sem `try/catch`, sem trava, botão sem `disabled` - único ponto de entrada da aba Manutenção inteira, sem proteção nenhuma. Duplo-clique cria manutenções duplicadas, cada uma bloqueando o equipamento duas vezes no calendário. | **Corrigido** |
| Média | `salvarIndisponibilidade` | `:606-619`, botão `:1596` | Duplo-clique duplica bloqueios visíveis no mapa de ocupação. | **Corrigido** |
| Média | `cancelarIndisponibilidade` | `:621-633`, `:1595` | O modal fecha (`setIndispModal(null)`) antes do resultado assíncrono - se falhar, o toast de erro aparece depois que a tela já "esqueceu" a ação. | **Corrigido** |
| Média | `salvarTransf` | `:635-646`, botão `:1628` | Duplo-clique gera transferências duplicadas no histórico. | **Corrigido** |
| Média | `salvarRevisaoFisica` | `:312-326`, botão `:1284` | Risco atenuado pela versão otimista no servidor, mas ainda sem feedback de erro de rede. | **Corrigido** |
| Média | `encerrarLoc` | `:398-409`, botão `:1070` | Usava `window.prompt` em vez de modal com `<Inp type="date">` (inconsistente com o resto da aba); era o único botão da lista de ações da locação sem `disabled`. | **Corrigido** (modal `encerrarLocModal`) |
| Média | `salvarDono` | `:386-393` original, botão `:1358` | Ignorava todo o pipeline de comandos versionados - usava `update()` direto, sem `expectedVersion`, sem auditoria, sem aviso de "alterado por outra pessoa". Única entidade do domínio nessa situação. | **Corrigido** — novo comando `EQUIPMENT_OWNER_SAVED` (`commands.js`), `salvarDono` agora usa `dispatchCommand` + trava, com testes em `commands.test.js` |

Cobertura de teste: 14 arquivos / 101 testes nos módulos puros de
equipamentos, todos passando. Nenhum teste de componente para
`EquipamentosView.jsx` - mesmo padrão de `TerceirosView.jsx`/
`ComprasView.jsx`, não é uma lacuna nova desta extração.

## Oportunidades de melhoria estrutural

| # | Achado | Impacto | Esforço |
| --- | --- | --- | --- |
| 1 | `EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED` é um comando com handler completo e testado (`commands.js:487-501`) mas **sem nenhuma UI que o dispare em todo o projeto** - não é abandonado, é o "Oitavo incremento" da Fase 5, ainda não construído (decisão registrada em "Próximos passos", item 5). | Médio | Baixo (investigar primeiro) - **investigado, decisão registrada** |
| 2 | ~~`Equipamentos` não aparece em nenhuma fase de `docs/ROADMAP_DESIGN.md`~~ | Médio | **Corrigido** - adicionado à Fase 3 |
| 3 | ~~E2E só testa caminho feliz de *visibilidade*~~ - **parcialmente corrigido**: `modules-smoke.spec.js` agora submete de verdade 4 fluxos (materializar cadastro físico, reservar/bloquear, registrar manutenção, cadastrar proprietário) e confirma o toast de sucesso. Ainda faltam submissões reais para `salvarLoc`/`salvarTransf`/`salvarLinhaCobranca`/`salvarMedicaoLocacao`/`salvarFaturaLocacao`/`encerrarLoc`/`cancelarIndisponibilidade` - a regra de negócio de todos eles é bem testada em unidade (`commands.test.js`), só falta a integração UI→comando→toast. | Médio (reduzido) | Baixo-médio |
| 4 | Dividir `EquipamentosView.jsx` em subcomponentes próprios | Baixo (nenhuma das outras 8 telas extraídas foi dividida - seria inconsistência isolada, não um padrão do projeto) | Médio |
| 5 | Duplicação de lógica entre Equipamentos e Terceirizados | Não confirmada (os dois domínios resolvem problemas genuinamente diferentes - ativo físico com capacidade finita vs. contrato de serviço) | N/A |

Mobile: ao contrário do que se poderia supor, a tela **já tem** tratamento
mobile real e dedicado (`useBreakpoint`, ~50 regras `@media(max-width:700px)`
escopadas a `.equipment-*` em `src/index.css`, alvos de toque, scroll
horizontal com header sticky no mapa de ocupação). Não é uma lacuna.

## Completude funcional frente a sistemas de mercado

Avaliação por conhecimento geral de domínio (Sienge, Rental Man e
similares), não um benchmark medido - marcado como tal.

| # | Lacuna | Evidência de ausência | Valor | Esforço |
| --- | --- | --- | --- | --- |
| 1 | Manutenção preventiva programada por horímetro/data + alerta de vencimento | `equipVazio` sem campo de horímetro; `hourMeter` do checklist de locação nunca propaga ao cadastro do equipamento (`registry.js:32` lê um campo que a UI nunca escreve) | Alto | Médio |
| 2 | Central de alertas proativos (contrato vencendo, manutenção atrasada, equipamento ocioso há N dias, documentação/licença vencendo) | Zero ocorrências de `vencimento`/`validade` ligadas a equipamento em todo o domínio | Alto | Médio-alto |
| 3 | Relatório de payback/ROI por ativo (receita acumulada de locação vs. `valorAquisicao`) | `EquipmentBillingReports.jsx` só tem ranking por competência; `valorAquisicao` só é comparado contra preço SINAPI de compra, nunca contra receita gerada | Alto | Médio |
| 4 | Comparação "comprar vs. seguir alugando de terceiro" (custo acumulado x valor de um equipamento novo) | Dados de `custoDono`/`tarifasCusto` só agregados por competência, nunca acumulados ao longo do tempo por proprietário/modelo | Alto | Médio |
| 5 | Campo de documentação/licença do equipamento com validade (NR-12, calibração, CAT/ART) | Nenhuma ocorrência de `licenca`/`seguro`/`apolice`/`NR-12`/`CAT` no domínio - nem o campo de dado existe | Médio-alto | Médio |
| 6 | **Calculadora de tarifa de locação** (sugerir `tarifas.dia/semana/quinzena/mes` combinando valor de mercado do aluguel do tipo de equipamento + depreciação do ativo + provisão de manutenção realista) | Os 8 campos de tarifa (`EquipamentosView.jsx:1216-1246`) são `<Inp type="number">` simples, sem nenhum cálculo assistido ao lado - só uma prévia de "quanto sairia um mês pela combinação mais barata" (`melhorTarifa`), que usa o valor JÁ digitado, não sugere um valor de partida. A integração SINAPI existente (`sinapiPreco`) traz valor de AQUISIÇÃO, não uma referência de tarifa de locação - são coisas diferentes. | Alto (afeta toda locação nova; hoje o usuário decide o preço sem nenhum apoio, sujeito a subprecificar sistematicamente) | Médio-alto (não tem fonte de dado de "aluguel de mercado" hoje - precisaria ou de uma tabela de referência própria, ou de uma estimativa via depreciação anualizada + manutenção histórica média da categoria, que já dá para calcular com os dados que existem: `valorAquisicao`, vida útil assumida, e o custo médio de manutenção por categoria que já está registrado em `manutencoesEquip`) |

Multi-obra/disponibilidade preditiva (item avaliado à parte): cobertura
**parcial** - reserva manual (`indispModal` tipo `reservation`) e checagem
de conflito (`rentalAvailability`) já existem; o que falta é uma visão
proativa "vai ficar livre em X" cruzada com demanda futura de outra obra.
Valor médio, esforço médio.

## Próximos passos sugeridos (atualizado após a rodada de correção "revise os erros")

1. ~~Achado 2 (guard de proprietário terceiro)~~ - **corrigido nesta
   sessão**.
2. ~~Achado 1 (quantidade/pacote tarifário no servidor)~~ - **corrigido
   nesta sessão** (commit `acc0c19`, recuperado e integrado de uma sessão
   paralela do usuário; servidor agora usa `calcEquipCustoObra` canônico
   em vez de reimplementar o cálculo). Suíte completa verde após a
   aplicação.
3. Achado 3 (cobrança/fatura de locação) - **não é um item de "corrigir
   bug"**: é decidir se a Fase 5 (`docs/EQUIPAMENTOS_FASE_5_COBRANCA.md`,
   inacabada desde 04/08) é retomada e concluída (incluindo a "ativação
   explícita da nova projeção" que o próprio plano prevê como etapa
   separada, com cuidado para não contar receita em dobro com o modelo
   antigo), ou explicitamente pausada/simplificada. Continua em aberto -
   decisão de produto, não conserto pontual.
4. ~~As 7 funções de gravação sem `try/catch`/trava~~ (inclui `salvarDono`,
   corrigido por último via o novo comando `EQUIPMENT_OWNER_SAVED`) -
   **todas corrigidas nesta sessão**.
5. `EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED` continua sem UI - **decisão
   confirmada nesta rodada: não construir agora**. É o "Oitavo incremento"
   da Fase 5 (commit `fe7f9ca`), com handler completo e testado no
   backend; a UI de vínculo de recebimento é trabalho novo de tela
   (conciliação de fatura × extrato bancário), não um bug a corrigir - fica
   junto da decisão do item 3 sobre retomar ou não a Fase 5.
6. ~~Adicionar `Equipamentos` ao `docs/ROADMAP_DESIGN.md`~~ - **feito**
   (Fase 3, com nota sobre o polish já aplicado).
7. ~~`scripts/check-financial-boundaries.mjs` não cobria `server/*.js`~~ -
   **corrigido**: guardrail agora falha o build se `server/dre-projection.js`
   voltar a tocar `valorDiaria`/`custoDiaria` diretamente ou perder o import
   de `calcEquipCustoObra` - vigia especificamente a regressão do Achado 1.
   Continua sem cobrir outros domínios servidor além de equipamentos -
   escopo deliberado, não generalizar sem necessidade concreta.
8. ~~E2E sem submissão real (item #3 de melhoria estrutural)~~ -
   **parcialmente corrigido**: 4 dos ~11 fluxos de gravação agora têm
   submissão real testada. Os 7 restantes (`salvarLoc`, `salvarTransf`,
   `salvarLinhaCobranca`, `salvarMedicaoLocacao`, `salvarFaturaLocacao`,
   `encerrarLoc`, `cancelarIndisponibilidade`) seguem só com teste de
   visibilidade - candidatos a uma rodada futura, mesmo padrão.
9. Nota geral do módulo em 8,3/10 (meta do usuário era 8,5). O que falta
   para os 0,2 restantes não é código a corrigir, é decisão de produto:
   fechar o item 3 (Fase 5 de cobrança) e/ou avançar algum item da tabela
   de completude funcional (calculadora de tarifa de locação é o de maior
   valor/menor esforço relativo, ver tabela acima).
