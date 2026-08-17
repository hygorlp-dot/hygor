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
| **Cadastro físico** (`fisico`) | **7,5** | Fluxo mais robusto tecnicamente (`materializarCadastroFisico` com padrão exemplar). Não é alcançado por nenhum dos 3 achados de DRE. Só perde pontos por `salvarRevisaoFisica` sem `try/catch`/trava (risco atenuado pela versão otimista no servidor). |
| **Relatório** (`relatorio`) | **7** | Componente limpo, sem lógica de gravação própria - mas herda os 3 achados de DRE por baixo (o número que ele mostra pode estar errado por causa do servidor). Nota alta na parte que audita (código), mas o dado que exibe é duvidoso. |
| **Mapa de ocupação** (`gestao`) | **6** | Grade em si é sólida e só leitura, mas o modal de indisponibilidade que ela abre tem os dois piores casos de falha silenciosa da tela inteira (duplicação de bloqueios, modal que fecha antes do resultado assíncrono aparecer). |
| **Frota** (`frota`) | **6,5** (era 5,5 - Achado 2 já corrigido) | Tinha o Achado 1 (em correção separada) e o Achado 2 (corrigido nesta sessão). No código em si, `salvarEquip`/`excluirEquip` são exemplares, mas `salvarTransf` e `salvarDono` (que ignora todo o pipeline de comandos) puxam para baixo. |
| **Manutenção** (`manutencao`) | **4** | Pior ponto de código da tela (`salvarManut` sem `try/catch`, sem trava, botão sem `disabled` - único ponto de entrada da aba, sem proteção nenhuma). Estruturalmente correta no DRE (não é bug, é decisão consciente que manutenção só afeta o nível empresa, não a obra), mas o código que a implementa é o mais frágil. |
| **Locações** (`locacoes`) | **6** (era 3,5 - Achado 3 reclassificado) | A aba mais rica e, isoladamente, a mais bem protegida em termos de wiring de comando (travas por chave, só `encerrarLoc` destoa). O subsistema de cobrança/medição/fatura de locação não alimenta o DRE, mas isso é fase documentada e inacabada (`docs/EQUIPAMENTOS_FASE_5_COBRANCA.md`), não um bug escondido - os toasts avisam honestamente o usuário. Ainda pesa o Achado 1 (em correção separada), que afeta diretamente o custo calculado de uma locação. |

**Nota geral do módulo: 6,3/10** (era 5,6 - revisado após corrigir o Achado 2
e reclassificar o Achado 3) - código de UI razoavelmente maduro (padrão
consistente de trava+catch na maioria das funções, boa cobertura de teste
unitário nos domínios puros). O que mais pesa contra a nota agora é o
Achado 1 (ainda em correção) e as 6 funções de gravação sem proteção contra
falha de rede/duplo-clique, mais a lacuna real de completude funcional
frente a sistemas de mercado.

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

Seis funções de gravação **não seguem o padrão** (que a maioria segue
corretamente: `setSalvandoEquipamento(chave)` → `try/catch` → `result?.ok`
checado → `finally` limpa a trava, com o botão usando
`disabled={!!salvandoEquipamento}`):

| Severidade | Função | Local | Efeito |
| --- | --- | --- | --- |
| Alta | `salvarManut` | `EquipamentosView.jsx:592-604`, botão `:1576` | Sem `try/catch`, sem trava, botão sem `disabled` - único ponto de entrada da aba Manutenção inteira, sem proteção nenhuma. Duplo-clique cria manutenções duplicadas, cada uma bloqueando o equipamento duas vezes no calendário. |
| Média | `salvarIndisponibilidade` | `:606-619`, botão `:1596` | Duplo-clique duplica bloqueios visíveis no mapa de ocupação. |
| Média | `cancelarIndisponibilidade` | `:621-633`, `:1595` | O modal fecha (`setIndispModal(null)`) antes do resultado assíncrono - se falhar, o toast de erro aparece depois que a tela já "esqueceu" a ação. |
| Média | `salvarTransf` | `:635-646`, botão `:1628` | Duplo-clique gera transferências duplicadas no histórico. |
| Média | `salvarRevisaoFisica` | `:312-326`, botão `:1284` | Risco atenuado pela versão otimista no servidor, mas ainda sem feedback de erro de rede. |
| Média | `encerrarLoc` | `:398-409`, botão `:1070` | Usa `window.prompt` em vez de modal com `<Inp type="date">` (inconsistente com o resto da aba); é o único botão da lista de ações da locação sem `disabled`. |
| Média | `salvarDono` | `:359-366`, botão `:1275` | Ignora todo o pipeline de comandos versionados - usa `update()` direto, sem `expectedVersion`, sem auditoria, sem aviso de "alterado por outra pessoa". Única entidade do domínio nessa situação. |

Cobertura de teste: 14 arquivos / 101 testes nos módulos puros de
equipamentos, todos passando. Nenhum teste de componente para
`EquipamentosView.jsx` - mesmo padrão de `TerceirosView.jsx`/
`ComprasView.jsx`, não é uma lacuna nova desta extração.

## Oportunidades de melhoria estrutural

| # | Achado | Impacto | Esforço |
| --- | --- | --- | --- |
| 1 | `EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED` é um comando com handler completo e testado (`commands.js:487-501`) mas **sem nenhuma UI que o dispare em todo o projeto** - parece funcionalidade de conciliação de recebimento de fatura abandonada pela metade. | Médio | Baixo (investigar primeiro) |
| 2 | `Equipamentos` não aparece em nenhuma fase de `docs/ROADMAP_DESIGN.md`, apesar de ter mais `style={{` (203) que `Terceiros` (127), que já está na Fase 3. | Médio | Baixo (é só adicionar ao roadmap) |
| 3 | E2E (`modules-smoke.spec.js`) só testa caminho feliz de *visibilidade* (abre modal, clica Cancelar) - nenhum cenário realmente submete um formulário e verifica sucesso ou erro. A regra de negócio em si é bem testada em unidade (`commands.test.js`, inclusive corrida de duas reservas disputando a última unidade), mas a integração UI→comando→toast não tem rede de segurança. | Médio | Baixo-médio |
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

## Próximos passos sugeridos (atualizado após a correção do Achado 2)

1. ~~Achado 2 (guard de proprietário terceiro)~~ - **corrigido nesta
   sessão**.
2. Achado 1 (quantidade/pacote tarifário no servidor) - em correção numa
   sessão separada; conferir o resultado e rodar a suíte completa quando
   terminar.
3. Achado 3 (cobrança/fatura de locação) - **não é mais um item de "corrigir
   bug"**: é decidir se a Fase 5 (`docs/EQUIPAMENTOS_FASE_5_COBRANCA.md`,
   inacabada desde 04/08) é retomada e concluída (incluindo a "ativação
   explícita da nova projeção" que o próprio plano prevê como etapa
   separada, com cuidado para não contar receita em dobro com o modelo
   antigo), ou explicitamente pausada/simplificada. Não é um conserto
   pontual.
4. As 6 funções de gravação sem `try/catch`/trava são um conserto
   mecânico, baixo risco, alto valor - candidatas a uma correção rápida
   isolada, no mesmo padrão das já corrigidas nesta sessão.
5. `EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED` não é abandonado - é o
   "Oitavo incremento" da Fase 5 (commit `fe7f9ca`), implementado no
   backend mas sem UI ainda. Mesma decisão do item 3: retomar a Fase 5 ou
   não.
6. Adicionar `Equipamentos` ao `docs/ROADMAP_DESIGN.md`.
