---
type: doc
name: glossary
description: Project terminology, type definitions, domain entities, and business rules
category: glossary
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Glossary & Domain Concepts

The product vocabulary is a wiki hierarchy: a **workspace** (the tenant) contains **spaces**, a space contains a tree of **pages**, and a page holds block content edited collaboratively. Around that spine sit comments, labels, attachments, favorites, watchers, shares, and public spaces; enterprise features add bases, templates, verifications, page-level permissions, AI chat, audit, and machine access (API keys, OAuth, MCP, SCIM).

Naming is consistent across the stack: the database table (`pages`), the generated Kysely type (`Pages` in `apps/server/src/database/types/db.d.ts`), the domain type (`Page` in `entity.types.ts`), the repository (`PageRepo`), the server module (`apps/server/src/core/page`), and the client feature (`apps/client/src/features/page`) all refer to the same concept. When in doubt, start from the entity type and follow the name.

## Type Definitions

Domain types are thin Kysely views over generated table types, all in [apps/server/src/database/types/entity.types.ts](../../apps/server/src/database/types/entity.types.ts). For each entity `X` the file exports `X` (`Selectable`), usually `InsertableX` (`Insertable`), and `UpdatableX` (`Updateable<Omit<…, 'id'>>`).

- **Tenancy & identity** — `Workspace`, `WorkspaceInvitation`, `User`, `UserSession`, `UserToken`, `UserMFA`, `AuthProvider`, `AuthAccount`, `Group`, `GroupUser`
- **Content** — `Space`, `SpaceMember`, `Page`, `PageHistory`, `Comment`, `Attachment`, `Backlink`, `Label`, `PageLabel`, `Favorite`, `Watcher`, `PageTransclusion`, `PageTransclusionReference`
- **Sharing** — `Share`, `PublicSpace`
- **Access control** — `PageAccess`, `PagePermission` (EE)
- **Enterprise** — `Template`, `PageVerification`, `PageVerifier`, `BaseProperty`, `BaseRow`, `BaseView`, `AiChat`, `AiChatMessage`, `PageEmbedding`, `Audit`, `SiemDestination`, `ApiKey`, `ScimToken`, `OAuthClient`, `OAuthGrant`, `OAuthAuthorizationCode`, `OAuthToken`, `Billing`
- **Operational** — `FileTask`, `Notification`

Supporting types elsewhere:

- `JwtPayload`, `JwtCollabPayload`, `JwtExchangePayload`, `JwtAttachmentPayload`, `JwtMfaTokenPayload`, `JwtApiKeyPayload`, `JwtPdfRenderPayload`, `JwtPdfExportDownloadPayload`, `JwtOAuthPayload` — [apps/server/src/core/auth/dto/jwt-payload.ts](../../apps/server/src/core/auth/dto/jwt-payload.ts)
- `ISpaceAbility` — [apps/server/src/core/casl/interfaces/space-ability.type.ts](../../apps/server/src/core/casl/interfaces/space-ability.type.ts); `IWorkspaceAbility` — [apps/server/src/core/casl/interfaces/workspace-ability.type.ts](../../apps/server/src/core/casl/interfaces/workspace-ability.type.ts)
- `AuditContext` — [apps/server/src/common/middlewares/audit-context.middleware.ts](../../apps/server/src/common/middlewares/audit-context.middleware.ts)
- `PaginationOptions` — `apps/server/src/database/pagination/pagination-options.ts`
- `IAttachment`, `IEmbedProvider`, `IEmbedResult`, `MediaUploadOptions`, `MentionNodeAttrs`, `ExcalidrawAttributes`, `DrawioAttributes`, `TransclusionSourceAttributes`, `SubpagesAttributes` — `packages/editor-ext/src/lib/*`
- `ApiResponse`, `QueryParams`, `IRoleData` — [apps/client/src/lib/types.ts](../../apps/client/src/lib/types.ts)
- `ISpacePagesSettings` — `apps/client/src/features/space/types` (fork addition backing the auto-subpages toggle)

## Enumerations

| Enum | Values | Location |
|------|--------|----------|
| `UserRole` | `owner`, `admin`, `member` | [common/helpers/types/permission.ts](../../apps/server/src/common/helpers/types/permission.ts) |
| `InviteUserRole` | `admin`, `member` | same file |
| `SpaceRole` | `admin`, `writer`, `reader` | same file |
| `SpaceVisibility` | `open`, `private` | same file |
| `PageAccessLevel` | `restricted` | same file |
| `PagePermissionRole` | `reader`, `writer` | same file |
| `SpaceCaslAction` | `manage`, `create`, `read`, `edit`, `delete` | [core/casl/interfaces/space-ability.type.ts](../../apps/server/src/core/casl/interfaces/space-ability.type.ts) |
| `SpaceCaslSubject` | `settings`, `member`, `page`, `share` | same file |
| `WorkspaceCaslAction` | `manage`, `create`, `read`, `edit`, `delete` | [core/casl/interfaces/workspace-ability.type.ts](../../apps/server/src/core/casl/interfaces/workspace-ability.type.ts) |
| `WorkspaceCaslSubject` | `settings`, `member`, `space`, `group`, `attachment`, `api_key`, `audit` | same file |
| `WorkspaceStatus` | `active`, `suspended` | [core/workspace/workspace.constants.ts](../../apps/server/src/core/workspace/workspace.constants.ts) |
| `JwtType` | `access`, `collab`, `exchange`, `attachment`, `mfa_token`, `api_key`, `pdf_render`, `pdf_export_download`, `oauth_access` | [core/auth/dto/jwt-payload.ts](../../apps/server/src/core/auth/dto/jwt-payload.ts) |
| `UserTokenType` | `forgot-password`, `email-verification` | [core/auth/auth.constants.ts](../../apps/server/src/core/auth/auth.constants.ts) |
| `DefaultGroup` | default group seed names | [core/group/dto/create-group.dto.ts:30](../../apps/server/src/core/group/dto/create-group.dto.ts#L30) |
| `AttachmentType` | `avatar`, `workspace-icon`, `space-icon`, `file`, `chat` | [core/attachment/attachment.constants.ts](../../apps/server/src/core/attachment/attachment.constants.ts) |
| `StorageOption` | local / S3 / Azure driver keys | [integrations/storage/interfaces/storage.interface.ts](../../apps/server/src/integrations/storage/interfaces/storage.interface.ts) |
| `MailOption` | SMTP / Postmark driver keys | [integrations/mail/interfaces/mail.interface.ts](../../apps/server/src/integrations/mail/interfaces/mail.interface.ts) |
| `ExportFormat` | `html`, `markdown` (server DTO); client adds PDF/DOCX paths | [integrations/export/dto/export-dto.ts:9](../../apps/server/src/integrations/export/dto/export-dto.ts#L9), [client page.types.ts:99](../../apps/client/src/features/page/types/page.types.ts#L99) |
| `ImportFormat` | `html`, `markdown` | [integrations/import/dto/import-dto.ts](../../apps/server/src/integrations/import/dto/import-dto.ts) |
| `FileTaskType` | `import`, `export` | [integrations/import/utils/file.utils.ts:5](../../apps/server/src/integrations/import/utils/file.utils.ts#L5) |
| `FileImportSource` | `generic`, `notion`, `confluence` | [file.utils.ts:10](../../apps/server/src/integrations/import/utils/file.utils.ts#L10) |
| `FileTaskStatus` | `processing`, `success`, `failed` | [file.utils.ts:16](../../apps/server/src/integrations/import/utils/file.utils.ts#L16) |
| `QueueName` | 12 hash-tagged queues (`{email-queue}` … `{siem-queue}`) | [integrations/queue/constants/queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts) |
| `QueueJob` | job names (`send-email`, `import-task`, `search-index-page`, `page-created`, …) | same file |
| `EventName` | in-process event names | [common/events/event.contants.ts](../../apps/server/src/common/events/event.contants.ts) |
| `AuditEvent`, `AuditResource`, `ActorType` | audit taxonomy; `ActorType` is `user` / `system` / `api_key` | [common/events/audit-events.ts](../../apps/server/src/common/events/audit-events.ts) |
| `PageEditMode` | per-user default edit mode | [client user.types.ts:52](../../apps/client/src/features/user/types/user.types.ts#L52) |
| `AvatarIconType`, `AttachmentType` (client) | avatar/icon upload kinds | [client attachment.types.ts:27](../../apps/client/src/features/attachments/types/attachment.types.ts#L27) |
| `AiAction` | AI editor actions (EE) | [client ee/ai/types/ai.types.ts](../../apps/client/src/ee/ai/types/ai.types.ts) |
| `BillingPlan` | subscription plans (EE cloud) | [client ee/billing/types/billing.types.ts](../../apps/client/src/ee/billing/types/billing.types.ts) |
| `SSO_PROVIDER` | SAML / OIDC / Google provider keys (EE) | [client ee/security/contants.ts](../../apps/client/src/ee/security/contants.ts) |
| `TokenKind` | formula tokenizer token kinds | [packages/base-formula/src/tokenizer.ts:4](../../packages/base-formula/src/tokenizer.ts#L4) |

## Core Terms

- **Workspace** — the tenant boundary. Resolved from the request hostname by `DomainMiddleware` and attached as `req.raw.workspaceId`; every `/api` route outside a short allowlist 404s without it. Statuses: `active`, `suspended`. Reserved hostnames are listed in `DISALLOWED_HOSTNAMES` (`core/workspace/workspace.constants.ts`).
- **Space** — a container of pages with its own members and visibility (`open` = any workspace member can find and join; `private` = only added members). Space roles are `admin` / `writer` / `reader`. Code: `core/space`, `features/space`.
- **Personal space** — an EE variant of a space scoped to one user (`apps/client/src/ee/personal-space`, migration `20260620T010047-personal-spaces.ts`).
- **Page** — a node in a space's page tree with block content stored as ProseMirror JSON plus a Yjs state. Ordering uses fractional indexing (`fractional-indexing-jittered`) so concurrent moves don't collide. Code: `core/page`, `features/page` (with `tree/` for the sidebar tree model).
- **Page tree** — the hierarchical sidebar. Client model in `features/page/tree/model/tree-model.ts`; server broadcasts add/move/delete events through `WsGateway` / `ws-tree.service.ts`.
- **Subpages block / auto-subpages** — a fork feature: a space setting (`autoSubpages`, `ISpacePagesSettings`) that injects a subpages block into newly created pages. Editor node in `packages/editor-ext/src/lib/subpages`.
- **Transclusion** — embedding a live region of one page inside another. Source and reference nodes in `packages/editor-ext/src/lib/transclusion`; server side in `core/page/transclusion`, tracked by `PageTransclusion` / `PageTransclusionReference`.
- **Backlink** — a recorded inbound link between pages, produced by the `PAGE_BACKLINKS` job and served by `BacklinkService`.
- **Page history** — a snapshot version of page content, written by `collaboration/processors/history.processor.ts` on the `HISTORY_QUEUE`; browsed and diffed in `features/page-history` (`rfc6902` + `diff` for comparison).
- **Comment** — a threaded discussion anchored to a range in page content; the anchor lives in the document as a comment mark (`packages/editor-ext/src/lib/comment`).
- **Label** — a workspace-level tag applied to pages through the `PageLabel` join; browsable at `/label/:id`.
- **Favorite / Watcher** — per-user bookmarks and per-page subscriptions. Watchers drive `NOTIFICATION_QUEUE` emails and in-app notifications.
- **Attachment** — an uploaded file or image, stored by `StorageService` with a metadata row. Typed by `AttachmentType`; access is granted through short-lived `attachment` JWTs.
- **Share** — a public link to a single page (`/share/:shareId/p/:pageSlug`), unauthenticated and excluded from the `api` prefix.
- **Public space** — a whole space published as a documentation portal under `/docs/:spaceSlug/:pageSlug`. Gated by `BETA_PUBLIC_SPACES`; code in `core/public-space` and `features/public-space`.
- **Page access / page permission** — `PageAccess` marks a page `restricted` (`PageAccessLevel`); EE `PagePermission` rows then grant `reader` / `writer` (`PagePermissionRole`) to specific users or groups. Enforced by `core/page/page-access/page-access.service.ts`.
- **Group** — a named set of users used to grant space membership and page permissions in bulk; default groups are seeded per `DefaultGroup`.
- **Base** — an EE structured-data feature (database/table views over rows): `BaseView`, `BaseProperty`, `BaseRow`, with formulas evaluated by `packages/base-formula` and realtime updates relayed by `ws/base-realtime.bridge.ts`.
- **Template** — an EE reusable page skeleton (`ee/template`, `Templates` table).
- **Page verification** — an EE review/approval workflow marking a page as verified by named verifiers, with optional expiry (`PageVerification`, `PageVerifier`).
- **AI chat / embeddings** — EE retrieval-augmented chat over workspace content; `PageEmbedding` rows (pgvector, migration `20260903T000000-page-embeddings.ts`) are produced on the `AI_QUEUE`, and chats are stored as `AiChat` + `AiChatMessage`.
- **MCP** — Model Context Protocol server on the unprefixed `/mcp` route, letting AI agents call the wiki as tools using an API key or OAuth grant (`ee/mcp`).
- **API key** — a hashed long-lived credential (`ApiKeys`, migration `20260902T211032-api-keys-token-hash.ts`) exchanged for a JWT with `type: api_key`; scopes are declared with `@OAuthScope()`.
- **File task** — a durable record of an import or export job (`FileTask`, `FileTaskType`, `FileTaskStatus`, `FileImportSource`), surfaced in `features/file-task`.
- **Collab token** — a short-lived JWT (`type: collab`) minted at `/api/auth/collab-token` purely to open the Hocuspocus WebSocket.
- **Audit / SIEM destination** — EE audit trail (`Audit` rows, `AuditEvent` / `AuditResource` taxonomy) plus configured external sinks (`SiemDestination`, migration `20260903T120000-siem-destinations.ts`) fed by the `SIEM_QUEUE`.
- **Entitlement** — the client-side gate deciding whether an EE feature is available for the current license/plan (`apps/client/src/ee/entitlement`, `apps/client/src/ee/features.ts`).

## Acronyms & Abbreviations

- **EE** — Enterprise Edition; code under `apps/server/src/ee`, `apps/client/src/ee`, `packages/ee`, licensed separately from the AGPL core.
- **CASL** — the `@casl/ability` authorization library; "ability" = a per-request permission object.
- **CLS** — Continuation-Local Storage (`nestjs-cls`), the request-scoped context holding `AuditContext`.
- **CRDT** — Conflict-free Replicated Data Type; here, Yjs documents backing concurrent editing.
- **Yjs / Hocuspocus** — the CRDT library and its WebSocket server used for collaboration.
- **PM / ProseMirror** — the editor document model behind Tiptap; page content is stored as ProseMirror JSON.
- **DTO** — Data Transfer Object; validated request shapes in `core/*/dto`, enforced by the global `ValidationPipe` with `class-validator`.
- **FTS** — Full-Text Search (Postgres `tsvector` + `pg-tsquery`), the default `SEARCH_DRIVER`.
- **MRL** — Matryoshka Representation Learning, referenced by `AI_EMBEDDING_SUPPORTS_MRL` for truncatable embeddings.
- **MCP** — Model Context Protocol. **SCIM** — System for Cross-domain Identity Management. **SSO** — Single Sign-On (SAML/OIDC/Google/LDAP). **MFA** — Multi-Factor Authentication (TOTP via `otplib`/`otpauth`). **SIEM** — Security Information and Event Management.
- **SSRF** — Server-Side Request Forgery, the class of attack `OutboundUrlGuard` exists to block.
- **PREVC** — the dotcontext workflow phases (Plan → Review → Execute → Verify → Complete) used by `.context/` agents and plans.
- **SDD** — the fork's spec/plan-driven-development documents, committed as `docs(sdd): …`.

## Personas / Actors

- **Workspace owner** (`UserRole.OWNER`) — created by first-run `/setup`; the only role that can delete the workspace. Handles billing (EE cloud), SSO, and global security settings.
- **Workspace admin** (`UserRole.ADMIN`) — everything an owner can do except delete the workspace: members, groups, spaces, API keys, audit.
- **Workspace member** (`UserRole.MEMBER`) — the default. Sees `open` spaces, joins them, creates and edits pages where their space role allows.
- **Space admin / writer / reader** (`SpaceRole`) — per-space layer on top of the workspace role; space membership is what most page operations actually check.
- **Guest / anonymous reader** — no account; reaches content only through a `Share` link or a published public space. These paths deliberately skip authentication and the global frame headers.
- **Machine actor** — an API key or OAuth client (including MCP agents). Recorded in audit as `ActorType.api_key`; scoped with `@OAuthScope()`.
- **System actor** — background jobs and migrations, recorded as `ActorType.system`.
- **SCIM provisioner** — an external IdP creating/deactivating users via `/api/scim` with a `ScimToken`.

Primary workflows: write and co-edit documentation; organize it into spaces and trees; discuss it in comments; find it via search or AI; publish subsets externally; and administer people, permissions, and compliance evidence around all of it.

## Domain Rules & Invariants

- **Every query is workspace-scoped.** Repos take `workspaceId` explicitly. A request that reaches a handler without a resolved workspace is a bug in the route allowlist, not something to work around.
- **Authorization is two-layered.** Workspace ability (`IWorkspaceAbility`) gates administration; space ability (`ISpaceAbility`) gates content. A restricted page adds a third check through `PageAccess` + EE `PagePermission`. Never short-circuit with a raw role comparison.
- **Owners are not deletable tenants.** `UserRole.ADMIN` has owner-equivalent powers *except* workspace deletion — that distinction is intentional and documented inline in `permission.ts`.
- **Yjs owns open-page content.** While a page has connected editors, the CRDT is authoritative; persistence is a debounced snapshot. Writing page content outside `collaboration.util.ts` / `yjs.util.ts` can be silently overwritten.
- **Page ordering is fractional.** Moves compute a jittered fractional index rather than renumbering siblings, so two concurrent moves converge instead of conflicting.
- **Slugs and hostnames are constrained.** Page/space slugs come from `@sindresorhus/slugify` + nanoid suffixes; workspace hostnames are rejected against `DISALLOWED_HOSTNAMES`.
- **Migrations are forward-only and order-sensitive.** Files are timestamp-named in `apps/server/src/database/migrations`; fork-only migrations must be named so they sort correctly against upstream ones (see the `fix(migrations): rename siem-destinations migration to follow fork execution order` precedent). `db.d.ts` is generated, never hand-edited.
- **Tokens are typed and single-purpose.** A `collab` token cannot be used as an `access` token, an `attachment` token is bound to one attachment/page, and PDF tokens are single-flow. Always mint the narrowest `JwtType`.
- **Outbound URLs from user input are guarded.** Embeds, imports, SIEM destinations, and AI base URLs must be built through `OutboundUrlGuard` / `OutboundAgentFactory`.
- **Validation is whitelist-based.** The global `ValidationPipe` uses `whitelist: true` and `stopAtFirstError: true`, so any field not declared on a DTO is stripped — adding a request field means adding it to the DTO.
- **Responses are enveloped by default.** Anything that must return raw bytes or custom headers needs `@SkipTransform()` on the server *and* an entry in `exemptEndpoints` on the client.
- **`core` never imports `ee`.** The community build must boot with `src/ee` deleted; only `CLOUD=true` makes a missing EE tree fatal.
- **Localization is data, not code.** User-facing strings go through `i18next` and sync via Crowdin (`crowdin.yml`); 10+ locales are supported, and date formatting goes through `features`-level `date-locale.ts` rather than ad-hoc formatting.

## Related Resources

- [architecture.md](architecture.md) — where each concept lives in code
- [data-flow.md](data-flow.md) — how these entities move through queues and realtime channels
- [security.md](security.md) — how roles, tokens, and tenancy are enforced
- [project-overview.md](project-overview.md) — stack and entry points
