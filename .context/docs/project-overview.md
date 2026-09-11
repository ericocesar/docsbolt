---
type: doc
name: project-overview
description: High-level overview of the project, its purpose, and key components
category: overview
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Project Overview

`boltplan` is a self-hosted, real-time collaborative wiki and documentation platform — a fork of [Docmost](https://docmost.com) (upstream is tracked as the `upstream` git remote, currently synced to `v0.96.0`). Teams get spaces, nested pages, a rich block editor with concurrent editing, comments, permissions, search, and public documentation portals, all from a single Docker container plus Postgres and Redis.

The fork adds its own branding ("BoltPlan"), sidebar/typography changes, an MCP server for AI agents, and a deploy pipeline targeting Portainer stacks. Enterprise capabilities (AI chat, Bases, SSO/SCIM, MFA, audit/SIEM, page permissions, templates, API keys) live in separately licensed `ee/` trees.

## Codebase Reference

> The generated semantic snapshot is the fastest way to orient. Run `context({ action: "getMap", section: "all" })` for stack, architecture layers, structure, dependency hotspots, key files, and navigation hints. Section-scoped reads (`section: "stack"`, `"keyFiles"`, `"architecture"`) are cheaper and refresh on read. Cached snapshots live in `.context/cache/semantic/`.

## Quick Facts

- **Root**: `/Users/ericocesar/Mac.local/boltdev/1main/docsbolt` (git branch `develop`; PRs target `main`)
- **Package name / version**: `boltplan` `0.96.0` (private, not published)
- **Primary language**: TypeScript (with JavaScript config files); React 19 on the client, Node on the server
- **Repo type**: monorepo — pnpm workspaces (`apps/*`, `packages/*`) orchestrated by Nx 23
- **Package manager**: `pnpm@11.25.0` (enforced via `packageManager`); `shamefullyHoist: true`
- **Backend**: NestJS 11 on Fastify, Kysely + PostgreSQL, Redis, BullMQ, Hocuspocus/Yjs
- **Frontend**: Vite + React 19 + Mantine 9 + TanStack Query + Jotai + Tiptap 3
- **Infra**: `Dockerfile` (multi-stage, Node 26 slim), `docker-compose.yml` (app + Postgres 18 + Redis 8), Portainer stacks in `.github/infra/`
- **Licensing**: AGPL-3.0 core; `apps/server/src/ee`, `apps/client/src/ee`, `packages/ee` under the Docmost Enterprise license

## Entry Points

- [apps/server/src/main.ts:21](../../apps/server/src/main.ts#L21) — `bootstrap()`; the API + SPA host (default `PORT=3000`, `HOST=0.0.0.0`)
- [apps/server/src/app.module.ts:114](../../apps/server/src/app.module.ts#L114) — `AppModule`, the root module graph
- [apps/server/src/collaboration/server/collab-main.ts](../../apps/server/src/collaboration/server/collab-main.ts) — standalone collaboration process (`pnpm collab` / `pnpm collab:dev`)
- [apps/server/src/database/migrate.ts](../../apps/server/src/database/migrate.ts) — Kysely migration CLI
- [apps/client/src/main.tsx](../../apps/client/src/main.tsx) — SPA bootstrap (providers, i18n, theme)
- [apps/client/src/App.tsx](../../apps/client/src/App.tsx) — route table
- [packages/editor-ext/src/index.ts](../../packages/editor-ext/src/index.ts) — shared Tiptap/ProseMirror extensions
- `packages/base-formula/src/index.server.ts` and `index.client.ts` — dual entry points for the formula engine
- `scripts/build-and-push-ghcr.sh`, `scripts/deployportainer.sh`, `scripts/createdb.sh` — operational entry points

## Key Exports

Rather than a flat symbol dump (the snapshot lists 2400+ exports), the meaningful public surfaces are:

- **HTTP API** — described by the hand-maintained OpenAPI 3.1 document `docs/guias/openapi-boltplan.json` (212 paths; not generated, so verify against the code). Everything lives under `/api`, assembled from `core/*` and `ee/*` controllers (e.g. `PageController` → `/api/pages/*`, `SpaceController` → `/api/spaces/*`, `AuthController` → `/api/auth/*`). Unprefixed public routes: `robots.txt`, `share/:shareId/p/:pageSlug`, `docs`, `docs/:spaceSlug`, `docs/:spaceSlug/:pageSlug`, `mcp`, `.well-known/oauth-*`.
- **Module aggregates** — `AppModule`, `CoreModule`, `EeModule`, `DatabaseModule`, `CollaborationModule`, `WsModule`, `QueueModule`.
- **Repositories** — one per aggregate in `apps/server/src/database/repos/*` (`PageRepo`, `SpaceRepo`, `UserRepo`, `WorkspaceRepo`, `CommentRepo`, `AttachmentRepo`, `ShareRepo`, `LabelRepo`, `WatcherRepo`, `TemplateRepo`, …). These are the only sanctioned way to reach Postgres.
- **Entity types** — `apps/server/src/database/types/entity.types.ts` re-exports `Selectable`/`Insertable`/`Updateable` views over the generated `db.d.ts` tables.
- **Websocket surfaces** — `CollaborationGateway` (Yjs) and `WsGateway` (socket.io rooms per space/user).
- **Client services** — `apps/client/src/features/<domain>/services/*-service.ts` wrap every API call; components never call axios directly.
- **Editor extensions** — `packages/editor-ext` exports node/mark extensions (`Excalidraw`, `Drawio`, `Embed`, `Video`, `Audio`, `Callout`, `Details`, `Math`, `Transclusion`, `Subpages`, table system) plus the docx serializer.
- **Formula engine** — `tokenize`, `parseRaw`, `resolve`, `typecheck`, `evaluate`, `format` from `packages/base-formula`.

## File Structure & Code Organization

- `apps/client/` — React SPA (~957 files under `src`)
  - `src/features/<domain>/` — the unit of organization: `components/`, `queries/`, `services/`, `types/`, `atoms/`, `hooks/`
  - `src/ee/<domain>/` — enterprise features, same internal shape, entitlement-gated
  - `src/pages/` — route-level screens (`auth`, `dashboard`, `page`, `space`, `spaces`, `settings/*`, `share`, `public-space`, `label`, `favorites`)
  - `src/components/` — shared UI (`ui/`, `layouts/`, `settings/`, `icons/`), `src/lib/` — axios client, routes, config, utils
- `apps/server/` — NestJS API (~505 files under `src`)
  - `src/core/` — 17 domain modules (page, space, user, workspace, auth, casl, comment, attachment, share, public-space, label, notification, watcher, favorite, group, search, session)
  - `src/ee/` — enterprise modules (ai, ai-chat, api-key, audit, base, mcp, mfa, page-verification, scim, security, template)
  - `src/database/` — `repos/`, `migrations/` (54), generated `types/db.d.ts`, `pagination/`, `listeners/`
  - `src/integrations/` — storage, mail, queue, redis, export, import, security, outbound, encryption, environment, audit, telemetry, throttle, static, health, transactional (react-email)
  - `src/collaboration/` — Hocuspocus server, extensions, history processor; `src/ws/` — socket.io gateway
  - `src/common/` — guards, decorators, interceptors, middlewares, helpers, validators, logger
- `packages/editor-ext/` — shared Tiptap extensions and docx serialization (~129 files)
- `packages/base-formula/` — formula tokenizer → parser → typechecker → evaluator, plus benchmarks (~20 files)
- `packages/ee/` — enterprise license text (referenced by `README.md`)
- `docs/` — product and process documentation, including `docs/historico/`
- `scripts/` — GHCR build/push, Portainer deploy, DB bootstrap
- `.github/` — `workflows/release.yml` and `infra/` (Portainer stack + env files)
- `.context/` — this AI context scaffolding; `patches/` — pnpm patches (`scimmy@1.3.5`)

## Technology Stack Summary

Runtime is Node (the Docker base image is `node:26-slim`); everything is TypeScript 5.9 compiled two different ways — `nest build` (tsc) for the server, `tsc && vite build` for the client. Nx 23 provides the task graph and caching (`build` depends on `^build`, `build` and `lint` are cached; `nx.json` sets `affected.defaultBase: main`). pnpm workspaces resolve the three internal packages through `workspace:*`.

Quality tooling: ESLint 9 (flat config, `typescript-eslint`) plus Prettier 3 on both apps — `pnpm --filter server lint`, `pnpm --filter client lint`, and `format` scripts per app. Tests use Jest 30 + ts-jest on the server (`*.spec.ts`, `rootDir: src`) and Vitest on the client (`*.test.ts(x)`). There is no repo-wide test or lint task in the root `package.json`; run them per workspace.

Containerization: a three-stage `Dockerfile` (base → builder → installer) that builds with `--parallel=1` and `--max-old-space-size=3072`, then reinstalls production-only dependencies as the `node` user. `docker-compose.yml` is the reference self-host topology.

## Core Framework Stack

- **Backend** — NestJS 11 with `@nestjs/platform-fastify`; `@nestjs/config`, `@nestjs/schedule`, `@nestjs/event-emitter`, `@nestjs/terminus` (health), `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`, `nestjs-pino` (logging), `nestjs-cls` (request context), `nestjs-kysely` (DB), `@nestjs/bullmq` (queues), `@nestjs/cache-manager` + `@keyv/redis`.
- **Data** — Kysely 0.28 query builder over `postgres`/`kysely-postgres-js`; migrations via `kysely-migration-cli`; types via `kysely-codegen`; `pgvector` for embeddings; `pg-tsquery` for full-text search; optional `typesense` and `@turbopuffer/turbopuffer` search drivers.
- **Realtime** — `@hocuspocus/server` + `yjs` + `y-prosemirror` for document CRDT; `socket.io` (+ `@socket.io/redis-adapter`) for tree/presence/notifications.
- **Frontend** — React 19, Vite, `@tanstack/react-query` (server state), `jotai` (client state), `react-router` via `App.tsx`, `i18next` (10+ locales, Crowdin-managed via `crowdin.yml`).
- **Editor** — Tiptap 3 / ProseMirror with `@tiptap/extension-collaboration`, plus Excalidraw, Draw.io, Mermaid, KaTeX, highlight.js/lowlight.
- **AI (EE)** — Vercel `ai` SDK with `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`, `ai-sdk-ollama`; `@langchain/textsplitters`; `@modelcontextprotocol/sdk` for the MCP server.
- **Auth** — `@nestjs/jwt` + `passport-jwt`, `bcrypt`, `otplib`/`otpauth` (MFA), `@node-saml/passport-saml`, `openid-client`, `ldapts`, `scimmy`, `@jmondi/oauth2-server`.

## UI & Interaction Libraries

Mantine 9 is the design system (`@mantine/core`, `dates`, `form`, `hooks`, `modals`, `notifications`, `spotlight`), themed in [apps/client/src/theme.ts](../../apps/client/src/theme.ts). Icons come from `@tabler/icons-react`; fonts are self-hosted via `@fontsource-variable/{inter,inter-tight,roboto-condensed}` (the fork uses Roboto Condensed for the sidebar and menus). Drag-and-drop for the page tree uses the Atlaskit `pragmatic-drag-and-drop` family; tables and long lists use `@tanstack/react-table` and `@tanstack/react-virtual`. Emoji picking is `@slidoapp/emoji-mart`. Localization runs through `i18next` + `i18next-http-backend`, with strings synced through Crowdin.

## Development Tools Overview

Day-to-day commands live in the root `package.json`: `pnpm dev` (concurrently runs client and server in watch mode), `pnpm client:dev`, `pnpm server:dev`, `pnpm build`, `pnpm clean`, `pnpm email:dev` (react-email preview on port 5019), and the deploy wrappers `pnpm push`, `pnpm deploy:dev`, `pnpm deploy:prod`. Database work happens in the server workspace: `pnpm --filter server migration:create|up|down|latest|reset|codegen`. See [tooling.md](tooling.md) for the full inventory and [development-workflow.md](development-workflow.md) for the process.

## Getting Started Checklist

1. Install prerequisites: Node 26.x (matching the Docker base image), `pnpm@11.25.0`, Docker (for Postgres/Redis), and a running PostgreSQL 18 + Redis 8.
2. `pnpm install` at the repo root — pnpm applies the `patches/` and honors the `overrides` block in `pnpm-workspace.yaml`.
3. `cp .env.example .env`, then set `APP_URL`, `APP_SECRET` (≥32 chars, `openssl rand -hex 32`), `DATABASE_URL`, and `REDIS_URL`.
4. Create the database if needed (`bash scripts/createdb.sh`) and apply migrations: `pnpm --filter server migration:latest`.
5. Start both apps: `pnpm dev`. The client dev server proxies `/api` to the NestJS process; open the printed Vite URL.
6. Complete first-run setup at `/setup` (`POST /api/auth/setup`) to create the initial workspace, owner account, and default space.
7. Verify: `GET /api/health` returns healthy, a page opens in the editor, and two browser tabs on the same page show live cursors (confirms Hocuspocus + Redis).
8. Run the checks you will need before shipping: `pnpm --filter server test`, `pnpm --filter client test`, `pnpm --filter server lint`, `pnpm build`.
9. Read [architecture.md](architecture.md) and [glossary.md](glossary.md) before your first change; read [security.md](security.md) before touching auth, tenancy, or outbound requests.

## Next Steps

This is a fork, so two upstream relationships matter: `origin` (this fork) and `upstream` (docmost/docmost). Merge plans for upstream syncs are tracked as `docs/` documents and commits prefixed `merge:`/`docs(sdd):`. Product docs and the event-charter documents in `docs/` are the business-side reference; `AGENTS.md` is the contributor-facing agent guide and currently carries stale placeholder text in its "Repository map" section — prefer this file and [architecture.md](architecture.md) until it is rewritten. External product documentation lives at <https://docmost.com/docs>.
