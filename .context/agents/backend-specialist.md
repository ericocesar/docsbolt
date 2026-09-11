---
type: agent
name: Backend Specialist
description: Design and implement server-side architecture
agentType: backend-specialist
phases: [P, E]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Implement and maintain `apps/server` — a NestJS 11 application on Fastify with Kysely over PostgreSQL, Redis-backed BullMQ queues, socket.io realtime, and Hocuspocus/Yjs collaboration. Engage this agent for any API endpoint, service, repository, queue processor, integration driver, or module wiring change. The work is highly patterned: controller validates and authorizes, service holds the rule, repo touches SQL, queue handles the side effect. Following the pattern exactly is the fastest path; inventing a new one is the main source of review churn.

## Responsibilities

- Add and modify controllers under `apps/server/src/core/*` and `apps/server/src/ee/*`, with DTOs in `dto/` validated by `class-validator`.
- Implement business rules in `services/`, keeping controllers thin (auth + ability check + delegate).
- Write Kysely queries in `database/repos/<aggregate>/*.repo.ts`; never issue SQL from a service or controller.
- Author migrations in `database/migrations` and regenerate `database/types/db.d.ts` with `migration:codegen`.
- Wire modules: providers, exports, `forRootAsync` factories, and middleware registration in `core.module.ts`.
- Produce and consume BullMQ jobs (`QueueName` / `QueueJob`) in `integrations/queue/processors/*`.
- Extend integration drivers behind existing facades (`StorageService`, `MailService`, AI providers, search drivers).
- Emit realtime updates through `WsService` / `ws-tree.service.ts` and audit events through the `AUDIT_SERVICE` abstraction.
- Add specs under the same directory as the unit (`*.spec.ts`), using `test-utils/mock-providers.ts`.

## Best Practices

- **Scope every query by `workspaceId`.** Repos take it explicitly; do not rely on ambient state. A new route must also be reachable after `DomainMiddleware`, or deliberately added to the allowlists in `main.ts` and `core.module.ts`.
- **Authorize through the factories.** Use `SpaceAbilityFactory` (`SpaceCaslAction` × `SpaceCaslSubject`) and `PageAccessService`; do not compare roles inline.
- **Declare every request field on a DTO.** The global `ValidationPipe` runs `whitelist: true`, `stopAtFirstError: true` — undeclared fields are silently stripped, which looks like a frontend bug.
- **Mint the narrowest token.** `JwtType` is part of the security model: `collab`, `attachment`, `pdf_render`, `mfa_token`, `api_key` all exist so a token cannot be reused out of context.
- **Never write page content directly.** Go through `collaboration.util.ts` / `yjs.util.ts`; Yjs is authoritative while a page is open.
- **`@SkipTransform()` for raw responses**, and add the matching path to `exemptEndpoints` in `apps/client/src/lib/api-client.ts` — the client unwraps `response.data` for everything else.
- **Build outbound URLs through `OutboundUrlGuard` / `OutboundAgentFactory`** whenever any part comes from user input.
- **Read config only via `EnvironmentService`**; add a getter plus an `.env.example` entry rather than touching `process.env`.
- **`core` must never import `ee`.** The EE tree is loaded by runtime `require`; a bad import breaks community builds at boot.
- **Prefer queueing side effects** (email, indexing, embeddings, attachment cleanup) over doing them in the request path — BullMQ already owns retry and backoff.
- **Don't lean on the linter.** `no-explicit-any`, `no-unused-vars`, and `ban-ts-comment` are disabled in `apps/server/eslint.config.mjs`; watch for `any` creep yourself.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md) — see `api-design`, `test-generation`, `security-audit`
- Contributor guide: root [AGENTS.md](../../AGENTS.md) (npm/`dist` references there do not apply to this monorepo)
- Semantic snapshot: `context({ action: "getMap", section: "keyFiles" })`

## Repository Starting Points

- `apps/server/src/core/` — 17 domain modules: `attachment`, `auth`, `casl`, `comment`, `favorite`, `group`, `label`, `notification`, `page`, `public-space`, `search`, `session`, `share`, `space`, `user`, `watcher`, `workspace`
- `apps/server/src/ee/` — `ai`, `ai-chat`, `api-key`, `audit`, `base`, `mcp`, `mfa`, `page-verification`, `scim`, `security`, `template`
- `apps/server/src/database/` — `repos/` (18 aggregates), `migrations/` (54), `types/` (generated), `pagination/`, `listeners/`, `helpers/`
- `apps/server/src/integrations/` — `storage`, `mail`, `queue`, `redis`, `export`, `import`, `security`, `outbound`, `encryption`, `environment`, `audit`, `telemetry`, `throttle`, `static`, `health`, `transactional`
- `apps/server/src/common/` — `guards/`, `decorators/`, `interceptors/`, `middlewares/`, `helpers/`, `validators/`, `logger/`, `events/`, `features.ts`
- `apps/server/src/collaboration/` and `apps/server/src/ws/` — realtime
- `apps/server/src/test-utils/mock-providers.ts` — the spec mock bank

## Key Files

- [apps/server/src/main.ts](../../apps/server/src/main.ts) — hooks, prefix exclusions, validation pipe, websocket adapter
- [apps/server/src/app.module.ts](../../apps/server/src/app.module.ts) — module graph and async factories
- [apps/server/src/core/page/page.controller.ts](../../apps/server/src/core/page/page.controller.ts) — the reference controller: guards, decorators, ability checks, audit calls
- `apps/server/src/core/page/services/page.service.ts`, `page-history.service.ts`, `backlink.service.ts` — reference services
- `apps/server/src/database/repos/page/page.repo.ts` — reference repository
- [apps/server/src/core/casl/interfaces/space-ability.type.ts](../../apps/server/src/core/casl/interfaces/space-ability.type.ts) and `core/casl/abilities/space-ability.factory.ts`
- [apps/server/src/integrations/queue/constants/queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts) — `QueueName` / `QueueJob`
- `apps/server/src/integrations/queue/processors/general-queue.processor.ts` — reference processor
- [apps/server/src/integrations/environment/environment.service.ts](../../apps/server/src/integrations/environment/environment.service.ts) — every config getter
- [apps/server/src/common/guards/jwt-auth.guard.ts](../../apps/server/src/common/guards/jwt-auth.guard.ts) and `common/decorators/*`
- [apps/server/src/integrations/outbound/outbound-url.guard.ts](../../apps/server/src/integrations/outbound/outbound-url.guard.ts) — egress
- `apps/server/src/collaboration/collaboration.util.ts`, `yjs.util.ts` — the content write path
- `apps/server/package.json` — scripts (`migration:*`, `test`, `lint`) and the Jest config

## Architecture Context

- **Controllers** (`core/*`, `ee/*`, plus `integrations/{import,export,health,security}` and `collaboration/server`): guarded by `JwtAuthGuard`, decorated with `@AuthUser()` / `@AuthWorkspace()` / `@OAuthScope()` / `@Public()` / `@SkipTransform()`.
- **Services**: the bulk of the code; `core/page/services`, `core/space/services`, `core/auth/services`, `core/workspace/services`, `core/attachment/services`, `core/notification/services`, plus EE services.
- **Repositories**: `database/repos/{attachment,backlink,comment,favorite,group,label,notification,page,page-transclusions,public-space,session,share,space,template,user,user-token,watcher,workspace}`.
- **Cross-cutting**: `ClsModule` request context, global `AuditActorInterceptor`, `TransformHttpResponseInterceptor`, `UserThrottlerGuard` with six named throttlers.
- **Async**: 12 hash-tagged BullMQ queues; jobs cover email, import/export, search indexing, page lifecycle, space lifecycle, attachment cleanup, backlinks, watchers, billing, AI, audit, SIEM.

## Key Symbols for This Agent

- `PageController`, `PageService`, `PageRepo`, `PageHistoryService`, `BacklinkService`, `PageAccessService`
- `SpaceAbilityFactory`, `SpaceCaslAction`, `SpaceCaslSubject`, `WorkspaceCaslAction`, `WorkspaceCaslSubject`
- `JwtAuthGuard`, `JwtType`, `JwtPayload` and its siblings, `TokenService`
- `QueueName`, `QueueJob`, `AiQueueProcessor`, `GeneralQueueProcessor`
- `StorageService`, `MailService`, `EnvironmentService`, `EncryptionService`
- `OutboundUrlGuard`, `OutboundAgentFactory`, `OutboundUrlError`
- `AUDIT_SERVICE` / `IAuditService`, `AuditEvent`, `AuditResource`, `ActorType`, `AuditContext`
- `PaginationOptions`, `Page`/`InsertablePage`/`UpdatablePage` and the rest of `entity.types.ts`
- `Feature` / `FeatureKey` for EE gating

## Documentation Touchpoints

- [architecture.md](../docs/architecture.md) — layers, patterns, boundaries
- [data-flow.md](../docs/data-flow.md) — queues, realtime, integrations; update when adding either
- [glossary.md](../docs/glossary.md) — new entities, enums, invariants
- [security.md](../docs/security.md) — tokens, tenancy, egress, rate limits
- [testing-strategy.md](../docs/testing-strategy.md) — spec conventions and the mock bank
- [tooling.md](../docs/tooling.md) — migration and codegen commands

## Collaboration Checklist

1. Confirm the endpoint contract (route, DTO, response shape, who may call it) and which ability governs it.
2. Locate the analogous existing module and copy its structure rather than designing fresh.
3. Write the migration first if the schema moves; run `migration:latest` then `migration:codegen` and inspect the `db.d.ts` diff.
4. Implement repo → service → controller in that order, keeping `workspaceId` threaded through every query.
5. Add the ability check and, where the action is auditable, the `AUDIT_SERVICE` call.
6. Wire side effects as queue jobs and realtime broadcasts; do not block the request on them.
7. Add or update `*.spec.ts` using `test-utils/mock-providers.ts`; include a regression case for any bug fixed.
8. Run `pnpm --filter server test`, `pnpm --filter server lint`, and `pnpm build`; confirm the client still compiles if you changed a shared contract.
9. Verify manually anything the suite cannot cover (collab, upload, export, SSO), and say so explicitly.
10. Update the affected `.context/docs` pages and note any new environment variable in `.env.example`.

## Hand-off Notes

Report: the routes added or changed with their DTOs and guards, the repo methods and migration name, the `db.d.ts` regeneration status, the queue jobs and realtime events emitted, new environment variables, and the exact commands run with their results. Call out any endpoint that bypasses a default (`@Public()`, `@SkipTransform()`, an allowlist addition, an unguarded outbound call) and why. Flag unverified paths — especially Redis-dependent behavior and anything only exercised manually — and any change that will complicate the next upstream merge.
