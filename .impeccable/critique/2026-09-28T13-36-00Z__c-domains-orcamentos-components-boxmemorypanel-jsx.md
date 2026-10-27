---
target: painel Caixas e reservatórios (BoxMemoryPanel)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-09-28T13-36-00Z
slug: c-domains-orcamentos-components-boxmemorypanel-jsx
---
# Critique — Caixas e reservatórios (BoxMemoryPanel)
Method: dual-agent (A read code only; browser blocked by classifier error). Detector run in parent after A: CLI 0 findings; browser 11 (9 tiny-text 11px, 2 line-length).

Score 24/40 (Acceptable). H1 3 · H2 3 · H3 2 · H4 2 · H5 2 · H6 2 · H7 2 · H8 3 · H9 2 · H10 3.

Priority issues:
- [P0] Apply silently overwrites existing per-item memorials (pre-checked); Enter submits form. Fix: warn + uncheck by default; block implicit submit. (harden)
- [P1] No before→after preview / R$ impact at apply time; old value vanishes after. (clarify)
- [P1] Numbers not auditable: symbolic formulas only, select options without values, unit/decimal inconsistency (4,06 m² vs 4,0584 M2), no plausibility checks (cm vs m), "Volume útil" is gross internal. (clarify)
- [P2] SVG plan semi-decorative: fixed proportions, L/e without values, no axis line, no highlight of the measured face. (polish)
- [P2] Off ARCD Carbon (blue primary, no Plex Mono values, radii); 11 identical pending warnings before input; AA contrast fails on .box-item__off and SVG labels. (polish)

Minor: pluralization, read-only notice at bottom, native confirm, no link to item memorial for unsupported units, saveBoxElement/removeBoxElement read budget.itens without ?. (domain CLAUDE.md rule).
