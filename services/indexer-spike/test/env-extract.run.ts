/**
 * Env-extraction gate tests — proves REFERENCES_ENV edges + EnvVar nodes and the
 * cross-repo config-coupling detection (docs/03). Pure, offline.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildEnvGraph, extractEnvRefs } from '../src/extractors/env.ts';

const ORG = resolve(import.meta.dirname, '../../../fixtures/sample-org');

let failures = 0;
function check(name: string, fn: () => void): void {
  try { fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ env-extract tests\n');

check('extractEnvRefs finds JS and Python env references', () => {
  const js = extractEnvRefs(`const a = process.env.DATABASE_URL; const b = process.env['REDIS_URL'];`);
  assert.deepEqual(js.map((r) => r.name).sort(), ['DATABASE_URL', 'REDIS_URL']);
  const py = extractEnvRefs(`x = os.getenv('API_KEY'); y = os.environ['PORT']`);
  assert.deepEqual(py.map((r) => r.name).sort(), ['API_KEY', 'PORT']);
});

const { graph, refs, sharedEnvVars } = buildEnvGraph(ORG);

check('EnvVar nodes are created for referenced vars', () => {
  const jwt = graph.getNode('env:JWT_SECRET');
  assert.ok(jwt && jwt.type === 'EnvVar', 'no JWT_SECRET EnvVar node');
});
check('REFERENCES_ENV edges connect repos to env vars with evidence', () => {
  const authRefs = graph.outgoing('repo:auth-lib', 'REFERENCES_ENV');
  assert.ok(authRefs.length >= 1, 'auth-lib references no env vars');
  assert.ok(authRefs.every((e) => e.evidence[0]?.path.includes('config')), 'missing config-file evidence');
});
check('JWT_SECRET is detected as a cross-repo config coupling', () => {
  const jwt = sharedEnvVars.find((s) => s.name === 'JWT_SECRET');
  assert.ok(jwt, 'JWT_SECRET not flagged as shared');
  assert.deepEqual(jwt.repos, ['auth-lib', 'billing-svc'], `wrong sharing set: ${jwt.repos}`);
});
check('the shared EnvVar node carries both repos in repoIds (ACL/serving)', () => {
  const jwt = graph.getNode('env:JWT_SECRET')!;
  assert.deepEqual([...jwt.repoIds].sort(), ['auth-lib', 'billing-svc']);
});
check('a repo-local env var (PORT) is NOT flagged as shared', () => {
  assert.ok(!sharedEnvVars.some((s) => s.name === 'PORT'), 'PORT wrongly flagged as shared');
  const port = graph.getNode('env:PORT')!;
  assert.deepEqual(port.repoIds, ['web-app']);
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
console.log(`  summary: ${refs.length} env refs, ${sharedEnvVars.length} shared (${sharedEnvVars.map((s) => s.name).join(', ')})\n`);
process.exit(failures === 0 ? 0 : 1);
