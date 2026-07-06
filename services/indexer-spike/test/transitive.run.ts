/**
 * Transitive impact gate tests — multi-hop blast radius over a dependency chain
 * (gateway -> api -> core). Proves impact propagates through chains, not just
 * one hop. Offline; uses the isolated chain-org fixture.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildFullGraph, computeImpact, computeImpactTransitive } from '../src/fullgraph.ts';

const CHAIN = resolve(import.meta.dirname, '../../../fixtures/chain-org');
const SAMPLE = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ transitive-impact tests\n');

const { graph } = buildFullGraph(CHAIN);

check('1-hop impact of core is only its direct dependent (api)', () => {
  assert.deepEqual(computeImpact(graph, 'core').all, ['api']);
});
check('transitive impact of core reaches api AND gateway (2 hops)', () => {
  const t = computeImpactTransitive(graph, 'core');
  assert.deepEqual(t.impacted, ['api', 'gateway'], `impacted=${t.impacted}`);
  assert.equal(t.hops['api'], 1, 'api should be hop 1');
  assert.equal(t.hops['gateway'], 2, 'gateway should be hop 2');
});
check('transitive impact terminates at the top of the chain (gateway)', () => {
  assert.deepEqual(computeImpactTransitive(graph, 'gateway').impacted, []);
});
check('maxHops bounds the traversal depth', () => {
  const t = computeImpactTransitive(graph, 'core', 1);
  assert.deepEqual(t.impacted, ['api'], 'depth-1 should stop before gateway');
});

// On sample-org, transitivity must not loop despite cyclic couplings.
const { graph: sample } = buildFullGraph(SAMPLE);
check('cyclic couplings do not loop (sample-org terminates)', () => {
  const t = computeImpactTransitive(sample, 'auth-lib');
  assert.deepEqual(t.impacted, ['billing-svc', 'web-app'], `impacted=${t.impacted}`);
});
check('ACL scope is respected transitively', () => {
  const t = computeImpactTransitive(graph, 'core', 5, new Set(['core', 'api']));
  assert.deepEqual(t.impacted, ['api'], 'gateway should be hidden by scope');
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
