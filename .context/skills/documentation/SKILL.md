---
type: skill
name: Documentation
description: Generate and update technical documentation. Use when Documenting new features or APIs, Updating docs for code changes, or Creating README or getting started guides
skillSlug: documentation
phases: [P, C]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Workflow

1. Identify which document owns the fact, and touch only that one. Ownership map: stack and orientation → `project-overview.md`; layers, patterns, boundaries, trade-offs → `architecture.md`; queues, realtime, integrations, failure modes → `data-flow.md`; branching, local dev, review rules → `development-workflow.md`; entities, enums, terms, invariants → `glossary.md`; auth, secrets, compliance, IR → `security.md`; test types, commands, gates → `testing-strategy.md`; scripts and automation → `tooling.md`.
2. Read the whole target document first. Each has a required section structure (recoverable with `context({ action: "fillSingle", filePath })`); removing or renaming a required heading makes the file read as unfilled.
3. Verify every claim against the repository — open the file, run the command, read the config value. Never document from memory or from upstream Docmost docs.
4. Cite concrete paths and use clickable relative links. From `.context/docs/*` the repo root is `../../`; from `.context/agents/*` sibling docs are `../docs/*`; from `.context/skills/<slug>/SKILL.md` docs are `../../docs/*` and repo files are `../../../`. Check the depth — broken links are the most common defect in this material.
5. Put each shell command in its own fenced `bash` block, one command per block, no `$` prompt and no interleaved output.
6. State negative facts plainly. The two most load-bearing here: **CI runs no tests** (`.github/workflows/release.yml` only builds and publishes images) and **no coverage threshold is enforced**. Softening these misleads every future reader.
7. Record the deliberate exceptions that look like bugs: unauthenticated `/share/*` and `/docs/*`, self-CSP on `/api/files/*`, tenancy bypass for `/api/billing/stripe/webhook` + `/api/auth/setup` + `/api/health*`, and the `try/catch` EE `require`.
8. Mark fork-vs-upstream provenance for anything that differs from docmost/docmost (branding, MCP additions, auto-subpages, Portainer deploys) so the next upstream merge stays legible.
9. Cross-link instead of duplicating; each fact should have exactly one home. Use tables for enums and symbol inventories, prose for reasoning, Mermaid for topology.
10. Update `.env.example` when configuration changes, and finish by re-reading for duplication and stale version/date claims (write absolute dates; `0.96.0` tracks the upstream merge point).

## Examples

```bash
grep -rn "^  get\|^  is" apps/server/src/integrations/environment/environment.service.ts | head -40
```

A well-formed doc claim — specific, linked, verifiable:

```markdown
Rate limiting uses `@nestjs/throttler` backed by Redis, configured in
[throttle.module.ts](../../../apps/server/src/integrations/throttle/throttle.module.ts)
with six named throttlers: auth `10/min`, AI chat `25/min`, OAuth register
`10/hour`, OAuth token `60/min`, OAuth authorize `30/min`, SIEM test `10/min`.
`UserThrottlerGuard` keys by authenticated user rather than IP, so a Redis
outage degrades throttling along with queues and websockets.
```

The same claim written badly — unverifiable, vague, no source:

```markdown
The API has sensible rate limiting to protect against abuse.
```

## Quality Bar

- Every factual claim traces to a file, command, or configuration value in this repository.
- Links resolve from the file they are written in; relative depth was actually checked.
- Required scaffold headings are intact and in order; frontmatter is preserved and `status` is updated.
- Commands are runnable verbatim from the repo root, one per `bash` block.
- Negative and exceptional facts are explicit, not implied.
- No duplication across documents — a fact appears once and is linked elsewhere.
- Generated material (the semantic snapshot under `.context/cache/semantic/`, `apps/server/src/database/types/db.d.ts`) is referenced, never transcribed.
- Enum and symbol inventories are tables with locations; reasoning is prose with the alternatives that were rejected.
- Operator-facing docs (`.env.example`, `.github/infra/doc-deploy.md`, `README.md`) stay in operator language; agent-facing docs (`.context/**`, `AGENTS.md`) stay in engineering language.
- Known inaccuracies are stated rather than quietly inherited — root `AGENTS.md` currently has npm/`dist`-based tips that do not apply, a placeholder "Repository map", and a link to a `CONTRIBUTING.md` that does not exist.

## Resource Strategy

- No helper files needed; the scaffold structure plus the repository are sufficient.
- Retrieve a document's required sections on demand with `context({ action: "fillSingle", filePath })` rather than copying them into this skill.
- Use `context({ action: "getMap", section: "<section>" })` for generated structure; prefer section-scoped reads, since `section: "all"` exceeds sane output limits in this repo.
- The authoritative sources per topic: `EnvironmentService` + `.env.example` (config), `migrations/` + `entity.types.ts` (schema), controllers under `core/*` and `ee/*` (API surface), `queue.constants.ts` (async contracts), `features.ts` (EE gating), root and per-app `package.json` (commands).
- Escalate rather than invent: if a rationale is not recorded anywhere, write what the code does and flag the missing "why" instead of guessing it.
