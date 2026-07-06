/**
 * Spike test harness — the Phase-0 gate for the secret-scan invariant and the
 * pipeline shape. Runs with plain Node (node test/run.ts); no framework.
 * This is the seed of the retrieval eval suite described in docs/02 §evals.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ingestRepo } from '../src/pipeline.ts';
import { MockEmbedder } from '../src/embedder.ts';

const PLANTED = ['AKIAIOSFODNN7EXAMPLE', 'sk-supersecretvalue123456', 'hunter2hunter2'];
const FIXTURE = resolve(import.meta.dirname, '../../../fixtures/sample-repo');

function readAll(dir: string): string {
  return readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  �’ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ indexer-spike tests\n');

const embedder = new MockEmbedder(64);
const stats = await ingestRepo(FIXTURE, { repoId: 'sample-repo', commit: 'TEST', embedder });
const out = stats.outputDir;
const blobs = readAll(join(out, 'blobs'));
const vectors = readFileSync(join(out, 'vectors.jsonl'), 'utf8');
const chunksMeta = readFileSync(join(out, 'chunks.jsonl'), 'utf8');

check('produces chunks', () => assert.ok(stats.chunks > 0, `chunks=${stats.chunks}`));
check('embeds every chunk', () => assert.equal(stats.embeddings, stats.chunks));
check('indexes ts + python', () => {
  assert.ok(stats.byLanguage['typescript']! >= 1, 'no ts');
  assert.ok(stats.byLanguage['python']! >= 1, 'no py');
});
check('detects the planted secrets', () => assert.ok(stats.secretsRedacted >= 3, `redacted=${stats.secretsRedacted}`));
check('NO planted secret survives into blobs', () => {
  for (const s of PLANTED) assert.ok(!blobs.includes(s), `secret leaked into blob: ${s}`);
});
check('redaction placeholder is present in blobs', () => assert.ok(blobs.includes('«REDACTED-SECRET»')));
check('vector store carries NO source code', () => {
  assert.ok(!vectors.includes('function'), 'source keyword leaked into vectors.jsonl');
  assert.ok(!vectors.includes('class '), 'source leaked into vectors.jsonl');
  for (const s of PLANTED) assert.ok(!vectors.includes(s), `secret leaked into vectors: ${s}`);
});
check('chunk metadata carries no raw secret', () => {
  for (const s of PLANTED) assert.ok(!chunksMeta.includes(s), `secret leaked into chunks.jsonl: ${s}`);
});
check('content addressing is deterministic', async () => {
  const s2 = await ingestRepo(FIXTURE, { repoId: 'sample-repo-2', commit: 'TEST', embedder });
  const ids1 = readFileSync(join(out, 'chunks.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id).sort();
  const ids2 = readFileSync(join(s2.outputDir, 'chunks.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id).sort();
  assert.deepEqual(ids1, ids2, 'same content produced different ids across runs');
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);

import './symbols.test.ts';