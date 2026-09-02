# EE Endpoints Funcionais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the neutral EE stub endpoints (API keys, SCIM tokens, SSO providers, MFA, audit retention, page verification) with real implementations backed by the existing DB tables, so the corresponding Settings pages are fully functional in the self-hosted docsbolt fork.

**Architecture:** All six EE subsystems already have (a) complete frontend pages under `apps/client/src/ee/*` and (b) DB tables created by upstream migrations. Only the server controllers/services are missing (they live in the closed-source `ee/` module). Each task adds one NestJS controller + service under `apps/server/src/ee/<name>/`, registered in `EeModule` → `BaseModule` pattern already established by `base.module.ts`. The stub file `ee-stubs.controller.ts` is progressively emptied as real controllers land.

**Tech Stack:** NestJS 11, Kysely (CamelCasePlugin — use camelCase identifiers like `apiKeys`, `workspaceId`), class-validator DTOs, bcrypt 6 (installed), qrcode 1.5.4 (in lockfile, add to server deps), otplib (new dep), Jest + supertest-style curl smoke tests.

## Global Constraints

- DB access via `@InjectKysely() db: KyselyDB` from `../../database/types/kysely.types`; **camelCase** table/column names (CamelCasePlugin translates to snake_case).
- Auth: `@UseGuards(JwtAuthGuard)` + `@AuthUser() user: User` + `@AuthWorkspace() workspace: Workspace` decorators from `apps/server/src/common/decorators/` and `common/guards/jwt-auth.guard`.
- All client calls are **POST** with JSON body (the app never uses GET for these routes).
- Soft delete = set `deletedAt: new Date()`; list queries must filter `.where('deletedAt', 'is', null)`.
- Pagination response shape: `{ items, meta: { limit, hasNextPage, hasPrevPage, nextCursor, prevCursor } }`.
- Feature names returned to client must match `apps/client/src/ee/features.ts` colon format (already handled by LicenseCheckService patch — do not regress).
- Dev server runs via `pnpm dev` at repo root (log `/tmp/dev.log`); backend `http://localhost:3000`, frontend `http://localhost:5173`. DB: `PGPASSWORD=password psql -h localhost -U postgres -d docmost`.
- Workspace id for smoke tests: `019b03ee-6833-7b6d-b283-5ddbf59fdf06`; user id: `019b03ee-6828-7e29-b35d-e49a7f492fc7`.
- Commit after each task: conventional commits, scope `ee`.
- **Do not touch** `apps/server/src/ee/base/base.service.ts` kanban logic (already fixed and working).

## Scope note (read first)

This spec bundles six independent subsystems. Per the writing-plans scope check they could be six separate plans; they are kept as one because each is small (one controller + service), they share the stub file, and the user asked for a single plan. Tasks are ordered by dependency: shared plumbing first, then subsystems from simplest to most complex. Each task is independently shippable.

**Out of scope** (explicitly deferred, note in PR):
- Actual SSO **login** flows (SAML/OIDC redirect handling) — only provider CRUD in Settings. Login with a configured provider still won't work; the EE auth-strategy layer is a separate project.
- SCIM 2.0 protocol endpoints (`/scim/v2/Users` etc.) — only token management CRUD.
- MFA enforcement during login (`/mfa/verify` challenge) — only setup/enable/disable/backup-codes in Settings.
- Audit log **writing** (the NoopAuditService stays; `/api/audit` reads whatever rows exist).
- Avatar 404: missing file on disk — user re-uploads avatar in UI; no code change.

## File Structure

```
apps/server/src/ee/
├── ee.module.ts                  # MODIFY: import the 5 new modules
├── base/
│   ├── ee-stubs.controller.ts    # MODIFY: remove handlers as real ones land; delete file at end
│   └── base.module.ts            # (untouched)
├── api-key/
│   ├── api-key.module.ts         # CREATE
│   ├── api-key.controller.ts     # CREATE — POST /api-keys, /api-keys/create|update|revoke
│   ├── api-key.service.ts        # CREATE — CRUD + token generation/hashing
│   └── dto.ts                    # CREATE
├── scim/
│   ├── scim.module.ts            # CREATE
│   ├── scim.controller.ts        # CREATE — POST /scim-tokens, /scim-tokens/create|update|revoke
│   ├── scim.service.ts           # CREATE
│   └── dto.ts                    # CREATE
├── security/
│   ├── security.module.ts        # CREATE
│   ├── sso.controller.ts         # CREATE — POST /sso/providers|info|create|update|delete
│   ├── sso.service.ts            # CREATE — auth_providers CRUD (secrets encrypted via EncryptionService)
│   └── dto.ts                    # CREATE
├── mfa/
│   ├── mfa.module.ts             # CREATE
│   ├── mfa.controller.ts         # CREATE — POST /mfa/status|setup|enable|disable|generate-backup-codes|validate-access
│   ├── mfa.service.ts            # CREATE — TOTP via otplib, QR via qrcode, bcrypt for confirm password
│   └── dto.ts                    # CREATE
└── page-verification/
    ├── page-verification.module.ts   # CREATE
    ├── page-verification.controller.ts # CREATE — POST /pages/verification-info|create-verification|update-verification|delete-verification|verify|submit-for-approval|reject-approval|mark-obsolete|verifications
    ├── page-verification.service.ts  # CREATE
    └── dto.ts                        # CREATE
```

Retention endpoints (`/api/audit/retention`) move into a small `audit/audit-settings.controller.ts` + service (reads/writes `workspaces.auditRetentionDays`).

---

### Task 1: API keys — full CRUD

**Files:**
- Create: `apps/server/src/ee/api-key/dto.ts`
- Create: `apps/server/src/ee/api-key/api-key.service.ts`
- Create: `apps/server/src/ee/api-key/api-key.controller.ts`
- Create: `apps/server/src/ee/api-key/api-key.module.ts`
- Create: `apps/server/src/database/migrations/<TIMESTAMP>-api-keys-token-hash.ts`
- Modify: `apps/server/src/ee/ee.module.ts`
- Modify: `apps/server/src/ee/base/ee-stubs.controller.ts` (remove `apiKeys` handler)
- Test: `apps/server/src/ee/api-key/api-key.service.spec.ts`

**Interfaces:**
- Consumes: `KyselyDB`, `JwtAuthGuard`, `AuthUser`/`AuthWorkspace` decorators.
- Produces: `ApiKeyService.list(workspaceId, userId, params) → IPagination<IApiKey>`, `create(userId, workspaceId, {name, expiresAt}) → IApiKey & {token}` (plaintext token returned ONCE), `update(userId, workspaceId, {apiKeyId, name}) → IApiKey`, `revoke(userId, workspaceId, {apiKeyId}) → void`. Client contract: `apps/client/src/ee/api-key/services/api-key-service.ts` + `types/api-key.types.ts` (`IApiKey.id/name/token?/creatorId/workspaceId/expiresAt/lastUsedAt/createdAt/creator`).

**Context:** the `api_keys` table has **no token column** (the closed EE module stores it elsewhere). We add `token_hash text` via a new migration. Auth middleware for API-key bearer tokens is NOT in scope (out-of-scope list); the hash exists so the plaintext is never stored and a later task can verify it.

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/ee/api-key/api-key.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { KyselyDB } from '../../database/types/kysely.types';

// Unit test with a hand-rolled fake Kysely: we only assert the service
// generates a token, hashes it, and returns the plaintext exactly once.
const fakeDb = () => {
  const inserted: any[] = [];
  const chain: any = {
    insertInto: (t: string) => { chain._t = t; return chain; },
    values: (v: any) => { inserted.push(v); return chain; },
    returningAll: () => chain,
    executeTakeFirstOrThrow: async () => ({ id: 'key-1', ...inserted[0] }),
    execute: async () => inserted,
    selectFrom: () => chain,
    selectAll: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    updateTable: () => chain,
    set: () => chain,
    executeTakeFirst: async () => undefined,
  };
  return { db: chain as unknown as KyselyDB, inserted };
};

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let fake: ReturnType<typeof fakeDb>;

  beforeEach(async () => {
    fake = fakeDb();
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: 'KyselyModuleConnectionToken', useValue: fake.db },
      ],
    }).compile();
    service = module.get(ApiKeyService);
  });

  it('create returns plaintext token and stores only its hash', async () => {
    const res = await service.create('user-1', 'ws-1', { name: 'ci' });
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{20,}/);
    expect(fake.inserted[0].tokenHash).not.toBe(res.token);
    expect(fake.inserted[0].tokenHash.length).toBe(64); // sha256 hex
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && pnpm test -- api-key`
Expected: FAIL — `Cannot find module './api-key.service'`

- [ ] **Step 3: Write the migration**

Create `apps/server/src/database/migrations/$(date -u +%Y%m%dT%H%M%S)-api-keys-token-hash.ts` (use actual timestamp; must sort after `20260825T022612-oauth`):

```typescript
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('api_keys')
    .addColumn('token_hash', 'text', (col) => col.ifNotExists())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('api_keys').dropColumn('token_hash').execute();
}
```

Run: `cd apps/server && pnpm migration:latest`
Expected: `Success: <name>-api-keys-token-hash (Up)`

- [ ] **Step 4: Write dto.ts**

```typescript
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsUUID()
  apiKeyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class RevokeApiKeyDto {
  @IsUUID()
  apiKeyId: string;
}

export class ListApiKeysDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
```

- [ ] **Step 5: Write api-key.service.ts**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { createHash, randomBytes } from 'crypto';
import { KyselyDB } from '../../database/types/kysely.types';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';

const PAGE_LIMIT = 50;

@Injectable()
export class ApiKeyService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async list(workspaceId: string, params: { cursor?: string; limit?: number }) {
    const limit = Math.min(params.limit ?? PAGE_LIMIT, PAGE_LIMIT);
    let q = this.db
      .selectFrom('apiKeys')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);
    if (params.cursor) q = q.where('createdAt', '<', params.cursor);

    const rows = await q.execute();
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: !!params.cursor,
        nextCursor: hasNextPage ? (items[items.length - 1] as any).createdAt : null,
        prevCursor: params.cursor ?? null,
      },
    };
  }

  async create(userId: string, workspaceId: string, dto: CreateApiKeyDto) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const row = await this.db
      .insertInto('apiKeys')
      .values({
        name: dto.name,
        creatorId: userId,
        workspaceId,
        tokenHash,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...row, token };
  }

  async update(userId: string, workspaceId: string, dto: UpdateApiKeyDto) {
    const row = await this.db
      .updateTable('apiKeys')
      .set({ name: dto.name, updatedAt: new Date() })
      .where('id', '=', dto.apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('API key not found');
    return row;
  }

  async revoke(workspaceId: string, apiKeyId: string) {
    const updated = await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    if (!updated) throw new NotFoundException('API key not found');
  }
}
```

- [ ] **Step 6: Write api-key.controller.ts + module**

`api-key.controller.ts`:

```typescript
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto, ListApiKeysDto, RevokeApiKeyDto, UpdateApiKeyDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  list(@AuthWorkspace() workspace: Workspace, @Body() body: ListApiKeysDto) {
    return this.service.list(workspace.id, body ?? {});
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  create(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: CreateApiKeyDto) {
    return this.service.create(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace, @Body() body: UpdateApiKeyDto) {
    return this.service.update(user.id, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  revoke(@AuthWorkspace() workspace: Workspace, @Body() body: RevokeApiKeyDto) {
    return this.service.revoke(workspace.id, body.apiKeyId);
  }
}
```

`api-key.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
```

- [ ] **Step 7: Register in EeModule; remove stub handler**

`apps/server/src/ee/ee.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BaseModule } from './base/base.module';
import { ApiKeyModule } from './api-key/api-key.module';

@Module({
  imports: [BaseModule, ApiKeyModule],
})
export class EeModule {}
```

In `ee-stubs.controller.ts` delete the `apiKeys` method and its now-unused imports if unreferenced.

- [ ] **Step 8: Run unit test + smoke test**

Run: `cd apps/server && pnpm test -- api-key` → PASS.
Smoke (needs a JWT — get one from browser DevTools → Application → Cookies `access_token`, or via login POST):

```bash
curl -sS -X POST http://localhost:3000/api/api-keys/create \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"smoke"}'
```

Expected: JSON with `id`, `token` (plaintext), `name: "smoke"`. Then `POST /api/api-keys` with `{}` → `items` contains the key, **no `token` field**. Then `POST /api/api-keys/revoke` `{"apiKeyId":"<id>"}` → 200; list no longer contains it.

- [ ] **Step 9: UI verification + commit**

Open `http://localhost:5173/settings/api-keys` (logged in). Create a key → modal shows token once. Revoke → row disappears.

```bash
git add apps/server/src/ee/api-key apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts apps/server/src/database/migrations
git commit -m "feat(ee): implement api-keys CRUD with hashed token storage"
```

---

### Task 2: SCIM tokens — full CRUD

**Files:**
- Create: `apps/server/src/ee/scim/dto.ts`, `scim.service.ts`, `scim.controller.ts`, `scim.module.ts`
- Modify: `apps/server/src/ee/ee.module.ts`, `apps/server/src/ee/base/ee-stubs.controller.ts` (remove `scimTokens`/`scimTokensCreate`)
- Test: `apps/server/src/ee/scim/scim.service.spec.ts`

**Interfaces:**
- Consumes: same plumbing as Task 1.
- Produces: `ScimTokenService.list/create/update/revoke`. Client contract (`apps/client/src/ee/scim/types/scim-token.types.ts`): `IScimToken { id, name, token?, tokenLastFour, isEnabled, creatorId, workspaceId, lastUsedAt, createdAt, creator? }`. Table `scim_tokens` already has `token_hash`, `token_last_four`, `is_enabled`.

- [ ] **Step 1: Write the failing test**

`scim.service.spec.ts` — same fake-Kysely pattern as Task 1 Step 1, asserting:

```typescript
it('create stores hash + last four and returns plaintext once', async () => {
  const res = await service.create('user-1', 'ws-1', { name: 'okta' });
  expect(res.token).toMatch(/^[A-Za-z0-9_-]{20,}/);
  expect(res.tokenLastFour).toBe(res.token.slice(-4));
  expect(fake.inserted[0].tokenHash).not.toBe(res.token);
});
```

Run: `pnpm test -- scim` → FAIL (module missing).

- [ ] **Step 2: Write dto.ts**

```typescript
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateScimTokenDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateScimTokenDto {
  @IsUUID()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  isEnabled?: boolean;
}

export class RevokeScimTokenDto {
  @IsUUID()
  tokenId: string;
}

export class ListScimTokensDto {
  @IsString()
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
```

- [ ] **Step 3: Write scim.service.ts**

Mirror `ApiKeyService` (Task 1 Step 5) with these differences:

```typescript
// create():
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('hex');
const row = await this.db
  .insertInto('scimTokens')
  .values({
    name: dto.name,
    tokenHash,
    tokenLastFour: token.slice(-4),
    isEnabled: true,
    creatorId: userId,
    workspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)
  .returningAll()
  .executeTakeFirstOrThrow();
return { ...row, token };

// update(): set({ name: dto.name, ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}), updatedAt: new Date() })
//   .where('id','=',dto.tokenId).where('workspaceId','=',workspaceId).where('deletedAt','is',null)

// revoke(): set({ deletedAt: new Date(), isEnabled: false, updatedAt: new Date() })
```

List query: same shape as ApiKeyService.list on `scimTokens`.

- [ ] **Step 4: Write controller + module**

Identical structure to Task 1 Step 6, routes `@Controller('scim-tokens')`, methods `list/create/update/revoke` mapping to `ListScimTokensDto/CreateScimTokenDto/UpdateScimTokenDto/RevokeScimTokenDto`. Module identical to Task 1 Step 6.

- [ ] **Step 5: Register + remove stubs**

Add `ScimModule` to `EeModule` imports. Delete `scimTokens` and `scimTokensCreate` from `ee-stubs.controller.ts`.

- [ ] **Step 6: Run tests + smoke**

`pnpm test -- scim` → PASS.
`curl -sS -X POST http://localhost:3000/api/scim-tokens/create -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"okta"}'` → JSON with `token` + `tokenLastFour`. List → no `token` field. Revoke → gone from list.

- [ ] **Step 7: UI verification + commit**

`http://localhost:5173/settings/scim` (or wherever settings-sidebar links): create token, copy shown once, toggle enabled, revoke.

```bash
git add apps/server/src/ee/scim apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts
git commit -m "feat(ee): implement scim-tokens CRUD"
```

---

### Task 3: SSO providers — management CRUD

**Files:**
- Create: `apps/server/src/ee/security/dto.ts`, `sso.service.ts`, `sso.controller.ts`, `security.module.ts`
- Modify: `apps/server/src/ee/ee.module.ts`, `ee-stubs.controller.ts` (remove `ssoProviders`)
- Test: `apps/server/src/ee/security/sso.service.spec.ts`

**Interfaces:**
- Consumes: `EncryptionService` from `../../integrations/encryption/encryption.service` (already global via `EncryptionModule` in AppModule — check its exports; if not exported, import `EncryptionModule` in `security.module.ts`).
- Produces: `SsoService.list/info/create/update/delete`. Client contract: `IAuthProvider` (see `apps/client/src/ee/security/types/security.types.ts`); routes `POST /sso/providers|/sso/info|/sso/create|/sso/update|/sso/delete`. Table `auth_providers` exists.

**Context:** secrets (`oidcClientSecret`, `samlCertificate`, ldap passwords) are stored encrypted with `EncryptionService.encrypt()` and decrypted on read for the owner UI. `type` values come from client `SSO_PROVIDER` constant (`apps/client/src/ee/security/contants.ts`) — read it first and mirror the enum in the DTO validator.

- [ ] **Step 1: Read the client constants**

```bash
cat apps/client/src/ee/security/contants.ts
```

Note the exact `SSO_PROVIDER` values (e.g. `saml`, `oidc`, `ldap`) — they go into `@IsIn([...])` in Step 2.

- [ ] **Step 2: Write the failing test**

`sso.service.spec.ts` with fake Kysely (pattern from Task 1):

```typescript
it('create encrypts oidc client secret before insert', async () => {
  const res = await service.create('user-1', 'ws-1', {
    name: 'Okta', type: 'oidc',
    oidcIssuer: 'https://x', oidcClientId: 'cid', oidcClientSecret: 'topsecret',
    allowSignup: false, isEnabled: false,
  } as any);
  expect(fake.inserted[0].oidcClientSecret).not.toContain('topsecret');
});
```

Run: `pnpm test -- sso` → FAIL.

- [ ] **Step 3: Write dto.ts**

```typescript
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
// SSO_PROVIDER_VALUES: copy verbatim from apps/client/src/ee/security/contants.ts (Step 1)
const SSO_PROVIDER_VALUES = ['saml', 'oidc', 'ldap']; // <-- VERIFY against Step 1 output

export class CreateSsoProviderDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsIn(SSO_PROVIDER_VALUES) type: string;
  @IsString() @IsOptional() samlUrl?: string;
  @IsString() @IsOptional() samlCertificate?: string;
  @IsString() @IsOptional() oidcIssuer?: string;
  @IsString() @IsOptional() oidcClientId?: string;
  @IsString() @IsOptional() oidcClientSecret?: string;
  @IsString() @IsOptional() ldapUrl?: string;
  @IsString() @IsOptional() ldapBindDn?: string;
  @IsString() @IsOptional() ldapBindPassword?: string;
  @IsString() @IsOptional() ldapBaseDn?: string;
  @IsOptional() ldapUserSearchFilter?: string;
  @IsOptional() ldapUserAttributes?: Record<string, unknown>;
  @IsBoolean() @IsOptional() ldapTlsEnabled?: boolean;
  @IsString() @IsOptional() ldapTlsCaCert?: string;
  @IsBoolean() @IsOptional() allowSignup?: boolean;
  @IsBoolean() @IsOptional() isEnabled?: boolean;
  @IsBoolean() @IsOptional() groupSync?: boolean;
}

export class UpdateSsoProviderDto extends CreateSsoProviderDto {
  @IsUUID() id: string;
}

export class ProviderIdDto {
  @IsUUID() providerId: string;
}
```

- [ ] **Step 4: Write sso.service.ts**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';
import { CreateSsoProviderDto, UpdateSsoProviderDto } from './dto';

const SECRET_FIELDS = ['oidcClientSecret', 'ldapBindPassword', 'ldapTlsCaCert'] as const;

@Injectable()
export class SsoService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly encryption: EncryptionService,
  ) {}

  private encryptSecrets(dto: Partial<CreateSsoProviderDto>) {
    const out: Record<string, unknown> = { ...dto };
    for (const f of SECRET_FIELDS) {
      const v = out[f];
      if (typeof v === 'string' && v.length) out[f] = this.encryption.encrypt(v);
    }
    return out;
  }

  private decryptSecrets<T extends Record<string, any>>(row: T): T {
    const out = { ...row };
    for (const f of SECRET_FIELDS) {
      if (typeof out[f] === 'string' && out[f]) {
        try { out[f] = this.encryption.decrypt(out[f]); } catch { /* leave as-is */ }
      }
    }
    return out;
  }

  async list(workspaceId: string) {
    const items = await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .execute();
    return {
      items: items.map((i) => this.decryptSecrets(i)),
      meta: { limit: 50, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null },
    };
  }

  async info(workspaceId: string) {
    const page = await this.list(workspaceId);
    return page.items[0] ?? null;
  }

  async create(userId: string, workspaceId: string, dto: CreateSsoProviderDto) {
    const row = await this.db
      .insertInto('authProviders')
      .values({
        ...this.encryptSecrets(dto),
        creatorId: userId,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.decryptSecrets(row);
  }

  async update(workspaceId: string, dto: UpdateSsoProviderDto) {
    const { id, ...rest } = dto;
    const row = await this.db
      .updateTable('authProviders')
      .set({ ...this.encryptSecrets(rest), updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundException('Provider not found');
    return this.decryptSecrets(row);
  }

  async delete(workspaceId: string, providerId: string) {
    const r = await this.db
      .updateTable('authProviders')
      .set({ deletedAt: new Date(), isEnabled: false, updatedAt: new Date() })
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!r) throw new NotFoundException('Provider not found');
  }
}
```

- [ ] **Step 5: Write controller + module**

`@Controller('sso')` with `@Post('providers')`, `@Post('info')`, `@Post('create')`, `@Post('update')`, `@Post('delete')` delegating to the service. Module imports `EncryptionModule` (verify it exports `EncryptionService`: `grep -A5 exports apps/server/src/integrations/encryption/encryption.module.ts`; if not exported, add it to that module's exports — one-line change, include in this commit).

- [ ] **Step 6: Register + remove stub + tests**

Add `SecurityModule` to `EeModule`; delete `ssoProviders` from stubs. `pnpm test -- sso` → PASS. Smoke: `POST /api/sso/providers` → `{items: [], ...}`; create an oidc provider → returned `oidcClientSecret` equals input (round-trip), DB raw value differs:

```bash
PGPASSWORD=password psql -h localhost -U postgres -d docmost -c "SELECT oidc_client_secret FROM auth_providers WHERE deleted_at IS NULL;"
```

Expected: ciphertext, not `topsecret`.

- [ ] **Step 7: UI verification + commit**

Settings → Security/SSO page renders, create + delete a provider.

```bash
git add apps/server/src/ee/security apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts
git commit -m "feat(ee): implement sso provider management CRUD (secrets encrypted at rest)"
```

---

### Task 4: Audit retention (real read/write)

**Files:**
- Create: `apps/server/src/ee/audit/audit-settings.controller.ts`, `audit-settings.service.ts`, `audit.module.ts`
- Modify: `ee.module.ts`, `ee-stubs.controller.ts` (remove `auditRetention`/`auditRetentionUpdate`; KEEP the `auditLogs` reader — it already works)
- Test: `apps/server/src/ee/audit/audit-settings.service.spec.ts`

**Interfaces:**
- Consumes: `workspaces.auditRetentionDays` column (exists, `Generated<number>`).
- Produces: `POST /api/audit/retention → {retentionDays}`, `POST /api/audit/retention/update {auditRetentionDays} → {retentionDays}`.

- [ ] **Step 1: Write the failing test**

```typescript
it('update writes retentionDays to workspace row', async () => {
  await service.updateRetention('ws-1', 30);
  expect(fake.inserted[0]).toMatchObject({ auditRetentionDays: 30 });
});
```

(fake Kysely pattern from Task 1; `updateTable().set()` captures into `inserted`.)

- [ ] **Step 2: Implement service + controller**

```typescript
// audit-settings.service.ts
@Injectable()
export class AuditSettingsService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getRetention(workspaceId: string) {
    const ws = await this.db
      .selectFrom('workspaces')
      .select('auditRetentionDays')
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    return { retentionDays: ws?.auditRetentionDays ?? 90 };
  }

  async updateRetention(workspaceId: string, retentionDays: number) {
    await this.db
      .updateTable('workspaces')
      .set({ auditRetentionDays: retentionDays, updatedAt: new Date() })
      .where('id', '=', workspaceId)
      .execute();
    return { retentionDays };
  }
}
```

Controller: `@Controller('audit')` with `@Post('retention')` and `@Post('retention/update')` (DTO `{auditRetentionDays: number}` with `@IsInt() @Min(1) @Max(3650)`).

- [ ] **Step 3: Register, remove stubs, test, smoke**

`pnpm test -- audit` → PASS. Smoke: GET retention → `{retentionDays: 90}`; update to 30 → DB `audit_retention_days = 30`.

- [ ] **Step 4: UI verification + commit**

Settings → Audit → retention control persists across reload.

```bash
git add apps/server/src/ee/audit apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts
git commit -m "feat(ee): implement audit retention read/update against workspaces table"
```

---

### Task 5: MFA — TOTP setup/enable/disable/backup codes

**Files:**
- Create: `apps/server/src/ee/mfa/dto.ts`, `mfa.service.ts`, `mfa.controller.ts`, `mfa.module.ts`
- Modify: `ee.module.ts`, `ee-stubs.controller.ts` (remove `mfaStatus`/`mfaSetup`), `apps/server/package.json` (add `otplib`)
- Test: `apps/server/src/ee/mfa/mfa.service.spec.ts`

**Interfaces:**
- Consumes: `user_mfa` table (`user_id` UNIQUE, `method`, `secret`, `is_enabled`, `backup_codes text[]`), `bcrypt` (installed), `qrcode` (in lockfile — add to server deps), `EncryptionService` (encrypt TOTP secret at rest).
- Produces (client contract `apps/client/src/ee/mfa/types/mfa.types.ts`):
  - `POST /mfa/status → {isEnabled?, method?, backupCodesCount?}`
  - `POST /mfa/setup {method:'totp'} → {method, qrCode, manualKey}` (qrCode = data URL)
  - `POST /mfa/enable {verificationCode} → {success, backupCodes}`
  - `POST /mfa/disable {confirmPassword?} → {success}`
  - `POST /mfa/generate-backup-codes {confirmPassword?} → {backupCodes}`
  - `POST /mfa/validate-access → {valid: true}` (always valid — login challenge out of scope)

- [ ] **Step 1: Install deps**

```bash
cd apps/server && pnpm add otplib && pnpm add qrcode && pnpm add -D @types/qrcode
```

Expected: lockfile updated, no peer warnings.

- [ ] **Step 2: Write the failing test**

`mfa.service.spec.ts` (fake Kysely + real otplib):

```typescript
import { authenticator } from 'otplib';

it('setup generates secret + QR data URL; enable verifies TOTP code', async () => {
  const setup = await service.setup('user-1', 'ws-1', 'ericocesar@webck.com.br');
  expect(setup.qrCode).toMatch(/^data:image\/png;base64,/);
  expect(authenticator.check('000000', setup.manualKey)).toBe(false); // sanity
  const codes = service.generateBackupCodes();
  expect(codes).toHaveLength(10);
});
```

Run: `pnpm test -- mfa` → FAIL.

- [ ] **Step 3: Write mfa.service.ts**

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { authenticator } from 'otplib';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import { KyselyDB } from '../../database/types/kysely.types';
import { EncryptionService } from '../../integrations/encryption/encryption.service';

@Injectable()
export class MfaService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly encryption: EncryptionService,
  ) {}

  private async row(userId: string) {
    return this.db
      .selectFrom('userMfa')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst();
  }

  async status(userId: string) {
    const r = await this.row(userId);
    return {
      isEnabled: !!r?.isEnabled,
      method: r?.isEnabled ? r.method : null,
      backupCodesCount: r?.backupCodes?.length ?? 0,
    };
  }

  async setup(userId: string, workspaceId: string, email: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'Docmost', secret);
    const qrCode = await QRCode.toDataURL(otpauth);
    await this.db
      .insertInto('userMfa')
      .values({
        userId,
        workspaceId,
        method: 'totp',
        secret: this.encryption.encrypt(secret),
        isEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflict((oc) => oc.column('userId').doUpdateSet({
        secret: this.encryption.encrypt(secret),
        isEnabled: false,
        updatedAt: new Date(),
      }))
      .execute();
    return { method: 'totp', qrCode, manualKey: secret };
  }

  generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{5}/)!.join('-'),
    );
  }

  async enable(userId: string, workspaceId: string, verificationCode: string) {
    const r = await this.row(userId);
    if (!r?.secret) throw new BadRequestException('Run setup first');
    const secret = this.encryption.decrypt(r.secret);
    if (!authenticator.check(verificationCode, secret)) {
      throw new BadRequestException('Invalid code');
    }
    const backupCodes = this.generateBackupCodes();
    await this.db
      .updateTable('userMfa')
      .set({ isEnabled: true, backupCodes, updatedAt: new Date() })
      .where('userId', '=', userId)
      .execute();
    return { success: true, backupCodes };
  }

  async disable(userId: string, password?: string) {
    const r = await this.row(userId);
    if (!r) return { success: true };
    if (password) {
      const user = await this.db
        .selectFrom('users').select('password')
        .where('id', '=', userId).executeTakeFirst();
      if (user?.password && !(await bcrypt.compare(password, user.password))) {
        throw new BadRequestException('Invalid password');
      }
    }
    await this.db.deleteFrom('userMfa').where('userId', '=', userId).execute();
    return { success: true };
  }

  async regenerateBackupCodes(userId: string) {
    const codes = this.generateBackupCodes();
    await this.db
      .updateTable('userMfa')
      .set({ backupCodes: codes, updatedAt: new Date() })
      .where('userId', '=', userId)
      .execute();
    return { backupCodes: codes };
  }
}
```

- [ ] **Step 4: Write dto.ts + controller + module**

DTOs: `EnableMfaDto {verificationCode: string @IsString @Length(6,8)}`, `DisableMfaDto {confirmPassword?: string @IsOptional @IsString}`, `SetupMfaDto {method: 'totp' @IsIn(['totp'])}`. Controller `@Controller('mfa')`: `status`, `setup`, `enable`, `disable`, `generate-backup-codes`, `validate-access` (returns `{valid: true}` — no enforcement). Pass `user.email` into `setup`. Module like Task 1, plus `EncryptionModule` import if needed (Task 3 established the pattern).

- [ ] **Step 5: Register + remove stubs + tests**

`pnpm test -- mfa` → PASS. Smoke: `POST /api/mfa/status` → `{isEnabled:false,...}`; `POST /api/mfa/setup {"method":"totp"}` → `qrCode` data URL + `manualKey`; verify a code from an authenticator app with `manualKey` → `POST /api/mfa/enable {"verificationCode":"123456"}` → `{success:true, backupCodes:[10 codes]}`; status → `isEnabled:true`.

- [ ] **Step 6: UI verification + commit**

Settings → MFA: setup modal shows scannable QR, code entry enables, disable works.

```bash
git add apps/server/src/ee/mfa apps/server/package.json apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts
git commit -m "feat(ee): implement TOTP MFA setup/enable/disable with backup codes"
```

---

### Task 6: Page verification — workflow CRUD

**Files:**
- Create: `apps/server/src/ee/page-verification/dto.ts`, `page-verification.service.ts`, `page-verification.controller.ts`, `page-verification.module.ts`
- Modify: `ee.module.ts`, `ee-stubs.controller.ts` (remove `pageVerifications`/`pageVerificationInfo`; delete file + its registration if now empty)
- Test: `apps/server/src/ee/page-verification/page-verification.service.spec.ts`

**Interfaces:**
- Consumes: `page_verifications` + `page_verifiers` tables (schemas inspected: `type 'expiring'|'qms'`, `status`, `mode 'period'|'fixed'|'indefinite'`, `period_amount`, `period_unit`, `verified_at/by_id`, `expires_at`, `requested_at/by_id`, `rejected_at/by_id` + `rejection_comment` — check remaining columns with `\d page_verifications`).
- Produces (client contract `apps/client/src/ee/page-verification/services/page-verification-service.ts`): `POST /pages/verification-info {pageId} → IPageVerificationInfo`, `create-verification`, `update-verification`, `delete-verification`, `verify`, `submit-for-approval`, `reject-approval`, `mark-obsolete`, `verifications` (list).

- [ ] **Step 1: Inspect remaining columns**

```bash
PGPASSWORD=password psql -h localhost -U postgres -d docmost -c "\d page_verifications"
```

Note `rejection_comment`/`rejected_by_id` exact names (camelCase in Kysely).

- [ ] **Step 2: Write the failing test**

```typescript
it('verify sets status=verified and verifiedAt', async () => {
  await service.verify('user-1', 'ws-1', 'page-1');
  expect(fake.inserted[0]).toMatchObject({ status: 'verified' });
  expect(fake.inserted[0].verifiedAt).toBeInstanceOf(Date);
});
```

- [ ] **Step 3: Write dto.ts**

```typescript
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PageIdDto { @IsUUID() pageId: string; }

export class SetupVerificationDto {
  @IsUUID() pageId: string;
  @IsString() @IsIn(['expiring', 'qms']) @IsOptional() type?: 'expiring' | 'qms';
  @IsString() @IsIn(['period', 'fixed', 'indefinite']) @IsOptional() mode?: string;
  @IsInt() @Min(1) @IsOptional() periodAmount?: number;
  @IsString() @IsIn(['day', 'week', 'month', 'year']) @IsOptional() periodUnit?: string;
  @IsString() @IsOptional() fixedExpiresAt?: string;
  @IsUUID('all', { each: true }) verifierIds: string[];
}

export class UpdateVerificationDto extends SetupVerificationDto {}

export class RejectApprovalDto {
  @IsUUID() pageId: string;
  @IsString() @IsOptional() comment?: string;
}

export class ListVerificationsDto {
  @IsString() @IsOptional() status?: string;
  @IsUUID() @IsOptional() spaceId?: string;
  @IsString() @IsOptional() cursor?: string;
  @IsOptional() limit?: number;
}
```

- [ ] **Step 4: Write service**

Core logic (full code in implementation; the state machine):

```typescript
// create-verification: upsert page_verifications row for pageId
//   (type default 'expiring', status 'draft' when mode set, verifiers -> page_verifiers rows)
// computeExpiresAt(mode, periodAmount, periodUnit, fixedExpiresAt):
//   period -> now + amount*unit; fixed -> fixedExpiresAt; indefinite -> null
// verify: set status='verified', verifiedAt=now, verifiedById=user,
//   expiresAt=computeExpiresAt(...)
// submit-for-approval: status='in_approval', requestedAt=now, requestedById=user
// reject-approval: status='draft', rejectedAt=now, rejectedById=user, rejectionComment
// mark-obsolete: status='obsolete'
// delete-verification: delete page_verifications row (hard delete OK — child
//   page_verifiers cascades; verify FK with \d page_verifiers first)
// verification-info: join latest row + verifiers (users name/avatarUrl/email)
//   + permissions {canVerify, canManage, canSubmitForApproval, canMarkObsolete}
//   — compute from space role via SpaceMemberRepo (reuse existing factory
//   SpaceAbilityFactory.createForUser(user, spaceId) if wired; else canVerify =
//   user is verifier or space admin)
// verifications list: filter by workspaceId (+ optional status/spaceId),
//   standard pagination envelope
```

- [ ] **Step 5: Controller + module + register**

`@Controller('pages')` — Nest allows two controllers sharing a prefix as long as paths differ; all nine routes above. Add `PageVerificationModule` to `EeModule`. Delete `ee-stubs.controller.ts` entirely if no handlers remain (remove its import from `base.module.ts`).

- [ ] **Step 6: Tests + smoke**

`pnpm test -- page-verification` → PASS. Smoke: `POST /api/pages/verification-info {"pageId":"<existing page>"}` → `{status:'none'}`; `create-verification` with `verifierIds:[<user id>]` → 200; info → status `draft` + verifier listed; `verify` → status `verified`, `expiresAt` set.

- [ ] **Step 7: UI verification + commit**

Open a page → verification menu → setup, verify, obsolete. Settings → Verifications page lists rows.

```bash
git add apps/server/src/ee/page-verification apps/server/src/ee/ee.module.ts apps/server/src/ee/base/ee-stubs.controller.ts apps/server/src/ee/base/base.module.ts
git commit -m "feat(ee): implement page verification workflow endpoints"
```

---

### Task 7: Cleanup + full regression

**Files:**
- Modify: `apps/server/src/ee/base/ee-stubs.controller.ts` (should be deleted by Task 6; if any handler remains, migrate it)
- Modify: `apps/server/src/test-utils/mock-providers.ts` (add new services if any spec breaks)

- [ ] **Step 1: Full server test suite**

Run: `cd apps/server && pnpm test`
Expected: all suites PASS (28+). Fix any DI fallout by adding stubs to `mock-providers.ts`.

- [ ] **Step 2: Client tests + build**

Run: `cd apps/client && pnpm test && pnpm build` (from repo root: `pnpm client:build`)
Expected: PASS / build success.

- [ ] **Step 3: Console-zero check**

Open `http://localhost:5173`, click through Settings pages (API keys, SCIM, Security, MFA, Audit, Verifications) and one kanban. DevTools console must show **no 404/500** except the known avatar image (user re-uploads avatar manually).

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "chore(ee): remove stub controller after real EE endpoints landed"  # only if changes
git push origin main
```

---

## Self-review notes

- **Spec coverage:** every 404 from the console report is addressed: api-keys (T1), scim-tokens (T2), sso/providers (T3), mfa/status (T5), audit + retention (T4), pages/verifications + verification-info (T6), avatar (out of scope — data issue, documented), TextSelection warning (upstream ProseMirror, not ours).
- **Type consistency:** `IApiKey.token` optional (only on create) matches client type; `MfaStatusResponse` fields match `mfa.types.ts`; retention response key is `retentionDays` (client `getAuditRetention`) while request key is `auditRetentionDays` (client `updateAuditRetention`) — both spellings intentional, do not "fix" one into the other.
- **Known risk:** Task 5 `onConflict` on `userMfa.userId` and Task 6 hard-delete cascade assumptions must be verified against `\d` output during implementation; adjust if FK differs.
