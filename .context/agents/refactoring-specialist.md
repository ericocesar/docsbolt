---
type: agent
name: Refactoring Specialist
description: Identify code smells and improvement opportunities
agentType: refactoring-specialist
phases: [E]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Improve the structure of existing code without changing behavior. Engage this agent for duplication across the 17 core (and 11 enterprise) domain modules, oversized controllers and services, leaked SQL, tangled client components, and drift from the repository's established patterns. One constraint dominates every decision here: **this is a fork that regularly merges docmost/docmost upstream**. A refactor that reformats or restructures upstream files trades a small readability win for a large future merge cost, so the default is surgical, fork-local, and pattern-conforming.

## Responsibilities

- Extract duplicated logic that repeats across domain modules into `common/helpers` (server) or shared components/hooks (client).
- Split oversized units — `apps/server/src/core/page/page.controller.ts` is ~21 KB and the obvious candidate — by moving rules into `services/` rather than creating parallel controllers.
- Move stray SQL out of services into `database/repos/*`.
- Normalize client features to the canonical `components/queries/services/types/atoms/hooks` shape.
- Align naming with the entity/repo/module/feature convention so a concept reads the same in every layer.
- Consolidate types: remove near-duplicate client types, tighten `any`, and delete dead code the linter ignores.
- Preserve and extend tests as the safety net; add coverage *before* restructuring untested code.
- Keep the core↔`ee` and `features`↔`ee` import directions intact while moving code.

## Best Practices

- **Establish a test net first.** With no CI test gate and only ~44 test files, a refactor of untested code is a behavior change in disguise. Add specs, then restructure.
- **Refactor in small, separately committed steps** using the repository's Conventional Commit style, so a bad step is revertible without unwinding a feature.
- **Weigh upstream merge cost explicitly.** Files that upstream also edits (core domain modules, editor extensions) should be touched minimally. Fork-only code (branding, MCP additions, Portainer scripts, auto-subpages) is where restructuring is cheapest.
- **Conform to the existing pattern rather than introducing a better one.** Nineteen other modules look a certain way; a lone "improved" module is harder to maintain than a consistent mediocre one.
- **Extract to `common/helpers`, not to a new package.** Only `packages/editor-ext` and `packages/base-formula` are legitimately shared; a new shared package adds build-graph and Docker-copy obligations.
- **Never consolidate the two content write paths.** REST and Yjs are separate for a reason; unify the *call site* through `collaboration.util.ts`, not the mechanism.
- **Keep tenant filters visible.** Moving a query into a helper must not hide `workspaceId` behind a default; the filter should remain explicit at the call site or in the repo signature.
- **Don't "clean up" documented exceptions.** The prefix-exclusion list in `main.ts`, the `exemptEndpoints` array, the `try/catch` EE require, and the `decorateReply` shims all look like cruft and are all load-bearing.
- **Watch the linter's blind spots.** `no-explicit-any`, `no-unused-vars`, and `ban-ts-comment` are off on the server, so dead code and `any` accumulate silently — these are legitimate refactor targets, but removing them needs manual verification.
- **Respect the client formatting split.** `apps/server` uses single quotes via its `.prettierrc`; `apps/client` uses Prettier defaults. Do not normalize one to the other — it produces enormous diffs.
- **Verify with the full local gate**, and rerun with `--skip-nx-cache` before believing a clean result.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md) — `refactoring` and `test-generation`
- Contributor guide: root [AGENTS.md](../../AGENTS.md)
- Semantic snapshot: `context({ action: "detectPatterns" })` to find repeated structures

## Repository Starting Points

- `apps/server/src/core/` — 17 structurally identical modules; the richest source of both duplication and safe pattern reference
- `apps/server/src/ee/` — 11 modules mirroring core; duplication between a core and EE variant is common
- `apps/server/src/common/helpers/` — the correct destination for extracted server utilities
- `apps/server/src/database/repos/` — where SQL belongs when found elsewhere
- `apps/client/src/features/` — 22 features to normalize against each other
- `apps/client/src/ee/` — ~25 mirrored features
- `apps/client/src/components/{ui,layouts,settings}/` — the destination for extracted shared UI
- `packages/editor-ext/src/lib/` — heavily upstream-shared; refactor conservatively
- `packages/base-formula/src/` — self-contained and well-tested; the safest place to refactor

## Key Files

- [apps/server/src/core/page/page.controller.ts](../../apps/server/src/core/page/page.controller.ts) — largest controller; primary split candidate
- `apps/server/src/core/page/services/page.service.ts` — where extracted rules should land
- `apps/server/src/database/repos/page/page.repo.ts` and `repos/page/types/` — reference repo shape and typed projections
- [apps/server/src/common/helpers/index.ts](../../apps/server/src/common/helpers/index.ts) — the shared-helper barrel
- `apps/server/src/common/helpers/{utils.ts,text.utils.ts,cache-keys.ts,with-cache.ts}` — existing extraction destinations (several spec-covered)
- [apps/server/src/test-utils/mock-providers.ts](../../apps/server/src/test-utils/mock-providers.ts) — must be updated when constructor signatures change
- [apps/server/src/database/types/entity.types.ts](../../apps/server/src/database/types/entity.types.ts) — the single home for entity types
- [apps/client/src/lib/api-client.ts](../../apps/client/src/lib/api-client.ts) and `lib/utils.tsx` — client-wide surfaces; changes here are high blast radius
- `apps/client/src/features/page/tree/` — tested client logic, so a safe refactor target
- `apps/server/eslint.config.mjs` — the rules that are *off*, i.e. what the linter will not catch for you

## Architecture Context

- **Repeated module shape** — `<domain>.controller.ts` + `services/` + `dto/` on the server; `components/queries/services/types/atoms/hooks` on the client. Consistency across ~20 instances is the codebase's main maintainability asset; protect it.
- **Layering** — controller (auth + ability + delegate) → service (rules) → repo (SQL). Most refactors are "move this down a layer".
- **Cross-cutting** — `common/` on the server and `lib/` + `components/` on the client; both are small and high-leverage, so extraction targets belong there.
- **Boundaries that must survive a refactor** — `core`↛`ee`, `features`↛`ee`, SQL only in repos, page content only via collaboration utils, config only via `EnvironmentService`, egress only via the outbound guard.
- **Upstream-shared surface** — core domain modules, `packages/editor-ext`, build config. Fork-local surface: branding/theme, MCP additions, auto-subpages, `scripts/`, `.github/infra/`.

## Key Symbols for This Agent

- `PageController`, `PageService`, `PageRepo` — the canonical layering example and the main split candidate
- `SpaceAbilityFactory`, `PageAccessService` — must remain the single authorization path after any move
- `PaginationOptions` — reuse rather than re-inventing list contracts
- `withCache`, `cache-keys.ts` builders — existing extraction precedent
- `entity.types.ts` triples — the single home for entity typing
- `mockProviders` — the coupling point between refactors and the test suite
- `TransformHttpResponseInterceptor` / `@SkipTransform()` — behavior that must not change
- `EnvironmentService` — do not inline config reads while "simplifying"

## Documentation Touchpoints

- [architecture.md](../docs/architecture.md) — the patterns and boundaries a refactor must preserve or update
- [development-workflow.md](../docs/development-workflow.md) — commit granularity and review expectations
- [testing-strategy.md](../docs/testing-strategy.md) — the safety net and how to extend it
- [glossary.md](../docs/glossary.md) — naming consistency across layers
- [tooling.md](../docs/tooling.md) — lint/format behavior and Nx cache pitfalls

## Collaboration Checklist

1. Name the smell concretely (duplication across N modules, SQL in a service, a 21 KB controller) and the intended end state.
2. Classify the files as upstream-shared or fork-local, and state the merge-cost consequence before starting.
3. Confirm test coverage for the affected behavior; if absent, add specs first and commit them separately.
4. Plan the refactor as a sequence of small, independently revertible steps.
5. Move code down a layer or into the established shared location — never create a new pattern or package.
6. Verify the boundaries still hold: import directions, tenant filters, single content writer, config access, egress guarding.
7. Update `mock-providers.ts` and any spec affected by changed constructor signatures.
8. Run `pnpm --filter server test`, `pnpm --filter client test`, both `lint` scripts, and `pnpm build`; rerun with `--skip-nx-cache`.
9. Verify manually any behavior the suite does not cover, since a "pure refactor" can still break collaboration, uploads, or exports.
10. Commit per step with Conventional Commit messages, and update `.context/docs` if a pattern or boundary description changed.

## Hand-off Notes

Report the smell addressed, the end state reached, and the step-by-step commit sequence. State explicitly that behavior is unchanged and how you know — which tests covered it before and after, and what you verified by hand. Quantify the merge-cost impact: which upstream-shared files were touched and why it was worth it. List anything intentionally left alone (documented exceptions, upstream-heavy files, untested areas you chose not to restructure) and any follow-up refactor the change makes possible, so the next agent inherits a plan rather than a half-finished move.
