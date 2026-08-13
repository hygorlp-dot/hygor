# Architecture Recovery Agent Policy

Scope: `hygorlp-dot/hygor` only.

Recovery branch: `refactor/architecture-recovery-v1`.
Canonical base at recovery start: `ef5ad21681e76049e8f302eb3ed4fe18da86b705`.
Ratchet checkpoint: `e385154c15d931d3058d7111fdecc524b76d387c`.

## Mission

Reduce architectural concentration and coupling without a big-bang rewrite. Preserve observable behavior by default and migrate one seam at a time toward:

`UI/Routes -> Application/Use Cases -> Domain -> Ports <- Infrastructure/Adapters`

## Non-negotiable invariants

1. Never write directly to `main` during recovery.
2. Never force-push to hide a failed checkpoint.
3. Never raise bundle, hotspot or quality budgets to obtain green.
4. Never add `.skip`, `.only`, disabled assertions or equivalent test bypasses.
5. Never delete or weaken a smoke test merely to pass CI; rebind it to the current semantic contract when the old selector/implementation detail is obsolete.
6. `src/LegacyApp.jsx`, `api/data.js` and `src/index.css` are ratchets: they may shrink, never grow above the frozen baseline.
7. New domain code must not acquire React, Supabase, Dexie or direct persistence/API coupling.
8. Production code must not import test/spec fixtures or test modules.
9. Structural extraction is behavior-preserving unless a separate behavior change is explicitly tested.
10. Database/schema changes require migration, compatibility and rollback/integrity review.
11. Dependency adoption requires primary/upstream research covering license, security, maintenance, compatibility and bundle/runtime cost.
12. Implementation and final review are separate roles. The implementer cannot approve its own patch.
13. Every checkpoint is tied to an exact Git SHA. A new commit invalidates prior terminal review evidence.
14. Failure is fail-closed: investigate root cause; do not bypass the gate.
15. If an irreversible external action, unavailable credential or ambiguous destructive operation cannot be completed safely, mark BLOCKED instead of guessing.

## Autonomous state machine

`DISCOVER -> BASELINE -> PLAN -> CHARACTERIZE -> PATCH -> UNIT -> INTEGRATION -> E2E -> ARCH_GATE -> SECURITY -> BUNDLE -> INDEPENDENT_REVIEW -> CHECKPOINT`

Any failure transitions to `ROOT_CAUSE` or `BLOCKED`, then resumes at the failed gate after correction.

## Agent cell

| Agent | Responsibility | May implement product code? | May approve final checkpoint? |
|---|---|---:|---:|
| architecture-orchestrator | dispatch, state and evidence | no | no |
| architecture-corrector | incremental extractions/refactors | yes | no |
| test-guardian | characterization/unit/E2E/adversarial tests | tests only | no |
| integration-guardian | API/runtime/transaction/idempotency contracts | integration code/tests | no |
| data-migration-guardian | schema/migration/data integrity/rollback | migration code/tests | no |
| research-scout | primary-source research and dependency ranking | no | no |
| security-supply-chain | vulnerabilities/secrets/dependency integrity | narrow security fixes | no |
| performance-bundle-guardian | bundle/lazy loading/performance ratchets | narrow perf fixes | no |
| independent-reviewer | exact-SHA adversarial review | no | yes |
| recovery-guardian | checkpoint/rollback/branch hygiene | recovery-only | no |

## Patch protocol

- One architectural seam per patch.
- Characterization tests before extraction.
- Prefer move/extract/delegate over rewrite.
- Keep public contracts stable where possible.
- New code goes to the target layer, not back into the legacy shell.
- Record the exact failing gate and cause before correction.
- Run `npm run arch:gate` before the full quality sequence.
- Run `npm run arch:orchestrate -- --full` for a terminal local checkpoint when browsers are available.

Routine recovery cycles do not require interactive human approval. The gates, exact-SHA review and rollback policy are the control mechanism.
