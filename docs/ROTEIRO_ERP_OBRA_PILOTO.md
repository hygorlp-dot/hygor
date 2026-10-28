# Roteiro do ERP de obra completo — análise de fluxo e brechas antes do piloto

> Produzido em 27/10/2026 por leitura direta do código na branch
> `feat/ponto-livro-migracoes` (HEAD `1078089`). É uma análise de **fluxo de
> negócio** (o dado nasce aqui, passa por ali, chega ao DRE e ao cliente?),
> não de qualidade técnica — para isso, ver `docs/MATRIZ_MODULOS_10_10.md`.
> Referências `arquivo:linha` foram conferidas nesta data e podem se mover.
> Compras foi auditado em profundidade em 26-27/10 (pathfinder, PRs
> #132–#146); aqui ele aparece só pelo que ainda falta e pelas pontas que
> ligam com outros fluxos.

---

## 1. Resumo executivo — as 10 brechas que mais pesam no piloto

| # | Brecha | Fluxo | Efeito no piloto | Gravidade |
|---|---|---|---|---|
| 1 | **A folha não gera conta a pagar.** `titulosFolha` só é lido (conciliação, ledger), nunca criado. A Folha calcula e exporta PDF/XLS, e o pagamento só aparece quando a conciliação do extrato cria um `pagamentosFolha` "sem título vinculado". | Ponto → pagamento | Não há "fechar quinzena → aprovar → pagar → baixar". O financeiro não vê a folha a pagar antes de ela sair do banco; o fluxo de caixa projetado ignora a maior despesa recorrente. | **Crítica** |
| 2 | **O app de ponto (REP-P) não alimenta a folha.** Marcações e apropriação vivem em `ponto_*` (servidor); a folha lê o `attendance` legado (P/M/F + horários). A ponte está na Fase 03 ("substituir folha"), não iniciada. | Ponto → folha | No piloto, alguém vai redigitar o ponto do app na grade legada — duplicidade, divergência e perda do valor fiscal da batida. | **Crítica** |
| 3 | **Custo de mão de obra sem encargos.** Custo = diária × fator + HE + VT/VR (`src/domains/ponto/payroll.js`). *(Corrigido em 28/10: o regime diária × CLT existe, com histórico, e a Folha calcula holerite CLT e provisões — mas encargos e provisões não entram no custo de mão de obra do DRE.)* | Ponto → DRE | Se houver CLT, o DRE subestima a mão de obra (encargos+provisões costumam somar 60–100% do salário) e a margem parece maior do que é. | **Crítica** (se houver CLT) |
| 4 | **Férias contam como falta.** O ponto só aceita P/M/F; dia sem P/M paga zero (`docs/BLUEPRINT_FERIAS.md`, não implementado). Atestado, folga compensada e afastamento também não existem. | Ponto → folha | Primeira férias do piloto gera desconto indevido. | Alta |
| 5 | **Físico-financeiro "inventa" o realizado.** Sem `custoReal` digitado na tarefa, o realizado vira `previsto × progresso` (`src/domains/planejamento/legacy-engine.js:590`) → CPI = 1 e desvio zero. O custo real do razão (compras, MO, terceiros) não chega à tarefa/etapa. | Orçamento → planejamento → DRE | O painel diz "no orçamento" justamente quando ninguém lança custo. É a brecha mais perigosa para decisão gerencial. | **Crítica** |
| 6 | **Motores prontos e desligados.** `calculateEarnedValue`, `calculateProductivity` (`planejamento/calculations.js:48,82`), `projectCashflow`, `contractBalances` (`controladoria/calculations.js:5,23`) têm teste e nenhum consumidor. | Planejamento / controladoria | Valor agregado, produtividade, fluxo de caixa projetado e saldo de contrato não existem para o usuário. | Alta |
| 7 | **Contrato do cliente sem aditivo.** "Aditivo" só existe em equipamentos. O portal publica `approvedChanges: 0` fixo (`server/client-portal-publication.js:146`) e `contractCurrent = contractOriginal`. | Comercial → medição → portal | Toda mudança de escopo fica fora do contrato, da receita projetada e do que o cliente vê. | Alta |
| 8 | **Portal com % diferente da medição.** Progresso do portal = média simples das tarefas (`client-portal-publication.js:56`); a medição técnica pondera por custo (`medicoes/calculations.js:32`). Decisões, alterações, mensagens, chamados e equipe não têm publicador → páginas sempre vazias. | Portal | Cliente vê 60% no portal e 35% no boletim de medição. Gera conflito na primeira reunião. | Alta |
| 9 | **Edição rejeitada continua na tela.** `update()` aplica o otimista e não reverte em `FAILED/CONFLICT` (achado #4 da matriz de 16/08); não encontrei evidência de correção. | Transversal | No piloto, com várias pessoas e rede ruim de obra, alguém vai "salvar" algo que o servidor recusou. | Alta |
| 10 | **LGPD aberta com biometria facial em campo.** `AUDITORIA_SISTEMA_ARCD.md` §6.7 segue aberto; o app de ponto coleta face (dado sensível, art. 11). | Ponto / RH | Exige termo de ciência, base legal, retenção e descarte **antes** do primeiro funcionário bater ponto. | **Crítica** (jurídica) |

---

## 2. O roteiro ideal de um ERP de obra — e onde o ARCD está

O ERP de obra completo é uma cadeia única. Cada elo recebe o ID do elo
anterior e devolve um fato ao DRE. A régua de maturidade abaixo usa:
✅ existe e está ligado · 🟡 existe mas a ligação é manual/parcial · ❌ não existe.

```
Lead → Proposta → ORÇAMENTO (EAP + composições) → CONTRATO (+ aditivos)
                        │ baseline
                        ▼
              PLANEJAMENTO (cronograma, curva S, lookahead)
               │ necessidade de material      │ meta de produção
               ▼                              ▼
   SUPRIMENTOS → COMPRA → RECEBIMENTO    EXECUÇÃO (RDO, ponto, terceiros)
               → ESTOQUE → APLICAÇÃO            │
                        │                       ▼
                        │              MEDIÇÃO TÉCNICA → MEDIÇÃO AO CLIENTE
                        ▼                       ▼
               CUSTO REALIZADO (por obra, etapa, item) ← → RECEITA
                        └──────────► DRE / CAIXA / CONTROLADORIA
                                         │
                                         ▼
                          RELATÓRIOS LEIGOS + PORTAL DO CLIENTE
```

### 2.1 Comercial → Orçamento → Contrato

| Elo | Ideal | ARCD hoje |
|---|---|---|
| Funil e proposta | Lead vira proposta a partir do orçamento | ✅ `domains/comercial` (funil, jornada, indicação) |
| Orçamento | EAP, SINAPI/ORSE, composições próprias, BDI, ABC, memória de cálculo | ✅ forte — memória estrutural/hidro/caixas, versões, baseline (`orcamentos/calculations.js:100-144`) |
| Contrato | Valor, cronograma de desembolso, regime (empreitada/administração), **aditivos de valor e prazo** | 🟡 `contractType`, `contractValue`, `adminPercentage` na obra; ❌ aditivos (brecha 7) |
| Orçamento → contrato | Contrato nasce do orçamento aprovado; aditivo nasce de revisão do orçamento | 🟡 baseline existe, mas o valor do contrato é digitado na obra |

**Melhoria de fluxo:** criar `aditivosContrato[]` na obra (valor, prazo,
justificativa, revisão de orçamento de origem, aprovação do cliente). Receita
projetada, saldo a medir e portal passam a usar `contratoVigente = original +
aditivos aprovados`. O motor `contractBalances` já existe para isso.

### 2.2 Orçamento → Planejamento → Suprimentos

| Elo | Ideal | ARCD hoje |
|---|---|---|
| Cronograma da baseline | Tarefas ligadas a etapas/itens do orçamento, custo previsto por tarefa | ✅ `tarefas[].etapaId`, baseline do plano |
| CPM, curva S, LOB, PPC | — | ✅ CPM, LOB e PPC em uso |
| Valor agregado (EVM) | PV/EV/AC vindos de cronograma, medição técnica e razão | 🟡 calcula, mas AC = digitado ou inventado (brecha 5) |
| Necessidade de material | Cronograma × quantitativo → data de necessidade → solicitação sugerida | 🟡 só curva A (`MarcosCurvaASuprimentos` → `createSupplyPlan`); lookahead não gera solicitação |
| Produtividade | Hh orçado × Hh apropriado do ponto | ❌ `calculateProductivity` sem consumidor; apropriação do ponto não chega à tarefa |

**Melhoria de fluxo:** o custo realizado precisa de **endereço**. Hoje o
razão sabe a obra; raramente sabe a etapa. Três fontes já carregam (ou podem
carregar) o endereço:
- compras: `orcItemId` já existe na solicitação → propagar ao pedido e à NF;
- ponto: a apropriação REP-P já diz obra por intervalo → acrescentar tarefa/etapa opcional;
- terceiros: medição de terceiro por serviço → etapa.

Com isso o AC do EVM sai do razão e o fallback `previsto × progresso` deve
**sumir** — melhor mostrar "sem custo apropriado" do que CPI = 1 falso.

### 2.3 Solicitação → Compra → Recebimento → Estoque → Aplicação

O núcleo foi corrigido em 27/10 (C1–C10, D-A..D-G). O que segue aberto
(ver `memory/project_compras-pathfinder` e `docs/COMPRAS_ROADMAP.md`):

| Elo | ARCD hoje | Falta |
|---|---|---|
| Solicitação → cotação → pedido → NF | ✅ cadeia com mesmo ID e obra (`server/procurement-chain-policy.js`) | `validateProcurementChain` no caminho de comando; `solicitacaoItemId` por item |
| Aprovação por alçada | ✅ C10 | — |
| Chegada na obra | ✅ C8 "Chegou" | Conferência com foto + assinatura do almoxarife pelo celular, offline |
| Estoque por obra | ✅ entradas, consumo, perda, devolução, transferência | — |
| **Aplicação** (consumo → onde foi usado) | ❌ consumo não tem tarefa/etapa | Sem isso não existe "consumo real × orçado" nem índice de perda por serviço |
| Pagamento ao fornecedor | ✅ título → baixa → conciliação | — |

**Melhoria de fluxo:** no consumo de estoque, pedir a tarefa do cronograma
(lista curta: só as tarefas em andamento na semana). Com isso nasce o
relatório mais pedido por dono de obra: *"comprei 120 sacos de cimento para
o reboco, o orçamento previa 95 — onde foram os 25?"*.

### 2.4 Batida de ponto → Tratamento → Folha → Pagamento → DRE

Este é o fluxo com mais elos soltos. O caminho ideal:

```
Batida (app REP-P, NSR, foto, hora fiscal)
  → Espelho do dia (marcações → jornada, atraso, HE, falta)
  → Tratamento (abono, atestado, férias, folga, correção com motivo)
  → Apropriação por obra/tarefa (já existe no servidor)
  → Fechamento da quinzena (trava + aprovação do encarregado/RH)
  → Folha (bruto, HE, VT/VR, vales, sindicato, encargos)
  → TÍTULO A PAGAR por funcionário, rateado por obra
  → Pagamento (PIX/lote) → conciliação do extrato → baixa do título
  → Custo de competência no DRE (já é reconhecido pelo ponto)
```

| Elo | ARCD hoje |
|---|---|
| Batida fiscal | ✅ ARP, NSR, hora confiável, offline, foto (Fase 0–1 integrada; homologação física **não iniciada**) |
| Espelho / tratamento | ❌ Fase 02 não iniciada; legado só tem P/M/F e horários digitados |
| Apropriação por obra | ✅ servidor (`ponto-apropriacao-*`), 🟡 não chega à folha |
| Férias, atestado, afastamento | ❌ (brecha 4) |
| Trava de período | 🟡 `attendanceLocks` + `unlockRequests` existem no legado |
| Folha (cálculo) | ✅ diária, HE, VT/VR, vales rateados por obra, sindicato, responsável pelo pagamento (obra por administração × construtora) |
| Encargos e provisões | ❌ (brecha 3) |
| **Título a pagar da folha** | ❌ (brecha 1) — o ledger já sabe processar `titulosFolha` com rateio (`financeiro/ledger.js:454-515`), só falta quem os crie |
| Pagamento e conciliação | ✅ conciliação cria pagamento; ⚠ gera alerta "sem título vinculado" (`ledger.js:511`) |
| Recibo / holerite ao funcionário | 🟡 PDF geral da folha; ❌ recibo individual assinável |
| Custo no DRE | ✅ por competência, via `labor-cost-engine.js` |

**Melhoria de fluxo — a menor ponte que destrava o piloto:**
1. Botão **"Fechar quinzena"** na Folha: trava o período, grava um
   `titulosFolha[]` por funcionário com `rateio[]` por obra (os números já
   estão em `allocateAdvancesByWork`/`splitPayrollResponsibility`) e
   vencimento. O ledger e a conciliação já consomem esse formato.
2. Ponte **REP-P → attendance** só de leitura: para cada funcionário/dia,
   propor P/M/F + horários a partir das marcações; o RH confirma. Não
   substitui a Fase 02 — evita redigitação durante o piloto.
3. Status de dia **"FE" (férias), "AT" (atestado), "FG" (folga)** com fator
   de pagamento próprio — é o item 1 do `BLUEPRINT_FERIAS.md`.

### 2.5 Execução → Medição técnica → Medição ao cliente → Recebimento

| Elo | ARCD hoje |
|---|---|
| RDO com serviços e % | ✅ `DiarioObraView`, progresso por tarefa |
| Medição técnica (boletim aprovado) → progresso da tarefa | ✅ `projectTechnicalMeasurementProgress` |
| Medição ao cliente (faturamento) | ✅ `medicoes` com competência, vencimento, recebimento |
| Medição técnica → valor da medição ao cliente | 🟡 são registros separados; em empreitada o valor a faturar deveria sair do avanço ponderado × contrato vigente |
| Medição de terceiros → pagamento → DRE | ✅ |

**Melhoria de fluxo:** na criação da medição ao cliente, sugerir o valor a
partir do último boletim técnico aprovado (`avancoFisico × contratoVigente −
já medido`). Uma fonte de "% executado" para tudo: DRE, portal e boletim.

### 2.6 DRE, caixa e controladoria

| Elo | ARCD hoje |
|---|---|
| Razão único (eventos com competência e caixa) | ✅ `financeiro/ledger.js`; ⚠ em **modo sombra** (`FINANCIAL_ENGINE_ENFORCE`, `api/data.js:137`) |
| DRE por obra, consolidado, histórico, quinzenal | ✅ |
| Receita por tipo de contrato (empreitada, admin, misto) | ✅ `calculateContractProjection` |
| Contas a pagar/receber, comprometido | ✅ |
| Fluxo de caixa **projetado** (títulos + folha futura + medições previstas) | ❌ `projectCashflow` sem consumidor; folha não entra (brecha 1) |
| Fechamento mensal com trava e evidência | 🟡 `fechamentosFinanceiros` e fechamento bancário existem; falta rito (checklist → trava → relatório) |
| Orçado × realizado por etapa | ❌ (brecha 5) |

### 2.7 Relatórios para leigos

O ARCD tem muito número correto e pouca **resposta**. Para o dono, o
engenheiro e o cliente, cada relatório precisa responder uma pergunta em
uma frase, com semáforo, antes de qualquer tabela:

| Pergunta | Relatório | Fonte que já existe | Falta |
|---|---|---|---|
| "A obra está no prazo?" | Ficha da obra — prazo | CPM, baseline, medição técnica | frase + semáforo; dias de atraso no caminho crítico |
| "Está no custo?" | Ficha da obra — custo | ledger | orçado × realizado por etapa (brecha 5) |
| "Vou ter dinheiro mês que vem?" | Caixa das próximas 8 semanas | `projectCashflow` | ligar o motor + títulos de folha |
| "Quanto falta receber do cliente?" | Saldo de contrato | `contractBalances` | ligar o motor + aditivos |
| "Quem trabalhou onde e quanto custou?" | Mão de obra por obra | folha + apropriação | encargos |
| "Onde perdi material?" | Consumo × orçado | estoque | aplicação por tarefa |

Proposta concreta: **uma página "Ficha da Obra"** (A4, imprimível, também
no celular) com 4 semáforos — Prazo, Custo, Caixa, Qualidade/Segurança —
cada um com uma frase ("3 dias atrasada no caminho crítico: estrutura do 1º
pavimento") e só depois os números. O `executive-summary.js` e o
`daily-brief.js` já são o embrião disso.

### 2.8 Portal do cliente

| Elo | ARCD hoje |
|---|---|
| Login, isolamento por obra, projeção segura | ✅ (forte — sem custo interno, sem dado bancário) |
| Progresso, cronograma, fotos, RDO como "atualização" | ✅ publicados; ⚠ % por média simples (brecha 8) |
| Financeiro (contrato, medições, pagamentos, caixa da obra) | ✅ opcional por obra; ⚠ sem aditivos |
| Compras visíveis ao cliente (obra por administração) | ✅ C4 |
| Decisões do cliente (escolha de acabamento, aprovação de aditivo) | ❌ página existe, nada publica, cliente não consegue aprovar |
| Mensagens, chamados de assistência técnica, equipe | ❌ sem publicador |
| Resumo semanal em linguagem de cliente | 🟡 usa o texto técnico do RDO |

**Melhoria de fluxo:** no portal, o cliente precisa **agir**, não só ver.
Prioridade: (1) aprovar/recusar decisão e aditivo com registro de data/hora
e usuário — isso fecha a brecha 7 pelo lado do cliente; (2) % igual ao do
boletim técnico; (3) resumo semanal editável pelo engenheiro antes de
publicar (o RDO vira rascunho, não texto final).

---

## 3. Brechas transversais

1. **Motor financeiro em sombra.** Correto mantê-lo assim até paridade
   zero, mas o piloto é exatamente a janela para medir a paridade com dados
   reais. Defina antes: quais obras, quantos dias, qual tolerância.
2. **`update()` sem rollback** (brecha 9). Em campo, rede intermitente torna
   isso frequente. Mínimo aceitável para o piloto: aviso persistente "não
   salvo" na linha rejeitada, mesmo sem rollback automático.
3. **Funcionário ≠ usuário** (`AUDITORIA_SISTEMA_ARCD.md` §5.2) e **cliente
   sem cadastro único** (§5.1, parcial). O portal e o ponto dependem de
   identidade única.
4. **LGPD** (brecha 10): termo de consentimento da biometria, política de
   retenção das fotos do ponto, canal do titular, base legal por dado.
5. **Primeiro administrador e links de arquivo** (§6.3 e §6.5) ainda abertos.

---

## 4. Plano do piloto

### Antes do piloto (bloqueadores)
- [ ] LGPD mínimo: termo de biometria assinado, retenção definida (brecha 10).
- [ ] Ponte REP-P → attendance com confirmação do RH (brecha 2) **ou**
      decisão explícita de rodar o app em paralelo ao ponto manual, com
      conferência semanal.
- [ ] Status de férias/atestado/folga no ponto (brecha 4).
- [ ] "Fechar quinzena" gerando título a pagar da folha (brecha 1).
- [ ] Decisão sobre encargos (ver §5) e, se houver CLT, custo de encargos no DRE.
- [ ] Aviso visível de salvamento rejeitado (brecha 9).
- [ ] Homologação física do APK (18 cenários de `HOMOLOGACAO-PILOTO.md`).

### Durante o piloto (1 obra, 4 quinzenas)
- Quinzena 1: ponto do app + folha + pagamento + conciliação, ponta a ponta.
- Quinzena 2: uma compra completa por semana, com chegada na obra registrada no celular.
- Quinzena 3: medição técnica → medição ao cliente → recebimento → portal.
- Quinzena 4: fechamento do mês — DRE da obra conferido contra extrato e
  planilha paralela; paridade do motor financeiro registrada.

### Critério de saída
DRE da obra piloto bate com a planilha paralela dentro da tolerância
definida; nenhuma redigitação entre app de ponto e folha; cliente acessou o
portal e o % visto por ele é igual ao do boletim.

### Depois do piloto (ordem sugerida)
1. Endereço de custo (etapa/tarefa) em compras, ponto e terceiros → EVM real (brechas 5 e 6).
2. Aditivos de contrato + aprovação pelo portal (brechas 7 e 8).
3. Fluxo de caixa projetado e saldo de contrato ligados (brecha 6).
4. Ficha da Obra para leigos (§2.7).
5. Aplicação de material por tarefa → consumo × orçado.
6. Fase 02 do ponto (espelho, AFD, comprovante) e depois Fase 03.

---

## 5. Decisões que são do dono do negócio

1. **Regime dos funcionários.** Todos diaristas/autônomos, todos CLT, ou
   misto? Define se o DRE precisa de encargos e provisões, e se o ARCD
   precisa gerar algo para a contabilidade/eSocial ou só exportar.
2. **Quem fecha a quinzena** e se o fechamento exige aprovação do encarregado da obra antes do RH.
3. **Planilha paralela no piloto:** sim/não, e por quantas quinzenas.
4. **Tolerância de paridade** para ligar o motor financeiro (`FINANCIAL_ENGINE_ENFORCE`).
5. **O que o cliente pode aprovar pelo portal** (decisões de acabamento? aditivos? medições?) e se isso tem validade contratual ou é só registro.
6. **Fallback do físico-financeiro:** remover a estimativa `previsto × progresso` (recomendado) ou mantê-la rotulada como "estimado".
