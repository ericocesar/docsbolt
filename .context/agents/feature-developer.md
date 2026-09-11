---
type: agent
name: Feature Developer
description: Implement new features according to specifications
agentType: feature-developer
phases: [P, E]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Deliver end-to-end features across `apps/server` and `apps/client` — the full slice from migration and repository through service, controller, DTO, client service, query hook, component, and i18n copy. Engage this agent when a feature spans both halves of the stack. The repository is strongly patterned, so the job is mostly *following the existing seam correctly* rather than inventing structure; the recent auto-subpages feature (eight small commits from client types through `SpaceRepo.updatePagesSettings` to the page-creation hook) is the canonical shape of a full-slice change here.

## Responsibilities

- Translate a specification into a concrete file plan across both apps before writing code.
- Implement the server slice: migration → `db.d.ts` regeneration → repo method → service rule → DTO → controller route with guards and ability checks.
- Implement the client slice: types → service function → query hook → component → route/settings placement → i18n keys.
- Wire side effects as BullMQ jobs and realtime broadcasts rather than inline request work.
- Gate enterprise functionality on `Feature` keys plus `ee/entitlement`, and keep the community path working.
- Add specs (`*.spec.ts` server, `*.test.ts(x)` client) for the logic introduced.
- Update `.context/docs` and `.env.example` when the feature changes vocabulary or configuration.

## Best Practices

- **Read the nearest analogous feature first.** Copy its folder shape, naming, and layering; a feature that looks different will be asked to look the same.
- **Slice vertically, commit granularly.** The repo's history is many small Conventional Commits per feature (`feat(client): add X component`, `feat(server): add Y to DTO`, `feat(server): handle Y in service`), which keeps upstream merges tractable.
- **Client types are duplicated, not imported.** Read the server DTO to write the client type; don't guess field names.
- **Never skip the ability check.** New page/space operations go through `SpaceAbilityFactory` / `PageAccessService`, not a role comparison.
- **Every query takes `workspaceId`.** Repos are where tenant filters live; keep them there.
- **Declare every request field on the DTO** — `whitelist: true` in the global `ValidationPipe` strips anything undeclared, which presents as a mysterious frontend bug.
- **Page content is CRDT-owned.** Any feature that writes document content must go through `collaboration.util.ts` / `yjs.util.ts`.
- **New config = `EnvironmentService` getter + `.env.example`**, and for client-visible values also the `define` allowlist in `apps/client/vite.config.ts`.
- **`core` never imports `ee`** (server) and `features/` never imports `ee/` (client).
- **Localize as you go.** Adding English strings and "doing i18n later" does not happen.
- **Verify what tests can't.** Collaboration, uploads, exports, and SSO have no automated coverage; exercise them and say so.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md) — `feature-breakdown` and `api-design` are the relevant ones
- Contributor guide: root [AGENTS.md](../../AGENTS.md)
- Semantic snapshot: `context({ action: "getMap", section: "navigation" })`

## Repository Starting Points

- `apps/server/src/core/<domain>/` — controller + `services/` + `dto/`; 17 domains to pattern-match against
- `apps/server/src/ee/<domain>/` — the enterprise equivalents
- `apps/server/src/database/{repos,migrations}/` — the persistence slice
- `apps/server/src/integrations/queue/` — where side effects belong
- `apps/client/src/features/<domain>/` — `components/`, `queries/`, `services/`, `types/`, `atoms/`, `hooks/`
- `apps/client/src/pages/` and `apps/client/src/App.tsx` — where a new screen becomes reachable
- `apps/client/src/ee/<domain>/` — enterprise UI mirror
- `packages/editor-ext/src/lib/` — when the feature adds editor behavior

## Key Files

- [apps/server/src/core/page/page.controller.ts](../../apps/server/src/core/page/page.controller.ts) — the reference controller (guards, decorators, abilities, audit)
- `apps/server/src/core/space/services/space.service.ts` and `database/repos/space/space.repo.ts` — the auto-subpages precedent (`updatePagesSettings`)
- `apps/server/src/core/space/dto/update-space.dto.ts` — how a new settings field enters the API
- [apps/server/src/integrations/queue/constants/queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts) — available jobs to reuse
- [apps/server/src/common/features.ts](../../apps/server/src/common/features.ts) — EE feature keys
- [apps/client/src/lib/api-client.ts](../../apps/client/src/lib/api-client.ts) — the client HTTP entry (and `exemptEndpoints`)
- [apps/client/src/lib/app-route.ts](../../apps/client/src/lib/app-route.ts) and [App.tsx](../../apps/client/src/App.tsx) — routing
- `apps/client/src/features/space/components/` — settings-panel patterns (e.g. `AutoSubpagesToggle`)
- `apps/client/src/features/space/types/` — `ISpacePagesSettings`, the client mirror of the server DTO
- `apps/server/src/test-utils/mock-providers.ts` — required for most new server specs
- `.env.example` — the configuration contract

## Architecture Context

- **Server layering** — controller (auth + ability + delegate) → service (rules) → repo (SQL); cross-cutting concerns arrive via `common/` decorators, guards, and interceptors.
- **Client layering** — component → query hook → service → axios; Jotai for local UI state only.
- **Async** — 12 BullMQ queues; page/space lifecycle jobs (`PAGE_CREATED`, `PAGE_CONTENT_UPDATED`, `SPACE_UPDATED`, …) already exist and usually cover a new feature's indexing and notification needs.
- **Realtime** — socket.io rooms per space/user for tree and notification updates; Yjs for document content.
- **Enterprise** — server `ee/` loaded dynamically; client `ee/` gated by entitlement. Both mirror core structure exactly.

## Key Symbols for This Agent

- `PageController`, `PageService`, `PageRepo`, `SpaceService`, `SpaceRepo`
- `SpaceAbilityFactory`, `SpaceCaslAction`, `SpaceCaslSubject`, `PageAccessService`
- `CreatePageDto`, `UpdatePageDto`, `UpdateSpaceDto`, `MovePageDto`, `PaginationOptions`
- `QueueName`, `QueueJob`
- `Feature` / `FeatureKey` (server) and `ee/features.ts` (client)
- `api` + `APP_ROUTE` + `isCloud()` on the client
- `ISpacePagesSettings`, `AutoSubpagesToggle` — the current full-slice exemplar
- `EnvironmentService` — every configuration switch

## Documentation Touchpoints

- [architecture.md](../docs/architecture.md) — where the feature belongs and which boundary it must respect
- [data-flow.md](../docs/data-flow.md) — add new queues, jobs, or integrations here
- [glossary.md](../docs/glossary.md) — add new domain terms and invariants
- [security.md](../docs/security.md) — read before adding auth, sharing, or outbound behavior
- [testing-strategy.md](../docs/testing-strategy.md) — what must be tested and how
- [development-workflow.md](../docs/development-workflow.md) — commit conventions and the pre-push gate

## Collaboration Checklist

1. Restate the specification as acceptance criteria, and list the exact files to add or modify on both sides before coding.
2. Confirm placement: `core` vs `ee`, which domain folder, and whether an existing feature should be extended instead.
3. Do the persistence slice first: migration → `migration:latest` → `migration:codegen` → `entity.types.ts` → repo method.
4. Implement the service rule and the controller route with its DTO, guards, ability check, and audit call.
5. Implement the client slice: type → service → query hook (with invalidations) → component → route/settings placement.
6. Move every side effect to a queue job or realtime broadcast; do not extend the request path.
7. Localize all copy and add the i18n keys.
8. Add server and client tests, including a case for each acceptance criterion.
9. Run `pnpm --filter server test`, `pnpm --filter client test`, both `lint` scripts, and `pnpm build`.
10. Verify manually in the browser (including an unauthenticated or two-tab path if relevant), then update `.context/docs` and `.env.example`.

## Hand-off Notes

Report the slice as a list: migration name, repo methods, service rules, routes + DTOs + guards, client services/hooks/components, routes registered, i18n keys, queue jobs, and new configuration. State which acceptance criteria are covered by automated tests and which you verified by hand. Call out anything intentionally left out of scope, any server contract the client inferred rather than confirmed, and any file where a heavy rewrite of upstream code will make the next merge harder. If the feature is enterprise-gated, confirm explicitly that the community path still builds and behaves.
