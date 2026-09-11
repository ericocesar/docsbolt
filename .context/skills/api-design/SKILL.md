---
type: skill
name: Api Design
description: Design RESTful APIs following best practices. Use when Designing new API endpoints, Restructuring existing APIs, or Planning API versioning strategy
skillSlug: api-design
phases: [P, R]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Read the closest existing controller before designing anything — [apps/server/src/core/page/page.controller.ts](../../../apps/server/src/core/page/page.controller.ts) is the reference. Match its conventions rather than importing external REST habits.
2. Note the house style: controllers are mounted under the global `api` prefix with a plural resource path (`@Controller('pages')`), and **most mutations and queries are `POST`** with a DTO body (`/api/pages/create`, `/api/pages/update`, `/api/pages/info`). Do not introduce a REST-purist verb/path scheme into a codebase that is consistently action-style — consistency beats correctness here.
3. Decide placement: `core/<domain>` (AGPL) or `ee/<domain>` (enterprise, dynamically loaded). Enterprise endpoints additionally check a `Feature` key from [common/features.ts](../../../apps/server/src/common/features.ts).
4. Define the DTO in `<domain>/dto/` with `class-validator` decorators. Every field the client sends must be declared — the global `ValidationPipe` runs `whitelist: true`, `stopAtFirstError: true`, `transform: true`, so undeclared fields are silently stripped.
5. Design authorization in two layers: `JwtAuthGuard` for authentication, then `SpaceAbilityFactory` (`SpaceCaslAction` × `SpaceCaslSubject`) or `WorkspaceCaslAction` × `WorkspaceCaslSubject`, plus `PageAccessService` for restricted pages. A `Feature` gate is availability, not permission.
6. Decide the token surface: cookie-based `access` for the SPA; `api_key` or `oauth_access` for machine clients (declare scopes with `@OAuthScope()`); `@RequireSessionAuth()` when a real user session is mandatory. Mint the narrowest `JwtType` for any new signed URL.
7. Use `PaginationOptions` for every list endpoint. Unbounded list responses are a design defect.
8. Decide the response: the default envelope from `TransformHttpResponseInterceptor`, or raw output with `@SkipTransform()` — in which case add the path to `exemptEndpoints` in [apps/client/src/lib/api-client.ts](../../../apps/client/src/lib/api-client.ts).
9. Decide what happens asynchronously: reuse an existing `QueueJob` (search indexing, embeddings, backlinks, watchers, notifications, audit) rather than doing it in the request.
10. Document the shape, then mirror it as a client type in `features/<domain>/types` plus a service function in `features/<domain>/services` — client types are duplicated by design, so the server DTO is the contract of record.

## Examples

```ts
// apps/server/src/core/label/dto/label.dto.ts
export class AddLabelsDto {
  @IsUUID()
  pageId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  labelIds: string[];
}

// apps/server/src/core/label/label.controller.ts
@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelController {
  @HttpCode(HttpStatus.OK)
  @Post('add')
  async addLabels(
    @Body() dto: AddLabelsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId, workspace.id);
    if (!page) throw new NotFoundException('Page not found');

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.labelService.addLabels(dto, workspace.id);
  }
}
```

Route surfaces worth remembering when designing: everything is under `/api` **except** the deliberately unprefixed `robots.txt`, `share/:shareId/p/:pageSlug`, `docs`, `docs/:spaceSlug`, `docs/:spaceSlug/:pageSlug`, `mcp`, and the three `.well-known/oauth-*` documents (see `main.ts`).

## Quality Bar

- The endpoint is consistent with its siblings in path shape, verb choice, and DTO naming — a lone RESTful resource among action-style routes is a defect, not an improvement.
- Every field is declared on the DTO with a validator; nothing relies on `any` or an untyped body.
- Authentication and authorization are both explicit, and the ability check uses the factory rather than a role comparison.
- The workspace is taken from `@AuthWorkspace()` and threaded into every repo call; no route trusts a `workspaceId` from the request body.
- The route is reachable after `DomainMiddleware`, or its exclusion is deliberate and justified (new allowlist entries in `main.ts` / `core.module.ts` are high-scrutiny).
- Lists are paginated via `PaginationOptions`; responses do not leak internal columns (follow the `tsv`-omission precedent in `entity.types.ts`).
- Raw-output endpoints pair `@SkipTransform()` with a client `exemptEndpoints` entry.
- Machine-accessible endpoints declare scopes with `@OAuthScope()`; session-only endpoints use `@RequireSessionAuth()`.
- Auditable actions call the `AUDIT_SERVICE` with the right `AuditEvent` / `AuditResource`.
- Rate-limited surfaces reuse an existing named throttler where one fits (auth, AI chat, OAuth, SIEM test) rather than inventing a limit.
- Page content is never written outside `collaboration.util.ts` / `yjs.util.ts`.

## Resource Strategy

- No helper files needed. The live contract is the code: controllers under `core/*` and `ee/*`, DTOs in `dto/`, and `main.ts` for the prefix exclusions.
- **There is a hand-maintained OpenAPI 3.1 document at `docs/guias/openapi-boltplan.json`** (`Docmost API`, 212 paths). It is *not* generated — `@nestjs/swagger` is not a dependency and nothing derives it from the controllers — so it drifts silently unless updated by hand. Adding or changing an endpoint means updating that file in the same change; treat a mismatch between it and the controllers as a defect.
- There is no API versioning scheme: endpoints evolve in place and the client is updated in the same change. Do not document a version strategy that does not exist; introducing one is an architecture decision.
- Keep the client contract in `features/<domain>/{types,services}`; the duplication is intentional, so the server DTO stays authoritative.
- Cross-reference rather than restate: [architecture.md](../../docs/architecture.md) for boundaries, [security.md](../../docs/security.md) for tokens and scopes, [data-flow.md](../../docs/data-flow.md) for queues and realtime, [glossary.md](../../docs/glossary.md) for enums.
- Add a helper here only if the project adopts a schema-first tool (OpenAPI, zod-to-DTO); until then, a reference-implementation pointer is more reliable than a template.
