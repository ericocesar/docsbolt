---
type: doc
name: security
description: Security policies, authentication, secrets management, and compliance requirements
category: security
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Security & Compliance Notes

This is a multi-tenant documentation platform that stores customer content, so the guardrails concentrate on four things: **tenant isolation**, **typed short-lived tokens**, **layered authorization**, and **controlled egress**. All four are enforced structurally — by middleware, guards, and factories — rather than by per-endpoint discipline, and the correct instinct when adding a feature is to find the existing chokepoint rather than write a new check.

The security-relevant code is concentrated in `apps/server/src/core/auth`, `apps/server/src/core/casl`, `apps/server/src/common/{guards,decorators,middlewares,helpers}`, `apps/server/src/integrations/{outbound,encryption,security,throttle}`, and — for enterprise controls — `apps/server/src/ee/{security,mfa,scim,api-key,audit}`. The test suite reflects this weighting: the outbound guard, security headers, JWT guard, encryption service, and no-URL validator all have dedicated specs.

Three deliberate holes in the default protections are worth memorizing, because they look like bugs and are not:

- `/share/*` and `/docs/*` are **unauthenticated by design** (public page shares and published spaces) and are skipped by the global frame-header hook in [main.ts](../../apps/server/src/main.ts) so they can be embedded.
- `/api/files/*` sets its **own** CSP, so the global hook skips it too.
- `/api/billing/stripe/webhook`, `/api/auth/setup`, and `/api/health*` bypass tenant resolution and `DomainMiddleware`; the Stripe webhook is therefore responsible for verifying its own signature.

## Authentication & Authorization

### Identity providers

Password auth (`bcrypt` hashes) is the baseline. Enterprise builds add Google OAuth (`passport-google-oauth20`), SAML 2.0 (`@node-saml/passport-saml`, with `SAML_DISABLE_REQUESTED_AUTHN_CONTEXT` for stubborn IdPs), OIDC (`openid-client`), and LDAP (`ldapts`) through `apps/server/src/ee/security`. User lifecycle can be driven externally via SCIM 2.0 (`scimmy`, locally patched in `patches/scimmy@1.3.5.patch`); the server registers an `application/scim+json` content-type parser in `main.ts` specifically for that surface. Provider and linked-account state lives in the `AuthProvider` / `AuthAccount` tables.

MFA is TOTP (`otplib` / `otpauth`, QR codes via `qrcode`) in `apps/server/src/ee/mfa`, with a dedicated `mfa_token` JWT that only carries a user past the challenge — it is not an access token.

### Token model

All tokens are JWTs signed with `APP_SECRET` and **typed** via `JwtType` ([core/auth/dto/jwt-payload.ts](../../apps/server/src/core/auth/dto/jwt-payload.ts)). The type field is part of the security model: a token minted for one purpose must not be accepted for another.

| Type | Purpose | Notes |
|------|---------|-------|
| `access` | normal API auth | delivered as the `authToken` cookie; carries `sub`, `email`, `workspaceId`, optional `sessionId`; lifetime from `JWT_TOKEN_EXPIRES_IN` (default `30d`) |
| `collab` | open the Hocuspocus WebSocket | minted at `/api/auth/collab-token`, short-lived, verified by `collaboration/extensions/authentication.extension.ts` |
| `exchange` | hand-off between flows | narrow, single-use |
| `attachment` | fetch one attachment | bound to `attachmentId` + `pageId` + `workspaceId` |
| `mfa_token` | carry an unfinished MFA challenge | cannot authorize API calls |
| `api_key` | machine access | issued from a hashed `ApiKeys` row; audited as `ActorType.api_key` |
| `pdf_render` | let Gotenberg fetch a page | scoped to one `pageId` |
| `pdf_export_download` | download a finished export | scoped to one `fileTaskId` |
| `oauth_access` | OAuth/MCP client access | carries `scope`, `grantId`, `aud`, `iss`, `jti` |

Sessions are tracked server-side (`UserSession`, `core/session`) so they can be listed and revoked from account settings; the access JWT references them by `sessionId`. Password-reset and email-verification links use single-purpose `UserToken` rows (`UserTokenType.FORGOT_PASSWORD`, `EMAIL_VERIFICATION`) rather than JWTs.

Cookies are set via `@fastify/cookie` with `withCredentials` on the client; `APP_URL` determines whether the app is treated as HTTPS (`EnvironmentService.isHttps()`), which in turn governs cookie flags — misconfiguring `APP_URL` behind a proxy is the usual cause of "login does nothing".

### Request pipeline

1. Fastify runs with `trustProxy: true` and `fastify-ip`, so client IPs come from proxy headers — only safe because the app is expected to sit behind a trusted reverse proxy.
2. A `preHandler` hook rejects any `/api` request without `req.raw.workspaceId` (allowlist: `auth/setup`, `health`, `billing/stripe/webhook`, `workspace/check-hostname`, `sso/google`, `workspace/create`, `workspace/joined`, `workspace/find-by-email`).
3. [`DomainMiddleware`](../../apps/server/src/common/middlewares/domain.middleware.ts) resolves the workspace from the hostname; [`AuditContextMiddleware`](../../apps/server/src/common/middlewares/audit-context.middleware.ts) seeds `AuditContext` into `nestjs-cls`.
4. [`JwtAuthGuard`](../../apps/server/src/common/guards/jwt-auth.guard.ts) authenticates unless the route is marked `@Public()`; `@RequireSessionAuth()` forces a real user session (blocking API-key/OAuth actors) and `@OAuthScope()` declares required scopes.
5. The global `ValidationPipe` runs with `whitelist: true`, `stopAtFirstError: true`, `transform: true` — undeclared request fields are stripped, which is a real defense against mass-assignment. Adding a request field means adding it to the DTO.
6. `AuditActorInterceptor` (global) records who did what; `TransformHttpResponseInterceptor` normalizes the response envelope.

### Authorization layers

- **Workspace level** — `WorkspaceCaslAction` × `WorkspaceCaslSubject` (`settings`, `member`, `space`, `group`, `attachment`, `api_key`, `audit`) gates administration. Roles: `owner`, `admin`, `member`; `admin` has owner-equivalent power *except* deleting the workspace.
- **Space level** — `SpaceCaslAction` × `SpaceCaslSubject` (`settings`, `member`, `page`, `share`) via `SpaceAbilityFactory`. Space roles: `admin`, `writer`, `reader`. Visibility is `open` (discoverable/joinable by workspace members) or `private`.
- **Page level** — a page marked `PageAccessLevel.RESTRICTED` is additionally filtered by `core/page/page-access/page-access.service.ts`; EE `PagePermission` rows grant `reader`/`writer` to users or groups.
- **Groups** — bulk grants; membership flows through `GroupUser` into space membership and page permissions.
- **Feature gating** — EE capabilities are keyed by `Feature` in [apps/server/src/common/features.ts](../../apps/server/src/common/features.ts) (`sso:custom`, `mfa`, `api:keys`, `page:permissions`, `ai`, `mcp`, `scim`, `audit:logs`, `siem`, `bases`, `oauth`, `retention`, `sharing:controls`, …) and checked against the license/plan; the client mirror is `apps/client/src/ee/features.ts` + `ee/entitlement`. A feature gate is **not** an authorization check — always do both.

### Rate limiting

`@nestjs/throttler` backed by Redis (`@nest-lab/throttler-storage-redis`), configured in [throttle.module.ts](../../apps/server/src/integrations/throttle/throttle.module.ts) with named throttlers: auth `10/min`, AI chat `25/min`, OAuth register `10/hour`, OAuth token `60/min`, OAuth authorize `30/min`, SIEM test `10/min`. `UserThrottlerGuard` keys by authenticated user rather than IP. Note the coupling: a Redis outage degrades rate limiting along with queues and websockets.

### Browser-facing headers

[`resolveFrameHeader`](../../apps/server/src/common/helpers/security-headers.ts) returns `X-Frame-Options: SAMEORIGIN` by default. Setting `IFRAME_EMBED_ALLOWED=true` with an empty `IFRAME_ALLOWED_ORIGINS` removes framing protection entirely; with origins listed it emits `Content-Security-Policy: frame-ancestors 'self' <origins>`. `resolveFrameHeadersForPath` unconditionally hard-denies framing for `/oauth/consent` (`X-Frame-Options: DENY` + `frame-ancestors 'none'`) so the consent screen cannot be clickjacked even when global framing is permitted. Content sanitization on the client uses `dompurify` (pinned to `3.4.13` via `pnpm-workspace.yaml` overrides) and `@braintree/sanitize-url`; server-side HTML generation goes through `common/helpers/prosemirror/html` and `common/helpers/html-escaper.ts`.

### Egress control (SSRF)

Any URL that originates from user input — embeds, import-by-URL, SIEM destinations, webhooks, AI provider base URLs — must be constructed through [`OutboundUrlGuard`](../../apps/server/src/integrations/outbound/outbound-url.guard.ts#L144) / `OutboundAgentFactory` (`integrations/outbound`). These reject private and link-local ranges unless explicitly permitted by `ALLOWED_PRIVATE_NETWORKS`, and they are covered by three spec files (`outbound-url.guard.spec.ts`, `outbound-network-policy.spec.ts`, `outbound-agent.factory.spec.ts`). A bare `fetch`/`axios`/`undici` call built from user data is a security defect, not a style issue. The `no-urls.validator.ts` (with its own spec) additionally blocks URLs in fields where they do not belong.

File handling adds its own constraints: `sanitize-filename` on uploads, size limits from `FILE_UPLOAD_SIZE_LIMIT` / `FILE_IMPORT_SIZE_LIMIT`, and zip extraction via `yauzl` for imports — treat archive contents as hostile (path traversal, zip bombs) and keep extraction inside `getFileTaskFolderPath`.

## Secrets & Sensitive Data

- **Configuration source.** All secrets come from environment variables read exclusively through [`EnvironmentService`](../../apps/server/src/integrations/environment/environment.service.ts) (it has its own spec). Do not read `process.env` directly in feature code; add a getter instead, and document the variable in `.env.example`.
- **`APP_SECRET`** is the root of trust: it signs every JWT and keys the encryption service. It must be ≥32 characters (`openssl rand -hex 32`). Rotating it invalidates all sessions and any data encrypted with it — plan a rotation, don't improvise one.
- **`.env` is local only.** The repo ships `.env.example`; a real `.env` exists in the working tree and must never be committed. Deployment secrets live in the Portainer env files under `.github/infra/portainer.dev.env` / `portainer.prod.env` (`PORTAINER_URL`, `PORTAINER_API_KEY`, `PORTAINER_ENDPOINT_ID`) — treat those as credential files, not config. CI secrets (`DOCKERHUB_TOKEN`, `BUILD_APP_PRIVATE_KEY`) live in GitHub Actions secrets.
- **Encryption at rest for integration credentials.** `integrations/encryption/encryption.service.ts` (spec-covered) encrypts stored third-party secrets — SSO client secrets, SIEM destination credentials, AI provider keys — so they are not readable straight from the database.
- **Credential hashing.** User passwords use `bcrypt`; API keys are stored as hashes (`20260902T211032-api-keys-token-hash.ts` migration) and the plaintext is shown once at creation (`ApiKeyCreatedModal` on the client).
- **Data classification.** Page content, comments, attachments, and AI chat history are customer data; user emails, session metadata, and IP addresses are personal data. Audit rows deliberately record actor identity, IP, and user agent (`AuditContext`), which makes the audit store one of the most sensitive tables — treat `SIEM_QUEUE` payloads accordingly.
- **Leak-prevention details already in place.** The `tsv` tsvector column on AI chat messages is deliberately omitted from the public entity type so it cannot leak into HTTP responses or model context. The `whitelist: true` validation pipe strips unexpected fields on the way in; `@SkipTransform()` endpoints bypass the response envelope and therefore bypass any future central redaction — audit them when adding one.
- **Logging hygiene.** `pino` is the only logger; `DEBUG_DB=true` logs SQL and `LOG_HTTP=true` logs requests, both of which can surface sensitive values — keep them off in production. `DEBUG_MODE=true` raises log verbosity in production and should be temporary.
- **Mail safety.** `MAIL_BLOCKED_RECIPIENT_DOMAINS` prevents transactional mail from reaching unwanted domains in non-production environments.
- **Telemetry.** Anonymous usage telemetry is on by default; set `DISABLE_TELEMETRY=true` for closed environments. Client-side PostHog is opt-in through `POSTHOG_KEY`.
- **Dependency pinning as a control.** `pnpm-workspace.yaml` pins a large `overrides` set (`dompurify`, `axios`, `undici`, `ws`, `nanoid`, `esbuild`, `js-yaml`, `form-data`, `fast-uri`, …) and sets `minimumReleaseAge: 4320` minutes to avoid freshly published (potentially compromised) versions. Security bumps are committed with a `fix(security):` scope and a GHSA reference — see `fix(security): update nodemailer to 9.1.1 to resolve GHSA-2x7j-588g-ccc2`.

## Compliance & Policies

- **Licensing is a compliance constraint here.** The core is AGPL-3.0; everything under `apps/server/src/ee`, `apps/client/src/ee`, and `packages/ee` is under the Docmost Enterprise license (`packages/ee/License`). Do not move enterprise code into core paths or vice versa, and keep `core` free of `ee` imports so an AGPL-only build remains possible.
- **Audit trail (EE).** `Audit` rows with the `AuditEvent` / `AuditResource` taxonomy in [common/events/audit-events.ts](../../apps/server/src/common/events/audit-events.ts), written asynchronously on `AUDIT_QUEUE`. `NoopAuditModule` is the always-registered fallback that satisfies `AUDIT_SERVICE` when EE is absent — so audit calls in core code are safe but silently no-op in community builds.
- **SIEM export (EE).** `SiemDestination` rows stream audit events to external SIEMs over `SIEM_QUEUE`; `EVENT_STORE_DRIVER` / `CLICKHOUSE_URL` support an analytical event store. Destination URLs are user-supplied and therefore guarded.
- **Retention & sharing controls (EE).** The `retention` and `sharing:controls` feature keys gate data-retention policies and restrictions on public sharing — the levers an operator needs for a data-handling policy.
- **Access review evidence.** Workspace/space membership, group membership, API keys, active sessions, and SCIM provisioning state are all queryable, which is what most access-review requests actually need.
- **No formal certification is claimed in-repo.** There is no SOC2/HIPAA/GDPR attestation committed here; treat those as deployment-level obligations of whoever self-hosts. The GDPR-relevant surfaces are user deletion, audit retention, and telemetry — know where each lives before answering a data-subject request.
- **No automated security scanning in CI.** `.github/workflows/release.yml` builds and publishes images only; dependency and code scanning are manual. Run `pnpm audit` deliberately and check the `overrides` block before bumping anything transitive.

## Incident Response

There is no on-call rotation or escalation policy committed to this repository, so the practical runbook is technical:

1. **Confirm blast radius by tenant.** Everything is workspace-scoped; determine whether the issue is one workspace (data/permission bug) or the deployment (infrastructure/credential compromise).
2. **Check health and logs first.** `GET /api/health` covers Postgres and Redis (`integrations/health/*`). Note that `main.ts` swallows `uncaughtException` / `unhandledRejection` into logs, so a replica can be alive-but-broken — read logs, don't trust liveness alone.
3. **Revoke, don't just rotate.** Sessions are server-side (`core/session`) and API keys are rows (`ee/api-key`), so both can be revoked immediately without touching `APP_SECRET`. Reach for `APP_SECRET` rotation only when the signing key itself is suspect — it invalidates every session and breaks data encrypted with it.
4. **Pull the audit trail.** `Audit` rows plus `AuditContext` (actor, actor type, IP, user agent) reconstruct who did what; forward to the configured SIEM destination if one exists.
5. **Contain egress.** If SSRF or a malicious embed is suspected, tighten `ALLOWED_PRIVATE_NETWORKS` and review any code path that builds URLs outside `OutboundAgentFactory`.
6. **Contain sharing.** Public exposure incidents usually trace to a `Share` link or a published public space — both are listed in settings (`/settings/shares`, public-space admin) and revocable per resource. `BETA_PUBLIC_SPACES` can disable the feature wholesale.
7. **Check queue state.** Redis has no dead-letter queue configured; failed jobs accumulate. After an incident, inspect failed jobs in `EMAIL_QUEUE`, `SIEM_QUEUE`, and `AI_QUEUE` for retries that may leak or duplicate side effects.
8. **Patch and record.** Fix with a `fix(security):` commit citing the advisory, add or pin the version in `pnpm-workspace.yaml` `overrides`, add a regression spec, and note the timeline in `docs/`.

## Related Resources

- [architecture.md](architecture.md) — where guards, middleware, and boundaries sit
- [data-flow.md](data-flow.md) — every external integration and its credentials
- [glossary.md](glossary.md) — roles, token types, and entity definitions
- [development-workflow.md](development-workflow.md) — review expectations that encode these rules
- [testing-strategy.md](testing-strategy.md) — the security-relevant specs and how to run them
