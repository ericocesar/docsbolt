---
type: agent
name: Performance Optimizer
description: Identify performance bottlenecks
agentType: performance-optimizer
phases: [E, V]
generated: 2026-09-11
status: filled
scaffoldVersion: "2.0.0"
---

## Mission

Find and fix latency, throughput, and resource problems across a NestJS/Fastify API, a hand-written Kysely data layer, twelve BullMQ queues, two realtime channels, and a large React SPA with a CRDT editor. Engage this agent for slow endpoints, sluggish page loads, editor lag, queue backlogs, build OOM, and memory growth. There is no APM or tracing in this repo — the available instruments are pino logs (`DEBUG_DB`, `LOG_HTTP`), Postgres `EXPLAIN`, BullMQ queue state in Redis, browser devtools, and the formula benchmark. Measure with those before changing anything.

## Responsibilities

- Profile and optimize Kysely queries: missing indexes, N+1 patterns in list endpoints, over-wide `select *` projections, and unbounded result sets.
- Verify pagination is used and correct on every list surface (`database/pagination/pagination-options.ts`).
- Tune caching: `@nestjs/cache-manager` over Redis (5 s default TTL) with keys in `common/helpers/cache-keys.ts` and the `with-cache.ts` wrapper.
- Diagnose queue throughput and backlog per `QueueName`; move expensive work out of the request path.
- Optimize the collaboration path: Hocuspocus persistence debounce, snapshot size, `redis-sync` traffic, and history job volume.
- Optimize the client: bundle size and chunking (`vendor-mantine` group in `vite.config.ts`), TanStack Query cache/invalidation patterns, virtualization for long lists and tables, and editor render cost.
- Address build-time resource limits (`--max-old-space-size=3072`, `--parallel=1`) and Nx cache effectiveness.
- Watch Postgres connection pressure via `DATABASE_MAX_POOL` against long-running import/export jobs.

## Best Practices

- **Measure first, in the layer you suspect.** `DEBUG_DB=true` gives SQL, `LOG_HTTP=true` gives request timing, browser devtools give the client waterfall. A "slow page" is usually one of: an unindexed query, an unpaginated list, a missing query-cache hit, or a client waterfall of dependent requests.
- **`EXPLAIN` before adding an index, and after.** The schema already carries targeted indexes (page-title trigram, tsvector, pgvector); add in the same spirit rather than broadly.
- **Fix N+1 in the repo, not the service.** Batch with a single query and join, or use one `where in` round trip; the repository layer exists so these fixes are local.
- **Don't cache correctness problems.** The cache TTL is 5 s by default — caching a tenant-scoped result without the tenant in the key is a data leak, not an optimization. Use `cache-keys.ts`.
- **Move work to a queue rather than making the request faster.** Search indexing, embeddings, attachment text extraction, backlinks, watcher fan-out, and history all already run asynchronously; follow that pattern.
- **Watch queue backlog, not just job duration.** There is no dead-letter queue; a slow processor plus retries compounds into a growing Redis footprint and, with `noeviction`, memory pressure.
- **Respect the CRDT.** Reducing collaboration cost means tuning debounce and snapshot frequency, not skipping persistence. Losing a snapshot loses user content.
- **On the client, prefer fewer round trips.** Consolidate dependent queries, set sensible `staleTime`, and invalidate narrowly — over-broad invalidation causes request storms that look like a server problem.
- **Virtualize before paginating the UI.** `@tanstack/react-virtual` and `react-table` are already dependencies; long trees, tables, and lists should use them.
- **Bundle work belongs in `vite.config.ts`.** The `advancedChunks` group for Mantine is the precedent; measure before splitting further.
- **Beware Nx cache illusions.** A "faster build" may just be a cache hit. Compare with `--skip-nx-cache`.
- **Bench the formula engine.** `packages/base-formula/bench/formula-bench.ts` exists precisely so parser/evaluator regressions are measurable.

## Key Project Resources

- Documentation index: [.context/docs/README.md](../docs/README.md)
- Agent handbook: [.context/agents/README.md](README.md)
- Skills index: [.context/skills/README.md](../skills/README.md)
- Contributor guide: root [AGENTS.md](../../AGENTS.md)
- Semantic snapshot: `context({ action: "getMap", section: "stats" })`

## Repository Starting Points

- `apps/server/src/database/repos/` — where almost every server-side performance fix lands
- `apps/server/src/database/{pagination,migrations}/` — pagination contract and index definitions
- `apps/server/src/common/helpers/{cache-keys.ts,with-cache.ts}` — the caching surface
- `apps/server/src/integrations/queue/` — queues, processors, and job definitions
- `apps/server/src/collaboration/extensions/` — persistence debounce and `redis-sync`
- `apps/server/src/ws/` — socket.io fan-out and room membership cost
- `apps/server/src/integrations/{import,export}/` — the long-running jobs that pressure the DB pool
- `apps/client/src/features/page/tree/` — the largest client-side data structure
- `apps/client/src/features/editor/` — render-cost hot spot
- `apps/client/vite.config.ts` — chunking and build configuration
- `packages/base-formula/bench/` — the only committed benchmark

## Key Files

- `apps/server/src/database/repos/page/page.repo.ts` — the busiest repository; list and tree queries live here
- [apps/server/src/database/database.module.ts](../../apps/server/src/database/database.module.ts) — pool configuration
- `apps/server/src/database/pagination/pagination-options.ts` — shared list contract
- `apps/server/src/common/helpers/cache-keys.ts` and `with-cache.ts` — cache key discipline
- [apps/server/src/app.module.ts](../../apps/server/src/app.module.ts) — `CacheModule` TTL and Keyv/Redis wiring
- [apps/server/src/integrations/queue/constants/queue.constants.ts](../../apps/server/src/integrations/queue/constants/queue.constants.ts) — the 12 queues and their jobs
- `apps/server/src/integrations/queue/processors/{general,ai}-queue.processor.ts` — processor cost
- `apps/server/src/collaboration/extensions/persistence.extension.ts` — snapshot cadence
- `apps/server/src/collaboration/extensions/redis-sync/redis-sync.extension.ts` — cross-replica traffic
- `apps/server/src/collaboration/processors/history.processor.ts` — version-write volume
- [apps/client/vite.config.ts](../../apps/client/vite.config.ts) — `advancedChunks`, env inlining
- `apps/client/src/features/page/tree/model/tree-model.ts` — tree computation
- `packages/base-formula/bench/formula-bench.ts` — parser/evaluator benchmarks
- `Dockerfile` — build memory and parallelism constraints

## Architecture Context

- **Request path** — Fastify → middleware → guards → controller → service → repo → Postgres. The dominant cost is almost always SQL; interceptors and validation are cheap by comparison.
- **Cache layer** — Redis-backed, 5 s default TTL, opt-in per call site. Not a general read-through cache.
- **Async layer** — 12 hash-tagged queues absorbing email, indexing, embeddings, attachments, history, audit, SIEM, billing. This is the pressure valve for request latency and the usual place backlogs hide.
- **Realtime** — Yjs documents (persistent, debounced snapshots, Redis-relayed across replicas) and socket.io rooms (one per space plus one per user, joined on connect from `SpaceMemberRepo.getUserSpaceIds`). Room membership cost scales with spaces per user.
- **Client** — ~957 source files; Mantine is chunked separately; TanStack Query governs network volume; the Tiptap editor with collaboration is the heaviest runtime component.
- **Build** — Nx-cached, memory-constrained; the client bundle is the binding constraint (`--parallel=1` exists because of buildkit OOM).

## Key Symbols for This Agent

- `PageRepo`, `SpaceRepo`, `CommentRepo`, `AttachmentRepo` — the highest-volume queries
- `PaginationOptions` — the contract that prevents unbounded reads
- `withCache` and the `cache-keys.ts` builders
- `QueueName`, `QueueJob` — where to look for backlog
- `AiQueueProcessor`, `GeneralQueueProcessor`
- `CollaborationGateway`, `persistence.extension.ts`, `redis-sync.extension.ts`
- `WsService`, `WsTreeService`, `getSpaceRoomName`, `getUserRoomName`
- `tree-model.ts`, `acquireCollabSocket` (client hot paths)
- `evaluate`, `tokenize`, `BaseFormulaGraph` (formula engine hot paths)
- `EnvironmentService.getDatabaseMaxPool()` — pool ceiling

## Documentation Touchpoints

- [data-flow.md](../docs/data-flow.md) — "Observability & Failure Modes" describes the instruments and known pressure points
- [architecture.md](../docs/architecture.md) — risks and constraints, including build memory
- [tooling.md](../docs/tooling.md) — debug flags, Nx cache, build tuning
- [testing-strategy.md](../docs/testing-strategy.md) — where benchmarks fit
- [glossary.md](../docs/glossary.md) — fractional indexing and other performance-relevant invariants

## Collaboration Checklist

1. Define the symptom quantitatively: which endpoint or interaction, at what percentile, with what data volume.
2. Reproduce it with a realistic dataset; a fast query on ten pages proves nothing about ten thousand.
3. Instrument the suspected layer (`DEBUG_DB`, `LOG_HTTP`, devtools, queue inspection) and record the baseline number.
4. Identify the dominant cost — SQL, serialization, network round trips, render, or job contention — before proposing a change.
5. For SQL, capture `EXPLAIN` before and after; add indexes with a migration and regenerate `db.d.ts`.
6. For request latency, first ask whether the work can move to an existing queue.
7. For caching, verify the key includes the tenant and every varying dimension.
8. For client work, measure bundle and request counts before and after; prefer consolidation and virtualization over new dependencies.
9. Re-measure and report the delta against the baseline; confirm correctness with the existing specs and, where relevant, two-tab collaboration.
10. Record the finding and the numbers in [data-flow.md](../docs/data-flow.md) or [architecture.md](../docs/architecture.md) so the next investigation starts from evidence.

## Hand-off Notes

Report baseline and post-change numbers with the method used to obtain them — not impressions. Include `EXPLAIN` output for query changes, index names and the migration that created them, cache keys added, and any job moved to a queue. State the dataset size you tested against and whether you exercised multi-replica behavior (socket.io rooms, collab `redis-sync`) or only a single process. Flag trade-offs explicitly: added index write cost, cache staleness windows, increased queue depth, or larger Redis footprint. Note what you chose not to optimize and why, and any measurement you could not take for lack of instrumentation.
