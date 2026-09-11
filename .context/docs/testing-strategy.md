---
type: doc
name: testing-strategy
description: Test frameworks, patterns, coverage requirements, and quality gates
category: testing
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Testing Strategy

Quality here rests on a **thin but deliberate** automated suite plus disciplined local verification. There are roughly 44 spec/test files across the monorepo: ~35 Jest specs on the server, 5 Vitest tests on the client, a handful in `packages/`, and one Nest e2e smoke spec. Coverage is concentrated where a mistake is expensive and hard to notice — security helpers (outbound URL guard, security headers, JWT guard, encryption, URL validator), permission-sensitive services (space, page, public-space, comment, search), and the enterprise surfaces that machine clients hit (`api-key`, `mcp`, `scim`, `mfa`, `sso`, `audit-settings`, `base`).

Two structural facts shape everything below:

1. **CI does not run tests.** `.github/workflows/release.yml` only builds and publishes Docker images on `v*` tags. The commands in this document are the gate — run them before you push.
2. **The server is a large NestJS graph.** Constructing a real module in a unit test drags in Kysely, Redis, queues, storage, and audit. The repo solves this with [apps/server/src/test-utils/mock-providers.ts](../../apps/server/src/test-utils/mock-providers.ts), a shared bank of `useValue: {}` providers that short-circuit constructor resolution. Use it instead of hand-mocking the dependency graph again.

## Test Types

**Unit — server (Jest 30 + ts-jest).** Configured inline in [apps/server/package.json](../../apps/server/package.json): `rootDir: src`, `testRegex: .*\.spec\.ts$`, `testEnvironment: node`, coverage to `apps/coverage`. Path aliases are mapped in `moduleNameMapper` (`@docmost/db/*`, `@docmost/transactional/*`, `@docmost/ee/*`, `src/*`, and the two `@docmost/base-formula` entries). A `transformIgnorePatterns` allowlist exists because several dependencies ship ESM only (`nanoid`, `uuid`, `marked`, `happy-dom`, `@scure`, `@noble`, `otplib`, `image-dimensions`) — if a new dependency explodes with `Unexpected token 'export'`, add it there rather than mocking it away.

Naming: co-located `*.spec.ts` next to the unit under test (`page.controller.spec.ts`, `space.service.spec.ts`, `outbound-url.guard.spec.ts`). Style: `Test.createTestingModule({ providers: [Subject, ...mockProviders] })`, then assert on behavior — most specs verify authorization decisions and input handling rather than SQL.

**Unit — client (Vitest + jsdom).** [apps/client/vitest.config.ts](../../apps/client/vitest.config.ts) sets `environment: 'jsdom'`, `globals: true`, the `@` → `src` alias, and the React plugin; there is no setup file. Naming: `*.test.ts` / `*.test.tsx` co-located with the code (`document-title.test.tsx`, `tree-model.test.ts`, `drop-op-to-move-payload.test.ts`, `resolve-compare-pair.test.ts`). The pattern is pure-logic-first: the tested units are tree models, payload mappers, and comparison resolvers rather than rendered screens.

**Unit — packages.** `packages/editor-ext` and `packages/base-formula` carry their own specs (e.g. the ProseMirror `indent-schema.spec.ts` under the server's helpers, formula tests and `packages/base-formula/bench/formula-bench.ts` for performance characterization). The formula pipeline (tokenize → parse → resolve → typecheck → evaluate) is the most test-friendly code in the repo — new formula behavior should always arrive with cases.

**Integration (DB-backed).** A few specs talk to a real Postgres and self-gate on the environment: [apps/server/src/ee/base/base.service.spec.ts](../../apps/server/src/ee/base/base.service.spec.ts) checks `process.env.DATABASE_URL` and skips when it is absent, creating its own schema per test. To run these, load the repo-root `.env` first; otherwise they silently no-op. This is the sanctioned pattern for integration specs — gate on `DATABASE_URL`, never hard-require it.

**E2E (Nest, smoke only).** `apps/server/test/app.e2e-spec.ts` with [apps/server/test/jest-e2e.json](../../apps/server/test/jest-e2e.json) (`testRegex: .e2e-spec.ts$`, `supertest`). It is a bootstrap smoke test, not a product suite — there is no browser-level end-to-end coverage in this repo. Flows that matter most (collaborative editing, imports/exports, SSO) are verified manually.

## Running Tests

Server unit specs:

```bash
pnpm --filter server test
```

Watch mode while iterating:

```bash
pnpm --filter server test:watch
```

A single file or pattern:

```bash
pnpm --filter server test -- outbound-url.guard
```

Server coverage report (written to `apps/coverage`):

```bash
pnpm --filter server test:cov
```

Include the DB-gated integration specs (loads the repo-root `.env` so `DATABASE_URL` is set):

```bash
pnpm --filter server exec env $(grep -v '^#' ../../.env | xargs) pnpm test
```

Nest e2e smoke test:

```bash
pnpm --filter server test:e2e
```

Client tests:

```bash
pnpm --filter client test
```

```bash
pnpm --filter client test:watch
```

Everything a reviewer expects, in one line:

```bash
pnpm --filter server test && pnpm --filter client test && pnpm --filter server lint && pnpm --filter client lint && pnpm build
```

There is no root-level `test` script — `nx run-many -t build` is the only aggregate task defined, so tests are always invoked per workspace.

## Quality Gates

- **New logic ships with a test.** A server service or guard change gets a `*.spec.ts`; a client model/mapper change gets a `*.test.ts(x)`. Pure functions and permission decisions are non-negotiable; React screens are not currently expected to have render tests.
- **Every bug fix ships a regression test** that fails before the fix. The security bumps and permission fixes in the history set this precedent.
- **Security-sensitive code is spec-covered by policy.** Anything touching `integrations/outbound`, `common/guards`, `common/helpers/security-headers.ts`, `common/validators`, `integrations/encryption`, or token minting must keep (or extend) its existing spec. Those specs exist precisely because the failure mode is silent.
- **No numeric coverage threshold is enforced.** `test:cov` is available and `collectCoverageFrom: **/*.(t|j)s` is configured, but no `coverageThreshold` gate exists. The working standard is directional: coverage should not go down in the files you touch. Do not add a global threshold without agreeing on it — it would immediately fail.
- **Lint and format must be clean.** ESLint 9 flat configs live at `apps/server/eslint.config.mjs` and `apps/client/eslint.config.mjs` (`typescript-eslint` + `eslint-config-prettier`); Prettier configs at `apps/server/.prettierrc` and `packages/editor-ext/.prettierrc`. Both `lint` scripts run with `--fix`, so run them before committing rather than after review.
- **Type-check is part of the build, not a separate task.** The client build is `tsc && vite build`, so `pnpm build` is the type-check gate for the SPA; the server uses `nest build`. A change that compiles in your editor but breaks `pnpm build` is not done.
- **Migrations are verified by running them.** Apply `migration:latest` against a real database, then regenerate `db.d.ts` with `migration:codegen` and confirm the diff is exactly what you expect. Test the rollback (`migration:down`) for anything destructive.
- **Manual verification for uncovered flows.** Collaborative editing (two tabs, live cursors, reconnect), import/export round-trips, share links and public spaces, SSO/SCIM, and file uploads have no automated coverage — exercise them by hand and say so in the PR description.
- **Container parity for build/runtime changes.** `docker compose up --build` before merging anything that touches the `Dockerfile`, workspace layout, or dependency graph.

## Troubleshooting

- **`Unexpected token 'export'` / ESM in Jest.** A dependency ships ESM only. Add it to `transformIgnorePatterns` in `apps/server/package.json` (note the existing `(\.pnpm/)?` prefix handling for pnpm's layout) rather than stubbing the module.
- **`Nest can't resolve dependencies of <Service>`.** The service gained a constructor dependency — import the matching mock from [test-utils/mock-providers.ts](../../apps/server/src/test-utils/mock-providers.ts) (or add one there) instead of instantiating the real graph. This is the single most common spec breakage after an upstream merge; several `merge:` commits in the history exist only to add these mocks.
- **DB-gated specs appear to pass without testing anything.** `DATABASE_URL` was unset, so they skipped. Load `.env` before running, and don't read a green run as coverage of `base.service`.
- **Integration specs leave schemas behind.** They create a schema per test; a crashed run can leak them. Inspect and drop stray schemas before rerunning.
- **Redis-dependent behavior can't be unit-tested meaningfully.** Queues, cache, throttling, websockets, and collab sync all need a real Redis. Mock at the service boundary in unit tests and verify the real behavior manually or in a compose environment.
- **Client tests have no setup file.** There are no global providers, mocks, or jest-dom matchers registered. If a test needs Mantine/i18n/query providers, wrap the subject explicitly in that test — or, preferably, extract the logic and test it without React.
- **Path aliases differ per workspace.** Server specs resolve `@docmost/*` and `src/*` through `moduleNameMapper`; client tests resolve `@` through the Vitest `resolve.alias`. An import that works in one will not necessarily resolve in the other.
- **`pnpm build` fails with heap errors locally.** The Docker build sets `NODE_OPTIONS=--max-old-space-size=3072` and `--parallel=1` for a reason; mirror those when reproducing a build OOM (`build(docker): use --parallel=1 during build to prevent buildkit OOM`).
- **Nx cache masks a fixed failure.** `build` and `lint` are cached in `nx.json`. If a result looks stale, rerun with `--skip-nx-cache` or clear `.nx/`.

## Related Resources

- [development-workflow.md](development-workflow.md) — the full pre-push checklist and review expectations
- [tooling.md](tooling.md) — every script, linter, and generator
- [security.md](security.md) — which specs protect which guardrail
- [architecture.md](architecture.md) — module boundaries that make units testable
