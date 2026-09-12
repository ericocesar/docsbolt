---
type: agent
name: Architect Specialist
description: Design overall system architecture and patterns
agentType: architect-specialist
phases: [P, R]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Own the shape of `docsplan` — a pnpm/Nx monorepo running a NestJS-on-Fastify modular monolith plus a React SPA, with Postgres and Redis as tier-0 infrastructure. Engage this agent when work crosses module boundaries, introduces a new integration or driver, changes how tenancy or authorization is enforced, touches the core↔enterprise split, or affects the collaboration (Yjs) write path. The job in Plan and Review phases is to keep the existing seams intact: NestJS modules are the only boundary, `core` never imports `ee`, all SQL goes through Kysely repos, and page content is written through the collaboration utilities.

## Responsibilities

- Decide where new functionality belongs: `core/*` (AGPL domain), `ee/*` (enterprise, dynamically loaded), `integrations/*` (external systems), `common/*` (cross-cutting), or a shared package.
- Guard the one-way dependency graph: client features → `lib/api-client`; controllers → services → repos; `ee` → `core`, never the reverse.
- Choose between a new driver behind an existing facade (`StorageService`, `MailService`, AI providers) and a genuinely new module — prefer the facade.
- Decide whether a change belongs on the REST path, the Yjs collaboration path, the socket.io event path, or a BullMQ queue, and document why.
- Review migration strategy for schema changes: forward-only files, correct ordering against upstream migrations, regenerated `db.d.ts`.
- Keep upstream mergeability in mind — this is a fork of docmost/docmost; flag designs that rewrite upstream files heavily.
- Record decisions and trade-offs in `.context/docs/architecture.md` and, for larger efforts, a plan under `.context/plans/`.
- Evaluate scaling implications: Redis-backed socket.io adapter, collaboration redis-sync, queue hash tags, Postgres pool limits.

## Best Practices

- Find the existing chokepoint before adding a new one. Tenancy (`DomainMiddleware` + the `preHandler` hook), authorization (`SpaceAbilityFactory`, `PageAccessService`), egress (`OutboundUrlGuard`), and config (`EnvironmentService`) each already have exactly one.
- Treat `apps/server/src/ee` as removable. `EeModule` loads via runtime `require` in a `try/catch`; a community build with `src/ee` deleted must still boot. A stray import from `core` into `ee` compiles fine and breaks at startup.
- Never introduce a second writer to page content. If a feature needs to mutate a document, route it through `collaboration.util.ts` / `yjs.util.ts`.
- Add new environment variables as `EnvironmentService` getters plus `.env.example` entries; client-visible ones must also be added to the allowlist in `apps/client/vite.config.ts`.
- Prefer duplicating a type across client/server over creating a new shared package. Only `packages/editor-ext` and `packages/base-formula` are legitimately shared.
- Assume Redis is required, not a cache. Do not design a "degrade gracefully without Redis" path unless you also fix queues, websockets, and collab.
- Check `pnpm-workspace.yaml` `overrides` and `minimumReleaseAge` before proposing a dependency.
- Prefer async factory modules (`forRootAsync`) for anything whose behavior depends on configuration at bootstrap.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md)
- Contributor/agent guide: root [AGENTS.md](../../AGENTS.md) (note: its "Repository map" and npm-based tips are stale — prefer `.context/docs`)
- Project README: root [README.md](../../README.md); upstream docs at <https://docmost.com/docs>
- Semantic snapshot: `context({ action: "getMap", section: "all" })`, cached under `.context/cache/semantic/`

## Repository Starting Points

- `apps/server/src/` — NestJS API: `core/` (17 domain modules), `ee/` (11 enterprise modules), `integrations/` (16 external-system modules), `database/`, `collaboration/`, `ws/`, `common/`
- `apps/client/src/` — React SPA: `features/` (domain-first), `ee/` (enterprise mirror), `pages/`, `components/`, `lib/`
- `packages/editor-ext/` — shared Tiptap/ProseMirror schema and docx serializer; changes here ripple to both apps
- `packages/base-formula/` — self-contained formula pipeline for EE Bases
- `packages/ee/` — enterprise license text (the licensing boundary this agent must respect)
- `.github/` — `workflows/release.yml` and `infra/` Portainer stacks
- `scripts/` — GHCR build/push and Portainer deploy; the deployment topology in code form

## Key Files

- [apps/server/src/main.ts](../../apps/server/src/main.ts) — bootstrap, global prefix and exclusions, hooks, frame headers, tenant `preHandler`
- [apps/server/src/app.module.ts](../../apps/server/src/app.module.ts) — the whole module graph, including the dynamic EE load at line 36
- [apps/server/src/core/core.module.ts](../../apps/server/src/core/core.module.ts) — domain aggregate and middleware wiring with its excluded-routes allowlist
- [apps/server/src/ee/ee.module.ts](../../apps/server/src/ee/ee.module.ts) — enterprise aggregate
- [apps/server/src/database/database.module.ts](../../apps/server/src/database/database.module.ts) — Kysely wiring and repo providers
- [apps/server/src/collaboration/collaboration.module.ts](../../apps/server/src/collaboration/collaboration.module.ts) and `collaboration/server/collab-main.ts` — the only optional second process
- [apps/server/src/ws/ws.gateway.ts](../../apps/server/src/ws/ws.gateway.ts) and `ws/adapter/ws-redis.adapter.ts` — realtime scaling
- [apps/server/src/integrations/queue/constants/queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts) — the 12 queues and their jobs
- [apps/server/src/integrations/environment/environment.service.ts](../../apps/server/src/integrations/environment/environment.service.ts) — every configuration switch
- [apps/client/src/App.tsx](../../apps/client/src/App.tsx) and [apps/client/src/lib/api-client.ts](../../apps/client/src/lib/api-client.ts) — client routing and the single HTTP entry
- Root `package.json`, `nx.json`, `pnpm-workspace.yaml`, `Dockerfile`, `docker-compose.yml` — build and deploy contract

## Architecture Context

- **Transport** — `apps/server/src/main.ts`, `common/{interceptors,guards,decorators,middlewares}`. Key exports: `TransformHttpResponseInterceptor`, `JwtAuthGuard`, `DomainMiddleware`, `AuditContextMiddleware`, `resolveFrameHeader`.
- **Domain (core)** — 17 modules under `core/`, each `*.controller.ts` + `services/` + `dto/`. Largest surface: `core/page` (controller ~21 KB, plus `services/`, `page-access/`, `transclusion/`).
- **Domain (enterprise)** — 11 modules under `ee/`: `ai`, `ai-chat`, `api-key`, `audit`, `base`, `mcp`, `mfa`, `page-verification`, `scim`, `security`, `template`.
- **Persistence** — `database/repos/*` (18 aggregates), `database/migrations/` (54 files), generated `database/types/db.d.ts`, `database/pagination/`, `database/listeners/`.
- **Integrations** — 16 modules; the driver-strategy ones are `storage` (local/S3/Azure), `mail` (SMTP/Postmark), `ee/ai/providers` (OpenAI/Google/compatible/Ollama), search (Postgres FTS/Typesense), vector (pgvector/Turbopuffer).
- **Realtime** — `collaboration/` (Hocuspocus + Yjs, four extensions incl. `redis-sync`) and `ws/` (socket.io rooms per space/user).
- **Client** — ~957 files; `features/<domain>/{components,queries,services,types,atoms,hooks}` repeated ~22 times, mirrored by ~25 `ee/` features.

## Key Symbols for This Agent

- `AppModule` — [app.module.ts:114](../../apps/server/src/app.module.ts#L114)
- `CoreModule` — [core.module.ts:51](../../apps/server/src/core/core.module.ts#L51)
- `EeModule` — [ee.module.ts:29](../../apps/server/src/ee/ee.module.ts#L29)
- `DatabaseModule` — [database.module.ts:125](../../apps/server/src/database/database.module.ts#L125)
- `CollaborationGateway` — [collaboration.gateway.ts:31](../../apps/server/src/collaboration/collaboration.gateway.ts#L31)
- `WsGateway` / `WsRedisIoAdapter` — [ws.gateway.ts:24](../../apps/server/src/ws/ws.gateway.ts#L24), `ws/adapter/ws-redis.adapter.ts:11`
- `StorageService` / `MailService` — the canonical driver facades
- `OutboundUrlGuard` / `OutboundAgentFactory` — the egress boundary
- `SpaceAbilityFactory`, `ISpaceAbility`, `IWorkspaceAbility` — the authorization contracts
- `QueueName` / `QueueJob` — the async contract between modules
- `Feature` / `FeatureKey` — [common/features.ts](../../apps/server/src/common/features.ts), the EE capability keys

## Documentation Touchpoints

- [architecture.md](../docs/architecture.md) — the document this agent owns; update patterns, boundaries, and trade-offs here
- [data-flow.md](../docs/data-flow.md) — update when a new queue, integration, or realtime channel appears
- [project-overview.md](../docs/project-overview.md) — update the stack summary when a framework changes
- [glossary.md](../docs/glossary.md) — add new domain concepts and invariants
- [security.md](../docs/security.md) — update when a boundary or trust assumption moves
- [development-workflow.md](../docs/development-workflow.md) — update review expectations when a new rule is introduced

## Collaboration Checklist

1. Confirm the requirement and its non-functional constraints (tenancy, licensing, scale, upstream mergeability) before proposing a design.
2. Read the semantic snapshot (`getMap`) plus `architecture.md` and `data-flow.md` so the proposal reflects the current graph, not a remembered one.
3. Identify the affected layer(s) and name the existing chokepoint you will reuse; justify explicitly if you must add one.
4. Verify the core↔`ee` direction and the licensing placement of every new file.
5. Specify the data-access plan: which repo, which migration, and the `migration:codegen` step.
6. Specify the write path for any page-content change (REST vs Yjs) and the queue jobs triggered.
7. List new environment variables with their `EnvironmentService` getters, `.env.example` entries, and — if client-visible — the `vite.config.ts` allowlist addition.
8. State the verification plan (which specs, which manual flows, whether `docker compose up --build` is needed) and hand it to the implementing agent.
9. Review the implementation against the plan before Verify; check imports, not just behavior.
10. Update `architecture.md` and the other affected docs, then capture the decision and its rejected alternatives.

## Hand-off Notes

When handing off, state: the chosen layer and module, the files to create versus modify, the dependency direction being relied on, the migration and codegen steps, the queue/realtime side effects, the new configuration surface, and the explicit list of invariants the implementer must not break (tenant scoping, `core`↛`ee`, single content writer, envelope/`@SkipTransform()` pairing, guarded egress). Flag any part of the design that increases future upstream-merge conflict risk, and note anything deferred — especially unverified scaling assumptions and untested failure modes, since CI runs no tests.
