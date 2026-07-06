/**
 * Datastore-extraction gate tests — Table nodes, READS/WRITES edges, and the
 * shared-schema (SHARES_SCHEMA) cross-repo coupling detection (docs/03). Offline.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildDatastoreGraph, extractTableAccess } from '../src/extractors/datastore.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ datastore-extract tests\n');

check('extractTableAccess classifies reads and writes', () => {
  const a = extractTableAccess(`SELECT id FROM users; INSERT INTO orders (x) VALUES (1); UPDATE users SET y=1; DELETE FROM carts WHERE z=2;`);
  const byTable = new Map(a.map((x) => [`${x.access} ${x.table}`, true]));
  assert.ok(byTable.has('READS users'), 'no READS users');
  assert.ok(byTable.has('WRITES orders'), 'no WRITES orders');
  assert.ok(byTable.has('WRITES users'), 'no WRITES users');
  assert.ok(byTable.has('WRITES carts'), 'no WRITES carts');
});

const { graph, accesses, sharedTables } = buildDatastoreGraph(ORG);

check('Table nodes are created for accessed tables', () => {
  const users = graph.getNode('table:users');
  assert.ok(users && users.type === 'Table', 'no users Table node');
});
check('web-app READS users; billing-svc WRITES users and invoices', () => {
  assert.ok(graph.outgoing('repo:web-app', 'READS').some((e) => e.dstId === 'table:users'), 'web-app not reading users');
  assert.ok(graph.outgoing('repo:billing-svc', 'WRITES').some((e) => e.dstId === 'table:users'), 'billing not writing users');
  assert.ok(graph.outgoing('repo:billing-svc', 'WRITES').some((e) => e.dstId === 'table:invoices'), 'billing not writing invoices');
});
check('users is detected as a cross-repo schema coupling', () => {
  const users = sharedTables.find((s) => s.table === 'users');
  assert.ok(users, 'users not flagged as shared');
  assert.deepEqual(users.repos, ['billing-svc', 'web-app']);
});
check('SHARES_SCHEMA edge connects web-app and billing-svc', () => {
  assert.ok(graph.outgoing('repo:web-app', 'SHARES_SCHEMA').some((e) => e.dstId === 'repo:billing-svc'), 'no SHARES_SCHEMA edge');
});
check('a repo-local table (invoices) is NOT shared', () => {
  assert.ok(!sharedTables.some((s) => s.table === 'invoices'), 'invoices wrongly shared');
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
console.log(`  summary: ${accesses.length} table accesses, shared: ${sharedTables.map((s) => s.table).join(', ') || 'none'}\n`);
process.exit(failures === 0 ? 0 : 1);
