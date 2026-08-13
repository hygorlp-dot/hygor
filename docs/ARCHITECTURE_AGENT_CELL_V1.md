# Architecture Agent Cell V1

## Purpose

Provide an autonomous, fail-closed operating model for incrementally repairing the architecture of `hygorlp-dot/hygor` without a big-bang rewrite.

The cell separates implementation, tests, integration/data, research, security, performance, recovery and final review. Mechanical gates run independently of conversational/LLM agents, so a missing agent runtime cannot turn a red build into green.

## External research adopted

The agent-file shape follows the public custom-agent conventions documented in GitHub's `github/awesome-copilot` repository (`agents/custom-agent-foundry.agent.md`). The operating model also adopts the repository's recurring discovery -> synthesis/planning -> implementation -> validation separation and test-first/modernization guidance. No third-party skill code is vendored by this checkpoint; only workflow patterns are adapted.

Primary source consulted:

- https://github.com/github/awesome-copilot
- https://github.com/github/awesome-copilot/blob/main/agents/custom-agent-foundry.agent.md
- https://github.com/github/awesome-copilot/blob/main/skills/doc-and-modernize/SKILL.md

Dependency decisions remain subject to Research Scout review; an awesome-list appearance is never sufficient evidence for adoption.

## Cell

1. **Architecture Orchestrator** — owns state/evidence, not product code.
2. **Architecture Corrector** — extracts one seam at a time.
3. **Test Guardian** — characterization and regression protection.
4. **Integration Guardian** — API/runtime/transaction/idempotency contracts.
5. **Data Migration Guardian** — durable data and migration safety.
6. **Research Scout** — primary-source technical research.
7. **Security & Supply Chain Guardian** — vulnerabilities, lockfile, secrets.
8. **Performance & Bundle Guardian** — measured bundle/runtime reduction.
9. **Independent Reviewer** — exact-SHA adversarial terminal review.
10. **Recovery Guardian** — rollback and branch hygiene.

## Mechanical control plane

- `npm run arch:inventory` — deterministic hotspot/domain inventory.
- `npm run arch:gate` — ratchets and forbidden-added-line policy.
- `npm run arch:orchestrate` — fail-fast static/unit/security/build/bundle sequence.
- `npm run arch:orchestrate -- --full` — adds Playwright E2E.

The gate freezes inherited debt rather than pretending it does not exist. Existing mixed concerns may remain temporarily, but newly added lines cannot worsen protected boundaries. Hotspots are bounded by the exact sizes at recovery checkpoint `e385154c15d931d3058d7111fdecc524b76d387c`.

## Step-by-step loop

1. Inventory current HEAD.
2. Select the highest-risk/highest-leverage seam.
3. Research only if a design/dependency decision is unresolved.
4. Characterize current behavior.
5. Apply the smallest extraction.
6. Run focused tests.
7. Run integration/data gates when affected.
8. Run full architecture recovery orchestration.
9. Obtain independent exact-SHA review.
10. Checkpoint only with P0=0 and P1=0.
11. Repeat; legacy fallback must not increase.

A failed step moves to root-cause analysis and resumes from that same gate. There is no bypass path.
