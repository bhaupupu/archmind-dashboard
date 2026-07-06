/**
 * API gate tests — boots the server on an ephemeral port and exercises every
 * endpoint, including the SSE analysis stream. Zero external deps (global fetch).
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { start } from '../src/server.ts';
import type { ImpactReport } from '../../../packages/shared-types/src/index.ts';
import { ingestRepo } from '../../../services/indexer-spike/src/pipeline.ts';
import { buildOrgGraph } from '../../../services/indexer-spike/src/org.ts';
import { BagOfWordsEmbedder } from '../../../services/indexer-spike/src/embedder.ts';
import { join, resolve } from 'node:path';

const server = await start(0);
await new Promise<void>((r) => server.once('listening', () => r()));
const port = (server.address() as AddressInfo).port;
const base = `http://127.0.0.1:${port}`;
const ORG = 'fixtures/sample-org';

let failures = 0;
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); console.log(`  ✔ ${name}`); }
  catch (err) { failures++; console.log(`  ✗ ${name}\n      ${(err as Error).message}`); }
}

const ORG_PATH = resolve(import.meta.dirname, '../../../fixtures/sample-org');
const { repos } = buildOrgGraph(ORG_PATH);
const embedder = new BagOfWordsEmbedder();
for (const r of repos) {
  await ingestRepo(join(ORG_PATH, r), { repoId: r, commit: 'WORKINGDIR', embedder });
}

console.log('\n▶ api tests\n');

await check('GET /health returns ok', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
});

await check('GET /v1/repos lists org repos', async () => {
  const r = await fetch(`${base}/v1/repos?org=${ORG}`);
  const body = await r.json() as { repos: string[] };
  assert.deepEqual([...body.repos].sort(), ['auth-lib', 'billing-svc', 'web-app']);
});

await check('GET /v1/graph returns nodes and edges', async () => {
  const r = await fetch(`${base}/v1/graph?org=${ORG}`);
  const g = await r.json() as { nodes: unknown[]; edges: unknown[] };
  assert.ok(g.nodes.length >= 3 && g.edges.length >= 2);
});

let analysisId = '';
await check('POST /v1/analyses returns an evidence-linked report', async () => {
  const r = await fetch(`${base}/v1/analyses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'jsonwebtoken', org: ORG }),
  });
  assert.equal(r.status, 201);
  const report = await r.json() as ImpactReport;
  analysisId = report.analysisId;
  const byRepo = new Map(report.affectedRepos.map((f) => [f.repoId, f.disposition]));
  assert.equal(byRepo.get('auth-lib'), 'must_change');
  assert.equal(byRepo.get('web-app'), 'may_change');
  assert.equal(byRepo.get('billing-svc'), 'may_change');
});

await check('POST /v1/analyses mode=agent runs the agent pipeline', async () => {
  const r = await fetch(`${base}/v1/analyses`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'jsonwebtoken', org: ORG, mode: 'agent' }),
  });
  assert.equal(r.status, 201);
  const report = await r.json() as ImpactReport;
  const byRepo = new Map(report.affectedRepos.map((f) => [f.repoId, f.disposition]));
  assert.equal(byRepo.get('auth-lib'), 'must_change');
  assert.equal(byRepo.get('web-app'), 'may_change');
});

await check('GET /v1/analyses/:id returns the stored report', async () => {
  const r = await fetch(`${base}/v1/analyses/${analysisId}`);
  assert.equal(r.status, 200);
  assert.equal((await r.json() as ImpactReport).analysisId, analysisId);
});

await check('POST /v1/analyses streams data-only SSE frames the dashboard can parse', async () => {
  const r = await fetch(`${base}/v1/analyses`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ prompt: 'jsonwebtoken', org: ORG }),
  });
  assert.ok(r.headers.get('content-type')?.includes('text/event-stream'), 'not an SSE response');
  const text = await r.text();
  // Mirror apps/web page.tsx: split on blank line, take frames starting with "data: ".
  const frames = text.split('\n\n').filter((f) => f.startsWith('data: ')).map((f) => f.slice(6));
  assert.ok(frames.length > 0, 'no data: frames');
  const stages = frames.filter((f) => f !== '[DONE]').map((f) => { try { return JSON.parse(f).stage; } catch { return null; } });
  assert.ok(stages.includes('started') && stages.includes('complete'), `missing stages: ${stages}`);
  const reportFrame = frames.find((f) => f !== '[DONE]' && JSON.parse(f).report);
  assert.ok(reportFrame, 'missing final report frame');
  assert.ok(frames[frames.length - 1] === '[DONE]', 'missing [DONE] sentinel');
});

await check('GET /v1/prompt-history records prompts per tenant', async () => {
  const r = await fetch(`${base}/v1/prompt-history`, { headers: { 'x-tenant-id': 'default' } });
  const body = await r.json() as { items: { prompt: string }[] };
  assert.ok(body.items.some((p) => p.prompt === 'jsonwebtoken'));
});

// Tests for static serving removed (Dashboard is now served via Next.js in apps/web)

await check('unknown route returns 404', async () => {
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});

server.close();
console.log(`\n${failures === 0 ? '✔ all passed' : `✗ ${failures} failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
