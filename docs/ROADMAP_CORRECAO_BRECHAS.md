# Roadmap de correção das brechas — do piloto ao ERP completo

> 27/10/2026. Complementa `docs/ROTEIRO_ERP_OBRA_PILOTO.md` (o diagnóstico);
> este documento é a **ordem de execução**. Os números entre parênteses são as
> brechas do §1 daquele roteiro. Tamanho: **P** ≈ 1 PR pequeno (até 1 dia),
> **M** ≈ 1 PR médio (2–4 dias), **G** ≈ 2+ PRs.
>
> Regra geral de cada PR: mesma barra de sempre (`npm run lint`, testes,
> build, orçamento de bundle). PR que toca razão, DRE, folha ou custo passa
> pelo agente `dre-integration-guardian` antes do merge.

---

## Visão geral

```
Onda 0  Decisões do dono + LGPD jurídico ─────────────┐ (sem código)
                                                      ▼
Onda 1  Bloqueadores do piloto ── 1.1 Fechar quinzena → título a pagar
        (paralelos entre si)      1.2 Férias/atestado/folga no ponto
                                  1.3 "Não salvo" visível + reversão
                                  1.4 LGPD no app de ponto
                                  1.5 Ponte REP-P → grade de presença  (após 1.2)
                                  1.6 Atalhos baratos: tirar CPI falso, % do portal = boletim
                                                      │
Onda 2  Encargos e regime (só se houver CLT) ─────────┤ (depende da decisão D1)
                                                      ▼
        ══ GATE: homologação física do APK + piloto quinzena 1 ══
                                                      │
Onda 3  Verdade do custo: endereço de custo + EVM ────┤ (durante o piloto)
Onda 4  Contrato e cliente: aditivos + portal que age ┤
Onda 5  Caixa projetado + Ficha da Obra para leigos ──┤
Onda 6  Ponto Fase 02/03 (espelho, AFD) ──────────────┘ (roadmap próprio)
```

A lógica da ordem: **primeiro o dinheiro sai certo** (folha → título →
pagamento, Onda 1–2), **depois o custo chega ao lugar certo** (etapa/tarefa,
Onda 3), **depois o cliente vê e aprova a mesma verdade** (Onda 4), e só então
**os relatórios resumem** (Onda 5). Relatório leigo construído sobre custo
inventado é pior do que nenhum relatório.

---

## Onda 0 — Decisões (sem código, destrava tudo)

| Id | Decisão | Destrava | Recomendação |
|---|---|---|---|
| D1 | Regime dos funcionários: só diarista/autônomo, só CLT ou misto | Onda 2 inteira; formato do título de folha | Se houver **um** CLT, tratar como misto |
| D2 | Quem fecha a quinzena; encarregado aprova antes do RH? | 1.1 (fluxo de aprovação) | Encarregado confere → RH fecha |
| D3 | Vencimento da folha (ex.: 5º dia útil, dia fixo após a quinzena) | 1.1 (data do título) | Regra única configurável na empresa |
| D4 | Fator de pagamento de férias, atestado e folga | 1.2 | FE e AT = 1, FG = 0 (ajustar ao seu acordo) |
| D5 | O que o cliente pode aprovar no portal e se tem validade contratual | 4.3 | Decisões de acabamento e aditivos; medição só "ciente" |
| D6 | Fallback do físico-financeiro: remover ou rotular "estimado" | 1.6a | Remover — mostrar "sem custo apropriado" |
| L1 | Termo de consentimento da biometria + prazo de guarda das fotos (texto jurídico) | 1.4 | Prazo = guarda legal do ponto; descarte automático depois |

---

## Onda 1 — Bloqueadores do piloto

Os itens 1.1 a 1.4 e 1.6 não dependem entre si e podem correr em paralelo
(sessões/branches separados, arquivos diferentes). O 1.5 espera o 1.2.

### 1.1 Fechar quinzena → título a pagar da folha (brecha 1) — **M**
- **O que muda:** botão "Fechar quinzena" na Folha. Trava o período
  (`attendanceLocks`, que já existe), gera um `titulosFolha[]` por
  funcionário com `rateio[]` por obra (números de
  `allocateAdvancesByWork`/`splitPayrollResponsibility`), vencimento (D3) e
  responsável pelo pagamento (obra por administração × construtora).
  Reabrir = cancelar os títulos não pagos, com motivo.
  **Implementado (28/10):** em vez de travar o ponto (que vive em linhas por
  obra, com fila própria), o fechamento congela os valores e a Folha acusa
  divergência se o ponto mudar depois; vencimento = data de pagamento do
  calendário da folha (`getPayrollPaymentCalendar`), então D3 já estava
  respondida pelo próprio app.
- **Onde:** comando puro novo em `src/domains/ponto/` (ex.
  `payroll-closing.js`) + botão em `FolhaView.jsx`. Ledger
  (`financeiro/ledger.js:454-515`) e conciliação (`conciliacao/mutations.js:242`)
  **já consomem** esse formato — não mexer neles, só testar.
- **Pronto quando:** fechar → título aparece em contas a pagar → conciliar
  extrato baixa o título **sem** o alerta "pagamento de folha sem título
  vinculado"; fechar duas vezes não duplica (idempotente por
  funcionário+período); paridade cliente × servidor no `financial-shadow`.
- **Sua contribuição (regra de negócio):** a regra de vencimento (D3) e o que
  acontece com vale lançado depois do fechamento.

### 1.2 Férias, atestado e folga no ponto (brecha 4) — **P/M**
- **O que muda:** novos status de dia `FE`, `AT`, `FG` (item 1 de
  `BLUEPRINT_FERIAS.md`), com fator próprio em `attendanceFactor`
  (`ponto/payroll.js`) e cor/legenda na grade. Não contam como falta, não
  geram VT/VR (a confirmar em D4).
- **Pronto quando:** funcionário com 5 dias `FE` recebe as diárias na Folha e
  no custo da obra; nenhum consumidor quebra com status desconhecido (grep em
  todos os `status === "F"`/`"P"` antes — memória
  *legacyapp-extraction-consumer-check*).
- **Sua contribuição:** a tabela de fatores (D4).

### 1.3 Salvamento recusado visível e revertido (brecha 9) — **M**
- **Situação real:** já existe aviso global "alterações não sincronizadas"
  (`LegacyApp.jsx:3798`), mas o registro recusado continua na tela como se
  estivesse salvo.
- **O que muda:** em `FAILED/CONFLICT`, reverter o otimista **da entidade
  recusada** para o último estado confirmado e marcar a linha ("não salvo —
  tentar de novo"). Não reverter o lote inteiro.
- **Pronto quando:** teste de integração simula recusa do servidor e a tela
  volta ao valor anterior com o aviso na linha; o fluxo do ponto
  (`LegacyApp.jsx:17641-17691`, fila própria) continua igual.

### 1.4 LGPD no app de ponto (brecha 10) — **M** (depende de L1)
- **O que muda:** aceite do termo na primeira abertura do app por
  funcionário (registro com data/hora/versão do termo, guardado no
  servidor); sem aceite, o app não captura foto. Rotina de descarte das fotos
  vencidas (`server/ponto-eletronico/fotos-caminho.js`). Canal do titular
  (e-mail/fluxo) documentado.
- **Pronto quando:** sem aceite não há foto; foto além do prazo é apagada pela
  rotina e o NSR/batida permanece (a batida fiscal não pode sumir).
- Lembrete do roadmap do ponto: migration nova exige regenerar
  `impressoes.json`; o gate de deploy no prebuild trava o ERP inteiro.

### 1.5 Ponte REP-P → grade de presença (brecha 2) — **M** (após 1.2)
- **O que muda:** "Importar do app de ponto" na grade: para cada
  funcionário/dia, propõe P/M/F + horários + obra a partir das marcações e da
  apropriação do servidor (`proporApropriacoes`). O RH confirma em lote; nada
  é gravado sem confirmação. Divergência com o que já estava digitado aparece
  destacada.
- **Não é** a Fase 02 do ponto (espelho/tratamento) — é a ponte provisória
  que evita redigitar durante o piloto.
- **Cuidado conhecido:** attendance é particionado por obra; mover registro de
  obra exige tombstone na origem (memória
  *ponto-attendance-obra-sharding-gotcha*).
- **Pronto quando:** uma quinzena de marcações reais vira grade sem digitação,
  e a Folha resultante bate com a conferência manual.

### 1.6 Atalhos baratos (brechas 5 e 8, parte) — **P** cada
- **1.6a Tirar o CPI falso:** remover o fallback `previsto × progresso`
  (`planejamento/legacy-engine.js:590`) conforme D6 — sem custo apropriado, a
  tela diz isso em vez de mostrar CPI = 1.
- **1.6b % do portal = % do boletim:** `client-portal-publication.js:56` passa
  a usar o avanço ponderado da medição técnica
  (`projectTechnicalMeasurementProgress`), com a média simples só como
  reserva quando não houver boletim aprovado.

---

## Onda 2 — Encargos no custo do DRE (brecha 3) — **M**, só depois de D1

> **Correção de 28/10:** o regime **já existe**. O funcionário tem modalidade
> diária × CLT com histórico de vigência (`rh/remuneration-mode.js`), a Folha
> tem as abas Holerites CLT, Provisões trabalhistas e Simulação CLT × diária
> (`ponto/clt-*.js`, `ponto/labor-provisions.js`). O que falta é menor: as
> provisões e os encargos patronais são calculados na tela, mas **não chegam ao
> custo de mão de obra do DRE** (`financeiro/labor-cost-engine.js` não os lê).

- Levar ao custo de competência do DRE as provisões (`calculateLaborProvision`)
  e os encargos patronais dos funcionários CLT, por obra.
- Alíquotas editáveis na empresa — não chumbar no código.
- `labor-cost-engine.js` soma encargos ao custo de competência; o título de
  folha (1.1) continua sendo só o **líquido a pagar ao funcionário** — guias
  (FGTS/INSS) viram títulos separados, gerados no fechamento do mês.
- **Pronto quando:** DRE de uma obra com 1 CLT mostra mão de obra = salário +
  encargos + provisões; diarista não muda; `dre-integration-guardian` aprova.
- **Sua contribuição:** as alíquotas e a forma de provisão que sua
  contabilidade usa.

---

## ══ Gate do piloto ══

- [ ] Onda 1 completa (1.1–1.6) em `main` e em produção.
- [ ] Onda 2 completa **ou** D1 = "nenhum CLT".
- [ ] Homologação física do APK (18 cenários de `HOMOLOGACAO-PILOTO.md`).
- [ ] Termo LGPD assinado pelos funcionários da obra piloto.
- [ ] Decisão D2 comunicada ao encarregado e ao RH.

Depois disso, o plano de 4 quinzenas do §4 do roteiro vale como está.

---

## Onda 3 — Verdade do custo (brechas 5 e 6) — **G**, durante o piloto

Objetivo: todo custo do razão sabe **obra + etapa** (e, quando der, tarefa).

| Passo | Fonte do custo | O que muda | Tamanho |
|---|---|---|---|
| 3.1 | Compras | Propagar `orcItemId`/etapa da solicitação para pedido e NF (`solicitacaoItemId` por item, pendência do pathfinder) | M |
| 3.2 | Estoque | Consumo pede a tarefa (só as em andamento na semana) → "consumo × orçado" por serviço | M |
| 3.3 | Ponto | Apropriação com tarefa/etapa opcional; folha leva a etapa ao rateio do título | M |
| 3.4 | Terceiros | Medição de terceiro por serviço → etapa | P |
| 3.5 | Planejamento | Ligar `calculateEarnedValue` (AC vindo do razão por etapa) e `calculateProductivity` (Hh apropriado × orçado) em tela | M |

**Pronto quando:** na obra piloto, orçado × realizado por etapa fecha com o
total do DRE da obra (a diferença é só custo "sem etapa", exibido como tal).

---

## Onda 4 — Contrato e cliente (brechas 7 e 8) — **G**

| Passo | O que muda | Depende | Tamanho |
|---|---|---|---|
| 4.1 | `aditivosContrato[]` na obra (valor, prazo, justificativa, revisão de orçamento de origem, status). `contratoVigente = original + aprovados`; ligar `contractBalances` | — | M |
| 4.2 | Portal publica aditivos (`approvedChanges` deixa de ser 0) e contrato vigente | 4.1 | P |
| 4.3 | Cliente aprova/recusa decisão e aditivo pelo portal, com usuário + data/hora | 4.1, D5 | M |
| 4.4 | Medição ao cliente sugere valor do boletim técnico (`avanço × contratoVigente − já medido`) | 4.1, 1.6b | P |
| 4.5 | Resumo semanal: RDO vira rascunho, engenheiro edita e publica; mensagens/chamados ganham publicador | — | M |

---

## Onda 5 — Caixa e relatórios para leigos — **M/G**

- 5.1 Ligar `projectCashflow`: títulos a pagar (incluindo folha da 1.1 e guias
  da Onda 2) + medições previstas → caixa das próximas 8 semanas.
- 5.2 **Ficha da Obra**: 4 semáforos (Prazo, Custo, Caixa, Qualidade), cada um
  com uma frase antes dos números; base em `executive-summary.js` e
  `daily-brief.js`. Imprimível em A4 e legível no celular.
- 5.3 Mesma ficha, versão cliente, no portal (sem custo interno).

---

## Onda 6 — Ponto Fase 02 e 03

Segue `docs/PONTO-OBRA-ROADMAP.md`: espelho de ponto, tratamento com motivo,
AFD/comprovante (Fase 02) e, por fim, a folha lendo direto do REP-P (Fase 03),
quando a ponte 1.5 vira desnecessária e é removida.

---

## Transversais (encaixar quando a onda tocar no assunto)

- **Motor financeiro em sombra:** medir paridade durante o piloto; ligar
  `FINANCIAL_ENGINE_ENFORCE` só com a tolerância definida.
- **Funcionário ≠ usuário** e **cliente sem cadastro único**
  (`AUDITORIA_SISTEMA_ARCD.md` §5): resolver junto com 1.4 (ponto) e 4.3
  (portal), que dependem de identidade.
- **Primeiro administrador e links de arquivo** (§6.3, §6.5): fora do
  caminho crítico do piloto, mas antes de abrir para mais obras.

---

## Acompanhamento

| Item | Status | PR |
|---|---|---|
| Onda 0 — D1…D6, L1 | ⬜ aguardando dono | — |
| 1.1 Fechar quinzena | ✅ em produção | #164 |
| 1.2 FE/AT/FG | ✅ em produção | #166 |
| 1.3 Não salvo visível | ✅ em produção | #167 |
| 1.4 LGPD ponto | ⬜ aguardando termo e prazo (L1) | — |
| 1.5 Ponte REP-P | ✅ em produção | #169 |
| 1.6a CPI falso | ✅ em produção | #165 |
| 1.6b % portal | ✅ em produção | #165 |
| Onda 2 Encargos | 🟨 em revisão | `feat/dre-encargos-clt` |
| Gate do piloto | ⬜ | — |
| Ondas 3–6 | ⬜ | — |
