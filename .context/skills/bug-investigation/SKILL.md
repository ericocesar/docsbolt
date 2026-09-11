---
type: skill
name: Bug Investigation
description: Investigate bugs systematically and perform root cause analysis. Use when Investigating reported bugs, Diagnosing unexpected behavior, or Finding the root cause of issues
skillSlug: bug-investigation
phases: [E, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Capture the symptom precisely: the request/response (status, body), the log excerpt, the UI state, and the environment (local `pnpm dev`, `docker compose`, dev stack, prod stack). "Broken in prod, fine locally" is itself a strong signal here.
2. Match the symptom against this repo's known failure shapes **before** reading unrelated code:
   - `404 "Workspace not found"` → tenant resolution: `DomainMiddleware` or the `preHandler` allowlist in `main.ts`.
   - Unexpected 401 / login redirect loop → `JwtAuthGuard` token type mismatch, or the interceptor exemptions in `apps/client/src/lib/api-client.ts` (`/share/*`, `/docs*`, `/api/auth/collab-token`).
   - A request field arrives `undefined` → the DTO is missing it; `whitelist: true` strips undeclared fields.
   - A download/export returns mangled data or loses headers → missing `@SkipTransform()` or a missing entry in `exemptEndpoints`.
   - Emails not sent, search stale, tree not updating, edits not syncing → Redis health, not application logic.
   - "My edit disappeared" → a second writer bypassing `collaboration.util.ts` / `yjs.util.ts`.
   - An env var is `undefined` in the browser → it is missing from the `define` allowlist in `apps/client/vite.config.ts` (client config is baked at build time).
   - EE feature missing or boot failure → a `core` → `ee` import; `EeModule` is `require`d in a `try/catch`.
   - `Nest can't resolve dependencies` in a spec → `test-utils/mock-providers.ts` needs the new dependency.
   - `Unexpected token 'export'` in Jest → ESM-only dependency missing from `transformIgnorePatterns`.
3. Reproduce deterministically. If you cannot, say so explicitly and list what you tried — do not fix by inspection.
4. Instrument the suspected layer: `DEBUG_DB=true` for SQL, `LOG_HTTP=true` for requests, `DEBUG_MODE=true` for verbosity, browser devtools for the client, BullMQ failed-job inspection for "nothing happened" reports. Remember `main.ts` logs `uncaughtException`/`unhandledRejection` instead of exiting, so read logs rather than trusting liveness.
5. Trace the path: `context({ action: "getFlow", entryFile: "<file>", entryFunction: "<fn>" })`, or read transport → controller → service → repo by hand.
6. Name the faulty layer and ask whether a documented invariant was violated (tenant scoping, single content writer, envelope pairing, guarded egress, config via `EnvironmentService`). If so, fix the violation, not the symptom.
7. Write the failing regression test before the fix and confirm it fails for the right reason.
8. Apply the minimal fix at the correct layer. Resist fixing downstream (patching a component around a stripped DTO field is the classic wrong move).
9. Check siblings: the 17 core domains share one structure, so the same defect often exists in several modules. Fix or report them.
10. Verify with the full gate (`test`, `lint`, `build`, `--skip-nx-cache` if results look stale) **in the environment where the bug appeared**, then commit as `fix(<scope>): …` with the root cause in the body.

## Examples

```bash
DEBUG_DB=true LOG_HTTP=true pnpm server:dev
```

```bash
# confirm the dependency layer before blaming code
curl -s localhost:3000/api/health | jq .
```

A root-cause note in the expected shape:

> **Symptom.** `POST /api/pages/update` returns 200 but the `icon` field never persists; only in the dev stack.
> **Reproduced.** Yes — any page, any workspace, both stacks. Not environment-specific after all.
> **Root cause.** `UpdatePageDto` has no `icon` property. The global `ValidationPipe` runs with `whitelist: true`, so the field is stripped before the controller sees it; the service then writes `undefined` and Kysely omits the column.
> **Fix.** Declare `icon` on `UpdatePageDto` with the matching validator. Regression spec asserts the field survives validation.
> **Siblings.** `UpdateSpaceDto` has the same gap for `description` — reported separately.

## Quality Bar

- The investigation states whether the bug was reproduced, and in which environment. An unreproduced fix is flagged as speculative.
- The root cause is one sentence naming a mechanism, not a restatement of the symptom.
- The fix is at the layer that owns the behavior; downstream workarounds are rejected.
- A regression test exists and is shown to fail on the pre-fix code.
- Sibling modules are checked, since this codebase repeats its structure ~20 times.
- Infrastructure causes are named as such: if the answer is "Redis was unhealthy" or "`APP_URL` was wrong behind the proxy", say that plainly instead of changing code.
- Documented exceptions are not mistaken for bugs (unauthenticated `/share` and `/docs`, self-CSP on `/api/files/*`, webhook/setup/health tenancy bypass).
- Verification happens in the failing environment — several past issues appeared only in the container build or behind the static file server.
- Diagnostic flags are turned back off; `DEBUG_DB` and `LOG_HTTP` leak sensitive values.
- If the bug revealed a missing guardrail, that is proposed explicitly rather than left implicit.

## Resource Strategy

- No helper files needed; the tools are `getFlow`, the debug env flags, Postgres/Redis health endpoints, and BullMQ job state.
- The failure-shape catalogue belongs in two places only: the workflow above and the "Observability & Failure Modes" section of [data-flow.md](../../docs/data-flow.md). When a new recurring shape is found, add it there.
- Spec-failure troubleshooting lives in [testing-strategy.md](../../docs/testing-strategy.md#troubleshooting); deliberate security exceptions live in [security.md](../../docs/security.md).
- Use [test-generation](../test-generation/SKILL.md) for the regression test and [code-review](../code-review/SKILL.md) to check the fix against the invariants.
- Add a helper here only if a reusable diagnostic script emerges (for example: hit `/api/health`, print queue depths per `QueueName`, and tail the last errors) — keep it runnable and short.
