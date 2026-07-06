/**
 * Retrieval + impact eval harness (docs/02 §evals). Golden queries with expected
 * outcomes over the fixture org; measures recall@k, top-1 repo accuracy, and
 * cross-repo impact recall; asserts regression thresholds (a CI gate). This is the
 * seed of the "retrieval is tested like a compiler" harness — the fixture grows
 * into the synthetic org described in docs/02 §9.
 *
 * Metrics are computed from stable modules only (retrieval + graph + ingestion),
 * so the harness is independent of the agent/API layers.
 */
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { ingestRepo } from '../src/pipeline.ts';
import { BagOfWordsEmbedder } from '../src/embedder.ts';
import { RetrievalIndex } from '../src/retrieval.ts';
import { buildOrgGraph, repoNodeId } from '../src/org.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');
const REPOS = ['auth-lib', 'web-app', 'billing-svc'];
const K = 5;

interface Golden {
  query: string;
  expectedTopRepo: string;   // repo of the #1 fused hit
  expectedRepos: string[];   // must appear among top-K retrieved chunks
  expectedAffected: string[]; // impact = retrieval seeds ∪ graph dependents
}

// Grounded in the fixture, each query targets a repo-specific token/symbol:
// jsonwebtoken/orgId/userId are auth-lib-only; stripe is billing-only; handleRequest
// /authHeader are web-app-only. Impact expands seeds via DEPENDS_ON.
//
// NOTE on the stand-in's ceiling: ambiguous SHARED terms expose the bag-of-words
// embedder's imprecision — e.g. "express react" mis-ranks top-1 because `express`
// is imported in both web-app and billing-svc, so the BoW vectors blur them.
// Real voyage-code-3 (docs/02) resolves this; we keep golden queries unambiguous
// so the gate catches regressions rather than flapping on a known stand-in limit.
const GOLDEN: Golden[] = [
  { query: 'jsonwebtoken', expectedTopRepo: 'auth-lib', expectedRepos: ['auth-lib'], expectedAffected: ['auth-lib', 'web-app', 'billing-svc'] },
  { query: 'Principal orgId userId', expectedTopRepo: 'auth-lib', expectedRepos: ['auth-lib'], expectedAffected: ['auth-lib', 'web-app', 'billing-svc'] },
  { query: 'stripe billing', expectedTopRepo: 'billing-svc', expectedRepos: ['billing-svc'], expectedAffected: ['billing-svc'] },
  { query: 'handleRequest authHeader', expectedTopRepo: 'web-app', expectedRepos: ['web-app'], expectedAffected: ['web-app'] },
];

const embedder = new BagOfWordsEmbedder();
const dirs: string[] = [];
for (const r of REPOS) {
  const s = await ingestRepo(join(ORG, r), { repoId: r, commit: 'EVAL', embedder });
  dirs.push(s.outputDir);
}
const index = RetrievalIndex.load(dirs);
const { graph } = buildOrgGraph(ORG);

function impactedRepos(seedRepos: string[]): Set<string> {
  const affected = new Set(seedRepos);
  for (const seed of seedRepos) for (const dep of graph.dependents(repoNodeId(seed))) affected.add(dep.name);
  return affected;
}

interface Row { query: string; recallAtK: number; top1: boolean; impactRecall: number }
const rows: Row[] = [];

for (const g of GOLDEN) {
  const hits = await index.search(g.query, embedder, 10);
  const topKRepos = new Set(hits.slice(0, K).map((h) => h.chunk.repoId));
  const recallAtK = g.expectedRepos.filter((r) => topKRepos.has(r)).length / g.expectedRepos.length;
  const top1 = hits[0]?.chunk.repoId === g.expectedTopRepo;

  const seeds = [...new Set(hits.map((h) => h.chunk.repoId))];
  const affected = impactedRepos(seeds);
  const impactRecall = g.expectedAffected.filter((r) => affected.has(r)).length / g.expectedAffected.length;

  rows.push({ query: g.query, recallAtK, top1, impactRecall });
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const mRecall = avg(rows.map((r) => r.recallAtK));
const mTop1 = rows.filter((r) => r.top1).length / rows.length;
const mImpact = avg(rows.map((r) => r.impactRecall));

console.log('\n▶ retrieval eval (golden queries over sample-org)\n');
console.log('  query                    recall@5   top1   impactRecall');
for (const r of rows) {
  console.log(`  ${r.query.padEnd(24)} ${r.recallAtK.toFixed(2).padStart(6)}   ${(r.top1 ? 'yes' : 'NO ').padStart(4)}   ${r.impactRecall.toFixed(2).padStart(6)}`);
}
console.log(`\n  aggregate: recall@${K}=${mRecall.toFixed(2)}  top1=${mTop1.toFixed(2)}  impactRecall=${mImpact.toFixed(2)}\n`);

// Regression gates (docs/02: CI blocks merges on metric drops).
let failures = 0;
const gate = (name: string, value: number, min: number) => {
  const ok = value >= min;
  if (!ok) failures++;
  console.log(`  ${ok ? '✔' : '✗'} ${name} ${value.toFixed(2)} >= ${min}`);
};
gate('recall@K   ', mRecall, 0.9);
gate('top1 acc   ', mTop1, 0.9);
gate('impactRecall', mImpact, 0.9);

console.log(`\n${failures === 0 ? '✔ eval gates passed' : `✗ ${failures} gate(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
