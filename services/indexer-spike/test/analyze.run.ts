/**
 * Impact-analysis gate tests — proves graph + retrieval synthesis produces an
 * evidence-linked ImpactReport where the graph adds repos retrieval alone misses.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runImpactAnalysis } from '../src/analyze.ts';
import { ingestRepo } from '../src/pipeline.ts';
import { buildOrgGraph } from '../src/org.ts';
import { BagOfWordsEmbedder } from '../src/embedder.ts';
import { join } from 'node:path';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ impact-analysis tests\n');

// "jsonwebtoken" appears only in auth-lib — so web-app/billing-svc can ONLY be
// pulled in via the cross-repo graph, proving graph adds value beyond retrieval.
const { repos } = buildOrgGraph(ORG);
const embedder = new BagOfWordsEmbedder();
for (const r of repos) {
  await ingestRepo(join(ORG, r), { repoId: r, commit: 'WORKINGDIR', embedder });
}

const { report } = await runImpactAnalysis(ORG, 'jsonwebtoken');
const byRepo = new Map(report.affectedRepos.map((f) => [f.repoId, f]));

check('auth-lib is must_change (matched by retrieval)', () => {
  assert.equal(byRepo.get('auth-lib')?.disposition, 'must_change');
});
check('dependents are pulled in via the graph as may_change', () => {
  assert.equal(byRepo.get('web-app')?.disposition, 'may_change');
  assert.equal(byRepo.get('billing-svc')?.disposition, 'may_change');
});
check('graph-sourced findings carry graph evidence', () => {
  const web = byRepo.get('web-app')!;
  assert.ok(web.evidence.some((e) => e.kind === 'graph' && e.edgeType === 'DEPENDS_ON'), 'no graph evidence on web-app');
});
check('every finding carries at least one evidence item', () => {
  for (const f of report.affectedRepos) assert.ok(f.evidence.length > 0, `${f.repoId} has no evidence`);
});
check('auth-lib finding cites a real file', () => {
  const fileEv = byRepo.get('auth-lib')!.evidence.find((e) => e.kind === 'file');
  assert.ok(fileEv && fileEv.kind === 'file' && fileEv.path.length > 0);
});
check('plans are empty (Planning agent not implemented in Phase 0)', () => {
  assert.equal(report.plans.length, 0);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
