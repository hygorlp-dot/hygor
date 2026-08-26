---
target: OrcamentoView.jsx (modulo de Orcamento)
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-26T19-43-28Z
slug: rc-domains-orcamentos-components-orcamentoview-jsx
---
Method: dual-agent (A: af1f81da88a7093b0 - B: ad37bc7faedb58d51)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Good async status text, but several controls render with zero visible affordance at all |
| 2 | Match Between System and Real World | 4/4 | Deep, accurate SINAPI/ORSE/BDI/TCU domain vocabulary throughout |
| 3 | User Control and Freedom | 2/4 | Clear cancel/back paths, but budget deletion is irreversible behind a bare confirm() |
| 4 | Consistency and Standards | 1/4 | Zero use of the app's own PageHero/SummaryCard/--arcd-type-* tokens; Inter used instead of required IBM Plex |
| 5 | Error Prevention | 3/4 | Real, incident-informed safeguards undercut by unprotected deletes |
| 6 | Recognition Rather Than Recall | 2/4 | Good inline search, but several row actions have no visible icon at all |
| 7 | Flexibility and Efficiency of Use | 3/4 | Mobile column toggle, inline editing, dual reorder, multiple export formats |
| 8 | Aesthetic and Minimalist Design | 2/4 | Five stacked panels before the spreadsheet appears; 8-9px text is pervasive |
| 9 | Error Recovery | 3/4 | Excellent where present, but several controls fail with no error state - nothing renders |
| 10 | Help and Documentation | 1/4 | No contextual help for one of the densest screens in the app |
| **Total** | | **23/40** | **Acceptable (57%)** |

## Design Specificity Verdict

Genuinely grounded in construction budgeting (SINAPI/ORSE, BDI vs TCU bands, curva ABC, dimensional audit). Detector: 11 findings/3 rules/exit 0 - 9 side-tab hits read as one deliberate systemic color convention; 1 overused-font hit is a false positive (Arial in a print export template, not the live screen); 1 layout-transition hit is real but low-impact. Live browser evidence independently confirmed the same blank-control defect found in source.

## Priority Issues

[P0] Six interactive controls render completely blank on every budget line-item row - confirmed both in source (lines 3093, 3097, 3125, 3129, 2666, 2477, 4000/4014) and live in production. Traces to the "extraido verbatim de LegacyApp.jsx" migration. Fix: restore the Ic icon/label at each of the 6 spots.

[P1] Touch targets hard-coded at 24px vs the app's own 44px mobile minimum, on a screen meant for on-site phone use.

[P1] The highest-stakes screen in the app is furthest from its own design system (zero PageHero/SummaryCard/token usage, Inter instead of mandated Plex Mono for money/codes/dates).

[P2] Hand-rolled checkbox divs (desonerado, repetirQuantidades) have no ARIA or keyboard path.

[P2] Deleting a budget is irreversible behind a native confirm() only, inconsistent with the app's own Modal system.

## Persona Red Flags

Casey (mobile): 24px targets + confirmed blank controls invite costly mis-taps in the field.
Sam (accessibility): no keyboard path for checkboxes; the accessible alternative to drag-reorder (the arrow buttons) is itself blank.
Riley (stress-tester): would find the blank buttons quickly, then discover one silently creates a new sub-level.

## Minor Observations

- Placeholder copy references a symbol that never renders (same stripped-glyph pattern in copy).
- Live evidence: pinned header chrome consumes ~55% of viewport before the table is reachable.
- KPI color-coding reads more like a rainbow legend than one consistent semantic mapping.
- Search modals aren't virtualized despite a ~17,000-item comment; a slice(0,12) cap mitigates this for now.
