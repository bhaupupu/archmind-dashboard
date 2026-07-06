/**
 * Unified-graph gate tests — the composed graph carries all node/edge types, and
 * multi-mechanism impact catches coupling that DEPENDS_ON alone misses (docs/03).
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildFullGraph, computeImpact } from '../src/fullgraph.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ fullgraph tests\n');

const { graph, stats } = buildFullGraph(ORG);

check('composed graph carries all five node types', () => {
  for (const t of ['Repo', 'Package', 'APIEndpoint', 'EnvVar', 'Table']) {
    assert.ok((stats.byNodeType[t] ?? 0) > 0, `missing node type ${t}`);
  }
});
check('composed graph carries all coupling edge types', () => {
  for (const t of ['DEPENDS_ON', 'EXPOSES', 'CALLS', 'REFERENCES_ENV', 'READS', 'WRITES', 'SHARES_SCHEMA']) {
    assert.ok((stats.byEdgeType[t] ?? 0) > 0, `missing edge type ${t}`);
  }
});

const bImpact = computeImpact(graph, 'billing-svc');
const auth = computeImpact(graph, 'auth-lib');

check('billing-svc has NO package dependents (DEPENDS_ON alone = empty)', () => {
  assert.deepEqual(bImpact.viaDepends, []);
});
check('...but IS impactful via API callers, shared config, shared schema, and messaging', () => {
  assert.deepEqual(bImpact.viaCalls, ['web-app']);
  assert.deepEqual(bImpact.viaConfig, ['auth-lib']);
  assert.deepEqual(bImpact.viaDatastore, ['web-app']);
  assert.deepEqual(bImpact.viaMessaging, ['web-app']);
  assert.deepEqual(bImpact.all.sort(), ['auth-lib', 'web-app']);
});
check('the multi-mechanism graph beats single-mechanism (DEPENDS_ON) analysis', () => {
  // The whole point: 0 via DEPENDS_ON, 2 via the full graph.
  assert.ok(bImpact.all.length > bImpact.viaDepends.length);
});
check('auth-lib impact spans package deps + config', () => {
  assert.deepEqual(auth.viaDepends, ['billing-svc', 'web-app']);
  assert.deepEqual(auth.viaConfig, ['billing-svc']); // shares JWT_SECRET
  assert.deepEqual(auth.all, ['billing-svc', 'web-app']);
});
check('ACL scope filters the impact set', () => {
  const scoped = computeImpact(graph, 'auth-lib', new Set(['auth-lib', 'web-app']));
  assert.deepEqual(scoped.all, ['web-app'], `scoped=${scoped.all}`); // billing-svc hidden
});

console.log('\n  impact("billing-svc") =', JSON.stringify(bImpact));
console.log('  impact("auth-lib")    =', JSON.stringify(auth));
console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
