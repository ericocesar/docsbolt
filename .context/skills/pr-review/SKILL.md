---
type: skill
name: Pr Review
description: Review pull requests against team standards and best practices. Use when Reviewing a pull request before merge, Providing feedback on proposed changes, or Validating PR meets project standards
skillSlug: pr-review
phases: [R, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Read the PR description first. It must state scope, acceptance criteria, and **what was verified manually** — because `.github/workflows/release.yml` runs no tests, lint, or type-check. If that evidence is missing, ask for it before reviewing code.
2. Confirm the target branch. `main` is the PR target (`nx.json` sets `affected.defaultBase: main`); `develop` is the working branch and upstream syncs land on `merge/v<version>` branches.
3. Check scope: one concern per PR. A diff that mixes a feature, a refactor, and a dependency bump should be split.
4. Check commits: Conventional Commits with a scope, small vertical slices, no hand-written `Build …` commits, no committed `.env` or real values in `.github/infra/portainer.*.env`.
5. Run the gate yourself — `pnpm --filter server test`, `pnpm --filter client test`, both `lint` scripts, and `pnpm build` — for anything touching the server, the database, or shared client infrastructure. Rerun with `--skip-nx-cache` if a result looks suspiciously clean.
6. Review the code against the invariants using the [code-review](../code-review/SKILL.md) skill: tenant scoping, layered authorization, `core`↛`ee`, single content writer, `@SkipTransform()` ↔ `exemptEndpoints`, guarded egress, config via `EnvironmentService`, SQL only in repos.
7. Review migrations for name/ordering against upstream, tenant columns, indexes, rollback, and a regenerated `db.d.ts`.
8. Assess upstream-merge risk explicitly: which upstream-shared files were rewritten or reformatted, and whether the benefit justifies the future conflict.
9. Check that docs moved with the code — `.context/docs` for vocabulary/flow/boundary changes, `.env.example` for new configuration.
10. Leave findings grouped as **blocking / should-fix / optional**, state which checks you ran versus took on trust, and approve only when the blocking list is empty and the manual-verification evidence covers the untested paths.

## Examples

```bash
gh pr view <number> --json title,body,headRefName,baseRefName,files && gh pr diff <number> --stat
```

```bash
gh pr checkout <number> && pnpm install && pnpm --filter server test && pnpm --filter client test && pnpm --filter server lint && pnpm --filter client lint && pnpm build
```

A review summary in the expected shape:

> **Blocking (2)**
> 1. `apps/server/src/core/label/label.controller.ts:88` — new `POST /api/labels/bulk` has `@Public()` but reads labels for a workspace. Remove `@Public()` and add the `SpaceCaslAction.Read` / `SpaceCaslSubject.Page` check, as in `page.controller.ts`.
> 2. `apps/server/src/database/types/db.d.ts` — hand-edited (diff shows a renamed column with no migration). Regenerate with `pnpm --filter server migration:codegen` after adding the migration.
>
> **Should-fix (1)** — `apps/client/src/features/label/queries/…`: mutation does not invalidate the label list key, so the UI stays stale.
>
> **Optional (1)** — extract the duplicated slug helper into `common/helpers/text.utils.ts`.
>
> Ran locally: server tests (pass), client tests (pass), both lints (pass), `pnpm build` (pass). Did **not** verify: collaborative editing or the label UI in a browser — author states both were checked manually.

## Quality Bar

- Every blocking finding names a file and line, the concrete failure scenario, and the fix — and is fixable within this PR.
- The review distinguishes what was *verified* from what was *assumed*; never write "looks good" about a path you did not exercise.
- Manual-verification evidence is demanded for collaboration, uploads, exports, share links, public spaces, and SSO — the suite covers none of them.
- Documented exceptions are not flagged: public `/share` and `/docs`, self-CSP on `/api/files/*`, webhook/setup/health tenancy bypass, the dynamic EE `require`.
- A new allowlist entry (prefix exclusion, middleware exclusion, `exemptEndpoints`, `@Public()`) is treated as blocking until justified in the description.
- Generated files must be generated: `apps/server/src/database/types/db.d.ts` comes from `migration:codegen`.
- Style is Prettier's job; the server/client quote-style difference is expected and must not be "fixed".
- Scope creep is called out even when the extra work is good — it belongs in a separate PR for merge hygiene.
- Approval means the reviewer would be comfortable deploying it, given that the release pipeline checks nothing.

## Resource Strategy

- No helper files needed. `gh` is the only tool required; the canonical expectations live in [development-workflow.md](../../docs/development-workflow.md#code-review-expectations).
- Delegate depth rather than duplicating it: [code-review](../code-review/SKILL.md) for line-level invariants, [security-audit](../security-audit/SKILL.md) for auth/egress/secret diffs, [test-generation](../test-generation/SKILL.md) when coverage is the gap.
- Keep this skill about PR-level judgment — scope, evidence, merge readiness, upstream risk — and let the other skills own code specifics.
- If a finding recurs across PRs, add it to the review checklist in `development-workflow.md` instead of lengthening this file.
- Only add a helper here if a mechanical pre-review script emerges (for example: run the gate, grep for `ee/` imports from `core/`, and diff `db.d.ts` against a fresh `migration:codegen`).
