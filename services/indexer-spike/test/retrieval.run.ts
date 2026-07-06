/**
 * Retrieval gate tests — lexical + semantic + RRF fusion over the org fixture.
 * The seed of the docs/02 retrieval eval harness (recall on planted queries).
 */
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { ingestRepo } from '../src/pipeline.ts';
import { BagOfWordsEmbedder } from '../src/embedder.ts';
import { RetrievalIndex } from '../src/retrieval.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');
const REPOS = ['auth-lib', 'web-app', 'billing-svc'];

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ retrieval tests\n');

const embedder = new BagOfWordsEmbedder();
const dirs: string[] = [];
for (const r of REPOS) {
  const s = await ingestRepo(join(ORG, r), { repoId: r, commit: 'TEST', embedder });
  dirs.push(s.outputDir);
}
const index = RetrievalIndex.load(dirs);

check('index loads chunks with text and vectors', () => {
  assert.ok(index.chunks.length > 0);
  assert.ok(index.chunks.every((c) => c.embedding.length > 0), 'a chunk is missing its vector');
});
check('lexical "jsonwebtoken" hits only auth-lib', () => {
  const repos = new Set(index.lexical('jsonwebtoken').map((s) => s.chunk.repoId));
  assert.deepEqual([...repos], ['auth-lib'], `got ${[...repos]}`);
});
check('semantic search returns ranked results', async () => {
  const [qv] = await embedder.embed(['verify authentication token']);
  const sem = index.semantic(qv!, 10);
  assert.ok(sem.length > 0 && sem[0]!.score > 0);
});
check('fused search for verifyToken surfaces auth-lib source', async () => {
  const hits = await index.search('verifyToken principal scopes', embedder, 10);
  assert.ok(hits.some((h) => h.chunk.repoId === 'auth-lib' && h.chunk.path.includes('index.ts')), 'auth-lib source not in top hits');
});
check('fused ranking is stable (deterministic)', async () => {
  const a = (await index.search('jsonwebtoken', embedder, 5)).map((h) => h.chunk.id);
  const b = (await index.search('jsonwebtoken', embedder, 5)).map((h) => h.chunk.id);
  assert.deepEqual(a, b);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
