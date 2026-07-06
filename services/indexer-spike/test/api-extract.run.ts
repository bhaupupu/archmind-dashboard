/**
 * API-extraction gate tests — proves route + call extraction builds APIEndpoint
 * nodes, EXPOSES edges, and cross-repo CALLS edges (docs/03 Q5/Q6). Pure, offline.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildApiGraph, extractRoutes, extractCalls } from '../src/extractors/apis.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ api-extract tests\n');

check('extractRoutes finds express routes with method + path', () => {
  const rs = extractRoutes(`router.post('/api/charge', h); router.get("/api/invoices", h);`);
  assert.equal(rs.length, 2);
  assert.deepEqual(rs.map((r) => `${r.method} ${r.path}`).sort(), ['GET /api/invoices', 'POST /api/charge']);
});
check('extractCalls detects fetch method (default GET, explicit POST)', () => {
  const cs = extractCalls(`fetch('/api/invoices'); fetch('/api/charge', { method: 'POST' });`);
  const set = new Set(cs.map((c) => `${c.method} ${c.path}`));
  assert.ok(set.has('GET /api/invoices') && set.has('POST /api/charge'), [...set].join(','));
});

const { graph, routes, calls, crossRepoCalls } = buildApiGraph(ORG);

check('billing-svc exposes /api/charge and /api/invoices as APIEndpoint nodes', () => {
  const charge = graph.getNode('endpoint:POST /api/charge');
  const invoices = graph.getNode('endpoint:GET /api/invoices');
  assert.ok(charge && charge.type === 'APIEndpoint', 'no charge endpoint node');
  assert.ok(invoices && invoices.type === 'APIEndpoint', 'no invoices endpoint node');
});
check('EXPOSES edges connect billing-svc to its endpoints with evidence', () => {
  const exposes = graph.outgoing('repo:billing-svc', 'EXPOSES');
  assert.equal(exposes.length, 2, `expected 2 EXPOSES, got ${exposes.length}`);
  assert.ok(exposes.every((e) => e.evidence[0]?.path.includes('routes')), 'EXPOSES missing route-file evidence');
});
check('web-app CALLS billing-svc cross-repo via matched endpoints', () => {
  const callsToBilling = graph.outgoing('repo:web-app', 'CALLS').filter((e) => e.dstId === 'repo:billing-svc');
  assert.ok(callsToBilling.length >= 1, 'no cross-repo CALLS edge web-app -> billing-svc');
  assert.equal(crossRepoCalls, 2, `expected 2 cross-repo calls (charge+invoices), got ${crossRepoCalls}`);
});
check('a call to an unexposed endpoint produces NO edge (no hallucinated comms)', () => {
  const g2 = buildApiGraph(ORG).graph;
  // there is no endpoint:DELETE /api/nope; assert nothing calls it
  assert.equal(g2.incoming('endpoint:DELETE /api/nope').length, 0);
});
check('auth-lib (a library) exposes no endpoints', () => {
  assert.equal(graph.outgoing('repo:auth-lib', 'EXPOSES').length, 0);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
console.log(`  summary: ${routes.length} routes, ${calls.length} matched calls, ${crossRepoCalls} cross-repo\n`);
process.exit(failures === 0 ? 0 : 1);
