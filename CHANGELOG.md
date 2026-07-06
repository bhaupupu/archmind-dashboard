# CHANGELOG — Atlas

All notable changes to this project. Format loosely follows Keep a Changelog. The project is at the design stage; entries describe **documentation/design deliverables**, not code releases.

## [Unreleased]

### Added — Phase 0: transitive multi-hop impact (docs/03 blast radius)
- **`computeImpactTransitive(graph, repo, maxHops, scope?)`** in `fullgraph.ts` — BFS over the 1-hop multi-mechanism expander so impact propagates through chains (A depends on B depends on C ⇒ changing C reaches A). Depth-bounded, ACL-scopable, cycle-safe (a `seen` set), and returns per-repo hop distances.
- **`fixtures/chain-org`** (isolated new fixture): `gateway → api → core` dependency chain — added separately so the 3-repo `sample-org` assertions stay intact.
- Verified: `computeImpact(core)` = `[api]` (1 hop) but `computeImpactTransitive(core)` = `[api, gateway]` with hops `{api:1, gateway:2}`; depth-1 stops at `api`; cyclic `sample-org` couplings terminate; ACL scope hides out-of-scope repos transitively.
- **6 gate tests** (`test/transitive.run.ts`); `npm test` now runs **80 checks** across 12 suites.

### Added — Phase 0: datastore / shared-schema extraction (docs/03 READS/WRITES/SHARES_SCHEMA)
- **`services/indexer-spike/src/extractors/datastore.ts`** — deterministic SQL-shape detection (`SELECT … FROM`, `INSERT INTO`, `UPDATE … SET`, `DELETE FROM`) → `Table` nodes + `READS`/`WRITES` edges. A table touched by more than one repo emits **`SHARES_SCHEMA`** edges between them — the classic invisible coupling (change the `users` schema in one service, silently break another). Evidence-linked.
- **Fixtures** (additive): `web-app` reads `users`, `billing-svc` writes `users` + `invoices` — a real shared-schema coupling on `users`.
- **Folded into `fullgraph`**: `computeImpact` now reports `viaDatastore`. `impact("billing-svc")` = `{viaDepends:[], viaCalls:[web-app], viaConfig:[auth-lib], viaDatastore:[web-app], all:[auth-lib, web-app]}` — four mechanisms, still zero package dependents.
- **6 gate tests** (`test/datastore-extract.run.ts`) + extended fullgraph tests; `npm test` now runs **74 checks** across 11 suites. The graph now covers **all major docs/03 coupling mechanisms**: DEPENDS_ON, EXPOSES/CALLS, REFERENCES_ENV, READS/WRITES/SHARES_SCHEMA.

### Added — Phase 0: unified graph + multi-mechanism impact (docs/03)
- **`services/indexer-spike/src/fullgraph.ts`** — composes the three deterministic subgraphs (package `DEPENDS_ON`, HTTP `EXPOSES`/`CALLS`, config `REFERENCES_ENV`) into one graph, and `computeImpact(repo)` answers "what breaks if repo X changes?" across **all** coupling mechanisms (package deps + API callers + config co-readers), ACL-scopable. New composition only — imports the extractors and uses graph-core's public API; does not touch `org.ts` or `graph-core`.
- Demonstrates the core thesis conclusively: `impact("billing-svc")` finds **0 package dependents** but catches `web-app` (calls its `/api/charge`) and `auth-lib` (shares `JWT_SECRET`) — impact single-mechanism analysis misses entirely (`viaDepends:[]` → `all:[auth-lib, web-app]`).
- **7 gate tests** (`test/fullgraph.run.ts`); `npm test` now runs **68 checks** across 10 suites.

### Added — Phase 0: env-var / config-coupling extraction (docs/03 REFERENCES_ENV)
- **`services/indexer-spike/src/extractors/env.ts`** — deterministic extraction of environment references (`process.env.X`, `os.environ['X']`, `os.getenv`/`Getenv`) → `EnvVar` nodes + `REFERENCES_ENV` edges. An `EnvVar` referenced by more than one repo is flagged as an **implicit cross-repo config coupling** (rotate `JWT_SECRET` in one repo, break every reader) — the shared `EnvVar` node carries both repos in `repoIds` for permission-scoped serving. Evidence-linked (`file:line`).
- **Fixtures** (additive): `auth-lib` + `billing-svc` both read `JWT_SECRET` (a real shared coupling); `web-app` reads a repo-local `PORT`.
- **6 gate tests** (`test/env-extract.run.ts`); `npm test` now runs **61 checks** across 9 suites. Covers the founder's "environment variables" understanding requirement with running code; production adds `.env`/Helm/Terraform/K8s parsing (graph shape stable).

### Added — Phase 0: retrieval eval harness (docs/02 §evals)
- **`services/indexer-spike/test/eval.run.ts`** — golden-query eval over the fixture org measuring **recall@5, top-1 repo accuracy, and cross-repo impact recall**, with regression gates (recall@5 ≥ 0.9, top-1 ≥ 0.9, impact ≥ 0.9) that fail the build on a drop — the "retrieval tested like a compiler" harness from docs/02, seeded. Uses only stable modules (retrieval + graph + ingestion), independent of the agent/API layers.
- Documented a real finding: ambiguous SHARED tokens (e.g. `express`, imported by two repos) expose the bag-of-words stand-in's top-1 imprecision; golden queries target repo-specific symbols so the gate catches regressions rather than flapping on a known stand-in limit (real voyage-code-3 resolves it). Current run: recall@5 = top1 = impactRecall = 1.00. `npm test` now runs **55 checks** across 8 suites.

### Added — Phase 0: API + service-to-service graph extraction (docs/03 Q5/Q6)
- **`services/indexer-spike/src/extractors/apis.ts`** — deterministic route + call extraction: framework-aware regex finds Express/FastAPI route definitions → `APIEndpoint` nodes + `EXPOSES` edges, and client call sites (`fetch`/`axios`/`requests`) → `CALLS` edges, matched to the exposing repo by `(METHOD, path)` so **cross-repo service calls become graph edges**. Calls to unknown endpoints produce no edge (no hallucinated comms). Evidence-linked (`file:line`).
- **Fixtures** (additive): `billing-svc/src/routes.ts` exposes `POST /api/charge` + `GET /api/invoices`; `web-app/src/api-client.ts` calls them — yielding a real cross-repo `CALLS` (web-app → billing-svc) alongside the existing `DEPENDS_ON`.
- **7 gate tests** (`test/api-extract.run.ts`); `npm test` now runs **52 checks** across 7 suites. Answers "how are APIs tracked" and "how is service-to-service communication represented" with running code. Production swaps the regex for tree-sitter queries + OpenAPI/AsyncAPI specs; the graph shape is stable.

### Added — Phase 0: Planning agent + Next.js SSE integration
- **Planning agent** (`services/indexer-spike/src/agents/planning.ts`, Opus) — produces a per-repo `RepoChangePlan` (required changes, technical approach, side effects, testing, migrations) for every affected repo; wired into the orchestrator (Advisory mode's final output). Gate tests assert a plan per affected repo with all five fields populated.
- **SSE format aligned to the Next.js dashboard** — `SseStream` now emits `data:`-only JSON frames plus a `[DONE]` sentinel (the report as `data: {report}`), matching `apps/web` `page.tsx`'s fetch-stream parser (which proxies `/api/v1/*` → the API via a `next.config` rewrite). API SSE test rewritten to parse frames the same way the dashboard does.
- Added `analysis` stage event so the dashboard timeline advances; `.data/` (file persistence) added to `.gitignore`.

> Note: this repo is being developed by concurrent workstreams. In parallel with the above, `apps/web` was migrated to a Next.js 15 + shadcn/ui dashboard, and the agent orchestrator was extended with a **Synthesis agent** (`synthesis.ts`: global verdict + executive summary), a **PR-generation stage** (`pr.ts`: suggested diffs + PR bodies), and file-based persistence (`apps/api/src/db.ts`). All of it runs together green (`npm test` = 45 checks).

### Added — Phase 0: orchestrator-worker agent layer (real Claude)
- **`@atlas/agent-core`** — `LLMClient` abstraction with model routing (Opus/Sonnet/Haiku ids per docs/05) and forced structured output. `AnthropicClient` (real Claude via the Messages API + forced tool-use, used when `ANTHROPIC_API_KEY` is set) and `MockLLMClient` (returns each request's deterministic fallback, so the pipeline runs and tests offline).
- **Agent stages** (`services/indexer-spike/src/agents/`): `scope.ts` (Opus — selects directly-affected repos), `analysis.ts` (Sonnet — per-repo, isolated context, retrieved code **spotlighted as untrusted data** for prompt-injection defense, docs/05 §7), `guards.ts` (**hallucination guard** — drops cited file paths that don't exist in the index and downgrades findings left with no valid evidence, docs/05 §6), `orchestrator.ts` (Scope → parallel per-repo Analysis → evidence verification → graph expansion → `ImpactReport`).
- **API + dashboard integration** — `POST /v1/analyses {mode:"agent"}` runs the agent pipeline (streams the same SSE events); dashboard gains an "Analysis mode" selector. Verified in the browser: agent mode scoped to auth-lib then expanded via the graph, streaming Scope/finding stages live.
- **8 new tests** (agent suite + agent-mode API test); `npm test` now runs **45 checks** across 6 suites.

### Added — Phase 0: browser dashboard (static SPA)
- **`apps/web`** — a zero-build static dashboard (vanilla HTML/CSS/JS) served by the API at `/`: organization + change-intent inputs, an **Analyze** button that opens the `POST /v1/analyses` **SSE stream** and shows stage events live, evidence-linked impact-report cards with `must_change`/`may_change` badges, and an **SVG dependency-graph** visualization built from `/v1/graph`. Production replaces this with Next.js 15 + React Flow (docs/01).
- API now serves the static assets (`/`, `/app.js`, `/styles.css`) same-origin.
- **Verified live in a browser** via the preview harness: the graph auto-loaded (auth-lib → web-app, billing-svc), and clicking Analyze streamed all 10 pipeline stages and rendered 3 findings with file/graph evidence. 2 new API tests assert dashboard serving; `npm test` now runs **37 checks**.

### Added — Phase 0: running core API (HTTP + SSE)
- **`apps/api`** — the core API as a zero-dependency Node `http` server (Phase-0 stand-in for NestJS, same docs/01 §5 surface). Endpoints: `GET /health`, `GET /v1/repos`, `GET /v1/graph` (React Flow feed), `POST /v1/analyses` (returns JSON, or streams **SSE** pipeline stage events when `Accept: text/event-stream`), `GET /v1/analyses/:id`, `GET /v1/prompt-history`. Tiny router + JSON + `SseStream` helpers in `src/http.ts`; tenancy stubbed via `x-tenant-id`.
- **Streaming analysis** — `runImpactAnalysis` now emits stage events (`started → scope → indexing → retrieval → finding → complete`) consumed by the SSE endpoint.
- **8 API gate tests** (`apps/api/test/api.run.ts`) boot the server on an ephemeral port and exercise every endpoint incl. SSE; `npm test` now runs **35 tests**. Scripts: `api:dev`, `test:api`.
- Recorded another Node type-stripping gotcha: **TypeScript parameter properties** (`constructor(private x)`) are unsupported — use explicit field assignment.

### Added — Phase 0: retrieval + end-to-end impact analysis
- **Retrieval** (`services/indexer-spike/src/retrieval.ts`) — loads the ingestion stores and implements two of the four primitives (lexical term-frequency + semantic cosine) fused with **reciprocal-rank fusion (k=60)** per docs/02 §5.2. Added a `BagOfWordsEmbedder` (feature-hashing) so semantic search is meaningful offline without a live model.
- **End-to-end impact analysis** (`src/analyze.ts`, `src/analyze-cli.ts`) — deterministic stand-in for the agent pipeline: index org → retrieve → **Scope** (matched repos → `must_change`) → **graph expand** (dependents → `may_change` with graph evidence) → evidence-linked `ImpactReport`. Demonstrates the core thesis: for query "jsonwebtoken", auth-lib matches by retrieval and web-app/billing-svc are surfaced *only* by the cross-repo graph edge — impact pure RAG misses. Planning is left empty (LLM agent stage, not implemented).
- **12 new tests** (retrieval + analysis suites); `npm test` now runs **27 tests**. Root scripts: `analyze`, `test:retrieval`, `test:analyze`.

### Added — Phase 0: cross-repo dependency graph (the moat, first slice)
- **`@atlas/graph-core`** — in-memory Tier-1 org knowledge graph (docs/03): typed nodes/edges, `dependents()`, `blastRadius()` (transitive, BFS over reverse DEPENDS_ON), and **permission-scoped serving** (every node/edge carries `repoIds`; traversals filter by the caller's visible set per docs/03 §6.4).
- **Dependency extractor** (`services/indexer-spike/src/extractors/dependencies.ts`) — deterministic npm (`package.json`) + best-effort Python (`requirements.txt`) manifest parsing with per-dependency line numbers for evidence.
- **Org graph builder + impact CLI** (`src/org.ts`, `src/org-index.ts`) — matches declared deps against internally-published package coordinates to synthesize **cross-repo `DEPENDS_ON` edges**; answers "if repo X changes, what breaks?" with `file:line` evidence. External packages (express, react, stripe) get nodes but produce no false cross-repo edges.
- **`fixtures/sample-org`** — 3-repo fixture (auth-lib ← web-app, billing-svc) exercising cross-repo edge discovery and ACL scoping.
- **7 org-graph gate tests** (`test/org.run.ts`); `npm test` now runs all **16 tests** (ingestion + graph). Root scripts: `org:index`, `test:org`, `test`.

### Added — Phase 0 implementation (first slice)
- **Monorepo scaffold** (npm workspaces; pnpm/Turborepo is the eventual target): root `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.nvmrc`.
- **`@atlas/shared-types`** — cross-service contracts: chunks, embeddings, evidence, findings, change plans, and the full graph node/edge taxonomy with runtime guards (soft-edge confidence cap).
- **`@atlas/scm-provider`** — the 5-port SCM abstraction (auth, repos, clone, webhooks, PRs) + provider registry.
- **`@atlas/config`** — dependency-free typed env loader (graceful + strict variants).
- **`services/indexer-spike`** — runnable ingestion vertical slice (Node 22+ type-stripping, zero install, no infra): file walk → language detection → **secret-scan (before embed)** → structure-aware chunking (TS/JS brace-depth, Python def/class) → content-addressed dedupe → pluggable embedder (mock ↔ real voyage-code-3) → 3-sink store (redacted blobs / chunk metadata / vectors-only). **9 gate tests pass**, proving no planted secret reaches any artifact and the vector store carries no source code.
- **`fixtures/sample-repo`** — fixture with planted fake secrets for the gate tests.
- **`infra/migrations/0001_init.sql`** — Postgres 16 schema (20 tables) with `FORCE ROW LEVEL SECURITY` and `current_setting('app.tenant_id', false)` per docs/06.
- **`docker-compose.yml`** — local infra spec (Postgres, Redis, Qdrant, Neo4j, Temporal, LocalStack).

### Notes
- Toolchain on the build machine: Node 24 + npm + git + Python; **no pnpm/Docker/cargo**, hence npm workspaces + a TypeScript spike (production indexer is Rust). Documented as Phase-0 substitutions in `PROJECT_HANDOFF.md` §2/§13.
- Gotcha recorded: literal control characters must not be embedded in `.ts` source under Node type-stripping (use numeric/`charCodeAt` checks).

## [0.1.0-design] — Architecture package (this session)

The founding architecture package for **Atlas**, an AI multi-repository engineering intelligence platform, was authored, adversarially reviewed, reconciled, and handed off.

### Added — architecture specification (10 documents, ~5,200 lines)
- `README.md` — master index: thesis, 10 key decisions, six-retrieval-questions table, technology table, 15-deliverable coverage map, reading order.
- `docs/01-system-architecture.md` — system + backend architecture, SCM provider abstraction, monorepo folder structure, full REST/SSE API surface, tenancy flow.
- `docs/02-retrieval-and-rag.md` — retrieval/RAG design, the six questions, four retrieval primitives, fusion→rerank pipeline, agent tool inventory, eval harness.
- `docs/03-graph-design.md` — two-tier graph, node/edge taxonomy, Cypher, extraction pipelines, incremental maintenance, visualization feed.
- `docs/04-github-and-ingestion.md` — GitHub App, OAuth, webhooks, cloning, 10-language parse table, chunking, embedding, incremental indexing, Temporal workflows.
- `docs/05-ai-and-agents.md` — AI architecture, model routing, orchestrator-worker agent pipeline, safety, hallucination guards, evals.
- `docs/06-data-architecture.md` — Postgres DDL, Qdrant/Neo4j/Redis/S3 design, data lifecycle, encryption, offboarding.
- `docs/07-scalability-and-cost.md` — load model at 10/100/1000 repos, bottlenecks, cost tables, unit economics, context-window math.
- `docs/08-security-and-deployment.md` — threat model, code privacy, tenancy tiers, secrets, sandboxing, EKS deployment, compliance.
- `docs/09-roadmap-team-risks-competition.md` — roadmap, team plan, risk register, competitive analysis.

### Added — handoff documentation
- `PROJECT_HANDOFF.md` — comprehensive 20-section staff-to-staff engineering handoff.
- `ARCHITECTURE.md` — distilled architecture cross-reference.
- `ROADMAP.md` — phased delivery plan.
- `CHANGELOG.md` — this file.

### Key architectural decisions locked
- Pure vector RAG rejected in favor of four retrieval primitives (lexical/Zoekt + semantic/Qdrant + org graph/Neo4j + symbol/SCIP).
- Deterministic graph construction (not LLM "Graph RAG"); LLM only for low-confidence soft edges.
- Two-tier graph: Neo4j org graph + on-demand SCIP symbol artifacts in S3 (symbol edges never materialized in Neo4j).
- Postgres as source of truth for edge assertions; Neo4j as a rebuildable projection.
- Orchestrator-worker agents with per-repo context isolation (not seven fixed personas).
- Modular monolith (NestJS) + Temporal backbone; Rust indexer fleet.
- Launch scope: TS/JS + Python, Advisory mode only (challenging the founder's "ten languages / autonomous" framing).

### Reviewed / reconciled
- Ran a 4-lens adversarial review (consistency, scale-skeptic, completeness, red-team): 29 findings (7 critical, 15 major, 7 minor).
- Applied 27 substantive fixes across docs 01/02/04/05/07 (always-on spend gate; blocking injection quarantine for autonomous mode; two new hallucination guards; corrected embedding-throughput and Redis-sizing math; reconciled cost/node-count figures; RRF worked-example arithmetic).
- **Rejected 3 "critical" findings as reviewer hallucinations** after verifying against the actual files (secret-to-LLM leak, graph-ACL leak, wrong table name — all already correctly handled in the design).
- Manually fixed 2 residual cross-doc inconsistencies (authz cache TTL → 300s; canonical retrieval tool names in the folder listing).

### Notes
- All cost, latency, throughput, and sizing figures are engineering estimates marked "estimate — verify"; none benchmarked.
- No application code exists yet. Implementation begins at Phase 0 (see `ROADMAP.md`, `PROJECT_HANDOFF.md` §8).

### Process
- Authored via multi-agent workflows; several runs were interrupted by rolling session-token limits and resumed via `resumeFromRunId` (completed agents cached). Documented for future large runs.
