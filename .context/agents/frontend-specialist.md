---
type: agent
name: Frontend Specialist
description: Design and implement user interfaces
agentType: frontend-specialist
phases: [P, E]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Build and maintain `apps/client` — a React 19 SPA on Vite, styled with Mantine 9, with TanStack Query for server state, Jotai for client state, Tiptap 3 for the editor, and i18next for 10+ locales. Engage this agent for any screen, component, route, editor extension surface, or client-side data-fetching change. The codebase is organized feature-first (`features/<domain>/{components,queries,services,types,atoms,hooks}`) and mirrored under `ee/` for enterprise features; following that shape is expected rather than optional.

## Responsibilities

- Implement components and screens in `apps/client/src/features/<domain>/components` and route-level pages in `apps/client/src/pages`.
- Register routes in [App.tsx](../../apps/client/src/App.tsx) and add path constants to [lib/app-route.ts](../../apps/client/src/lib/app-route.ts).
- Write API callers in `features/<domain>/services/<domain>-service.ts` and wrap them in TanStack Query hooks under `features/<domain>/queries`.
- Model local UI state with Jotai atoms in `features/<domain>/atoms`; keep server data in Query, not in atoms.
- Extend the editor: node views and UI in `features/editor/components/*`, schema/extension logic in `packages/editor-ext`.
- Handle realtime updates from the socket.io feed (`features/websocket`) — notably page-tree mutations and notifications.
- Gate enterprise UI behind `ee/entitlement` and the `Feature` keys in `ee/features.ts`.
- Keep all user-facing strings in i18next resources; never hard-code copy.
- Add Vitest tests for logic-bearing units (models, mappers, resolvers).

## Best Practices

- **Never call axios from a component.** Go through `features/<domain>/services`, then a query hook. The shared instance is [lib/api-client.ts](../../apps/client/src/lib/api-client.ts) and it already unwraps `response.data`.
- **If you add a download/export endpoint**, add its path to `exemptEndpoints` in `api-client.ts` — otherwise the response headers are lost by the unwrapping interceptor.
- **Respect the 401/404 interceptor logic.** `api-client.ts` deliberately skips the login redirect for `/share/*`, `/docs*`, and `/api/auth/collab-token`. Public surfaces must keep working unauthenticated.
- **Client-visible env vars must be added to the allowlist in [vite.config.ts](../../apps/client/vite.config.ts).** A value in `.env` that is not in that `define` list is `undefined` in the browser.
- **Use Mantine primitives and the shared theme** ([theme.ts](../../apps/client/src/theme.ts)) instead of ad-hoc CSS. The fork has specific typography choices (Roboto Condensed for sidebar/menus, Inter elsewhere) — match them.
- **Page tree changes go through the tree model** (`features/page/tree/model/tree-model.ts`) and the drag mappers (`tree/hooks/drop-op-to-move-payload.ts`), both of which have tests. Don't mutate tree state ad hoc.
- **Do not import from `ee/` in core `features/`.** The dependency runs `ee/` → `features/`.
- **Editor content is CRDT-backed.** Do not set document content imperatively outside the collaboration flow; prefer Tiptap commands and extension storage.
- **Client formatting uses Prettier defaults (double quotes)** — there is no `apps/client/.prettierrc`, unlike the server. Match the file you're in.
- **Test the logic, not the pixels.** The existing pattern extracts pure functions and tests those; there is no Vitest setup file, no jest-dom, and no provider harness.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md)
- Contributor guide: root [AGENTS.md](../../AGENTS.md)
- Semantic snapshot: `context({ action: "getMap", section: "structure" })`

## Repository Starting Points

- `apps/client/src/features/` — 22 domains: `attachments`, `auth`, `comment`, `editor`, `favorite`, `file-task`, `group`, `home`, `label`, `notification`, `page`, `page-details`, `page-history`, `public-space`, `search`, `session`, `share`, `space`, `transclusion`, `user`, `websocket`, `workspace`
- `apps/client/src/ee/` — ~25 enterprise features: `ai`, `ai-chat`, `api-key`, `audit`, `base`, `billing`, `cloud`, `comment`, `entitlement`, `licence`, `mfa`, `oauth`, `page-permission`, `page-verification`, `pdf-export`, `personal-space`, `scim`, `security`, `siem`, `template`, plus shared `components/`, `hooks/`, `pages/`
- `apps/client/src/pages/` — `auth`, `dashboard`, `page`, `space`, `spaces`, `favorites`, `label`, `share`, `public-space`, `settings/{account,group,shares,space,workspace}`
- `apps/client/src/components/` — `ui/`, `layouts/global/`, `settings/`, `icons/`
- `apps/client/src/lib/` — `api-client.ts`, `app-route.ts`, `config.ts`, `utils.tsx`, `date-locale.ts`, `types.ts`, `jotai-helper.ts`, `local-emitter.ts`
- `packages/editor-ext/src/lib/` — editor schema: tables, transclusion, subpages, math, callout, details, excalidraw, drawio, embeds, video, audio, pdf, columns, footnotes

## Key Files

- [apps/client/src/main.tsx](../../apps/client/src/main.tsx) — providers, i18n, theme bootstrap
- [apps/client/src/App.tsx](../../apps/client/src/App.tsx) — route table
- [apps/client/src/lib/api-client.ts](../../apps/client/src/lib/api-client.ts) — the single axios instance and its interceptors
- [apps/client/src/lib/app-route.ts](../../apps/client/src/lib/app-route.ts) — route constants used by redirects and guards
- [apps/client/src/lib/config.ts](../../apps/client/src/lib/config.ts) — runtime flags (`isCloud()`, limits, feature betas)
- [apps/client/src/theme.ts](../../apps/client/src/theme.ts) — Mantine theme and typography
- [apps/client/vite.config.ts](../../apps/client/vite.config.ts) — env allowlist, dev proxies (`/api`, `/socket.io`, `/collab`), chunking
- [apps/client/vitest.config.ts](../../apps/client/vitest.config.ts) — jsdom, globals, `@` alias
- `apps/client/src/features/page/tree/model/tree-model.ts` — sidebar tree state (tested)
- `apps/client/src/features/editor/collab-socket.ts` — `acquireCollabSocket`, the collaboration connection
- `apps/client/src/features/websocket/types/types.ts` — realtime event payloads (e.g. `AddTreeNodeEvent`)
- `apps/client/src/ee/features.ts` and `apps/client/src/ee/entitlement/` — enterprise gating
- `apps/client/src/i18n.ts` — i18next setup

## Architecture Context

- **Routing/pages** — `pages/*` are route shells; real UI lives in `features/*/components`. Settings screens are split by scope (`account`, `workspace`, `group`, `space`, `shares`).
- **Data layer** — `services/` (axios calls) → `queries/` (TanStack Query hooks with cache keys) → components. Mutations invalidate query keys rather than mutating local caches by hand.
- **Client state** — Jotai atoms per feature (`features/share/atoms`, `features/page/tree/atoms`, `components/layouts/global/hooks/atoms`, `features/editor/components/search-and-replace/atoms`), with `jotai-optics` for lens-style updates.
- **Editor** — `features/editor/components/*` supplies ~25 node UIs (table handles, bubble menu, slash menu, mention, emoji, excalidraw, drawio, embeds, math, pdf, transclusion, subpages, code-block, callout); schema lives in `packages/editor-ext`.
- **Realtime** — socket.io via `features/websocket`; Yjs via `features/editor/collab-socket.ts` and `@hocuspocus/provider-react`.
- **Enterprise mirror** — every `ee/` feature repeats the same internal folder shape, so a core pattern transfers directly.

## Key Symbols for This Agent

- `api` (default export of `api-client.ts`), `ApiResponse`, `QueryParams`, `IRoleData`
- `APP_ROUTE` (`lib/app-route.ts`), `isCloud()` (`lib/config.ts`)
- `acquireCollabSocket` — `features/editor/collab-socket.ts:23`
- `AddTreeNodeEvent` and siblings — `features/websocket/types/types.ts`
- `PageEditMode`, `AttachmentType`, `AvatarIconType` — client-side enums in `features/*/types`
- `ISpacePagesSettings`, `AutoSubpagesToggle` — the fork's space-settings pattern
- `AiAction`, `BillingPlan`, `SSO_PROVIDER`, `FeatureKey` — EE types
- `addUniqueIdsToDoc`, `IAttachment`, `IEmbedProvider` — from `packages/editor-ext`

## Documentation Touchpoints

- [project-overview.md](../docs/project-overview.md) — UI stack and library inventory
- [architecture.md](../docs/architecture.md) — client layers and the client/server contract
- [data-flow.md](../docs/data-flow.md) — how the SPA reaches the API and realtime channels
- [glossary.md](../docs/glossary.md) — domain vocabulary shown in the UI
- [testing-strategy.md](../docs/testing-strategy.md) — Vitest conventions and their limits
- [tooling.md](../docs/tooling.md) — Vite config, env allowlist, format scripts

## Collaboration Checklist

1. Confirm the UX intent and which feature folder owns it; check whether an `ee/` equivalent already exists.
2. Confirm the API contract with the server DTO (client types are duplicated, not imported — read the server DTO to get it right).
3. Add or extend the service function, then the query hook with a stable cache key and the right invalidations.
4. Build the component with Mantine primitives and the shared theme; route it through `pages/` + `App.tsx` + `app-route.ts` if it is a new screen.
5. Put all copy through i18next; add keys to the locale resources.
6. Gate enterprise UI on `ee/entitlement` / `Feature`, and verify the community path renders sensibly without it.
7. Add Vitest coverage for any non-trivial pure logic; extract it from the component if needed.
8. Run `pnpm --filter client test`, `pnpm --filter client lint`, and `pnpm build` (the client build is also the type-check).
9. Verify in the browser: the happy path, an unauthenticated path if relevant (`/share`, `/docs`), and two-tab behavior if the change touches realtime or the editor.
10. Update the relevant `.context/docs` pages and note any new env var in both `.env.example` and `vite.config.ts`.

## Hand-off Notes

Report: components and screens added, routes registered, services/query hooks introduced with their cache keys, atoms added, i18n keys created, and entitlement gates applied. State explicitly whether you verified in a browser and what you exercised (including two-tab collaboration if relevant), since the client suite is small and CI runs nothing. Call out any change to `api-client.ts` interceptors, `exemptEndpoints`, or the `vite.config.ts` env allowlist — those affect every feature. Note remaining gaps: untested screens, unlocalized strings, and any place where a server contract was inferred rather than confirmed.
