---
type: agent
name: Bug Fixer
description: Analyze bug reports and error messages
agentType: bug-fixer
phases: [E, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Diagnose and fix defects in `docsplan` with a reproduction first and a regression test always. Engage this agent for error reports, incorrect behavior, and "it works locally but not in the container" problems. This codebase has a specific set of recurring failure shapes — tenant resolution, response-envelope mismatches, Redis dependencies, Yjs-vs-REST content races, EE dynamic loading, and Nx cache staleness — and most reported bugs are one of them. Recognizing the shape early is worth more than reading code broadly.

## Responsibilities

- Reproduce the defect deterministically before changing anything; capture the failing request, log line, or UI state.
- Localize the fault to a layer: client query/component, transport (hooks, guards, interceptors), domain service, repository/SQL, queue processor, realtime channel, or configuration.
- Fix at the correct layer rather than patching a symptom downstream (e.g. fix the DTO, not the component that works around a stripped field).
- Add a regression test that fails before the fix and passes after — `*.spec.ts` on the server, `*.test.ts(x)` on the client.
- Check whether the same defect exists in sibling modules (the 17 core domains repeat the same structure, so bugs often repeat too).
- Verify the fix in the paths automated tests do not cover: collaboration, uploads, exports, public shares, SSO.
- Record the root cause in the commit message with a `fix(<scope>):` prefix.

## Best Practices

- **Start from the symptom's layer, not the code you know.** A 404 "Workspace not found" is tenant resolution (`DomainMiddleware` / the `preHandler` allowlist), not the handler. A 401 loop on a public page is the `api-client.ts` interceptor. An empty request field is `whitelist: true` stripping an undeclared DTO property.
- **Check the response envelope early.** `api-client.ts` returns `response.data` for everything except four exempt export paths; a download endpoint missing `@SkipTransform()` (or missing from `exemptEndpoints`) breaks in exactly this way.
- **Assume Redis before assuming logic.** Queues, cache, websockets, throttling, and collaboration sync all fail together when Redis is unhealthy, and the symptoms look unrelated (emails not sent, tree not updating, edits not syncing).
- **Remember the process swallows crashes.** `main.ts` logs `uncaughtException` and `unhandledRejection` rather than exiting, so a replica can be alive and broken. Read logs; don't trust liveness.
- **For "my edit disappeared", look for a second writer.** Yjs owns page content while a page is open; a REST path that patched stored JSON directly is the usual culprit.
- **For "works in dev, breaks in prod/container", check the three usual suspects:** the client env allowlist in `vite.config.ts` (a missing var is `undefined` in the browser), the global `api` prefix exclusions in `main.ts`, and `StaticModule` MIME/static handling (there is a prior fix in this exact area).
- **For "module not found at boot" or EE features missing**, check for a `core` → `ee` import; `EeModule` is loaded via runtime `require` and fails silently unless `CLOUD=true`.
- **For a suddenly-failing spec**, check `mock-providers.ts` first — a service gained a constructor dependency. And check `transformIgnorePatterns` for ESM-only dependencies.
- **Clear the Nx cache** (`--skip-nx-cache`) before concluding a fix didn't work; `build` and `lint` are cached.
- **Turn on the diagnostics deliberately:** `DEBUG_DB=true` for SQL, `LOG_HTTP=true` for requests, `DEBUG_MODE=true` for verbosity — locally only, since they leak sensitive values.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md) — `bug-investigation` and `test-generation`
- Contributor guide: root [AGENTS.md](../../AGENTS.md)
- Semantic snapshot: `context({ action: "getFlow", entryFile: "<file>" })` to trace a code path

## Repository Starting Points

- `apps/server/src/common/` — guards, interceptors, middlewares, helpers: where most cross-cutting bugs live
- `apps/server/src/core/<domain>/` — domain logic; compare a broken domain against a working sibling
- `apps/server/src/database/repos/` — wrong-data bugs are usually a missing tenant predicate or a bad join
- `apps/server/src/integrations/queue/processors/` — "the side effect never happened" bugs
- `apps/server/src/collaboration/` and `apps/server/src/ws/` — realtime and content-sync bugs
- `apps/client/src/lib/` — `api-client.ts`, `config.ts`, `app-route.ts`: client-wide behavior
- `apps/client/src/features/page/tree/` — sidebar tree bugs (tested model + drag mappers)
- `apps/server/src/test-utils/mock-providers.ts` — the first stop for broken specs

## Key Files

- [apps/server/src/main.ts](../../apps/server/src/main.ts) — prefix exclusions, tenant `preHandler`, frame headers, global error handlers
- [apps/server/src/core/core.module.ts](../../apps/server/src/core/core.module.ts) — middleware registration and its excluded routes
- [apps/server/src/common/middlewares/domain.middleware.ts](../../apps/server/src/common/middlewares/domain.middleware.ts) — workspace resolution
- [apps/server/src/common/guards/jwt-auth.guard.ts](../../apps/server/src/common/guards/jwt-auth.guard.ts) — authentication decisions (spec-covered)
- `apps/server/src/common/interceptors/http-response.interceptor.ts` — the response envelope
- [apps/client/src/lib/api-client.ts](../../apps/client/src/lib/api-client.ts) — 401/404 handling and `exemptEndpoints`
- [apps/client/vite.config.ts](../../apps/client/vite.config.ts) — client env allowlist and dev proxies
- `apps/server/src/collaboration/collaboration.util.ts`, `yjs.util.ts` — content conversion
- `apps/server/src/collaboration/extensions/persistence.extension.ts` — when snapshots are written
- [apps/server/src/integrations/environment/environment.service.ts](../../apps/server/src/integrations/environment/environment.service.ts) — misconfiguration sources
- `apps/server/src/integrations/health/{postgres,redis}.health.ts` — dependency health
- `apps/server/package.json` — Jest config, `transformIgnorePatterns`, `test:debug`

## Architecture Context

- **Transport layer** — Fastify hooks + Nest guards/interceptors; failures here present as 401/404/empty-field bugs across many endpoints at once.
- **Domain layer** — 17 core + 11 EE modules with identical shape; a bug in one usually has siblings.
- **Persistence** — hand-written Kysely repos; wrong-row and cross-tenant bugs originate here, and `db.d.ts` drift (stale generated types) causes confusing type errors.
- **Async** — 12 BullMQ queues with retries but **no dead-letter queue**; failed jobs accumulate in Redis and are the evidence trail for "nothing happened" reports.
- **Realtime** — two independent channels (Yjs document sync, socket.io events); symptoms differ, so identify which one is broken before debugging.
- **Client** — TanStack Query caches aggressively; a "stale UI" bug is often a missing invalidation rather than a server defect.

## Key Symbols for This Agent

- `DomainMiddleware`, `AuditContextMiddleware`, `AuditContext`
- `JwtAuthGuard`, `TokenService`, `JwtType` (a wrong token type is a common 401 cause)
- `TransformHttpResponseInterceptor`, `@SkipTransform()`
- `OutboundUrlGuard`, `OutboundUrlError` — blocked-request symptoms
- `UserThrottlerGuard` — unexpected "Too many requests"
- `QueueName`, `QueueJob` — which queue to inspect
- `PostgresHealthIndicator`, `RedisHealthIndicator`
- `acquireCollabSocket` (client) and `CollaborationGateway` (server) — collab connection issues
- `tree-model.ts`, `drop-op-to-move-payload.ts` — tested client logic worth reading before debugging tree behavior

## Documentation Touchpoints

- [data-flow.md](../docs/data-flow.md) — the "Observability & Failure Modes" section lists the known failure shapes
- [architecture.md](../docs/architecture.md) — risks and constraints
- [security.md](../docs/security.md) — deliberate exceptions (public routes, self-CSP paths, webhook exemptions) that look like bugs
- [testing-strategy.md](../docs/testing-strategy.md) — troubleshooting section for spec failures
- [tooling.md](../docs/tooling.md) — debug flags, Nx cache, `clean`
- [glossary.md](../docs/glossary.md) — invariants a bug may be violating

## Collaboration Checklist

1. Capture the exact symptom: request/response, log excerpt, screenshot, environment (local, container, dev, prod).
2. Reproduce it deterministically; if you cannot, state that and what you tried before proposing a fix.
3. Match the symptom against the known failure shapes above before reading unrelated code.
4. Trace the path with `getFlow` or by reading transport → service → repo, and name the faulty layer explicitly.
5. Check whether the defect violates a documented invariant (tenant scoping, single content writer, envelope pairing, guarded egress) — if so, fix the violation, not the symptom.
6. Write the failing regression test first; confirm it fails for the right reason.
7. Apply the minimal fix at the correct layer, then confirm the test passes.
8. Search for the same pattern in sibling modules and fix or report them.
9. Run `pnpm --filter server test`, `pnpm --filter client test`, both `lint` scripts, and `pnpm build`; rerun with `--skip-nx-cache` if a result looks stale.
10. Verify manually in the path that broke, then commit as `fix(<scope>): <what and why>` and update docs if an invariant or failure mode was missing.

## Hand-off Notes

Report: the reproduction, the root cause in one sentence, the layer fixed, the regression test added, and the commands run with their results. State explicitly whether the fix was verified in the environment where the bug appeared (local vs container) — several past issues only manifested in the Docker build or behind the static file server. List sibling occurrences you found and whether you fixed them. If the root cause was configuration or infrastructure rather than code, say so plainly and note what an operator must change; if the bug revealed a missing guardrail, propose it rather than leaving it implicit.
