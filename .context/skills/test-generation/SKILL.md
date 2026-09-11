---
type: skill
name: Test Generation
description: Generate comprehensive test cases for code. Use when Writing tests for new functionality, Adding tests for bug fixes (regression tests), or Improving test coverage for existing code
skillSlug: test-generation
phases: [E, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Identify the workspace and therefore the runner: `apps/server` → Jest 30 + ts-jest, files named `*.spec.ts` co-located with the unit; `apps/client` → Vitest + jsdom, files named `*.test.ts(x)`; `packages/*` → their own specs.
2. Read the closest existing spec and copy its structure. Good models: `apps/server/src/integrations/outbound/outbound-url.guard.spec.ts` (guardrail), `apps/server/src/common/helpers/security-headers.spec.ts` (pure function), `apps/server/src/core/page/page.controller.spec.ts` (controller), `apps/server/src/ee/base/base.service.spec.ts` (DB-gated), `apps/client/src/features/page/tree/model/tree-model.test.ts` (client logic).
3. Enumerate cases before writing code: happy path, denied/unauthorized, invalid input, boundary values, and the error branch. Most real defects in this repo live in the non-happy branches.
4. For a NestJS unit, build the module with `Test.createTestingModule({ providers: [Subject, ...mockProviders] })`, importing from [apps/server/src/test-utils/mock-providers.ts](../../../apps/server/src/test-utils/mock-providers.ts). Do not hand-mock Kysely, Redis, queues, storage, or audit — that bank exists precisely to skip constructor resolution.
5. If the subject gained a constructor dependency, add the mock to `mock-providers.ts` rather than locally; other specs will need it too.
6. For anything needing a real database, follow the gated pattern: check `process.env.DATABASE_URL`, skip when absent, create and drop your own schema. Never hard-require a database.
7. For client code, prefer extracting the logic out of the component and testing the pure function — there is **no Vitest setup file**, so no jest-dom matchers and no global Mantine/i18n/Query providers exist. Wrap providers explicitly if you must render.
8. For a bug fix, write the test first and confirm it fails on the pre-fix code for the right reason.
9. Run it: `pnpm --filter server test -- <pattern>` or `pnpm --filter client test`. If Jest throws `Unexpected token 'export'`, the dependency is ESM-only — add it to `transformIgnorePatterns` in `apps/server/package.json` instead of stubbing the module.
10. Report what is covered and what remains verified only manually (Redis-backed queues/throttling/websockets, Yjs collaboration, storage drivers, mail, SSO/SCIM, import/export).

## Examples

```ts
// apps/server/src/core/label/label.service.spec.ts
import { Test } from '@nestjs/testing';
import { LabelService } from './label.service';
import { mockProviders } from '../../test-utils/mock-providers';

describe('LabelService', () => {
  let service: LabelService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LabelService, ...mockProviders],
    }).compile();

    service = moduleRef.get(LabelService);
  });

  it('scopes lookups to the requesting workspace', async () => {
    await expect(
      service.findForPage('page-from-other-workspace', 'workspace-a'),
    ).resolves.toEqual([]);
  });
});
```

```bash
pnpm --filter server test -- label.service && pnpm --filter client test
```

## Quality Bar

- Assertions describe **decisions and outcomes** — access denied, tenant filter applied, correct token type required — not that a mock was called.
- Every case list includes at least one denial/invalid-input case; a spec with only a happy path adds little here.
- Enum-driven branching is covered per meaningful value (`JwtType`, `SpaceRole`, `SpaceCaslAction`, `FileTaskStatus`).
- No unit spec touches the network, a real Redis, or a real database. Anything that must, is `DATABASE_URL`-gated.
- Regression tests demonstrably fail before the fix; state that explicitly.
- New constructor dependencies are added to `mock-providers.ts`, keeping sibling specs green.
- Spec files sit next to their subject and match the runner's naming (`*.spec.ts` server, `*.test.ts(x)` client) — a misnamed file is silently never run.
- Path aliases differ per workspace: server specs use `moduleNameMapper` (`@docmost/db/*`, `src/*`), client tests use the `@` alias from `vitest.config.ts`. An import that works in one may not resolve in the other.
- Tests are fast and hermetic. Because CI runs nothing, a slow suite is a suite nobody runs.
- No global coverage threshold is introduced — the current suite (~44 files) would fail one immediately.

## Resource Strategy

- The one indispensable resource already exists: [apps/server/src/test-utils/mock-providers.ts](../../../apps/server/src/test-utils/mock-providers.ts). Extend it; do not fork it.
- Configuration lives in `apps/server/package.json` (Jest block), [apps/client/vitest.config.ts](../../../apps/client/vitest.config.ts), and `apps/server/test/jest-e2e.json`. Read them before debugging a resolution failure.
- Conventions, commands, and troubleshooting belong in [testing-strategy.md](../../docs/testing-strategy.md); update that document when you introduce a new pattern rather than growing this skill.
- Add a helper file here only for a genuinely reusable fixture (for example a factory for `Workspace`/`Space`/`Page` rows used by several DB-gated specs) — and put it under `apps/server/src/test-utils/`, not inside `.context/`.
- For behavior that cannot be unit-tested (collaboration, uploads, SSO), write down the manual verification steps in the PR instead of building brittle fakes.
