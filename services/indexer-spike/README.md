# indexer-spike

The **Phase-0 ingestion vertical slice** (PROJECT_HANDOFF §8 task 6). It proves the
ingestion pipeline shape and the load-bearing security invariant end-to-end, and
runs with **plain Node 22+ — no `npm install`, no Docker, no external services.**

## Run it

```bash
# from the repo root
node services/indexer-spike/src/index.ts fixtures/sample-repo   # index the fixture
node services/indexer-spike/test/run.ts                         # run the test gate
```

Output lands in `<repoDir>/.atlas/<repoId>/`:
- `blobs/<id>.txt` — **redacted** chunk text (the only place text lives)
- `chunks.jsonl` — chunk metadata (mirrors the Postgres `chunks` table)
- `vectors.jsonl` — `{id, embedding}` only, **no source code** (mirrors the Qdrant collection)
- `manifest.json` — run stats

## What it validates

| Concern | How |
|---|---|
| Secret-scan **before** embedding (docs/04 §3.5) | `pipeline.ts` redacts the whole file before chunk/hash/embed; the test asserts zero planted secrets in any artifact |
| Structure-aware chunking (docs/02) | `chunker.ts` splits TS/JS by brace depth and Python by top-level def/class |
| Content-addressed dedupe (docs/04) | `content-address.ts` hashes normalized redacted content; identical chunks embed once; ids are deterministic |
| No source code in the vector store (docs/06) | `store.ts` writes vectors and text to separate sinks; the test greps vectors.jsonl for leakage |
| Pluggable embeddings (docs/02) | `embedder.ts` — `MockEmbedder` by default, real `voyage-code-3` when `VOYAGE_API_KEY` is set |

## What is mocked / simplified (and the production swap)

- **Embeddings** → mock hash vectors unless `VOYAGE_API_KEY` is set. Prod: voyage-code-3, int8-quantized into Qdrant.
- **Parsing** → regex/brace heuristics. Prod: tree-sitter + SCIP (the `chunker.ts` output contract is stable, so the swap is local).
- **Stores** → local JSON/blobs. Prod: S3 (redacted blobs) + Postgres (`chunks`) + Qdrant (vectors).
- **Language** → this spike is TypeScript; production indexer is **Rust** (docs/01, docs/04). This exists to de-risk the pipeline logic quickly, not to be the production indexer.

## Switch to real embeddings

```bash
VOYAGE_API_KEY=... node services/indexer-spike/src/index.ts fixtures/sample-repo
```
