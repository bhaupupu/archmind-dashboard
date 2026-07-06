/**
 * Org graph gate tests — proves deterministic cross-repo edge discovery and the
 * permission-scoped serving model (docs/03). Runs on plain Node, no infra.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildOrgGraph, repoNodeId } from '../src/org.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ org-graph tests\n');

const { graph, crossRepoEdges } = buildOrgGraph(ORG);
const authId = repoNodeId('auth-lib');
const dependents = graph.dependents(authId).map((n) => n.name).sort();
const blast = [...graph.blastRadius(authId)].map((id) => id.replace('repo:', '')).sort();

check('discovers exactly the two cross-repo edges', () => assert.equal(crossRepoEdges, 2, `got ${crossRepoEdges}`));
check('web-app and billing-svc depend on auth-lib', () => assert.deepEqual(dependents, ['billing-svc', 'web-app']));
check('blast radius of auth-lib = both consumers', () => assert.deepEqual(blast, ['billing-svc', 'web-app']));
check('external deps do NOT create cross-repo edges', () => {
  // express/react/stripe/jsonwebtoken are Package nodes but have no Repo publisher,
  // so no repo DEPENDS_ON a repo through them.
  assert.equal(graph.dependents(repoNodeId('web-app')).length, 0, 'web-app should have no dependents');
});
check('every DEPENDS_ON edge carries file evidence', () => {
  for (const e of graph.allEdges()) {
    assert.ok(e.evidence.length > 0 && e.evidence[0]!.path === 'package.json', `edge ${e.srcId}->${e.dstId} missing evidence`);
    assert.ok(e.confidence >= 0.7, 'deterministic edge below 0.7 confidence');
  }
});
check('permission scoping hides unauthorized dependents', () => {
  const scoped = graph.dependents(authId, new Set(['auth-lib', 'web-app'])).map((n) => n.name);
  assert.deepEqual(scoped, ['web-app'], `billing-svc leaked: ${scoped.join(',')}`);
});
check('blast radius respects ACL scope', () => {
  const scoped = [...graph.blastRadius(authId, 5, new Set(['auth-lib', 'web-app']))].map((id) => id.replace('repo:', ''));
  assert.deepEqual(scoped, ['web-app']);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
