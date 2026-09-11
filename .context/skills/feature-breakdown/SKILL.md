---
type: skill
name: Feature Breakdown
description: Break down features into implementable tasks. Use when Planning new feature implementation, Breaking large tasks into smaller pieces, or Creating implementation roadmap
skillSlug: feature-breakdown
phases: [P]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Restate the request as acceptance criteria — observable outcomes, not implementation steps. Anything you cannot verify by clicking, calling, or asserting is not a criterion.
2. Decide placement before decomposing: `core/` vs `ee/` on the server, `features/` vs `ee/` on the client. Enterprise work additionally needs a `Feature` key and an entitlement gate.
3. Find the nearest analogous feature and list its files; your breakdown should mirror that file set. The current exemplar is the auto-subpages feature, which shipped as ~8 small commits: client types → client component → DTO field → repo method → service handling → page-creation hook.
4. Decompose **vertically, bottom-up**, in this order — each step is independently reviewable and usually one commit:
   1. migration (if the schema moves) + `migration:codegen` + `entity.types.ts`
   2. repo method(s)
   3. service rule(s)
   4. DTO + controller route (guards, ability check, audit call)
   5. client types
   6. client service function
   7. client query hook (with cache keys and invalidations)
   8. client component + route/settings placement
   9. i18n keys
   10. tests (server spec, client test) — or written earlier if practicing TDD
   11. docs (`.context/docs`) + `.env.example` if configuration changed
5. Identify the async work and map it to an existing `QueueJob` (search indexing, embeddings, backlinks, watchers, notifications, audit) rather than inventing a new queue.
6. Identify the realtime surface: does the page tree, a space room, or a user room need a broadcast via `WsService` / `ws-tree.service.ts`?
7. Flag the invariants the feature must respect: tenant scoping, layered authorization, single content writer (Yjs), envelope/`@SkipTransform()` pairing, guarded egress, config via `EnvironmentService`.
8. Flag upstream-merge risk: list which upstream-shared files the feature must modify, and whether the design can avoid touching them.
9. Note what cannot be automatically tested (collaboration, uploads, exports, shares, SSO) and write the manual verification steps into the plan, since CI runs nothing.
10. Order the tasks by dependency, mark which can proceed in parallel, and record the plan — for non-trivial work, scaffold it with `context({ action: "scaffoldPlan", planName })` and then start the harness workflow with `workflow-init`.

## Examples

```
Feature: per-space default page template

Acceptance criteria
  AC1 A space admin can pick a template in Space settings > General.
  AC2 New pages created in that space open with the template's content.
  AC3 Clearing the selection restores the current blank-page behavior.
  AC4 Non-admins cannot change the setting (403).

Tasks (vertical, in order)
  T1  migration: spaces.default_template_id (nullable FK -> templates.id)   [schema]
  T2  migration:codegen + entity.types.ts triple update                     [schema]
  T3  SpaceRepo.updatePagesSettings extension                              [repo]
  T4  SpaceService rule + ability check (SpaceCaslAction.Manage/Settings)  [service]
  T5  UpdateSpaceDto field + validator                                     [api]  depends T4
  T6  PageService: apply template on create (via collaboration.util)       [service] depends T1
  T7  client types (ISpacePagesSettings extension)                         [client] parallel with T3-T6
  T8  client service + query hook + invalidation                          [client] depends T5
  T9  TemplatePicker component in space General settings                   [client] depends T7,T8
  T10 i18n keys                                                            [client]
  T11 specs: SpaceService ability denial, PageService template application [test]
  T12 client test: settings payload mapper                                 [test]
  T13 docs: glossary (template default), data-flow if a job is added       [docs]

Invariants to respect
  - every SpaceRepo query filters by workspaceId
  - page content applied through collaboration.util.ts, never raw JSON
  - EE templates feature key checked if templates remain enterprise-gated

Upstream risk
  - T6 touches core/page/services/page.service.ts (upstream-shared) — keep the
    change to a single guarded call site.

Manual verification
  - two-tab check that a templated page syncs correctly
  - non-admin receives 403 in the settings UI
```

## Quality Bar

- Acceptance criteria are observable and numbered, and every task traces to at least one of them.
- Tasks are vertical slices, each independently reviewable and roughly one Conventional Commit.
- The schema step comes first and explicitly includes `migration:codegen` — forgetting it produces confusing type errors later.
- Every task names the layer it belongs to, so the wrong-layer mistake (SQL in a service, business rules in a controller) is caught at planning time.
- Dependencies and parallelizable work are marked; a flat list is not a plan.
- Placement (`core` vs `ee`) and licensing are decided up front, not discovered mid-implementation.
- Async and realtime effects are assigned to existing jobs/channels; a new queue requires justification.
- The invariant list is explicit, because these are the failures that pass review when unstated.
- Upstream-shared files are called out with the merge-cost consequence.
- Manual verification steps are written down for anything the suite cannot cover.
- Configuration changes list all three destinations: `EnvironmentService` getter, `.env.example`, and — if client-visible — the `define` allowlist in `apps/client/vite.config.ts`.

## Resource Strategy

- Use the dotcontext plan scaffolding for non-trivial features (`scaffoldPlan` then `workflow-init`) instead of inventing a plan format here; plan state persists under `.context/runtime/workflows/`.
- Don't create a helper template file — the canonical example is the repository history itself: `git log --oneline -20` around a shipped feature shows the real slice granularity.
- Reference rather than restate: [architecture.md](../../docs/architecture.md) for placement, [data-flow.md](../../docs/data-flow.md) for jobs and channels, [glossary.md](../../docs/glossary.md) for invariants, [development-workflow.md](../../docs/development-workflow.md) for commit and review expectations.
- Hand the finished breakdown to the [feature-developer](../../agents/feature-developer.md) playbook; use [api-design](../api-design/SKILL.md) for endpoint shape and [test-generation](../test-generation/SKILL.md) for the test tasks.
- Escalate to the architect specialist rather than planning around a boundary: anything that needs a new shared package, a new process, or a `core` → `ee` dependency is an architecture decision, not a task.
