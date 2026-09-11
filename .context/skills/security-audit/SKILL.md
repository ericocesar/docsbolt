---
type: skill
name: Security Audit
description: Review code and infrastructure for security weaknesses. Use when Reviewing code for security vulnerabilities, Assessing authentication/authorization, or Checking for OWASP top 10 issues
skillSlug: security-audit
phases: [R, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Scope the audit to the surfaces the change touches: authentication, authorization, tenancy, sharing, file handling, egress, secrets, dependencies. Then ask the one question that matters here: **does this route through the existing chokepoint, or around it?**
2. Learn the deliberate exceptions before flagging anything — unauthenticated `/share/:shareId/p/:pageSlug` and `/docs/*`, self-CSP on `/api/files/*`, tenancy bypass for `/api/billing/stripe/webhook` + `/api/auth/setup` + `/api/health*`, and the `try/catch` EE `require`. These are documented decisions. Any **new** entry on those allowlists is a finding until justified.
3. **Tenancy.** Verify every new Kysely query filters by `workspaceId` and every new route is reachable only after `DomainMiddleware`. Cross-tenant reads are the highest-severity class in this codebase.
4. **Authorization.** Verify depth: workspace ability (`WorkspaceCaslAction` × `WorkspaceCaslSubject`), space ability (`SpaceCaslAction` × `SpaceCaslSubject`), then `PageAccessService` / EE `PagePermission` for restricted pages. Confirm a `Feature` key is not being used as a permission check — it only gates availability.
5. **Tokens.** Confirm the narrowest `JwtType` is minted and accepted. Nine types exist (`access`, `collab`, `exchange`, `attachment`, `mfa_token`, `api_key`, `pdf_render`, `pdf_export_download`, `oauth_access`) precisely so one cannot be replayed in another context. Check `@RequireSessionAuth()` where machine actors must be excluded and `@OAuthScope()` where scopes apply.
6. **Input.** Verify every request field is declared on a DTO — `whitelist: true` in the global `ValidationPipe` is the mass-assignment control, and a loose type or `any` silently weakens it. Check `no-urls.validator.ts` usage where URLs should be rejected outright.
7. **Egress.** Any URL derived from user input (embeds, import-by-URL, SIEM destinations, webhooks, AI base URLs) must be constructed through `OutboundUrlGuard` / `OutboundAgentFactory`. A bare `fetch`/`axios`/`undici` call built from user data is a finding.
8. **Files.** Check `sanitize-filename` on upload, size limits (`FILE_UPLOAD_SIZE_LIMIT`, `FILE_IMPORT_SIZE_LIMIT`), and `yauzl` extraction confined to `getFileTaskFolderPath` — treat archives as hostile (path traversal, zip bombs).
9. **Secrets and output.** Confirm config is read only through `EnvironmentService`, third-party credentials are encrypted via `EncryptionService`, passwords are bcrypt and API keys are hashed, nothing sensitive is committed, and internal columns stay out of public types (the `tsv` omission in `entity.types.ts` is the precedent). Check `@SkipTransform()` endpoints for raw output and confirm `DEBUG_DB` / `LOG_HTTP` are not enabled.
10. Re-run the guardrail specs, then report findings by severity with a concrete failure scenario and a specific remediation, and update [security.md](../../docs/security.md) if a control or exception changed.

## Examples

```bash
pnpm --filter server test -- "outbound|security-headers|jwt-auth.guard|encryption|no-urls"
```

```bash
# the three greps that catch the most common real findings
grep -rnE "await (fetch|axios|undici)" apps/server/src --include=*.ts | grep -v outbound
grep -rn "@Public()" apps/server/src/core apps/server/src/ee
grep -rn "from '.*\bee/" apps/server/src/core
```

A finding written the way it should be:

> **High — cross-tenant disclosure via SIEM test endpoint.** `apps/server/src/ee/audit/…:57` — `POST /api/siem/test` accepts a `destinationUrl` from the body and posts the sample event with `undici` directly, bypassing `OutboundAgentFactory`. An authenticated member of any workspace can point it at `http://169.254.169.254/…` and receive the response body, exposing cloud instance metadata; they can also probe internal services on the app network. Remediation: build the request through `OutboundAgentFactory.lease()` so `OutboundUrlGuard` rejects private and link-local ranges unless `ALLOWED_PRIVATE_NETWORKS` permits them, and keep the existing `SIEM_TEST_THROTTLER` (10/min) on the route.

## Quality Bar

- Every finding states **who** can do **what** and **what they gain** — a concrete failure scenario, not a category name.
- Remediation is specific to this codebase: name the guard, factory, ability, or DTO field to change, not "validate input properly".
- Findings are ranked by severity, and documented exceptions are explicitly distinguished from real gaps.
- Tenancy findings take precedence: a missing `workspaceId` predicate outranks most other classes here.
- The audit distinguishes what was verified by reading code from what was verified by running specs; the guardrail specs actually re-run (`outbound-url.guard`, `outbound-network-policy`, `outbound-agent.factory`, `security-headers`, `jwt-auth.guard`, `encryption.service`, `no-urls.validator`).
- Configuration footguns are checked, not assumed: `IFRAME_EMBED_ALLOWED=true` with empty `IFRAME_ALLOWED_ORIGINS` removes framing protection entirely, and `/oauth/consent` must still receive its hard `DENY`.
- `trustProxy: true` is accounted for — client IPs come from headers, so IP-based audit, throttling, or allowlisting is only as trustworthy as the reverse proxy.
- Dependency changes are checked against the `overrides` block and `minimumReleaseAge: 4320` in `pnpm-workspace.yaml`; security bumps must cite an advisory (`GHSA-…`).
- Residual risk is recorded as accepted, not omitted: Redis-coupled rate limiting, no dead-letter queue, no CI security scanning, no committed compliance attestation.
- The licensing boundary is treated as a compliance control — enterprise code stays in `ee/`, and `core` remains buildable without it.

## Resource Strategy

- No helper files needed. The controls are readable in code and the policy is written in [security.md](../../docs/security.md) — keep that document as the single home for the threat model, exceptions, and incident runbook.
- Authoritative sources: `core/auth/dto/jwt-payload.ts` (token model), `common/helpers/types/permission.ts` (roles), `core/casl/interfaces/*` (abilities), `integrations/outbound/*` (egress), `common/helpers/security-headers.ts` (framing), `integrations/throttle/throttle.module.ts` (limits), `common/features.ts` (gating), `common/events/audit-events.ts` (evidence), `pnpm-workspace.yaml` (dependency policy).
- Prefer re-running the existing guardrail specs over writing new ad-hoc checks; if a gap has no spec, add one via [test-generation](../test-generation/SKILL.md) so the fix cannot silently regress.
- Pair with [code-review](../code-review/SKILL.md) for non-security quality and [pr-review](../pr-review/SKILL.md) for merge-readiness judgment.
- Add a helper here only if a repeatable scan emerges (for example a script running the guardrail specs plus the three greps above) — and keep it short enough that people actually run it.
