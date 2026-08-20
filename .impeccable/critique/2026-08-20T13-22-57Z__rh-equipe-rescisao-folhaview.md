---
target: "RH: Equipe, Rescisao, FolhaView"
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-20T13-22-57Z
slug: rh-equipe-rescisao-folhaview
---

## Adendo de correção (20/08/2026, mesmo dia)

**Nota revisada: 29/40 (72,5%)**, de 23/40. Correções aplicadas em 4
commits pequenos e verificados (`f8c89cb`, `f7a659f`, `11bd6ae`,
`3ea9dd1`), cada um passando pela suíte completa (`vitest`, `build`,
`architecture:check`, `typecheck`) e, no commit que tocou o `Modal`
compartilhado, também pelo smoke e2e completo de todos os módulos
autorizados (`e2e/modules-smoke.spec.js`), não só RH.

### Corrigido

- **[P1] Vocabulário de motivo de desligamento** (Consistency and
  Standards, Error Prevention, Recognition Rather Than Recall):
  `confirmDismissal` agora grava `terminationType` já mapeado para o
  vocabulário de `RESCISSION_TYPES` (`DISMISSAL_TO_RESCISSION_TYPE`);
  `Rescisao.selectEmp()` pré-seleciona `form.tipo` a partir disso, com
  nota visível e não-bloqueante ("Herdado do desligamento registrado em
  Equipe - revise se necessário"). "Corrigir agendamento" ganhou o mapa
  inverso para não quebrar ao reabrir o formulário de Equipe. Sem
  migração retroativa - só desligamentos registrados a partir de agora
  carregam o campo.
- **[P2] Botão "Gerar PDF" com estilo `danger`**: trocado para `ghost`
  (as duas ocorrências - botão principal e o "PDF" do histórico).
- **[P2] `window.prompt()` em `removeAdv`/`cancelarRescisao`**: as duas
  trocadas pelo padrão `Modal`+`Inp` já usado no resto do app (mesma
  estrutura do modal de arquivamento de funcionário), motivo obrigatório,
  gate function abre modal / execute function faz o trabalho.
- **[P2] Modal de funcionário (16 campos)**: agrupado em 4 seções
  (Identificação, Lotação, Remuneração, PIX) com `TYPO.eyebrow` como
  título de seção - mesmos campos, mesma validação, só reorganização
  visual.
- **[P2] Filtros de status duplicados**: removido o dropdown `Sel`,
  mantida a barra de pills (mais consistente com o resto da tela), com
  "Todas as situações" adicionada à barra para não perder a opção.
- **[P3] Gradiente banido no card de resultado da Rescisão**: trocado
  por fundo sólido `${C.yellow}12` + borda `${C.yellow}44` (mesmo padrão
  do card "Acordo interno" na mesma tela); mini-cards internos trocaram
  o overlay `rgba(0,0,0,.15)` (pensado para o gradiente escuro) por
  `C.surface`/`C.border`.
- **[P3] Cor do logo no PDF de rescisão**: `#f6d833` -> `#D4AF37`
  (dourado canônico, igual ao já usado no PDF da FolhaView).
- **[P3] Hex hardcoded em `src/index.css:7560-7563`**: trocado pelos
  tokens `--arcd-color-success/warning/text-muted/danger`, com o hex
  original mantido como fallback do `var()`.
- **[P3, opcional] Sombra decorativa do `Modal` compartilhado**:
  removida (`boxShadow: 0 20px 60px rgba(18,18,18,.16)`), a borda de
  1px já presente cumpre sozinha a regra de DESIGN.md ("Bordas de 1px e
  mudança de superfície; sem sombras decorativas"). Como afeta todo
  modal do app, foi verificada com o smoke e2e completo, não só o de RH.

### Não corrigido (fora do escopo desta rodada, por decisão explícita)

- Adoção de `SummaryCard`/`PageHeader` nas 3 telas - reescrita de
  componente maior, não um polish pontual.
- As 5 bordas decorativas "side-tab" apontadas pelo scan determinístico
  (`LegacyApp.jsx`, ex. cards de Equipe/Rescisão) e o Arial nos
  templates de impressão/PDF (`FolhaView.jsx:479`, PDF de rescisão) -
  achados do detector que não estavam na lista de correções desta
  sessão; continuam abertos.
- `team-row__initials` com dourado decorativo - achado leve, risco
  desproporcional para mexer em CSS de avatar compartilhado agora.
- Toggle "Acordo interno" descartando seleções sem aviso - comportamento
  de formulário mais delicado, deixado para uma sessão dedicada a
  entender todo o fluxo.
- Achado de ferramenta sobre `DESIGN.md` sem frontmatter YAML -
  infraestrutura da skill `impeccable`, fora deste projeto.

### Por que 29 e não mais

A pontuação por heurística abaixo é uma revisão honesta, não uma
reinterpretação favorável: heurísticas onde a correção foi completa e
direta (Consistency/Standards, com a unificação de vocabulário e o
botão `danger`) subiram mais; heurísticas onde só parte do problema
original foi endereçada (Aesthetic/Minimalist, onde o gradiente e o
modal de 16 campos foram corrigidos mas o side-tab antipattern e a
ausência de `SummaryCard` continuam) subiram menos. Nenhum heurística
foi levada ao 4/4 nesta rodada.

| # | Heurística | Antes | Depois | Por quê |
|---|---|---|---|---|
| 3 | User Control and Freedom | 2 | 3 | Os 2 `window.prompt()` do módulo RH viraram Modal+Inp; outros `window.prompt`/`confirm` no resto do app (fora do escopo) continuam. |
| 4 | Consistency and Standards | 1 | 3 | Vocabulário unificado e herdado entre as telas; botão "Gerar PDF" não usa mais `danger`. Não é 4 porque o `danger` ainda aparece em outros botões de ação não-destrutiva fora do escopo revisado. |
| 5 | Error Prevention | 2 | 3 | A herança do motivo de desligamento com nota visível reduz o risco de mis-seleção manual: não é bloqueio/validação cruzada dura (decisão consciente, ver nota do achado P1 - o usuário pode sobrescrever), por isso não chega a 4. |
| 6 | Recognition Rather Than Recall | 2 | 3 | Motivo de desligamento não precisa mais ser lembrado e redigitado; filtro de status duplicado removido. |
| 8 | Aesthetic and Minimalist Design | 2 | 3 | Modal de 16 campos agrupado, gradiente banido removido, sombra decorativa do Modal removida. Não chega a 4: as 5 bordas "side-tab" e a ausência de `SummaryCard`/`PageHeader` (fora do escopo desta rodada) continuam. |

Demais heurísticas (1, 2, 7, 9, 10) sem mudança de nota - não foram
objeto de correção nesta rodada.

Method: dual-agent (A: isolated design-review sub-agent · B: isolated detector+browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No major gaps found in the 3 screens |
| 2 | Match System / Real World | 3 | No major gaps found |
| 3 | User Control and Freedom | 2 | Cancellation of advances/rescissions goes through native `window.prompt()` (LegacyApp.jsx:7347, :10539), which breaks the app's own Modal+Inp pattern and offers no visible cancel affordance beyond the browser's own dialog chrome |
| 4 | Consistency and Standards | 1 | Termination-reason vocabulary is asked twice with two incompatible enums (Equipe: `demissao_sem_justa_causa/pedido_demissao/demissao_justa_causa/termino_contrato/outro`; Rescisão: `sem_justa_causa/justa_causa/pedido_demissao/acordo_mutuo/termino_contrato/acordo_interno`) and never transfers between screens (`selectEmp()` in Rescisão never reads `employee.terminationType`); "Gerar PDF" uses the `danger` button variant, which DESIGN.md reserves for destructive actions |
| 5 | Error Prevention | 2 | The vocabulary mismatch above means RH re-selects (and can mis-select) the dismissal type a second time by hand, with no cross-check against what was recorded at dismissal time |
| 6 | Recognition Rather Than Recall | 2 | Same termination reason must be recalled and re-entered manually in a second screen; Equipe has two redundant, slightly-mismatched status filters (pill bar + `Sel` dropdown) doing the same job |
| 7 | Flexibility and Efficiency of Use | 2 | No specific accelerators found; not a focus of either assessment |
| 8 | Aesthetic and Minimalist Design | 2 | Employee modal in Equipe has 16 fields in one flat grid with no grouping; 5 "side-tab" decorative left/top borders (LegacyApp.jsx:7801, 7864, 10398, 10755, 10877) — the most recognizable AI-generated-UI tell per the detector; banned gradient on the rescission result card (LegacyApp.jsx:10833, explicitly prohibited by DESIGN.md); `SummaryCard`, the documented canonical primitive, is used in none of the 3 screens |
| 9 | Error Recovery | 3 | No major gaps found |
| 10 | Help and Documentation | 3 | No major gaps found |
| **Total** | | **23/40** | **Acceptable (57.5%)** |

Individual per-heuristic scores above are this session's reconciliation of the two isolated sub-agents' findings against the 23/40 total the design-review sub-agent reported; the sub-agent's own message to the orchestrator carried the total and the priority-issue list rather than a verbatim 10-row table, so treat the specific 0-4 splits as a faithful reconstruction, not a verbatim quote.

## Design Specificity Verdict

**LLM assessment**: The RH module functions correctly but reads as a fairly generic admin-CRUD surface bolted onto ARCD's documented Carbon-inspired system rather than a deliberate application of it: the canonical `SummaryCard`/`PageHeader` primitives are absent from all three screens, and termination — the single highest-stakes, most emotionally loaded action in the whole module — gets no distinct visual or interaction treatment; it's styled with the same weight as editing a phone number.

**Deterministic scan**: 8 total findings across the two extracted screens and FolhaView.jsx — 5 "side-tab" (decorative 3-4px colored side border, LegacyApp.jsx:7801/7864/10398/10755/10877), 2 "overused-font" (Arial instead of IBM Plex Sans/Mono inside print/PDF templates, FolhaView.jsx:479 and LegacyApp.jsx:10593), 1 "layout-transition" (animating `height` instead of transform/opacity, LegacyApp.jsx:9071). No false positives flagged.

**Important scan-coverage caveat**: the detector requires a YAML frontmatter block (`---`) at the top of the design-system file to load token/palette/radius rules; this project's `DESIGN.md` is plain Markdown with no frontmatter, so the entire color/typography/radius-vs-token layer of the detector never ran — not just on these 3 screens, but on any file in the project scanned this way. Findings above are therefore mechanical-pattern findings (side-tab, overused-font, layout-transition) only; token-drift findings below (color hex, PDF logo color) came from the design-review sub-agent's manual reading against DESIGN.md, not from the detector.

**Manual token-drift findings (Assessment A, cross-checked against DESIGN.md)**: near-canonical hardcoded hex instead of `var(--arcd-*)` in `src/index.css:7560-7563`; PDF termination document uses `#f6d833` for the ARCD logo instead of the canonical gold `#D4AF37` (LegacyApp.jsx:10595).

**Visual overlays**: unavailable. The browser could not render any of the three screens in this environment — the sub-agent reported this as an environment/infrastructure rendering failure, not a login/auth block. All findings above rest on code reading and the static detector run.

## Overall Impression

The module works and nothing found rises to P0 (no task is blocked). The single biggest opportunity is the split termination-reason vocabulary between Equipe and Rescisão: it is a real data-integrity risk (RH can pick a different reason on the rescission than the one recorded at dismissal, with no cross-check), not just a cosmetic inconsistency.

## What's Working

- No P0/blocking issues in either assessment — RH staff can complete every primary task (register/edit an employee, run an advance, calculate and print a rescission).
- No live browser evidence was collected against any hidden/broken interactive state, so the module's static structure appears sound.

## Priority Issues

**[P1] Termination reason is asked twice with two incompatible vocabularies and never reconciled**
- Why it matters: Equipe's dismissal enum (`demissao_sem_justa_causa/pedido_demissao/demissao_justa_causa/termino_contrato/outro`) and Rescisão's rescission-type enum (`sem_justa_causa/justa_causa/pedido_demissao/acordo_mutuo/termino_contrato/acordo_interno`) don't line up 1:1, and `selectEmp()` in Rescisão never reads `employee.terminationType` to pre-fill or cross-check. RH can legally/financially misclassify a termination (e.g. record "sem justa causa" at dismissal but pick "acordo_mutuo" at rescission) with no warning, which directly affects the rescission math (aviso prévio, multa) already audited in this session.
- Fix: unify the two enums (or map one to the other explicitly) and have Rescisão pre-select from `employee.terminationType`, flagging a mismatch instead of silently allowing one.
- Suggested command: `/impeccable clarify` (data/copy consistency) or `/impeccable harden` (cross-field validation)

**[P2] Destructive-looking styling on a non-destructive action, native prompts instead of the app's own modal pattern**
- Why it matters: "Gerar PDF" using the `danger` button variant trains users to associate red/danger styling with routine, safe actions, diluting the signal when danger styling appears on an actually destructive action elsewhere in the app. `window.prompt()` in `removeAdv` (LegacyApp.jsx:7347) and `cancelarRescisao` (LegacyApp.jsx:10539) bypasses the app's established Modal+Inp component, so cancellation reasons for adiantamentos and rescisões — both legally/financially meaningful text — get no styling, validation, or mobile-friendliness consistent with the rest of the app.
- Fix: restyle "Gerar PDF" to a neutral/primary variant; replace both `window.prompt()` calls with the existing Modal+Inp pattern already used elsewhere for reason capture.
- Suggested command: `/impeccable polish`

**[P2] Employee modal (16 fields, flat grid) and duplicate status filters**
- Why it matters: Equipe's employee create/edit modal presents 16 fields in one ungrouped grid — exceeds the cognitive-load guidance of ≤4 chunked items per group — and the screen carries two redundant status filters (a pill bar and a `Sel` dropdown) with slightly different option sets, which is both extra surface area and a source of confusing behavior if the two ever disagree.
- Fix: group the 16 fields into logical sections (identification, pay, PIX/banking, work schedule); remove one of the two redundant status filters or make them provably the same control.
- Suggested command: `/impeccable layout`

**[P3] Token/pattern drift: side-tab antipattern, banned gradient, print-template font, wrong PDF logo color**
- Why it matters: 5 "side-tab" decorative borders are the most recognizable tell of AI-generated (rather than deliberately authored) UI; the gradient on the rescission result card is explicitly banned by DESIGN.md ("Cards não devem flutuar nem usar gradientes"); Arial in print/PDF templates breaks the IBM Plex Sans/Mono typographic system at the one moment (a termination document) where a worker or auditor is most likely to actually print and keep the artifact; the PDF logo uses `#f6d833` instead of the canonical `#D4AF37` gold — small but visible on a legal/HR document that leaves the app.
- Fix: remove side-tab borders in favor of the documented spacing/hierarchy system; remove the gradient; swap Arial for IBM Plex in the two print templates; correct the logo hex.
- Suggested command: `/impeccable polish`

## Persona Red Flags

**Alex (Power User, repetitive RH data entry)**: Has to re-type the same termination reason from a different, incompatible list when moving from dismissing an employee (Equipe) to calculating their rescission — pure wasted recall/re-entry for someone who does this often, and a real error risk under time pressure. Two overlapping status filters in Equipe force a moment of "which one do I use" on every visit.

**Riley (Stress Tester)**: Deliberately picking a rescission type that doesn't match the employee's recorded dismissal type produces no warning at all — the system silently accepts an internally inconsistent record. Native `window.prompt()` for cancellation reasons is also easy to dismiss/cancel accidentally (Esc, click-away) with no draft recovery, unlike the app's own Modal+Inp fields.

## Minor Observations

- `SummaryCard` and `PageHeader`, DESIGN.md's canonical primitives for exactly this kind of operational screen, appear in none of Equipe, Rescisão, or FolhaView — a documentation/implementation drift independent of the specific bugs above.
- The detector's frontmatter requirement silently disabled all color/typography/radius-vs-token checking project-wide, not just on these 3 screens — worth fixing (add YAML frontmatter to DESIGN.md) so future `/impeccable audit`/`critique` runs actually check token compliance instead of only pattern-antibodies like side-tab/overused-font.

## Questions to Consider

- Should the termination reason be captured exactly once (at dismissal) and simply carried into the rescission calculation, rather than asked twice with two different vocabularies?
- Rescisão is arguably the single highest-stakes screen in the whole app for the employee on the other end of it — should it get a visually distinct, more careful treatment than routine CRUD screens, in line with the "emotional journey" principle for high-stakes moments?
- Is the `danger` button variant being used loosely enough elsewhere in the app that it's already losing its warning meaning?
