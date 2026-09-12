---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Development Workflow

Day-to-day work in this repository follows a simple loop: branch from `develop`, run both apps with `pnpm dev`, write a migration if the schema moves, add or update the matching `*.spec.ts` / `*.test.tsx`, run the per-workspace lint and test commands, commit with a Conventional Commit message scoped to `server` / `client` / `migrations` / `docker` / `security`, and merge back. There is no CI test gate — `.github/workflows/release.yml` only builds and publishes images on `v*` tags — so the local checks below *are* the gate.

Two things shape the process more than anything else: this is a **fork** of docmost/docmost that periodically merges upstream, and the runtime depends on **Postgres + Redis being up**. Plan work so upstream-touching files stay easy to merge, and never assume a feature works without Redis.

## Branching & Releases

- **Branches.** `main` is the integration/PR target (`nx.json` sets `affected.defaultBase: main`). `develop` is the active working branch. Upstream syncs land on dedicated branches named `merge/v<version>` (e.g. `merge/v0.96.0`) and are merged into `develop` with `merge:`-prefixed commits.
- **Remotes.** `origin` → this fork; `upstream` → docmost/docmost. Fetch `upstream` before planning a version bump; upstream feature branches (`upstream/fix/*`) are visible and sometimes cherry-picked.
- **Feature work.** Branch off `develop`, keep the change scoped to one concern, open a PR into `main` (per the repo default) or merge to `develop` for fork-local work. Do not commit directly to `main`.
- **Commits.** Conventional Commits with a scope, as in the current history: `feat(server): inject subpages block on page creation when autoSubpages is enabled`, `fix(client): keep tree actions visible while menu is open`, `fix(migrations): rename siem-destinations migration to follow fork execution order`, `build(docker): use --parallel=1 during build to prevent buildkit OOM`, `chore(merge): ...`, `docs(sdd): ...`. Common scopes: `server`, `client`, `migrations`, `docker`, `security`, `mcp`, `merge`, `sdd`.
- **Build commits.** `scripts/build-and-push-ghcr.sh` records image builds as `Build <timestamp> - sha-<short>` commits and writes history into `docs/historico/` (including `docs/historico/latest-tag`). Those are machine-generated — don't hand-edit them.
- **Upstream releases.** The repo version (`0.96.0`) tracks the upstream Docmost version it is merged with; root `package.json`, `apps/server/package.json`, and `apps/client/package.json` all carry it and should move together.
- **Release pipeline.** Pushing a `v*` tag (or running the workflow manually) builds `linux/amd64` + `linux/arm64` images, pushes by digest, assembles a manifest list, and opens a **draft** GitHub release with the image tarballs. Fork deploys instead use `pnpm push` (GHCR) followed by `pnpm deploy:dev` / `pnpm deploy:prod`.

## Local Development

Prerequisites: Node 26.x (matches the `node:26-slim` Docker base), `pnpm@11.25.0`, and reachable PostgreSQL 18 + Redis 8 (the quickest path is the `db` and `redis` services from `docker-compose.yml`).

Install and configure:

```bash
pnpm install
```

```bash
cp .env.example .env
```

Set at minimum `APP_URL`, `APP_SECRET` (≥32 chars), `DATABASE_URL`, `REDIS_URL`. Generate a secret with:

```bash
openssl rand -hex 32
```

Create the database and apply migrations:

```bash
bash scripts/createdb.sh
```

```bash
pnpm --filter server migration:latest
```

Run both apps in watch mode (client + server, colour-tagged via `concurrently`):

```bash
pnpm dev
```

Run them separately when you only need one side:

```bash
pnpm client:dev
```

```bash
pnpm server:dev
```

Other frequently used commands:

```bash
pnpm build
```

```bash
pnpm clean
```

```bash
pnpm email:dev
```

```bash
pnpm collab:dev
```

Database workflow — create a migration, apply it, then regenerate types (never hand-edit `apps/server/src/database/types/db.d.ts`):

```bash
pnpm --filter server migration:create my-change
```

```bash
pnpm --filter server migration:latest && pnpm --filter server migration:codegen
```

Rollback helpers: `migration:down` (one step), `migration:redo`, `migration:reset` (down to `NO_MIGRATIONS` — destructive).

Checks before you push:

```bash
pnpm --filter server test && pnpm --filter client test
```

```bash
pnpm --filter server lint && pnpm --filter client lint
```

```bash
pnpm build
```

Container parity, when a change touches the build or runtime layout:

```bash
docker compose up --build
```

First run: open the Vite URL, complete `/setup` to create the workspace and owner account, then confirm `/api/health` is healthy and that two tabs on the same page show live cursors (that proves Hocuspocus + Redis are wired).

## Code Review Expectations

Before requesting review, the author should be able to answer yes to all of these:

- **Scope** — one concern per PR; upstream-mergeable files changed as little as possible. Fork-specific rewrites of upstream files are the main source of future merge conflicts, so call them out in the description.
- **Boundaries** — no import from `core` into `ee` on the server, no import from `features` into `ee` in reverse on the client. `EeModule` is loaded by runtime `require`, so a bad import only fails at boot in a community build. Reviewers should check this explicitly.
- **Tenancy** — every new query filters by `workspaceId`; every new route is reachable *after* `DomainMiddleware`, or is deliberately added to the excluded-routes allowlist in [main.ts](../../apps/server/src/main.ts) / [core.module.ts](../../apps/server/src/core/core.module.ts).
- **Authorization** — new page/space operations go through `SpaceAbilityFactory` / `PageAccessService`, not ad-hoc role checks.
- **Data access** — SQL only through `database/repos/*`; new columns come with a migration *and* a regenerated `db.d.ts`; migrations are named with the timestamp convention and ordered correctly relative to fork-only migrations (see the `fix(migrations)` precedent).
- **Page content** — writes to page content go through `collaboration.util.ts` / `yjs.util.ts`, never by patching stored JSON directly.
- **Response shape** — download/export endpoints use `@SkipTransform()`; if a new export path is added, the matching entry goes into `exemptEndpoints` in [api-client.ts](../../apps/client/src/lib/api-client.ts).
- **Outbound requests** — any URL derived from user input is built through `OutboundUrlGuard` / `OutboundAgentFactory`.
- **Config** — new environment variables get a getter on `EnvironmentService` and an entry in `.env.example`.
- **API contract** — `docs/guias/openapi-docsplan.json` is a hand-maintained OpenAPI 3.1 document (212 paths); nothing generates it, so an added or changed endpoint must update it in the same change.
- **Tests** — new logic ships with a `*.spec.ts` (server, Jest) or `*.test.ts(x)` (client, Vitest); bug fixes ship with a regression test. See [testing-strategy.md](testing-strategy.md).
- **Client conventions** — API calls live in `features/<domain>/services`, cached through `features/<domain>/queries`; components do not call axios.
- **i18n** — user-facing strings go through `i18next`, not hard-coded literals (translations sync via Crowdin).
- **Commit message** — Conventional Commits with a scope; squash noise before merge.

The root [AGENTS.md](../../AGENTS.md) also carries contributor/agent tips, but note its "Dev environment tips" reference `npm` and a `dist/` bundle that do not match this monorepo, and its "Repository map" is still placeholder text — trust this document and [architecture.md](architecture.md) instead until `AGENTS.md` is rewritten. `AGENTS.md` links a `CONTRIBUTING.md` that does not exist in the repo; upstream contribution guidance lives at <https://docmost.com/docs/self-hosting/development>.

## Onboarding Tasks

Good first tasks, roughly in order of difficulty:

1. **Read-only orientation** — run `context({ action: "getMap", section: "keyFiles" })`, then trace one request end to end: `apps/client/src/features/page/services` → `PageController` → `PageService` → `PageRepo`.
2. **Add a small client-only setting** — follow the `AutoSubpagesToggle` precedent (`feat(client): add AutoSubpagesToggle component` and its sibling commits) to see how a space setting flows from component → types → DTO → service → repo.
3. **Write a missing spec** — pick a service in `apps/server/src/core/*/services` with no `*.spec.ts` and add one; the existing 44 spec files show the mocking style.
4. **Fix an `AGENTS.md` inaccuracy** — replace the placeholder repository map with real directory descriptions; low risk, high value.
5. **Run a full container build** — `docker compose up --build` to understand the memory constraints (`--parallel=1`, `--max-old-space-size=3072`) before you touch build config.

Useful references while onboarding: [project-overview.md](project-overview.md) (stack), [architecture.md](architecture.md) (layers and boundaries), [data-flow.md](data-flow.md) (queues, realtime, integrations), [glossary.md](glossary.md) (domain vocabulary), [tooling.md](tooling.md) (every script), [security.md](security.md) (read before touching auth or outbound calls). Deployment runbook: `.github/infra/doc-deploy.md`.
