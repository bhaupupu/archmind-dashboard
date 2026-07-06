import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { start } from '../src/server.ts';

const server = await start(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}`;

let failures = 0;
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

console.log('\n▶ auth tests\n');

await check('GET /v1/auth/github/login returns 500 without config', async () => {
  const r = await fetch(`${base}/v1/auth/github/login`, { redirect: 'manual' });
  assert.equal(r.status, 500);
  assert.equal((await r.json() as any).error, 'github_not_configured');
});

await check('GET /v1/auth/github/callback returns 400 missing code', async () => {
  const r = await fetch(`${base}/v1/auth/github/callback`, { redirect: 'manual' });
  assert.equal(r.status, 400);
  assert.equal((await r.json() as any).error, 'missing_code');
});

console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
server.close();
process.exit(failures === 0 ? 0 : 1);
