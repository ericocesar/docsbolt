---
type: skill
name: Refactoring
description: Refactor code safely with a step-by-step approach. Use when Improving code structure without changing behavior, Reducing code duplication, or Simplifying complex logic
skillSlug: refactoring
phases: [E]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Name the smell concretely and the intended end state: duplication across N modules, SQL leaked into a service, a 21 KB controller (`core/page/page.controller.ts` is the standing example), a client feature that deviates from the `components/queries/services/types/atoms/hooks` shape.
2. Classify every file you intend to touch as **upstream-shared** (core domain modules, `packages/editor-ext`, build config) or **fork-local** (branding/theme, MCP additions, auto-subpages, `scripts/`, `.github/infra/`). This repo merges docmost/docmost regularly; restructuring upstream files trades a small readability win for a large future conflict. State the trade-off before starting.
3. Establish the safety net. With ~44 test files and no CI test gate, refactoring untested code is a behavior change in disguise. Add specs for the affected behavior **first**, in their own commit.
4. Plan the change as a sequence of small, independently revertible steps, each one commit.
5. Execute mechanically, one step at a time, running the relevant tests after each. Move code *down* a layer (controller → service → repo) or *out* to the established shared location (`common/helpers` on the server, `components/`/`lib/` on the client).
6. Do not create new patterns or new packages. Only `packages/editor-ext` and `packages/base-formula` are legitimately shared; a new workspace adds build-graph and Dockerfile-copy obligations.
7. Re-check the boundaries after each move: `core`↛`ee`, `features`↛`ee`, SQL only in repos, page content only through `collaboration.util.ts` / `yjs.util.ts`, config only through `EnvironmentService`, egress only through `OutboundUrlGuard`.
8. Keep tenant filters visible. Extracting a query must not hide `workspaceId` behind a default parameter — it should stay explicit in the repo signature or at the call site.
9. Update [apps/server/src/test-utils/mock-providers.ts](../../../apps/server/src/test-utils/mock-providers.ts) whenever a constructor signature changes, and fix the specs that depend on it.
10. Verify with the full gate (`pnpm --filter server test`, `pnpm --filter client test`, both `lint` scripts, `pnpm build`; rerun with `--skip-nx-cache`), plus manual checks for anything the suite does not cover — a "pure refactor" can still break collaboration, uploads, or exports.

## Examples

```bash
pnpm --filter server test -- page && pnpm --filter server lint && pnpm build --skip-nx-cache
```

A step sequence that is safe to review and revert:

```
step 1  test(server): cover page duplicate + move rules before extraction
step 2  refactor(server): move duplicate/move logic from PageController to PageService
step 3  refactor(server): move remaining slug SQL from PageService into PageRepo
step 4  refactor(server): extract shared title-slug helper into common/helpers/text.utils.ts
step 5  test(server): update mock-providers for PageService constructor change
```

Things that look like cruft and must **not** be "cleaned up": the prefix-exclusion list and `decorateReply('setHeader'/'end')` shims in `apps/server/src/main.ts`, the `exemptEndpoints` array in `apps/client/src/lib/api-client.ts`, the `try/catch` around `require('./ee/ee.module')` in `app.module.ts`, and the `transformIgnorePatterns` allowlist in `apps/server/package.json`. Each is load-bearing.

## Quality Bar

- Behavior is provably unchanged: state which tests covered the behavior before and after, and what you verified by hand.
- Tests were added *before* restructuring untested code, in a separate commit.
- Each commit is small, self-contained, revertible, and uses the repository's Conventional Commit style with a scope.
- The refactor conforms to the existing pattern. Nineteen sibling modules look a certain way; a lone "improved" module is a maintenance cost, not a win.
- No new shared package, no new architectural pattern, no unified content write path.
- Import directions and tenant filters are re-verified after every move, not assumed.
- `mock-providers.ts` and the affected specs are updated in the same change.
- The server/client formatting split is preserved — `apps/server` uses single quotes via its `.prettierrc`, `apps/client` uses Prettier defaults. Normalizing one to the other produces an unreviewable diff.
- Dead code and `any` removals are verified manually, since `no-unused-vars`, `no-explicit-any`, and `ban-ts-comment` are **off** in `apps/server/eslint.config.mjs`.
- Upstream-shared files touched are listed with the merge-cost justification.
- Nx cache is bypassed at least once before declaring the gate green.

## Resource Strategy

- No helper files needed. Use `context({ action: "detectPatterns" })` to find repeated structures and `context({ action: "getFlow", entryFile })` to confirm a call path before moving code.
- The reference implementations are the resource: `core/page/page.controller.ts` + `services/` (layering), `database/repos/page/page.repo.ts` (repo shape), `common/helpers/{utils,text.utils,cache-keys,with-cache}.ts` (extraction destinations, several spec-covered), `packages/base-formula` (well-tested and safe to restructure).
- Pair with [test-generation](../test-generation/SKILL.md) for the safety net and [code-review](../code-review/SKILL.md) to confirm boundaries survived.
- Record pattern or boundary changes in [architecture.md](../../docs/architecture.md); do not document refactors that changed nothing structural.
- Escalate instead of proceeding when the "right" refactor would cross a boundary (new package, new process, `core` → `ee` dependency) — that is an architecture decision, not a refactor.
