---
type: doc
name: tooling
description: Scripts, IDE settings, automation, and developer productivity tips
category: tooling
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Tooling & Productivity Guide

Everything runs through **pnpm workspaces** with **Nx** as the task runner. The root `package.json` holds the commands you use every day; workspace-specific commands (migrations, tests, lint) live in `apps/server/package.json` and `apps/client/package.json` and are invoked with `pnpm --filter <workspace> <script>`. Nx caches `build` and `lint`, and makes `build` depend on `^build` so `packages/editor-ext` and `packages/base-formula` compile before the apps that import them.

The repo ships no editor configuration — no `.vscode/`, no `.editorconfig` — so formatting consistency comes entirely from Prettier + ESLint. Configure your editor to run them, or run the `format` scripts before committing.

## Required Tooling

- **Node 26.x** — matches the `node:26-slim` Docker base. Older majors may build but are untested against the pinned dependency set.
- **pnpm 11.25.0** — pinned via `"packageManager": "pnpm@11.25.0"`. Install with `corepack enable` (or `npm i -g pnpm@11.25.0`). Do **not** use npm or yarn: the repo depends on `pnpm-workspace.yaml` features — `patchedDependencies` (`scimmy@1.3.5` from `patches/`), a large `overrides` block, `shamefullyHoist: true`, `minimumReleaseAge: 4320`, and `allowBuilds` for native packages (`bcrypt`, `@swc/core`, `esbuild`, `@parcel/watcher`, `unrs-resolver`, `core-js`, `msgpackr-extract`, `nx`).
- **Nx 23.1.1** — devDependency; use `pnpm nx <target> <project>` or the root wrappers. Cache lives in `.nx/`.
- **PostgreSQL 18** and **Redis 8** — both required at runtime, not optional. Fastest path is the `db` and `redis` services in `docker-compose.yml`.
- **Docker + Buildx** — for `docker compose up --build` and for release images (multi-arch amd64/arm64).
- **TypeScript 5.9** — comes from the workspace; server builds with `nest build`, client with `tsc && vite build`.
- **Vite 7 / Vitest** (client) and **NestJS CLI 11 / Jest 30** (server) — provided as devDependencies, no global install needed.
- **CLI utilities for deploys** — `scripts/deployportainer.sh` requires `curl`, `jq`, and `python3` on the machine running it.
- **Optional external services** — Gotenberg (`GOTENBERG_URL`) for PDF export, a Draw.io host (`DRAWIO_URL`) for diagrams, Typesense or Turbopuffer for alternative search drivers, an AI provider endpoint for EE AI features.

## Recommended Automation

### Everyday commands (root)

```bash
pnpm dev
```

Runs client and server together via `concurrently`, tagged `frontend`/`backend` in cyan/green. Individual halves: `pnpm client:dev` (Vite), `pnpm server:dev` (`nest start --watch`). The collaboration process runs separately with `pnpm collab:dev`.

```bash
pnpm build
```

`nx run-many -t build` across all workspaces. Targeted builds: `pnpm server:build`, `pnpm client:build`, `pnpm editor-ext:build`.

```bash
pnpm clean
```

Removes `apps/*/dist`, `packages/*/dist`, and `apps/client/node_modules/.vite`. Reach for this when a stale bundle or Vite cache produces impossible errors.

```bash
pnpm email:dev
```

React Email preview server on port 5019 for the templates in `apps/server/src/integrations/transactional/emails` — edit and see the rendered mail without sending anything.

### Database automation (server workspace)

```bash
pnpm --filter server migration:create my-change
```

Creates a timestamped file in `apps/server/src/database/migrations`. Apply, roll back, or reset with `migration:latest`, `migration:up`, `migration:down`, `migration:redo`, `migration:reset` (the last goes down to `NO_MIGRATIONS` and is destructive).

```bash
pnpm --filter server migration:codegen
```

Regenerates `apps/server/src/database/types/db.d.ts` with `kysely-codegen` (`--dialect=postgres --camel-case --env-file=../../.env`). This file is **generated** — never hand-edit it, and always regenerate after a schema migration so `entity.types.ts` stays truthful.

### Lint and format

```bash
pnpm --filter server lint && pnpm --filter client lint
```

Both run ESLint 9 flat configs with `--fix`. The server config (`apps/server/eslint.config.mjs`) layers `js.configs.recommended` + `typescript-eslint` recommended + `eslint-config-prettier`, with type-aware linting via `projectService: true`. Note that several rules are deliberately **off** — `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `ban-ts-comment`, `no-empty-object-type`, `prefer-rest-params`, `no-useless-catch`, `no-useless-escape` — so the linter will not catch `any` creep or dead variables for you. Review for those manually.

```bash
pnpm --filter server format && pnpm --filter client format
```

Prettier over `src/**/*.ts(x)` and `test/**/*.ts`. Server/package style is `singleQuote: true`, `trailingComma: "all"` (`apps/server/.prettierrc`, `packages/editor-ext/.prettierrc`); the client has no `.prettierrc` and uses Prettier defaults (double quotes), which is why `apps/client` code reads with `"` and `apps/server` with `'`. Match the file you are editing.

### Tests

```bash
pnpm --filter server test && pnpm --filter client test
```

See [testing-strategy.md](testing-strategy.md) for watch mode, coverage, the DB-gated integration specs, and the e2e smoke test.

### Build, publish, deploy

```bash
pnpm push
```

`scripts/build-and-push-ghcr.sh` — builds a `linux/amd64` image, derives the image name from `package.json` (sanitized), pushes to `ghcr.io`, and records build history under `docs/historico/` including `docs/historico/latest-tag`. It also creates the `Build <timestamp> - sha-<short>` commits you see in the log.

```bash
pnpm deploy:dev
```

```bash
pnpm deploy:prod
```

`scripts/deployportainer.sh <env> [tag]` — reads `.github/infra/stack-{dev,prod}.yml` plus `.github/infra/portainer.{dev,prod}.env` (`PORTAINER_URL`, `PORTAINER_API_KEY`, `PORTAINER_ENDPOINT_ID`) and updates the Portainer stack. If no tag is passed, it uses `docs/historico/latest-tag`. Those env files are credential files — never commit real values. Runbook: `.github/infra/doc-deploy.md`.

```bash
bash scripts/createdb.sh
```

Bootstraps the database for a fresh local environment.

### Release automation

Pushing a `v*` tag (or dispatching the workflow) runs `.github/workflows/release.yml`: parallel amd64/arm64 builds with GHA layer caching, push-by-digest, manifest-list assembly, and a **draft** GitHub release with image tarballs. It does **not** run tests or lint — that is why the local gate matters.

### Client build-time configuration

[apps/client/vite.config.ts](../../apps/client/vite.config.ts) reads the repo-root `.env` with `loadEnv` and injects a fixed allowlist into `process.env` at build time: `APP_URL`, `FILE_UPLOAD_SIZE_LIMIT`, `FILE_IMPORT_SIZE_LIMIT`, `DRAWIO_URL`, `CLOUD`, `SUBDOMAIN_HOST`, `COLLAB_URL`, `BILLING_TRIAL_DAYS`, `POSTHOG_HOST`, `POSTHOG_KEY`, `AI_VECTOR_DRIVER`, `BETA_PUBLIC_SPACES`, plus `APP_VERSION` from the package version. **A new client-visible env var must be added to that list**, or it will be `undefined` in the browser regardless of what `.env` says. The same file sets the dev proxies (`/api`, `/socket.io`, `/collab` → `APP_URL`), the `@` → `/src` alias, and a `vendor-mantine` chunk split.

## IDE / Editor Setup

No editor config is committed, so set this up yourself:

- **Format on save with Prettier**, using the workspace Prettier 3 (not a globally installed one). Remember the client/server quote-style difference — let Prettier resolve per directory rather than forcing a single global setting.
- **ESLint flat-config support** must be enabled (ESLint 9). In VS Code that means a recent ESLint extension; point it at `apps/server` and `apps/client` as separate working directories so `projectService` type-aware linting resolves the right `tsconfig`.
- **TypeScript: use the workspace version.** With `shamefullyHoist: true`, the hoisted `node_modules/typescript` is the right one; a mismatched global TS will report phantom errors against `db.d.ts` and Kysely generics.
- **Path aliases** — server code uses `@docmost/db/*`, `@docmost/transactional/*`, `@docmost/ee/*`, `src/*`; client code uses `@/*`. These are declared in the respective `tsconfig.json`, the Jest `moduleNameMapper`, `vite.config.ts`, and `vitest.config.ts`. If an import resolves in your editor but fails in tests, the alias is missing from one of those four places.
- **Useful extensions** — a Mermaid previewer (diagrams in `.context/docs` and page content), a REST client for poking `/api` with the `authToken` cookie, and a Postgres client for inspecting migrations and generated types.
- **Recommended `.vscode/settings.json` starting point** (not committed — add locally if you want it): default formatter Prettier, `editor.formatOnSave: true`, `eslint.useFlatConfig: true`, `typescript.tsdk: "node_modules/typescript/lib"`, and `files.exclude` for `.nx`, `dist`, `.context/cache`.

## Productivity Tips

- **Nx cache is your friend and occasionally your enemy.** `build` and `lint` are cached. When a result looks impossible, rerun with `--skip-nx-cache` or clear `.nx/`.
- **`pnpm --filter` beats `cd`.** `pnpm --filter server <script>` and `pnpm --filter client <script>` work from anywhere in the repo and avoid accidentally running a root script.
- **Reproduce build OOM the way Docker does.** `NODE_OPTIONS=--max-old-space-size=3072 pnpm build --parallel=1` mirrors the Dockerfile; the client bundle is the pressure point (`build(docker): use --parallel=1 during build to prevent buildkit OOM`).
- **Debug the server with a real inspector.** `pnpm --filter server start:debug` (`nest start --debug --watch`); for tests, `pnpm --filter server test:debug` runs Jest under `--inspect-brk --runInBand`.
- **Turn on the diagnostic env flags selectively.** `DEBUG_DB=true` logs SQL, `LOG_HTTP=true` logs requests, `DEBUG_MODE=true` raises verbosity. All three leak sensitive values — local only.
- **Use `mock-providers.ts` instead of fighting Nest DI.** When a spec breaks with "can't resolve dependencies", import the existing mock bank ([apps/server/src/test-utils/mock-providers.ts](../../apps/server/src/test-utils/mock-providers.ts)).
- **Check `overrides` before upgrading anything.** `pnpm-workspace.yaml` pins dozens of transitive versions for security reasons, and `minimumReleaseAge: 4320` (3 days) deliberately blocks brand-new releases. `minimumReleaseAgeExclude` carves out `@tiptap/*`, `fastify`, and `postcss-selector-parser`.
- **`.env` is read from the repo root by everything** — the server, the Vite client config, and `kysely-codegen` (`--env-file=../../.env`). One file, three consumers; keep it in sync with `.env.example`.
- **Editor extension changes need a package rebuild.** After touching `packages/editor-ext`, run `pnpm editor-ext:build` (or a full `pnpm build`) so the client picks up the new `dist`.
- **Bench the formula engine when you touch it.** `packages/base-formula/bench/formula-bench.ts` exists to catch parser/evaluator regressions that tests won't.
- **Keep `.context/` fresh.** Regenerate the semantic snapshot with `context({ action: "getMap", section: "all" })` after significant restructuring; cached snapshots live in `.context/cache/semantic/`.

## Related Resources

- [development-workflow.md](development-workflow.md) — process, branching, and the pre-push checklist
- [testing-strategy.md](testing-strategy.md) — test commands and gates in detail
- [project-overview.md](project-overview.md) — stack summary and getting-started checklist
- [architecture.md](architecture.md) — what each workspace is responsible for
- `.github/infra/doc-deploy.md` — deployment runbook
